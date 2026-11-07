import { getChargeStatus } from '../lib/efi-service';
import { createClient } from '@supabase/supabase-js';
import { confirmPaymentInDatabase } from '../lib/efi-payment-confirm';

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
        // CORREÇÃO DEFINITIVA (20/09/2026):
        // Se CONCLUIDA, usa a RPC atômica confirm_payment_by_txid() via
        // update_efi_transaction_status(). Igual ao webhook.
        //
        // NÃO usa mais UPSERT genérico que sobrescrevia buyer_name.
        // NÃO recria reservas — apenas confirma as que já existem com este txid.
        // ════════════════════════════════════════════════════════════════════════
        if (status.status === 'CONCLUIDA') {
            try {
                const supabase = createClient(
                    process.env.VITE_SUPABASE_URL || '',
                    process.env.VITE_SUPABASE_ANON_KEY || ''
                );

                const confirmResult = await confirmPaymentInDatabase(
                    supabase,
                    txid,
                    'CONCLUIDA',
                    status.paidAt || new Date().toISOString(),
                    { source: 'polling' }
                );

                if (confirmResult.success) {
                    console.log(`✅ [API Efi Status] Pagamento ${txid} confirmado e sincronizado via polling`);
                } else {
                    console.error('⚠️ [API Efi Status] Falha ao sincronizar via polling:', confirmResult.error);
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
