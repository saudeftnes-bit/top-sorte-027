import { createClient } from '@supabase/supabase-js';
import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

// Supabase client para serverless
const getSupabase = () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
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
 * Confirma pagamento EFI de forma idempotente e segura:
 * 1. Tenta via RPC atômica confirm_efi_payment(p_txid, p_paid_at) no banco.
 * 2. Se a RPC falhar/não existir, executa fallback seguro que NUNCA sobrescreve
 *    um número já pago por outro txid.
 */
async function confirmEfiPayment(
    supabase: ReturnType<typeof getSupabase>,
    txid: string,
    paidAt: string | null
): Promise<number> {
    // Tentar primeiro via RPC atômica e idempotente
    const { data: rpcData, error: rpcError } = await supabase.rpc('confirm_efi_payment', {
        p_txid: txid,
        p_paid_at: paidAt || new Date().toISOString(),
    });

    if (!rpcError && rpcData) {
        if (typeof rpcData === 'object' && rpcData.conflicts?.length > 0) {
            console.error(`🚨 [Webhook Efi] CONFLITO detectado para ${txid} nos números: ${rpcData.conflicts.join(', ')}. Dono original preservado.`);
        }
        const confirmed = typeof rpcData === 'number' ? rpcData : (rpcData.updated ?? 0);
        const alreadyPaid = typeof rpcData === 'object' ? (rpcData.alreadyPaid ?? 0) : 0;
        console.log(`✅ [Webhook Efi] RPC confirm_efi_payment para ${txid}:`, rpcData);

        if (confirmed > 0 || alreadyPaid > 0) {
            return confirmed;
        }

        // Se a RPC retornou updated: 0 e alreadyPaid: 0, verificar se há reservas pagas no banco
        const { count: paidCheck } = await supabase
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('efi_txid', txid)
            .eq('status', 'paid');

        if ((paidCheck || 0) > 0) {
            return paidCheck || 0;
        }

        console.warn(`⚠️ [Webhook Efi] RPC retornou 0 atualizações e nenhuma reserva paga encontrada para ${txid}. Executando recovery JS...`);
    }

    if (rpcError) {
        console.warn(`⚠️ [Webhook Efi] RPC confirm_efi_payment indisponível (${rpcError.message}), usando fallback seguro...`);
    }

    // Fallback seguro caso a RPC ainda não tenha sido aplicada no banco
    const { data: updatedReservations, error: updateError } = await supabase
        .from('reservations')
        .update({
            status: 'paid',
            expires_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq('efi_txid', txid)
        .neq('status', 'paid')
        .select();

    if (updateError) {
        console.error(`❌ [Webhook Efi] Erro ao atualizar reservas para ${txid}:`, updateError);
    }

    const updatedCount = updatedReservations?.length || 0;

    if (updatedCount > 0) {
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

    // Buscar transação para recuperar números se foram deletados pelo cleanup
    const { data: transaction, error: txError } = await supabase
        .from('efi_transactions')
        .select('*')
        .eq('txid', txid)
        .single();

    if (txError || !transaction || !transaction.numbers_json) {
        return 0;
    }

    let numbers: string[] = [];
    try {
        numbers = JSON.parse(transaction.numbers_json);
    } catch {
        return 0;
    }

    if (!Array.isArray(numbers) || numbers.length === 0) {
        return 0;
    }

    const pricePerNumber = (transaction.amount || 0) / numbers.length;
    let recreatedCount = 0;

    for (const number of numbers) {
        // Verificar ANTES se o número já está pago por OUTRO txid (nunca sobrescrever dono!)
        const { data: existing } = await supabase
            .from('reservations')
            .select('id, status, efi_txid, buyer_name')
            .eq('raffle_id', transaction.raffle_id)
            .eq('number', String(number))
            .maybeSingle();

        if (existing?.status === 'paid') {
            if (existing.efi_txid !== txid) {
                console.error(`🚨 [Webhook Efi] Número ${number} já está PAGO para ${existing.buyer_name} (txid: ${existing.efi_txid}). Bloqueando sobrescrita de ${txid}.`);
            }
            continue;
        }

        if (existing) {
            const { error: updErr } = await supabase
                .from('reservations')
                .update({
                    buyer_name: transaction.buyer_name || existing.buyer_name,
                    buyer_phone: transaction.buyer_phone || '',
                    buyer_email: transaction.buyer_email || '',
                    status: 'paid',
                    payment_amount: pricePerNumber,
                    payment_method: 'efi',
                    efi_txid: txid,
                    expires_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .neq('status', 'paid');

            if (!updErr) recreatedCount++;
        } else {
            const { error: insErr } = await supabase
                .from('reservations')
                .insert({
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
                });

            if (!insErr) recreatedCount++;
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

        // Extrair e deduplicar txids do payload
        const txidSet = new Set<string>();
        if (payload.pix) {
            payload.pix.forEach((pix: any) => {
                if (pix.txid) {
                    txidSet.add(String(pix.txid));
                }
            });
        }
        const txids = Array.from(txidSet);

        console.log('📝 [Webhook Efi] TXIDs a processar:', txids);

        const supabase = getSupabase();
        const efipay = getEfiClient();

        // Processar cada txid com idempotência
        for (const txid of txids) {
            try {
                // Idempotência rápida: se já está CONCLUIDA, verificar se números já foram gravados
                // IMPORTANTE: buscar a transação completa (números + comprador) para poder recriar se necessário
                const { data: existingTx } = await supabase
                    .from('efi_transactions')
                    .select('status, numbers_json, raffle_id, buyer_name, buyer_phone, buyer_email, amount')
                    .eq('txid', txid)
                    .maybeSingle();

                if (existingTx?.status === 'CONCLUIDA') {
                    const { count: paidCount } = await supabase
                        .from('reservations')
                        .select('id', { count: 'exact', head: true })
                        .eq('efi_txid', txid)
                        .eq('status', 'paid');

                    if ((paidCount || 0) > 0) {
                        console.log(`⏭️ [Webhook Efi] txid ${txid} já confirmado (${paidCount} reservas pagas). Ignorando notificação repetida.`);
                        continue;
                    }

                    // CONCLUIDA mas sem reservas pagas — pagamento perdido! Recriar agora.
                    console.warn(`⚠️ [Webhook Efi] txid ${txid} está CONCLUIDA mas sem reservas pagas. Recriando reservas a partir de efi_transactions...`);
                    if (existingTx.numbers_json && existingTx.raffle_id) {
                        const confirmed = await confirmEfiPayment(supabase, txid, new Date().toISOString());
                        console.log(`🔧 [Webhook Efi] Reservas recriadas para txid ${txid}: ${confirmed}`);
                        continue;
                    }
                }

                console.log(`🔍 [Webhook Efi] Consultando status real na EFI para txid: ${txid}`);

                // Consultar status atualizado na Efi (nunca confiar cegamente apenas no payload)
                const response = await efipay.pixDetailCharge({ txid });
                const status = response.status;
                const paidAt = response.pix?.[0]?.horario || null;

                console.log(`📊 [Webhook Efi] Status real para ${txid}: ${status}`);

                // Se pago, confirmar reservas via RPC idempotente/atômica
                if (status === 'CONCLUIDA') {
                    console.log(`💰 [Webhook Efi] Pagamento CONFIRMADO para ${txid}! Confirmando reservas...`);
                    const confirmed = await confirmEfiPayment(supabase, txid, paidAt);
                    console.log(`✅ [Webhook Efi] Total de reservas confirmadas para ${txid}: ${confirmed}`);
                } else {
                    await supabase
                        .from('efi_transactions')
                        .update({
                            status: status,
                            paid_at: paidAt || null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('txid', txid);
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
