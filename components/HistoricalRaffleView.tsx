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
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-slate-900 text-white py-6 px-4 shadow-lg mb-6">
                <div className="max-w-2xl mx-auto flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Visualizando Histórico
                        </div>
                        <h1 className="text-xl font-black leading-none">
                            {raffle.title}
                        </h1>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto px-4">
                    {/* Centered Finished Title with Animation */}
                    <div className="mb-8 text-center space-y-2">
                        <div className="inline-block relative">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic py-2 px-6 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-[length:200%_auto] animate-gradient-text text-transparent bg-clip-text drop-shadow-sm select-none">
                                Rifa Encerrada
                            </h2>
                            <div className="absolute -inset-1 bg-red-500 opacity-20 blur-xl animate-pulse rounded-full -z-10"></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200 p-2 sm:p-6">
                        <RaffleSelection
                            selectedNumbers={[]}
                            onToggleNumber={() => { }} // No-op
                            reservations={localReservations}
                            totalNumbers={raffle.total_numbers}
                            selectionMode={raffle.selection_mode}
                            isReadOnly={true}
                            raffleCode={raffle.code}
                        // sessionId is not needed for history view
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
