import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { getReservationsByRaffle } from '../../lib/supabase-admin';
import type { Raffle, Reservation } from '../../types/database';

interface RaffleGridViewProps {
    raffle: Raffle;
    onBack: () => void;
}

const RaffleGridView: React.FC<RaffleGridViewProps> = ({ raffle, onBack }) => {
    const [reservations, setReservations] = useState<Record<string, { status: string; name: string }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [winnerNumbers, setWinnerNumbers] = useState<string[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadReservations();
    }, [raffle.id]);

    const loadReservations = async () => {
        setIsLoading(true);
        const data = await getReservationsByRaffle(raffle.id);
        const map: Record<string, { status: string; name: string }> = {};

        data.forEach(res => {
            if (res.status !== 'cancelled') {
                map[res.number] = {
                    status: res.status,
                    name: res.buyer_name
                };
            }
        });

        setReservations(map);
        setIsLoading(false);
    };

    const handleNumberClick = (num: string) => {
        setWinnerNumbers(prev =>
            prev.includes(num)
                ? prev.filter(n => n !== num)
                : [...prev, num]
        );
    };

    const downloadScreenshot = async () => {
        if (!gridRef.current) return;

        setIsCapturing(true);
        // Small delay to ensure UI updates before capture
        await new Promise(resolve => setTimeout(resolve, 100));

        try {
            const canvas = await html2canvas(gridRef.current, {
                useCORS: true,
                scale: 2, // Better quality
                backgroundColor: '#f8fafc',
            });

            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            const winnersText = winnerNumbers.length > 0 ? `vencedores-${winnerNumbers.join('-')}` : 'nenhum-vencedor';
            link.download = `grade-rifa-${raffle.code || 'export'}-${winnersText}.png`;
            link.click();
        } catch (error) {
            console.error('Error capturing screenshot:', error);
            alert('Erro ao capturar o print. Tente novamente.');
        } finally {
            setIsCapturing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            </div>
        );
    }

    const total = raffle.total_numbers || 100;
    const numbers = Array.from({ length: total }, (_, i) => (i + 1).toString().padStart(total >= 1000 ? 3 : 2, '0'));

    return (
        <div className="space-y-6">
            {/* Header Control */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div>
                    <h2 className="text-xl font-black text-slate-900">📸 Captura de Grade</h2>
                    <p className="text-sm text-slate-500 font-medium">Selecione o vencedor e baixe o print</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={downloadScreenshot}
                        disabled={isCapturing}
                        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2"
                    >
                        {isCapturing ? '⌛ Processando...' : '📥 Baixar Print da Grade'}
                    </button>
                    <button
                        onClick={onBack}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2.5 rounded-xl font-bold transition-colors"
                    >
                        Voltar
                    </button>
                </div>
            </div>

            {/* Hint */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl">
                <div className="flex items-center gap-3">
                    <span className="text-xl">💡</span>
                    <p className="text-sm text-blue-700 font-medium">
                        Clique em um número para destacá-lo como o **VENCEDOR** antes de capturar o print.
                    </p>
                </div>
            </div>

            {/* Capture Area */}
            <div
                ref={gridRef}
                className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl overflow-hidden"
                style={{ minWidth: '800px' }} // Ensure enough width for a nice screenshot
            >
                <div className="text-center mb-10">
                    <div className="inline-block bg-purple-600 text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-4">
                        Top Sorte 027 - Grade Oficial
                    </div>

                    {raffle.status === 'finished' && (
                        <div className="mb-6">
                            <div className="inline-block relative">
                                <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic py-2 px-6 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-[length:200%_auto] animate-gradient-text text-transparent bg-clip-text drop-shadow-sm select-none">
                                    Rifa Encerrada
                                </h2>
                                <div className="absolute -inset-1 bg-red-500 opacity-20 blur-xl animate-pulse rounded-full -z-10"></div>
                            </div>
                        </div>
                    )}

                    <h1 className="text-3xl font-black text-slate-900 mb-1">{raffle.title}</h1>
                    <p className="text-slate-500 font-bold">Edição #{raffle.code}</p>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 max-w-5xl mx-auto">
                    {numbers.map((num) => {
                        const reservation = reservations[num];
                        const isWinner = winnerNumbers.includes(num);
                        const isPaid = reservation?.status === 'paid';
                        const isPending = reservation?.status === 'pending';

                        return (
                            <div
                                key={num}
                                onClick={() => handleNumberClick(num)}
                                className={`
                                    relative aspect-square flex flex-col items-center justify-center rounded-lg border-2 transition-all cursor-pointer
                                    ${isWinner
                                        ? 'bg-yellow-400 border-yellow-600 scale-110 z-10 shadow-lg ring-4 ring-yellow-200'
                                        : isPaid
                                            ? 'bg-green-500 border-green-600 text-white'
                                            : isPending
                                                ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                                : 'bg-slate-50 border-slate-200 text-slate-400'}
                                `}
                            >
                                <span className={`text-xs font-black ${isWinner ? 'text-yellow-950' : ''}`}>
                                    {num}
                                </span>
                                {isWinner && (
                                    <span className="absolute -top-1 -right-1 text-xs">👑</span>
                                )}
                                {isPaid && reservation && !isWinner && (
                                    <span className="text-[8px] font-bold uppercase truncate w-full px-1 text-center opacity-75">
                                        {reservation.name.split(' ')[0]}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Legend for Screenshot */}
                <div className="mt-12 pt-8 border-t border-slate-100 flex justify-center gap-8">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded shadow-sm"></div>
                        <span className="text-xs font-bold text-slate-600">PAGO</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded shadow-sm"></div>
                        <span className="text-xs font-bold text-slate-600">RESERVADO</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-slate-50 border border-slate-200 rounded shadow-sm"></div>
                        <span className="text-xs font-bold text-slate-600">LIVRE</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-yellow-400 border-2 border-yellow-600 rounded shadow-sm"></div>
                        <span className="text-xs font-bold text-slate-600 font-orange-600 uppercase">🏆 VENCEDOR</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RaffleGridView;
