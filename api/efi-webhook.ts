import { createClient } from '@supabase/supabase-js';
import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

// Supabase client para serverless (usa process.env ao invés de import.meta.env)
const getSupabase = () => {
    const url = process.env.VITE_SUPABASE_URL || '';
    const key = process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
};

// EFI client
const getEfiClient = () => {
    return new EfiPay({
        sandbox: process.env.EFI_SANDBOX === 'true',
        client_id: process.env.EFI_CLIENT_ID || '',
        client_secret: process.env.EFI_CLIENT_SECRET || '',
        certificate: (process.env.EFI_CERTIFICATE_BASE64 || '').trim(),
        cert_base64: true,
        validateMtls: false,
    });
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // OPTIONS - Preflight CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GET ou PUT - Verificação do webhook pela EFI
    if (req.method === 'GET' || req.method === 'PUT') {
        console.log('✅ [Webhook Efi] Verificação recebida (método:', req.method, ')');
        return res.status(200).json({ status: 'ok', webhook: 'active' });
    }

    // POST - Notificação de pagamento
    if (req.method !== 'POST') {
        return res.status(200).json({ status: 'ok' });
    }

    try {
        const payload = req.body;

        console.log('🔔 [Webhook Efi] Recebido:', JSON.stringify(payload));

        // Se payload está vazio ou é uma verificação, retornar OK
        if (!payload || Object.keys(payload).length === 0) {
            console.log('✅ [Webhook Efi] Payload vazio - verificação da EFI');
            return res.status(200).json({ status: 'ok' });
        }

        // Validar se é um webhook PIX
        if (!payload.pix && !payload.pixQrcode) {
            console.log('⚠️ [Webhook Efi] Payload não é PIX, retornando OK');
            return res.status(200).json({ status: 'ok', message: 'payload recebido' });
        }

        // Extrair txids do payload
        const txids: string[] = [];
        if (payload.pix) {
            payload.pix.forEach((pix: any) => {
                if (pix.txid) {
                    txids.push(pix.txid);
                }
            });
        }

        console.log('📝 [Webhook Efi] TXIDs a processar:', txids);

        const supabase = getSupabase();
        const efipay = getEfiClient();

        // Processar cada txid
        for (const txid of txids) {
            try {
                // Consultar status atualizado na Efi
                const response = await efipay.pixDetailCharge({ txid });
                const status = response.status;
                const paidAt = response.pix?.[0]?.horario || null;

                console.log('🔍 [Webhook Efi] Status do txid', txid, ':', status);

                // Atualizar transação no banco via RPC
                const { error: transactionError } = await supabase.rpc('update_efi_transaction_status', {
                    p_txid: txid,
                    p_status: status,
                    p_paid_at: paidAt || '',
                    p_event: {
                        timestamp: new Date().toISOString(),
                        payload: payload,
                    },
                });

                if (transactionError) {
                    console.error('❌ [Webhook Efi] Erro RPC:', transactionError);
                }

                // Se pago, atualizar reservas para 'paid'
                if (status === 'CONCLUIDA') {
                    console.log('💰 [Webhook Efi] Pagamento confirmado! Atualizando reservas...');

                    const { error: reservationsError } = await supabase
                        .from('reservations')
                        .update({
                            status: 'paid',
                            efi_status: 'CONCLUIDA',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('efi_txid', txid);

                    if (reservationsError) {
                        console.error('❌ [Webhook Efi] Erro ao atualizar reservas:', reservationsError);
                    } else {
                        console.log('✅ [Webhook Efi] Reservas atualizadas para PAID');
                    }
                }
            } catch (error: any) {
                console.error('❌ [Webhook Efi] Erro ao processar txid', txid, ':', error);
            }
        }

        return res.status(200).json({ success: true, processed: txids.length });
    } catch (error: any) {
        console.error('❌ [Webhook Efi] Erro geral:', error);
        return res.status(200).json({ status: 'ok' });
    }
}
