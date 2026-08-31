import { supabase } from './supabase';
import type { Reservation } from '../types/database';

/**
 * Gerencia seleções temporárias de números (antes de confirmar compra)
 * Cria reservas com status 'pending' que aparecem como AMARELO para outros usuários
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
 * PROTEÇÃO contra race condition: verifica se o número já tem um PIX ativo
 * ou uma reserva válida de outro usuário antes de criar/sobrescrever.
 */
export async function createTemporarySelection(
    raffleId: string,
    number: string,
    sessionId: string,
    timeoutMinutes: number = 3
): Promise<boolean> {
    try {
        const nowMs = Date.now();

        // ── Verificação de conflito ────────────────────────────────────────────
        // Antes de fazer o upsert, checar se existe reserva PAGA ou ativa de outro usuário.
        const { data: existing, error: checkError } = await supabase
            .from('reservations')
            .select('id, buyer_name, efi_txid, expires_at, status')
            .eq('raffle_id', raffleId)
            .eq('number', number)
            .maybeSingle(); // Buscar QUALQUER reserva (sem filtro de status)

        if (checkError) {
            console.warn('⚠️ [Insert] Erro ao verificar reserva existente:', checkError);
        }

        if (existing) {
            // Caso 0: Número já PAGO — SEMPRE bloquear (nunca sobrescrever!)
            if (existing.status === 'paid') {
                console.warn(`🔒 [Insert] Número ${number} BLOQUEADO — já está PAGO por "${existing.buyer_name}"`);
                return false;
            }

            // Pular reservas canceladas (podem ser sobrescritas)
            if (existing.status === 'cancelled') {
                console.log(`♻️ [Insert] Número ${number} estava cancelled — sobrescrevendo`);
                // Continuar para o UPSERT
            } else {
                const expiresAtMs = existing.expires_at ? new Date(existing.expires_at).getTime() : 0;
                const isNotExpired = expiresAtMs > nowMs;

                // Caso 1: PIX ativo de outro comprador — BLOQUEAR
                if (existing.efi_txid && isNotExpired) {
                    console.warn(`🔒 [Insert] Número ${number} BLOQUEADO — PIX ativo até ${existing.expires_at}`);
                    return false;
                }

                // Caso 2: Reserva válida de outro usuário (sem PIX ainda) — BLOQUEAR
                if (!existing.efi_txid && existing.buyer_name !== sessionId && isNotExpired) {
                    console.warn(`🔒 [Insert] Número ${number} BLOQUEADO — reservado por outro usuário`);
                    return false;
                }

                // Caso 3: É a reserva do próprio usuário → pode sobrescrever/renovar
                console.log(`🔄 [Insert] Renovando reserva do próprio usuário para número ${number}`);
            }
        }
        // ──────────────────────────────────────────────────────────────────────

        const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

        const insertData = {
            raffle_id: raffleId,
            number: number,
            buyer_name: sessionId,
            buyer_email: `temp_${sessionId}@selecting.local`,
            buyer_phone: '',
            status: 'pending' as const,
            expires_at: expiresAt,
            efi_txid: null,
            created_at: new Date().toISOString()
        };

        console.log(`➕ [Insert] Criando reserva:`, insertData);

        const { data, error } = await supabase
            .from('reservations')
            .upsert(insertData, { onConflict: 'raffle_id, number' })
            .select();

        if (error) {
            console.error('❌ [Insert] Erro ao criar:', error);
            return false;
        }

        console.log(`✅ [Insert] Criado com sucesso:`, data);
        console.log(`✅ [Selection] Número ${number} bloqueado temporariamente`);
        return true;
    } catch (error) {
        console.error('❌ [Insert] Exceção:', error);
        return false;
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
            .select(); // Adicionar select para ver o que foi deletado

        if (error) {
            console.error('❌ [Delete] Erro ao remover:', error);
            return false;
        }

        console.log(`✅ [Delete] Removido com sucesso:`, data);
        console.log(`✅ [Delete] Quantidade de linhas deletadas: ${data?.length || 0}`);
        return true;
    } catch (error) {
        console.error('❌ [Delete] Exceção ao remover:', error);
        return false;
    }
}

/**
 * Remove TODAS as seleções temporárias desta sessão
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
            .eq('status', 'pending');

        if (error) {
            console.error('Error cleaning up session selections:', error);
            return false;
        }

        console.log(`🧹 [Cleanup] Todas as seleções temporárias removidas`);
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
