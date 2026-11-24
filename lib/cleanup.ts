import { supabase } from './supabase';

/**
 * Chama /api/pre-cleanup (serverless Node.js) para verificar
 * pagamentos EFI antes de rodar o cleanup. Evita deletar números
 * de quem pagou mas o webhook ainda não chegou.
 */
async function runPreCleanup(): Promise<void> {
    try {
        const res = await fetch('/api/pre-cleanup', { method: 'GET' });
        if (res.ok) {
            const data = await res.json();
            if (data.confirmed > 0) {
                console.log(`✅ [Cleanup] Pre-cleanup confirmou ${data.confirmed} pagamento(s) EFI antes de limpar.`);
            }
        }
    } catch (e) {
        // Não bloqueia o cleanup se o pre-cleanup falhar
        console.warn('⚠️ [Cleanup] Pre-cleanup falhou (não bloqueante):', e);
    }
}

/**
 * Deleta reservas expiradas do banco de dados.
 * ANTES de deletar, chama /api/pre-cleanup para confirmar pagamentos EFI.
 * Chama função SQL expire_old_reservations() (grace period 5 min).
 * Deve ser chamada periodicamente (ex: ao carregar dados da página)
 */
export async function cleanupExpiredReservations(): Promise<number> {
    try {
        console.log('🧹 [Cleanup] Iniciando limpeza de reservas expiradas...');

        // ⚡ PROTEÇÃO: Verificar pagamentos EFI antes de deletar
        await runPreCleanup();

        // Tenta primeiro a função mais completa
        let { data, error } = await supabase.rpc('expire_old_reservations');

        if (error) {
            console.warn('⚠️ [Cleanup] expire_old_reservations falhou, tentando delete_expired_reservations:', error.message);
            // Fallback para a função simplificada
            const retry = await supabase.rpc('delete_expired_reservations');
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.warn('⚠️ [Cleanup] RPCs não disponíveis, executando limpeza direta via query:', error.message);
            const nowIso = new Date().toISOString();
            
            // 1. Limpar seleções temporárias na grade que já expiraram (sem PIX)
            const { error: delErr } = await supabase
                .from('reservations')
                .delete()
                .eq('status', 'pending')
                .is('efi_txid', null)
                .lt('expires_at', nowIso);

            // 2. Marcar como cancelled reservas com PIX expirado (mantém para webhook recovery)
            const { error: upErr } = await supabase
                .from('reservations')
                .update({ status: 'cancelled', updated_at: nowIso })
                .eq('status', 'pending')
                .not('efi_txid', 'is', null)
                .lt('expires_at', nowIso);

            if (delErr || upErr) {
                console.error('❌ [Cleanup] Erro na limpeza direta:', delErr || upErr);
            } else {
                console.log('✅ [Cleanup] Limpeza direta executada com sucesso.');
            }
            return 1;
        }

        const count = data || 0;
        if (count > 0) {
            console.log(`✅ [Cleanup] ${count} reserva(s) removida(s)/cancelada(s)`);
        } else {
            console.log('✅ [Cleanup] Nenhuma reserva expirada encontrada');
        }

        return count;
    } catch (error) {
        console.error('❌ [Cleanup] Exceção geral no cleanup:', error);
        return 0;
    }
}
