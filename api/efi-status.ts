import { getChargeStatus } from '../lib/efi-service';

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
        // DUPLA REDUNDÂNCIA: Se status é CONCLUIDA, confirma no banco imediatamente
        // (Garante que se o webhook atrasar, a consulta ativa já crava como PAGO)
        // ════════════════════════════════════════════════════════════════════════
        if (status.status === 'CONCLUIDA') {
            try {
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                    process.env.VITE_SUPABASE_URL || '',
                    process.env.VITE_SUPABASE_ANON_KEY || ''
                );

                // 1. Buscar dados da transação
                const { data: txData } = await supabase
                    .from('efi_transactions')
                    .select('raffle_id, buyer_name, buyer_phone, buyer_email, amount, numbers_json')
                    .eq('txid', txid)
                    .single();

                // 2. Atualizar transação para CONCLUIDA
                await supabase
                    .from('efi_transactions')
                    .update({
                        status: 'CONCLUIDA',
                        paid_at: status.paidAt || new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('txid', txid);

                // 3. Atualizar/Gravar TODOS os números comprados diretamente para 'paid'
                if (txData?.numbers_json) {
                    const rawNumbers: string[] = JSON.parse(txData.numbers_json);
                    const numbers = Array.from(new Set(rawNumbers.map((n: any) => String(n).trim()))).filter((n): n is string => Boolean(n));

                    if (numbers.length > 0) {
                        const reservationsToUpsert = numbers.map((num: string) => ({
                            raffle_id: txData.raffle_id,
                            number: num,
                            buyer_name: txData.buyer_name,
                            buyer_phone: txData.buyer_phone || '',
                            buyer_email: txData.buyer_email || '',
                            status: 'paid',
                            payment_amount: txData.amount / numbers.length,
                            payment_method: 'efi',
                            efi_txid: txid,
                            expires_at: null,
                            updated_at: new Date().toISOString(),
                        }));

                        await supabase
                            .from('reservations')
                            .upsert(reservationsToUpsert, { onConflict: 'raffle_id,number' });
                    }
                } else {
                    const updatePayload: any = {
                        status: 'paid',
                        expires_at: null,
                        updated_at: new Date().toISOString()
                    };
                    if (txData?.buyer_name) updatePayload.buyer_name = txData.buyer_name;
                    if (txData?.buyer_phone) updatePayload.buyer_phone = txData.buyer_phone;

                    await supabase
                        .from('reservations')
                        .update(updatePayload)
                        .eq('efi_txid', txid);
                }
                console.log(`✅ [API Efi Status] Pagamento ${txid} confirmado com dupla redundância!`);
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
