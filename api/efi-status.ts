import { createClient } from '@supabase/supabase-js';
import { getChargeStatus } from '../lib/efi-service';

const getSupabaseServerClient = () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
};

/**
 * Recria reservas pagas a partir de efi_transactions quando a reservation expirou
 * antes do webhook/polling chegar. Nunca sobrescreve número já pago por outro comprador.
 */
async function recoverLostReservations(
    supabase: ReturnType<typeof getSupabaseServerClient>,
    txid: string,
    paidAt: string
): Promise<number> {
    const { data: tx } = await supabase
        .from('efi_transactions')
        .select('raffle_id, numbers_json, buyer_name, buyer_phone, buyer_email, amount')
        .eq('txid', txid)
        .maybeSingle();

    if (!tx?.numbers_json || !tx.raffle_id) return 0;

    let numbers: string[] = [];
    try { numbers = JSON.parse(tx.numbers_json); } catch { return 0; }
    if (!numbers.length) return 0;

    const pricePerNumber = (tx.amount || 0) / numbers.length;
    let recovered = 0;

    for (const number of numbers) {
        const { data: existing } = await supabase
            .from('reservations')
            .select('id, status, efi_txid')
            .eq('raffle_id', tx.raffle_id)
            .eq('number', String(number))
            .maybeSingle();

        // Nunca sobrescrever número já pago por OUTRO comprador
        if (existing?.status === 'paid' && existing.efi_txid !== txid) {
            console.error(`🚨 [Efi Status] Número ${number} já pago por outro comprador. Bloqueando.`);
            continue;
        }

        if (existing?.status === 'paid' && existing.efi_txid === txid) {
            recovered++; // já ok
            continue;
        }

        if (existing) {
            const { error } = await supabase.from('reservations').update({
                buyer_name: tx.buyer_name,
                buyer_phone: tx.buyer_phone || '',
                buyer_email: tx.buyer_email || '',
                status: 'paid',
                payment_amount: pricePerNumber,
                payment_method: 'efi',
                efi_txid: txid,
                expires_at: null,
                updated_at: new Date().toISOString(),
            }).eq('id', existing.id).neq('status', 'paid');
            if (!error) recovered++;
        } else {
            const { error } = await supabase.from('reservations').insert({
                raffle_id: tx.raffle_id,
                number: String(number),
                buyer_name: tx.buyer_name || '',
                buyer_phone: tx.buyer_phone || '',
                buyer_email: tx.buyer_email || '',
                status: 'paid',
                payment_amount: pricePerNumber,
                payment_method: 'efi',
                efi_txid: txid,
                expires_at: null,
                updated_at: new Date().toISOString(),
            });
            if (!error) recovered++;
        }
    }

    if (recovered > 0) {
        await supabase.from('efi_transactions').update({
            status: 'CONCLUIDA',
            paid_at: paidAt,
            updated_at: new Date().toISOString(),
        }).eq('txid', txid);
    }

    return recovered;
}

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { txid } = req.query;

        if (!txid || typeof txid !== 'string') {
            return res.status(400).json({ error: 'txid is required' });
        }

        console.log('🔍 [API Efi Status] Consultando status:', txid);

        const status = await getChargeStatus(txid);

        // ════════════════════════════════════════════════════════════════════════
        // Se CONCLUIDA: confirmar via RPC atômica + recovery de reservas perdidas.
        // Garante que o número SEMPRE fica gravado no nome do comprador,
        // mesmo que a reservation tenha expirado antes do webhook chegar.
        // ════════════════════════════════════════════════════════════════════════
        if (status.status === 'CONCLUIDA') {
            try {
                const supabase = getSupabaseServerClient();
                const paidAt = status.paidAt || new Date().toISOString();

                // 1. Tentar via RPC atômica e idempotente
                let { data: confirmResult, error: confirmErr } = await supabase.rpc(
                    'confirm_efi_payment',
                    { p_txid: txid, p_paid_at: paidAt }
                );

                // Fallback para assinatura antiga
                if (confirmErr) {
                    const fallback = await supabase.rpc('update_efi_transaction_status', {
                        p_txid: txid,
                        p_status: 'CONCLUIDA',
                        p_paid_at: paidAt,
                        p_event: { timestamp: new Date().toISOString(), source: 'polling' },
                    });
                    confirmResult = fallback.data;
                    confirmErr = fallback.error;
                }

                if (confirmErr) {
                    console.warn('⚠️ [API Efi Status] RPC indisponível, usando recovery direto:', confirmErr.message);
                }

                // 2. Verificar se números foram gravados — se não, recriar (reservation expirou)
                const { count: paidCount } = await supabase
                    .from('reservations')
                    .select('id', { count: 'exact', head: true })
                    .eq('efi_txid', txid)
                    .eq('status', 'paid');

                if ((paidCount || 0) === 0) {
                    console.warn(`⚠️ [API Efi Status] txid ${txid} CONCLUIDA mas sem reservas pagas. Executando recovery...`);
                    const recovered = await recoverLostReservations(supabase, txid, paidAt);
                    console.log(`🔧 [API Efi Status] Recovery concluído para ${txid}: ${recovered} números gravados.`);
                } else {
                    console.log(`✅ [API Efi Status] Pagamento ${txid} confirmado (${paidCount} reservas pagas).`);
                }
            } catch (dbErr: any) {
                console.error('⚠️ [API Efi Status] Erro ao sincronizar status no banco:', dbErr.message);
            }
        }

        return res.status(200).json({
            success: true,
            ...status,
        });
    } catch (error: any) {
        console.error('❌ [API Efi Status] Erro:', error);
        return res.status(500).json({
            error: error.message || 'Erro ao consultar status',
        });
    }
}
