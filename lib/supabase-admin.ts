import { supabase as supabaseClient } from './supabase';
export const supabase = supabaseClient;
import type { Raffle, Reservation, WinnerPhoto, RaffleAnalytics } from '../types/database';

// ==================== RAFFLE OPERATIONS ====================

export async function getActiveRaffle(): Promise<Raffle | null> {
    const { data, error } = await supabase
        .from('raffles')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('Error fetching active raffle:', error);
        return null;
    }

    return data;
}

export async function updateRaffle(id: string, updates: Partial<Raffle>): Promise<boolean> {
    console.log('📝 [Admin] Atualizando sorteio:', id, updates);

    const { data, error } = await supabase
        .from('raffles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select();

    if (error) {
        console.error('❌ [Admin] Erro ao atualizar sorteio:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        return false;
    }

    console.log('✅ [Admin] Sorteio atualizado com sucesso!', data);
    return true;
}

export async function resetRaffleNumbers(raffleId: string): Promise<number> {
    console.log('🗑️ [Admin] Zerando números do sorteio:', raffleId);

    const { data, error } = await supabase.rpc('reset_raffle_numbers', {
        raffle_id_param: raffleId
    });

    if (error) {
        console.error('❌ [Admin] Erro ao zerar números:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
        });
        return -1; // Retorna -1 para indicar erro
    }

    // RPC retorna array de objetos: [{ deleted_count: number }]
    console.log('📊 [Admin] Data retornada:', data);

    let count = 0;
    if (Array.isArray(data) && data.length > 0 && data[0]?.deleted_count !== undefined) {
        count = data[0].deleted_count;
    } else if (typeof data === 'number') {
        count = data;
    }

    console.log(`✅ [Admin] ${count} número(s) zerado(s) com sucesso!`);
    return count;
}


export async function createRaffle(raffle: Omit<Raffle, 'id' | 'created_at' | 'updated_at'>): Promise<Raffle | null> {
    const { data, error } = await supabase
        .from('raffles')
        .insert([raffle])
        .select()
        .single();

    if (error) {
        console.error('Error creating raffle:', error);
        return null;
    }

    return data;
}

// ==================== RESERVATION OPERATIONS ====================

export async function getReservationsByRaffle(raffleId: string): Promise<Reservation[]> {
    const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('raffle_id', raffleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reservations:', error);
        return [];
    }

    return data || [];
}

export async function createReservation(reservation: Omit<Reservation, 'id' | 'created_at' | 'updated_at'>): Promise<Reservation | null> {
    const { data, error } = await supabase
        .from('reservations')
        .insert([reservation])
        .select()
        .single();

    if (error) {
        console.error('Error creating reservation:', error);
        return null;
    }

    return data;
}

export async function updateReservationStatus(id: string, status: 'pending' | 'paid' | 'cancelled'): Promise<boolean> {
    const updates: any = {
        status,
        updated_at: new Date().toISOString()
    };

    // Se for marcado como pago, removemos a expiração para o cleanup não cancelar o número
    if (status === 'paid') {
        updates.expires_at = null;
    }

    const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id);

    if (error) {
        console.error('Error updating reservation status:', error);
        return false;
    }

    return true;
}

export async function confirmManualPayment(id: string, amount: number): Promise<boolean> {
    console.log('💰 [Admin] Confirmando pagamento manual:', id, amount);
    const { error } = await supabase
        .from('reservations')
        .update({
            status: 'paid',
            payment_amount: amount,
            expires_at: null, // Limpa expiração para evitar que o cleanup cancele
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('Error confirming manual payment:', error);
        return false;
    }

    return true;
}

export async function reactivateReservation(id: string, timeoutMinutes: number = 5): Promise<boolean> {
    console.log('🎟️ [Admin] Reativando reserva:', id, 'com timeout:', timeoutMinutes);

    // Calcular nova data de expiração
    const newExpiresAt = new Date();
    newExpiresAt.setMinutes(newExpiresAt.getMinutes() + timeoutMinutes);

    const { error } = await supabase
        .from('reservations')
        .update({
            status: 'pending',
            expires_at: newExpiresAt.toISOString(), // Renova o tempo para não sumir no próximo cleanup
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('Error reactivating reservation:', error);
        return false;
    }

    return true;
}

export async function deleteReservation(id: string): Promise<boolean> {
    console.log('🗑️ [Admin] Deletando reserva:', id);
    const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting reservation:', error);
        return false;
    }

    return true;
}

// ==================== WINNER PHOTOS OPERATIONS ====================

export async function getWinnerPhotos(): Promise<WinnerPhoto[]> {
    const { data, error } = await supabase
        .from('winner_photos')
        .select('*')
        .order('display_order', { ascending: true });

    if (error) {
        console.error('Error fetching winner photos:', error);
        return [];
    }

    return data || [];
}

export async function addWinnerPhoto(photo: Omit<WinnerPhoto, 'id' | 'created_at'>): Promise<WinnerPhoto | null> {
    const { data, error } = await supabase
        .from('winner_photos')
        .insert([photo])
        .select()
        .single();

    if (error) {
        console.error('Error adding winner photo:', error);
        return null;
    }

    return data;
}

export async function deleteWinnerPhoto(id: string): Promise<boolean> {
    const { error } = await supabase
        .from('winner_photos')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting winner photo:', error);
        return false;
    }

    return true;
}

// ==================== ANALYTICS ====================

export async function getRaffleAnalytics(raffleId: string): Promise<RaffleAnalytics> {
    const reservations = await getReservationsByRaffle(raffleId);

    const paidReservations = reservations.filter(r => r.status === 'paid');
    const pendingReservations = reservations.filter(r => r.status === 'pending');

    const totalRevenue = paidReservations.reduce((sum, r) => sum + r.payment_amount, 0);
    const numbersSold = paidReservations.length;
    const numbersPending = pendingReservations.length;
    const numbersAvailable = 100 - numbersSold - numbersPending;

    // Count unique buyers
    const uniqueBuyers = new Set(paidReservations.map(r => r.buyer_phone || r.buyer_email)).size;

    return {
        totalRevenue,
        numbersSold,
        numbersPending,
        numbersAvailable,
        totalBuyers: uniqueBuyers,
    };
}

// ==================== REAL-TIME SUBSCRIPTIONS ====================

export function subscribeToReservations(raffleId: string, callback: (payload: any) => void) {
    return supabase
        .channel('reservations_channel')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'reservations',
                filter: `raffle_id=eq.${raffleId}`,
            },
            callback
        )
        .subscribe();
}
