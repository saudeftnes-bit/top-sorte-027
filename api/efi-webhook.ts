import { createClient } from '@supabase/supabase-js';
import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

// Supabase client para serverless
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

/**
 * Confirma pagamento EFI: atualiza reservas existentes ou as RECRIA a partir de efi_transactions.
 * Retorna o número de reservas confirmadas.
 */
async function confirmEfiPayment(
    supabase: ReturnType<typeof getSupabase>,
    txid: string,
    paidAt: string | null
): Promise<number> {
    // 1. Tentar atualizar reservas existentes (caso não tenham sido deletadas pelo cleanup)
    const { data: updatedReservations, error: updateError } = await supabase
        .from('reservations')
        .update({
            status: 'paid',
            expires_at: null, // Remove expiração para o cleanup nunca deletar
            updated_at: new Date().toISOString(),
        })
        .eq('efi_txid', txid)
        .select();

    if (updateError) {
        console.error(`❌ [Webhook Efi] Erro ao atualizar reservas para ${txid}:`, updateError);
    }

    const updatedCount = updatedReservations?.length || 0;

    if (updatedCount > 0) {
        console.log(`✅ [Webhook Efi] ${updatedCount} reserva(s) atualizada(s) para PAID (txid: ${txid})`);

        // Atualizar transação
        await supabase
            .from('efi_transactions')
            .update({
                status: 'CONCLUIDA',
                paid_at: paidAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('txid', txid);

        return updatedCount;
    }

    // 2. FALLBACK: reservas foram deletadas pelo cleanup — recriá-las a partir de efi_transactions
    console.warn(`⚠️ [Webhook Efi] Nenhuma reserva encontrada para ${txid}. Buscando em efi_transactions para recriar...`);

    const { data: transaction, error: txError } = await supabase
        .from('efi_transactions')
        .select('*')
        .eq('txid', txid)
        .single();

    if (txError || !transaction) {
        console.error(`❌ [Webhook Efi] Transação não encontrada para txid ${txid}:`, txError);
        return 0;
    }

    const numbersJson = transaction.numbers_json;
    if (!numbersJson) {
        console.error(`❌ [Webhook Efi] numbers_json vazio para txid ${txid}`);
        // Atualizar status da transação mesmo sem recriar reservas
        await supabase
            .from('efi_transactions')
            .update({
                status: 'CONCLUIDA',
                paid_at: paidAt || new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('txid', txid);
        return 0;
    }

    let numbers: string[];
    try {
        numbers = JSON.parse(numbersJson);
    } catch (e) {
        console.error(`❌ [Webhook Efi] Erro ao parsear numbers_json para ${txid}:`, e);
        return 0;
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
        console.error(`❌ [Webhook Efi] numbers_json inválido para ${txid}:`, numbers);
        return 0;
    }

    console.log(`🔄 [Webhook Efi] Recriando ${numbers.length} reservas como PAID para txid ${txid}...`);

    const pricePerNumber = (transaction.amount || 0) / numbers.length;
    let recreatedCount = 0;

    for (const number of numbers) {
        const { error: upsertError } = await supabase
            .from('reservations')
            .upsert(
                {
                    raffle_id: transaction.raffle_id,
                    number: String(number),
                    buyer_name: transaction.buyer_name || '',
                    buyer_phone: transaction.buyer_phone || '',
                    buyer_email: transaction.buyer_email || '',
                    status: 'paid',
                    payment_amount: pricePerNumber,
                    payment_method: 'efi',
                    efi_txid: txid,
                    expires_at: null,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: 'raffle_id,number',
                    ignoreDuplicates: false,
                }
            );

        if (upsertError) {
            console.error(`❌ [Webhook Efi] Erro ao recriar reserva número ${number} para ${txid}:`, upsertError);
        } else {
            recreatedCount++;
        }
    }

    // Atualizar status da transação
    await supabase
        .from('efi_transactions')
        .update({
            status: 'CONCLUIDA',
            paid_at: paidAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('txid', txid);

    console.log(`✅ [Webhook Efi] ${recreatedCount}/${numbers.length} reservas RECRIADAS como PAID para txid ${txid}`);
    return recreatedCount;
}

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

                // Fallback direto na tabela (RPC pode não existir)
                await supabase
                    .from('efi_transactions')
                    .update({
                        status: status,
                        paid_at: paidAt || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('txid', txid);

                // Se pago, confirmar reservas (atualizar ou recriar)
                if (status === 'CONCLUIDA') {
                    console.log(`💰 [Webhook Efi] Pagamento CONFIRMADO para ${txid}! Confirmando reservas...`);
                    const confirmed = await confirmEfiPayment(supabase, txid, paidAt);
                    console.log(`✅ [Webhook Efi] Total de reservas confirmadas para ${txid}: ${confirmed}`);
                } else {
                    // Atualizar efi_status mesmo que não seja CONCLUIDA
                    await supabase
                        .from('reservations')
                        .update({
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
