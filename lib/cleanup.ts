import { supabase } from './supabase';

/**
 * Deleta reservas expiradas do banco de dados
 * Chama função SQL delete_expired_reservations()
 * Deve ser chamada periodicamente (ex: ao carregar dados da página)
 */
export async function cleanupExpiredReservations(): Promise<number> {
    try {
        console.log('🧹 [Cleanup] Limpando reservas expiradas...');

        const { data, error } = await supabase.rpc('delete_expired_reservations');

        if (error) {
            console.error('❌ [Cleanup] Erro ao limpar reservas expiradas:', error);
            return 0;
        }

        const count = data || 0;
        if (count > 0) {
            console.log(`✅ [Cleanup] ${count} reserva(s) expirada(s) removida(s)`);
        } else {
            console.log('✅ [Cleanup] Nenhuma reserva expirada encontrada');
        }

        return count;
    } catch (error) {
        console.error('❌ [Cleanup] Exceção ao limpar reservas:', error);
        return 0;
    }
}
