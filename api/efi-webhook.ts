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
                console.log(`🔍 [Webhook Efi] Processando txid: ${txid}`);

                // Consultar status atualizado na Efi
                const response = await efipay.pixDetailCharge({ txid });
                const status = response.status;
                const paidAt = response.pix?.[0]?.horario || null;

                console.log(`📊 [Webhook Efi] Status para ${txid}: ${status}`);

                if (status === 'CONCLUIDA') {
                    console.log(`💰 [Webhook Efi] Pagamento CONFIRMADO para ${txid}! Chamando confirm_payment_by_txid...`);

                    // ════════════════════════════════════════════════════════════
                    // CORREÇÃO DEFINITIVA (20/09/2026):
                    // Usa ÚNICA função atômica confirm_payment_by_txid().
                    // Verifica txid antes de marcar como pago.
                    // NUNCA sobrescreve número já pago por outro comprador.
                    // NUNCA usa UPSERT genérico que sobrescrevia buyer_name.
                    // ════════════════════════════════════════════════════════════
                    const { data: confirmResult, error: confirmErr } = await supabase.rpc(
                        'update_efi_transaction_status',
                        {
                            p_txid:    txid,
                            p_status:  status,
                            p_paid_at: paidAt || '',
                            p_event:   { timestamp: new Date().toISOString(), payload },
                        }
                    );

                    if (confirmErr) {
                        console.error(`❌ [Webhook Efi] Erro ao confirmar pagamento ${txid}:`, confirmErr);
                        // Tentativa de fallback seguro: UPDATE apenas por efi_txid, sem sobrescrever buyer_name
                        const { error: fallbackErr } = await supabase
                            .from('reservations')
                            .update({
                                status:     'paid',
                                expires_at: null,
                                updated_at: new Date().toISOString()
                            })
                            .eq('efi_txid', txid)
                            .neq('status', 'paid');

                        if (fallbackErr) {
                            console.error(`❌ [Webhook Efi] Fallback também falhou para ${txid}:`, fallbackErr);
                        } else {
                            console.log(`✅ [Webhook Efi] Fallback executado para ${txid}`);
                        }
                    } else {
                        console.log(`✅ [Webhook Efi] confirm_payment_by_txid resultado:`, confirmResult);
                    }

                } else {
                    // Apenas atualizar status da transação (não CONCLUIDA)
                    await supabase
                        .from('efi_transactions')
                        .update({
                            status:     status,
                            updated_at: new Date().toISOString()
                        })
                        .eq('txid', txid);

                    // Atualizar efi_status nas reservas (sem tocar em buyer_name ou status)
                    await supabase
                        .from('reservations')
                        .update({
                            efi_status: status,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('efi_txid', txid)
                        .neq('status', 'paid');  // Nunca toca em reservas pagas
                }

            } catch (error: any) {
                console.error(`❌ [Webhook Efi] Erro crítico ao processar txid ${txid}:`, error);
            }
        }

        return res.status(200).json({ success: true, processed: txids.length });
    } catch (error: any) {
        console.error('❌ [Webhook Efi] Erro geral:', error);
        return res.status(200).json({ status: 'ok' });
    }
}
