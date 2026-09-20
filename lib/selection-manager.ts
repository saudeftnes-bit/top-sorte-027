import { supabase } from './supabase';
import type { Reservation } from '../types/database';

/**
 * Gerencia seleções temporárias de números (antes de confirmar compra)
 * Cria reservas com status 'pending' que aparecem como AMARELO para outros usuários
 *
 * CORREÇÃO DEFINITIVA (20/09/2026):
 * Todas as operações agora usam RPC atômica no banco (SELECT FOR UPDATE).
 * Não há mais SELECT + UPSERT separados — eliminando o race condition.
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
 * Elimina o race condition do SELECT+UPSERT separados anterior.
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
 * Remove uma reserva temporária quando usuário desseleciona um número
 */
export async function removeTemporarySelection(
    raffleId: string,
    number: string,
    sessionId: string
): Promise<boolean> {
    try {
        console.log(`🗑️ [Delete] Tentando remover número ${number} para sessão ${sessionId}`);

        const { data, error } = await supabase
            .from('reservations')
            .delete()
            .eq('raffle_id', raffleId)
            .eq('number', number)
            .eq('buyer_name', sessionId)
            .eq('status', 'pending')
            .is('efi_txid', null)  // Só remove seleções sem PIX gerado
            .select();

        if (error) {
            console.error('❌ [Delete] Erro ao remover:', error);
            return false;
        }

        console.log(`✅ [Delete] Removido com sucesso. Linhas deletadas: ${data?.length || 0}`);
        return true;
    } catch (error) {
        console.error('❌ [Delete] Exceção ao remover:', error);
        return false;
    }
}

/**
 * Remove TODAS as seleções temporárias desta sessão (sem PIX gerado)
 * Usado ao cancelar checkout ou sair da página
 */
export async function cleanupSessionSelections(
    raffleId: string,
    sessionId: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('reservations')
            .delete()
            .eq('raffle_id', raffleId)
            .eq('buyer_name', sessionId)
            .eq('status', 'pending')
            .is('efi_txid', null);  // Só remove seleções sem PIX gerado

        if (error) {
            console.error('Error cleaning up session selections:', error);
            return false;
        }

        console.log(`🧹 [Cleanup] Todas as seleções temporárias sem PIX removidas para sessão ${sessionId}`);
        return true;
    } catch (error) {
        console.error('Error in cleanupSessionSelections:', error);
        return false;
    }
}

/**
 * Converte seleções temporárias em reservas confirmadas (status: paid)
 * Usado quando usuário confirma o checkout
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
