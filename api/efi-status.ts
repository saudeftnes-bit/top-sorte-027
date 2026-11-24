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
    // 1. Tentar atualizar reservas existentes
    const { data: updatedReservations, error: updateError } = await supabase
        .from('reservations')
        .update({
            status: 'paid',
            expires_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('efi_txid', txid)
        .select();

    if (updateError) {
        console.error(`❌ [Efi Status] Erro ao atualizar reservas para ${txid}:`, updateError);
    }

    const updatedCount = updatedReservations?.length || 0;

    if (updatedCount > 0) {
        console.log(`✅ [Efi Status] ${updatedCount} reserva(s) atualizada(s) para PAID (txid: ${txid})`);

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

    // 2. FALLBACK: reservas foram deletadas — recriar a partir de efi_transactions
    console.warn(`⚠️ [Efi Status] Nenhuma reserva encontrada para ${txid}. Recriando a partir de efi_transactions...`);

    const { data: transaction, error: txError } = await supabase
        .from('efi_transactions')
        .select('*')
        .eq('txid', txid)
        .single();

    if (txError || !transaction) {
        console.error(`❌ [Efi Status] Transação não encontrada para txid ${txid}:`, txError);
        return 0;
    }

    const numbersJson = transaction.numbers_json;
    if (!numbersJson) {
        console.error(`❌ [Efi Status] numbers_json vazio para txid ${txid}`);
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
        console.error(`❌ [Efi Status] Erro ao parsear numbers_json para ${txid}:`, e);
        return 0;
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
        console.error(`❌ [Efi Status] numbers_json inválido para ${txid}:`, numbers);
        return 0;
    }

    console.log(`🔄 [Efi Status] Recriando ${numbers.length} reservas como PAID para txid ${txid}...`);

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
            console.error(`❌ [Efi Status] Erro ao recriar reserva número ${number}:`, upsertError);
        } else {
            recreatedCount++;
        }
    }

    await supabase
        .from('efi_transactions')
        .update({
            status: 'CONCLUIDA',
            paid_at: paidAt || new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('txid', txid);

    console.log(`✅ [Efi Status] ${recreatedCount}/${numbers.length} reservas RECRIADAS como PAID para txid ${txid}`);
    return recreatedCount;
}

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

        const efipay = getEfiClient();
        const response = await efipay.pixDetailCharge({ txid });

        const status = response.status;
        const paidAt = response.pix?.[0]?.horario || null;
        const value = parseFloat(response.valor?.original || '0');
        const paidValue = response.pix ? parseFloat(response.pix[0]?.valor || '0') : 0;

        console.log(`📊 [API Efi Status] Status para ${txid}: ${status}`);

        // ⚡ CONFIRMAÇÃO AUTOMÁTICA: se pago, confirmar reservas imediatamente
        // sem esperar o webhook (que pode ter falhado)
        if (status === 'CONCLUIDA') {
            console.log(`💰 [API Efi Status] Pagamento CONCLUIDA detectado! Confirmando reservas para ${txid}...`);
            const supabase = getSupabase();

            // Verificar se já está confirmado para evitar trabalho duplo
            const { data: existingPaid } = await supabase
                .from('reservations')
                .select('id')
                .eq('efi_txid', txid)
                .eq('status', 'paid')
                .limit(1);

            if (!existingPaid || existingPaid.length === 0) {
                // Não está confirmado ainda — confirmar agora
                const confirmed = await confirmEfiPayment(supabase, txid, paidAt);
                console.log(`✅ [API Efi Status] ${confirmed} reserva(s) confirmada(s) via polling para ${txid}`);
            } else {
                console.log(`ℹ️ [API Efi Status] Reservas para ${txid} já estão pagas. Nada a fazer.`);
            }
        }

        return res.status(200).json({
            success: true,
            txid: response.txid,
            status,
            value,
            paidValue,
            paidAt,
            customer: response.devedor,
        });
    } catch (error: any) {
        console.error('❌ [API Efi Status] Erro:', error);
        return res.status(500).json({
            error: error.message || 'Erro ao consultar status',
        });
    }
}
