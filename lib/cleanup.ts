import { supabase } from './supabase';

/**
 * Deleta reservas expiradas do banco de dados
 * Chama função SQL delete_expired_reservations()
 * Deve ser chamada periodicamente (ex: ao carregar dados da página)
 */
export async function cleanupExpiredReservations(): Promise<number> {
    try {
        console.log('🧹 [Cleanup] Limpando reservas expiradas...');

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
            console.error('❌ [Cleanup] Erro crítico ao limpar reservas expiradas:', error);
            return 0;
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
