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
                    console.error(`⚠️ [Webhook Efi] Erro RPC para ${txid}:`, transactionError);

                    // Fallback: Atualização direta na tabela
                    console.log(`🔄 [Webhook Efi] Tentando atualização direta na tabela para ${txid}`);
                    await supabase
                        .from('efi_transactions')
                        .update({
                            status: status,
                            paid_at: paidAt || null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('txid', txid);
                }

                // ════════════════════════════════════════════════════════════════
                // Se pago, atualizar reservas para 'paid'
                // ════════════════════════════════════════════════════════════════
                if (status === 'CONCLUIDA') {
                    console.log(`💰 [Webhook Efi] Pagamento CONFIRMADO para ${txid}! Atualizando reservas...`);

                    // 1. Buscar dados da transação para ter nome e telefone reais
                    const { data: txInfo } = await supabase
                        .from('efi_transactions')
                        .select('raffle_id, buyer_name, buyer_phone, buyer_email, amount, numbers_json')
                        .eq('txid', txid)
                        .single();

                    const updateFields: any = {
                        status: 'paid',
                        expires_at: null, // Limpa expiração para o cleanup não tocar
                        updated_at: new Date().toISOString(),
                    };
                    if (txInfo?.buyer_name) updateFields.buyer_name = txInfo.buyer_name;
                    if (txInfo?.buyer_phone) updateFields.buyer_phone = txInfo.buyer_phone;

                    let updateSucceeded = false;

                    try {
                        const { data: updatedReservations, error: reservationsError } = await supabase
                            .from('reservations')
                            .update(updateFields)
                            .eq('efi_txid', txid)
                            .neq('status', 'paid')
                            .select();

                        if (!reservationsError && updatedReservations && updatedReservations.length > 0) {
                            console.log(`✅ [Webhook Efi] ${updatedReservations.length} reserva(s) marcada(s) como PAID para ${txid}`);
                            updateSucceeded = true;
                        } else if (reservationsError) {
                            console.warn(`⚠️ [Webhook Efi] Update normal falhou para ${txid} (${reservationsError.message}). Acionando RECOVERY direto...`);
                        }
                    } catch (e: any) {
                        console.warn(`⚠️ [Webhook Efi] Exceção no update normal para ${txid}:`, e.message);
                    }

                    if (!updateSucceeded) {
                        // ════════════════════════════════════════════════════════
                        // 🔄 RECOVERY DEFINITIVO: Garante que o pagamento recebido
                        // na EFI SEMPRE seja gravado como PAGO no banco.
                        // ════════════════════════════════════════════════════════
                        console.log(`🔄 [Webhook Efi] Executando RECOVERY DEFINITIVO para txid ${txid}...`);

                        try {
                            // Buscar dados da transação original
                            const { data: txData, error: txLookupError } = await supabase
                                .from('efi_transactions')
                                .select('raffle_id, buyer_name, buyer_phone, buyer_email, amount, numbers_json')
                                .eq('txid', txid)
                                .single();

                            if (txLookupError || !txData) {
                                console.error(`❌ [Webhook Efi] Recovery FALHOU: transação ${txid} não encontrada em efi_transactions`);
                            } else if (!txData.numbers_json) {
                                console.error(`❌ [Webhook Efi] Recovery FALHOU: transação ${txid} não tem numbers_json (transação antiga, anterior à correção)`);
                            } else {
                                const rawNumbers: string[] = JSON.parse(txData.numbers_json);
                                const numbers: string[] = Array.from(new Set((rawNumbers || []).map((n: any) => String(n).trim()))).filter(Boolean);
                                console.log(`🔄 [Webhook Efi] Recovery: tentando recriar ${numbers.length} reserva(s) para "${txData.buyer_name}": [${numbers.join(', ')}]`);

                                // Verificar quais números já estão ocupados por OUTRO comprador
                                const { data: existing } = await supabase
                                    .from('reservations')
                                    .select('number, buyer_name, efi_txid, status')
                                    .eq('raffle_id', txData.raffle_id)
                                    .in('number', numbers);

                                const takenByOthers = new Set(
                                    (existing || [])
                                        .filter((r: any) => {
                                            // Se a reserva tem nosso txid → é nossa
                                            if (r.efi_txid === txid) return false;
                                            // Se está PAGA por outro comprador → conflito real, não sobrescrever
                                            if (r.status === 'paid') return true;
                                            // Se está apenas 'pending' (carrinho não pago) → o pagamento REAL tem prioridade e assume o número!
                                            return false;
                                        })
                                        .map((r: any) => r.number)
                                );

                                const recoverableNumbers = numbers.filter((n: string) => !takenByOthers.has(n));

                                if (takenByOthers.size > 0) {
                                    console.error(`⚠️ [Webhook Efi] CONFLITO no recovery: números [${[...takenByOthers].join(', ')}] já ocupados por outro comprador. Esses NÃO serão sobrescritos.`);
                                }

                                if (recoverableNumbers.length > 0) {
                                    const reservationsToCreate = recoverableNumbers.map((num: string) => ({
                                        raffle_id: txData.raffle_id,
                                        number: num,
                                        buyer_name: txData.buyer_name,
                                        buyer_phone: txData.buyer_phone || '',
                                        buyer_email: txData.buyer_email || '',
                                        status: 'paid',
                                        payment_amount: txData.amount / numbers.length,
                                        payment_method: 'efi',
                                        efi_txid: txid,
                                        expires_at: null, // Pago → sem expiração
                                        updated_at: new Date().toISOString(),
                                    }));

                                    const { data: recovered, error: recoverError } = await supabase
                                        .from('reservations')
                                        .upsert(reservationsToCreate, { onConflict: 'raffle_id,number' })
                                        .select();

                                    if (recoverError) {
                                        console.error(`❌ [Webhook Efi] Erro no recovery UPSERT:`, recoverError);
                                    } else {
                                        console.log(`✅ [Webhook Efi] RECOVERY SUCESSO: ${recovered?.length || 0} reserva(s) RECUPERADA(S) para txid ${txid} (${txData.buyer_name})`);
                                    }
                                } else {
                                    console.error(`❌ [Webhook Efi] Recovery impossível: todos os ${numbers.length} números já ocupados por outros compradores`);
                                }
                            }
                        } catch (recoveryError: any) {
                            console.error(`❌ [Webhook Efi] Exceção no recovery para ${txid}:`, recoveryError.message);
                        }
                    }
                } else {
                    // Atualizar efi_status mesmo que não seja CONCLUIDA
                    await supabase
                        .from('reservations')
                        .update({
                            efi_status: status,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('efi_txid', txid);
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
