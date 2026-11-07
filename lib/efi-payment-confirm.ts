import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Confirmação de pagamento PIX no banco de dados com múltiplas camadas de segurança.
 * NUNCA depende exclusivamente de uma única RPC.
 * Garante que efi_transactions E reservations fiquem com status 'CONCLUIDA' / 'paid'.
 */
export async function confirmPaymentInDatabase(
    supabase: SupabaseClient,
    txid: string,
    status: string,
    paidAt: string | null,
    eventData?: any
): Promise<{ success: boolean; error?: string }> {
    try {
        console.log(`🔒 [Confirm Payment] Sincronizando txid: ${txid} (status: ${status})`);

        const formattedPaidAt = paidAt ? new Date(paidAt).toISOString() : new Date().toISOString();

        // ════════════════════════════════════════════════════════════════════
        // CAMADA 1: Atualizar diretamente a tabela efi_transactions
        // ════════════════════════════════════════════════════════════════════
        const { data: updatedTx, error: txUpdateErr } = await supabase
            .from('efi_transactions')
            .update({
                status: status,
                paid_at: formattedPaidAt,
                updated_at: new Date().toISOString()
            })
            .eq('txid', txid)
            .select('*')
            .maybeSingle();

        if (txUpdateErr) {
            console.warn(`⚠️ [Confirm Payment] Erro ao atualizar efi_transactions para ${txid}:`, txUpdateErr.message);
        }

        // Buscar dados da transação caso o select no update não tenha retornado
        let txData = updatedTx;
        if (!txData) {
            const { data: fetchedTx } = await supabase
                .from('efi_transactions')
                .select('*')
                .eq('txid', txid)
                .maybeSingle();
            txData = fetchedTx;
        }

        const raffleId = txData?.raffle_id;

        // Se o status NÃO for CONCLUIDA, apenas sincroniza o status nas reservas sem marcar como pago
        if (status !== 'CONCLUIDA') {
            await supabase
                .from('reservations')
                .update({
                    efi_status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('efi_txid', txid)
                .neq('status', 'paid');
            return { success: true };
        }

        // ════════════════════════════════════════════════════════════════════
        // CAMADA 2: Chamar a RPC atômica confirm_payment_by_txid (se disponível)
        // ════════════════════════════════════════════════════════════════════
        let rpcSuccess = false;
        if (raffleId) {
            try {
                const { data: rpcData, error: rpcErr } = await supabase.rpc(
                    'confirm_payment_by_txid',
                    {
                        p_txid: txid,
                        p_raffle_id: raffleId
                    }
                );

                if (!rpcErr && rpcData?.success) {
                    console.log(`✅ [Confirm Payment] confirm_payment_by_txid executado com sucesso:`, rpcData);
                    rpcSuccess = true;
                } else if (rpcErr) {
                    console.warn(`⚠️ [Confirm Payment] confirm_payment_by_txid retornou erro (${rpcErr.message}), executando camada direta.`);
                }
            } catch (rpcCallErr: any) {
                console.warn(`⚠️ [Confirm Payment] Falha na chamada da RPC confirm_payment_by_txid:`, rpcCallErr.message);
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // CAMADA 3: Confirmação direta garantida por número e raffle_id
        // ════════════════════════════════════════════════════════════════════
        let numbers: string[] = [];
        if (txData?.numbers_json) {
            try {
                const parsed = typeof txData.numbers_json === 'string'
                    ? JSON.parse(txData.numbers_json)
                    : txData.numbers_json;
                if (Array.isArray(parsed)) {
                    numbers = parsed.map(String);
                }
            } catch (e) {
                console.warn('⚠️ [Confirm Payment] Falha ao parsear numbers_json:', e);
            }
        }

        if (raffleId && numbers.length > 0) {
            for (const num of numbers) {
                // Verificar se já existe reserva deste número
                const { data: existingRes } = await supabase
                    .from('reservations')
                    .select('*')
                    .eq('raffle_id', raffleId)
                    .eq('number', num)
                    .maybeSingle();

                // Se já estiver pago por outro txid legítimo, emitir alerta e proteger
                if (existingRes && existingRes.status === 'paid' && existingRes.efi_txid && existingRes.efi_txid !== txid) {
                    console.error(`🚨 [CONFLITO DUPLO] Número ${num} da rifa ${raffleId} já está pago por ${existingRes.buyer_name} (txid ${existingRes.efi_txid}). Ignorando sobrescrita para txid ${txid}.`);
                    continue;
                }

                // Atualizar para PAID
                const { error: updErr } = await supabase
                    .from('reservations')
                    .update({
                        status: 'paid',
                        buyer_name: txData.buyer_name || existingRes?.buyer_name || 'Comprador PIX',
                        buyer_phone: txData.buyer_phone || existingRes?.buyer_phone || '',
                        buyer_email: txData.buyer_email || existingRes?.buyer_email || '',
                        payment_method: 'efi',
                        payment_amount: txData.amount || existingRes?.payment_amount || null,
                        efi_txid: txid,
                        efi_status: 'CONCLUIDA',
                        expires_at: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('raffle_id', raffleId)
                    .eq('number', num);

                if (updErr) {
                    console.error(`❌ [Confirm Payment] Erro ao atualizar reserva do número ${num}:`, updErr.message);
                } else {
                    console.log(`✅ [Confirm Payment] Número ${num} marcado como PAID para ${txData.buyer_name}`);
                }
            }
        } else {
            // Fallback por efi_txid
            const { error: directErr } = await supabase
                .from('reservations')
                .update({
                    status: 'paid',
                    expires_at: null,
                    efi_status: 'CONCLUIDA',
                    payment_method: 'efi',
                    updated_at: new Date().toISOString()
                })
                .eq('efi_txid', txid);

            if (directErr) {
                console.error(`❌ [Confirm Payment] Erro no fallback por efi_txid ${txid}:`, directErr.message);
            } else {
                console.log(`✅ [Confirm Payment] Reservas vinculadas ao txid ${txid} marcadas como PAID`);
            }
        }

        return { success: true };
    } catch (err: any) {
        console.error(`❌ [Confirm Payment] Erro geral ao processar txid ${txid}:`, err);
        return { success: false, error: err.message };
    }
}
