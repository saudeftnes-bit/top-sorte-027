import React, { useState, useEffect } from 'react';
import { Raffle, Reservation } from '../types/database';
import { getReservationsByRaffle } from '../lib/supabase-admin';
import RaffleSelection from './RaffleSelection';
import { ReservationMap } from '../App';

interface HistoricalRaffleViewProps {
    raffle: Raffle;
    onBack: () => void;
}

export const HistoricalRaffleView: React.FC<HistoricalRaffleViewProps> = ({ raffle, onBack }) => {
    const [localReservations, setLocalReservations] = useState<ReservationMap>({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadHistoricalData = async () => {
            try {
                console.log(`📜 [History] Loading data for finished raffle: ${raffle.id}`);
                const data = await getReservationsByRaffle(raffle.id);

                if (!isMounted) return;

                const map: ReservationMap = {};
                data.forEach(res => {
                    if (res.status !== 'cancelled') {
                        map[res.number] = {
                            name: res.buyer_name,
                            status: res.status as 'available' | 'pending' | 'paid'
                        };
                    }
                });

                setLocalReservations(map);
            } catch (error) {
                console.error('Error loading historical data:', error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadHistoricalData();

        return () => {
            isMounted = false;
        };
    }, [raffle.id]);

    return (
        <div className="bg-slate-50 dark:bg-gray-950 pb-6 transition-colors duration-300">
            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
            ) : (
                <div className="max-w-2xl mx-auto">
                    <RaffleSelection
                        selectedNumbers={[]}
                        onToggleNumber={() => { }} // No-op
                        reservations={localReservations}
                        totalNumbers={raffle.total_numbers}
                        selectionMode={raffle.selection_mode}
                        isReadOnly={true}
                        raffleCode={raffle.code}
                        pricePerNumber={raffle.price_per_number}
                    />
                </div>
            )}
        </div>
    );
};
