/**
 * /api/efi-recover
 *
 * API de RECUPERAÇÃO de pagamentos perdidos.
 * Varre todas as efi_transactions com status CONCLUIDA que NÃO têm
 * reservas pagas correspondentes e recria essas reservas.
 *
 * Uso:
 *   POST /api/efi-recover              → varre todas as rifas
 *   POST /api/efi-recover?raffle_id=X  → apenas uma rifa
 *   POST /api/efi-recover?txid=Y       → apenas um txid específico
 *
 * Requer header: x-admin-key: <ADMIN_PASSWORD>
 */
import { createClient } from '@supabase/supabase-js';

type VercelRequest = any;
type VercelResponse = any;

const getSupabase = () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
};

async function recoverTransaction(
    supabase: ReturnType<typeof getSupabase>,
    tx: { txid: string; raffle_id: string; numbers_json: string; buyer_name: string; buyer_phone: string; buyer_email: string; amount: number; paid_at: string | null }
): Promise<{ txid: string; recovered: number; skipped: number; alreadyPaid: number }> {
    let numbers: string[] = [];
    try { numbers = JSON.parse(tx.numbers_json); } catch { return { txid: tx.txid, recovered: 0, skipped: 1, alreadyPaid: 0 }; }

    const pricePerNumber = (tx.amount || 0) / (numbers.length || 1);
    let recovered = 0, skipped = 0, alreadyPaid = 0;

    for (const number of numbers) {
        const { data: existing } = await supabase
            .from('reservations')
            .select('id, status, efi_txid, buyer_name')
            .eq('raffle_id', tx.raffle_id)
            .eq('number', String(number))
            .maybeSingle();

        // Já pago pelo mesmo txid — ok
        if (existing?.status === 'paid' && existing.efi_txid === tx.txid) {
            alreadyPaid++;
            continue;
        }

        // Pago por outro comprador — proteger, não sobrescrever
        if (existing?.status === 'paid' && existing.efi_txid !== tx.txid) {
            console.error(`🚨 [Recovery] Número ${number} (rifa ${tx.raffle_id}) já pago por ${existing.buyer_name} (txid: ${existing.efi_txid}). Mantendo dono original.`);
            skipped++;
            continue;
        }

        const payload = {
            buyer_name: tx.buyer_name || '',
            buyer_phone: tx.buyer_phone || '',
            buyer_email: tx.buyer_email || '',
            status: 'paid' as const,
            payment_amount: pricePerNumber,
            payment_method: 'efi' as const,
            efi_txid: tx.txid,
            expires_at: null,
            updated_at: new Date().toISOString(),
        };

        if (existing) {
            const { error } = await supabase.from('reservations').update(payload).eq('id', existing.id).neq('status', 'paid');
            if (!error) { recovered++; console.log(`✅ [Recovery] Atualizado número ${number} → ${tx.buyer_name} (txid: ${tx.txid})`); }
            else { skipped++; console.error(`❌ [Recovery] Erro ao atualizar número ${number}:`, error); }
        } else {
            const { error } = await supabase.from('reservations').insert({
                raffle_id: tx.raffle_id,
                number: String(number),
                ...payload,
            });
            if (!error) { recovered++; console.log(`✅ [Recovery] Inserido número ${number} → ${tx.buyer_name} (txid: ${tx.txid})`); }
            else { skipped++; console.error(`❌ [Recovery] Erro ao inserir número ${number}:`, error); }
        }
    }

    return { txid: tx.txid, recovered, skipped, alreadyPaid };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Autenticação simples
    const adminKey = req.headers['x-admin-key'];
    const adminPassword = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '';
    if (!adminKey || adminKey !== adminPassword) {
        return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
        const supabase = getSupabase();
        const { txid: queryTxid, raffle_id: queryRaffleId } = req.query;

        let query = supabase
            .from('efi_transactions')
            .select('txid, raffle_id, numbers_json, buyer_name, buyer_phone, buyer_email, amount, paid_at')
            .eq('status', 'CONCLUIDA')
            .not('numbers_json', 'is', null);

        if (queryTxid) query = query.eq('txid', String(queryTxid));
        if (queryRaffleId) query = query.eq('raffle_id', String(queryRaffleId));

        const { data: transactions, error: txErr } = await query;

        if (txErr) return res.status(500).json({ error: 'Erro ao buscar transações', details: txErr.message });
        if (!transactions?.length) return res.status(200).json({ message: 'Nenhuma transação CONCLUIDA encontrada', recovered: 0 });

        const results = [];
        let totalRecovered = 0, totalSkipped = 0, totalAlreadyOk = 0;

        for (const tx of transactions) {
            // Verificar se já tem reservas pagas com este txid
            const { count: paidCount } = await supabase
                .from('reservations')
                .select('id', { count: 'exact', head: true })
                .eq('efi_txid', tx.txid)
                .eq('status', 'paid');

            let numbersCount = 0;
            try { numbersCount = JSON.parse(tx.numbers_json || '[]').length; } catch {}

            if ((paidCount || 0) >= numbersCount && numbersCount > 0) {
                totalAlreadyOk++;
                continue; // Tudo ok, pular
            }

            // Tem pagamento perdido — recuperar
            console.log(`🔍 [Recovery] Processando txid ${tx.txid} (${paidCount}/${numbersCount} reservas pagas)`);
            const result = await recoverTransaction(supabase, tx);
            results.push(result);
            totalRecovered += result.recovered;
            totalSkipped += result.skipped;
        }

        return res.status(200).json({
            success: true,
            totalTransactionsChecked: transactions.length,
            totalAlreadyOk,
            totalRecovered,
            totalSkipped,
            details: results,
        });

    } catch (error: any) {
        console.error('❌ [Recovery] Erro geral:', error);
        return res.status(500).json({ error: error.message });
    }
}
