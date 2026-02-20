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
    const printRef = useRef<HTMLDivElement>(null);

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
        if (!printRef.current) return;

        setIsCapturing(true);
        // Small delay to ensure UI updates before capture
        await new Promise(resolve => setTimeout(resolve, 150));

        try {
            const canvas = await html2canvas(printRef.current, {
                useCORS: true,
                scale: 3, // Very high quality for sharing
                backgroundColor: '#ffffff',
            });

            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            const winnersText = winnerNumbers.length > 0 ? `vencedores-${winnerNumbers.join('-')}` : 'resultado';
            link.download = `ganhadores-${raffle.code || 'top-sorte'}-${winnersText}.png`;
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
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-16 w-16 border-8 border-purple-600 border-t-transparent"></div>
            </div>
        );
    }

    const total = raffle.total_numbers || 100;
    const numbers = Array.from({ length: total }, (_, i) => (i + 1).toString().padStart(total >= 1000 ? 3 : 2, '0'));

    return (
        <div className="space-y-10 pb-20">
            {/* Header Control - Larger */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl">📸</div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gerador de Prints</h2>
                        <p className="text-lg text-slate-500 font-bold">Gerencie os vencedores e gere o resultado final</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={downloadScreenshot}
                        disabled={isCapturing || winnerNumbers.length === 0}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 flex items-center gap-3 text-lg"
                    >
                        {isCapturing ? '⌛ PROCESSANDO...' : '📥 BAIXAR PRINT RESULTADO'}
                    </button>
                    <button
                        onClick={onBack}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-8 py-4 rounded-2xl font-black transition-colors text-lg"
                    >
                        VOLTAR
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                {/* Column 1: Admin Management */}
                <div className="space-y-8">
                    {/* Management Grid - Larger cards */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                🔢 Seleção de Vencedores
                            </h3>
                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest">
                                {winnerNumbers.length} SELECIONADOS
                            </div>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">
                            {numbers.map((num) => {
                                const reservation = reservations[num];
                                const isWinner = winnerNumbers.includes(num);
                                const isPaid = reservation?.status === 'paid';

                                return (
                                    <div
                                        key={num}
                                        onClick={() => handleNumberClick(num)}
                                        className={`
                                            aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all cursor-pointer select-none
                                            ${isWinner
                                                ? 'bg-yellow-400 border-yellow-600 scale-110 z-10 shadow-lg ring-4 ring-yellow-100'
                                                : isPaid
                                                    ? 'bg-blue-600 border-blue-700 text-white'
                                                    : 'bg-slate-50 border-slate-200 text-slate-300'}
                                        `}
                                    >
                                        <span className={`text-sm font-black ${isWinner ? 'text-yellow-950' : ''}`}>
                                            {num}
                                        </span>
                                        {isWinner && <span className="absolute -top-1 -right-1 text-sm">👑</span>}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Winners Management Table - LARGE as requested */}
                        {winnerNumbers.length > 0 && (
                            <div className="overflow-hidden bg-white rounded-3xl border-2 border-slate-100 shadow-sm mt-10">
                                <div className="bg-slate-50 py-4 px-6 border-b border-slate-100">
                                    <h4 className="font-black text-slate-500 uppercase text-xs tracking-widest">Painel Administrativo de Ganhadores</h4>
                                </div>
                                <table className="w-full">
                                    <tbody className="divide-y divide-slate-100">
                                        {winnerNumbers.sort((a, b) => parseInt(a) - parseInt(b)).map((num) => (
                                            <tr key={num} className="group">
                                                <td className="px-6 py-6 w-24">
                                                    <div className="w-14 h-14 bg-yellow-400 text-yellow-950 rounded-2xl flex items-center justify-center font-black text-xl shadow-md ring-4 ring-yellow-50">
                                                        {num}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    <p className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                                                        {reservations[num]?.name || 'Pendente / Manual'}
                                                    </p>
                                                    <p className="text-slate-400 font-bold text-sm">Vencedor Confirmado</p>
                                                </td>
                                                <td className="px-6 py-6 text-right">
                                                    <button
                                                        onClick={() => handleNumberClick(num)}
                                                        className="text-red-400 hover:text-red-600 font-black text-sm uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        REMOVER
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Print Preview - VERY VISIBLE as requested */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 ml-4">
                        <span className="text-2xl">📱</span>
                        <h3 className="text-2xl font-black text-slate-900">Prévia do Print (Mobile)</h3>
                    </div>

                    <div className="relative group">
                        {/* THE ACTUAL PRINT AREA - New Visual Model */}
                        <div
                            ref={printRef}
                            className="bg-[#001D3D] w-full max-w-[420px] mx-auto p-10 flex flex-col items-center text-white font-sans overflow-hidden min-h-[750px] border-[10px] border-white/5 shadow-2xl"
                            style={{ backgroundImage: 'radial-gradient(circle at top, #003566 0%, #001D3D 100%)' }}
                        >
                            {/* Logo / Brand Header - CENTERED and CORRECTED */}
                            <div className="flex justify-center w-full mb-10">
                                <div className="bg-yellow-400 text-[#001D3D] px-8 py-2.5 rounded-full font-black text-base uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,214,10,0.3)] text-center">
                                    TOPSORTE_027
                                </div>
                            </div>

                            {/* Main Title */}
                            <div className="text-center mb-14 px-4 w-full">
                                <h2 className="text-slate-400 font-extrabold uppercase tracking-widest text-xs mb-3">Resultado Oficial</h2>
                                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic leading-tight text-center">
                                    <span className="text-white block mb-1">Vencedores do</span>
                                    <span className="text-yellow-400 block drop-shadow-lg">Concurso #{raffle.code || '000'}</span>
                                </h1>
                            </div>

                            {/* Winners List Area - NO TRUNCATE, better spacing */}
                            <div className="w-full flex-1 space-y-5">
                                {winnerNumbers.length > 0 ? (
                                    winnerNumbers.sort((a, b) => parseInt(a) - parseInt(b)).map((num) => (
                                        <div key={num} className="flex items-center gap-5 bg-white/5 border border-white/10 p-5 rounded-[1.8rem] backdrop-blur-sm">
                                            <div className="w-14 h-14 min-w-[3.5rem] bg-yellow-400 text-[#001D3D] rounded-2xl flex items-center justify-center font-black text-2xl shadow-[0_0_20px_rgba(255,214,10,0.2)]">
                                                {num}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-0.5">Ganhador(a)</p>
                                                <p className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tighter break-words leading-tight">
                                                    {reservations[num]?.name || '---'}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-64 flex items-center justify-center border-2 border-dashed border-white/10 rounded-[2.5rem]">
                                        <p className="text-white/30 font-black uppercase text-center px-10 leading-relaxed italic">
                                            Selecione os números na tabela <br /> para gerar o resultado
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Footer Message */}
                            <div className="mt-14 text-center w-full">
                                <div className="h-[2px] w-1/4 bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent mx-auto mb-8"></div>
                                <h3 className="text-2xl sm:text-3xl font-black text-yellow-400 uppercase italic tracking-tighter animate-pulse mb-3 text-center">
                                    PARABÉNS AOS GANHADORES!
                                </h3>
                                <p className="text-white/40 font-bold text-xs tracking-widest uppercase">Obrigado a todos por participar</p>
                            </div>
                        </div>

                        {/* Hint Overlay for Admin */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none rounded-[2.5rem]">
                            <p className="text-white font-black text-xl uppercase tracking-tighter italic bg-black/60 px-6 py-3 rounded-full backdrop-blur-md">
                                ÁREA DE CAPTURA ✨
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RaffleGridView;
