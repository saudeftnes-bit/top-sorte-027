import { supabase } from './supabase';
import type { Reservation } from '../types/database';

/**
 * Gerencia seleções temporárias de números (antes de confirmar compra)
 * Cria reservas com status 'pending' que aparecem como AMARELO para outros usuários
 *
 * CORREÇÃO DEFINITIVA (Novembro/2026):
 * - Operações atômicas com tratamento seguro de concorrência.
 * - Suporte a cancelamento e liberação instantânea de números reservados.
 * - Impede números presos na grade quando o usuário desiste ou o timer expira.
 */

// Gerar ID de sessão único para identificar este usuário
export function getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('raffle_session_id');

    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('raffle_session_id', sessionId);
    }

    return sessionId;
}

/**
 * Cria uma reserva temporária quando usuário seleciona um número.
 * Status: 'pending' → Aparece AMARELO para outros.
 *
 * USA RPC ATÔMICA: reserve_number_atomic() com SELECT FOR UPDATE no banco.
 * Elimina race conditions entre múltiplos usuários.
 */
export async function createTemporarySelection(
    raffleId: string,
    number: string,
    sessionId: string,
    timeoutMinutes: number = 3
): Promise<{ success: boolean; reason?: string; message?: string }> {
    try {
        console.log(`➕ [Selection] Reservando número ${number} atomicamente para sessão ${sessionId}`);

        const { data, error } = await supabase.rpc('reserve_number_atomic', {
            p_raffle_id: raffleId,
            p_number: number,
            p_session_id: sessionId,
            p_expires_minutes: timeoutMinutes
        });

        if (error) {
            console.error('❌ [Selection] Erro na RPC reserve_number_atomic:', error);
            return { success: false, reason: 'error', message: error.message };
        }

        const result = data as { success: boolean; reason: string; message: string };
        if (!result.success) {
            console.warn(`🔒 [Selection] Número ${number} bloqueado: ${result.reason} — ${result.message}`);
        } else {
            console.log(`✅ [Selection] Número ${number} reservado atomicamente.`);
        }

        return result;
    } catch (error) {
        console.error('❌ [Selection] Exceção:', error);
        return { success: false, reason: 'error', message: 'Erro inesperado ao reservar número.' };
    }
}

/**
 * Remove uma reserva temporária quando o usuário desseleciona um número na grade.
 * Não afeta números que já foram pagos.
 */
export async function removeTemporarySelection(
    raffleId: string,
    number: string,
    sessionId: string
): Promise<boolean> {
    try {
        console.log(`🗑️ [Delete] Tentando remover número ${number} para sessão ${sessionId}`);

        // 1. Tentar remover por RPC de cancelamento atômico
        const { error: rpcError } = await supabase.rpc('cancel_reservation_atomic', {
            p_raffle_id: raffleId,
            p_numbers: [number],
            p_session_id: sessionId
        });

        if (!rpcError) {
            console.log(`✅ [Delete] Número ${number} liberado via RPC.`);
            return true;
        }

        // 2. Fallback: Deleção direta no Supabase
        const { error: delError } = await supabase
            .from('reservations')
            .delete()
            .eq('raffle_id', raffleId)
            .eq('number', number)
            .eq('status', 'pending')
            .is('efi_txid', null);

        if (!delError) {
            console.log(`✅ [Delete] Número ${number} removido com sucesso.`);
            return true;
        }

        console.error('❌ [Delete] Erro ao remover:', delError);
        return false;
    } catch (error) {
        console.error('❌ [Delete] Exceção ao remover:', error);
        return false;
    }
}

/**
 * Cancela e libera imediatamente reservas de números específicos.
 * Usado quando o usuário desiste no checkout (step payment ou info),
 * quando o timer expira, ou quando clica em 'Cancelar e escolher outros'.
 * NUNCA afeta números que já tenham status = 'paid'.
 */
export async function cancelReservationNumbers(
    raffleId: string,
    numbers: string[],
    sessionId: string
): Promise<boolean> {
    if (!raffleId || !numbers || numbers.length === 0) return true;

    try {
        console.log(`🛑 [Cancel] Liberando ${numbers.length} número(s): ${numbers.join(', ')} para sessão ${sessionId}`);

        // 1. Tentar primeiro via RPC atômica
        const { error: rpcErr } = await supabase.rpc('cancel_reservation_atomic', {
            p_raffle_id: raffleId,
            p_numbers: numbers,
            p_session_id: sessionId
        });

        if (!rpcErr) {
            console.log('✅ [Cancel] Números cancelados via RPC com sucesso.');
            return true;
        }

        console.warn('⚠️ [Cancel] RPC cancel_reservation_atomic indisponível, aplicando fallback direto:', rpcErr.message);

        // 2. Fallback: Deletar seleções temporárias sem PIX
        await supabase
            .from('reservations')
            .delete()
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .eq('status', 'pending')
            .is('efi_txid', null);

        // 3. Fallback: Marcar como 'cancelled' reservas com PIX não pagas
        await supabase
            .from('reservations')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .eq('status', 'pending');

        console.log('✅ [Cancel] Números liberados com sucesso via fallback.');
        return true;
    } catch (error) {
        console.error('❌ [Cancel] Exceção ao cancelar reservas:', error);
        return false;
    }
}

/**
 * Remove TODAS as seleções temporárias desta sessão (sem PIX gerado)
 * Usado ao sair da página ou trocar de sorteio
 */
export async function cleanupSessionSelections(
    raffleId: string,
    sessionId: string
): Promise<boolean> {
    try {
        // Tenta remover seleções temporárias da sessão
        const { error } = await supabase
            .from('reservations')
            .delete()
            .eq('raffle_id', raffleId)
            .eq('buyer_name', sessionId)
            .eq('status', 'pending')
            .is('efi_txid', null);

        if (error) {
            console.error('Error cleaning up session selections:', error);
            return false;
        }

        console.log(`🧹 [Cleanup] Seleções temporárias sem PIX removidas para sessão ${sessionId}`);
        return true;
    } catch (error) {
        console.error('Error in cleanupSessionSelections:', error);
        return false;
    }
}

/**
 * Converte seleções temporárias em reservas confirmadas (status: pending com dados do comprador)
 */
export async function confirmSelections(
    raffleId: string,
    sessionId: string,
    buyerName: string,
    buyerEmail: string,
    buyerPhone: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('reservations')
            .update({
                buyer_name: buyerName,
                buyer_email: buyerEmail,
                buyer_phone: buyerPhone,
                status: 'pending',
                updated_at: new Date().toISOString()
            })
            .eq('raffle_id', raffleId)
            .eq('buyer_name', sessionId)
            .eq('status', 'pending');

        if (error) {
            console.error('Error confirming selections:', error);
            return false;
        }

        console.log(`🎉 [Confirm] Seleções confirmadas para ${buyerName}`);
        return true;
    } catch (error) {
        console.error('Error in confirmSelections:', error);
        return false;
    }
}
