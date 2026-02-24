import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { getReservationsByRaffle } from '../../lib/supabase-admin';
import type { Raffle, Reservation } from '../../types/database';

interface RaffleGridViewProps {
    raffle: Raffle;
    onBack: () => void;
}

interface WinnerEntry {
    number: string;
    position: number; // 1, 2, 3, ...
    customName?: string; // Manual override name
}

const PRIZE_LABELS: Record<number, { label: string; icon: string; color: string; bg: string; border: string }> = {
    1: { label: '1º Prêmio', icon: '🥇', color: '#78350f', bg: '#FDE68A', border: '#D97706' },
    2: { label: '2º Prêmio', icon: '🥈', color: '#1e293b', bg: '#E2E8F0', border: '#94A3B8' },
    3: { label: '3º Prêmio', icon: '🥉', color: '#7c2d12', bg: '#FED7AA', border: '#EA580C' },
};

const PRIZE_PRINT_COLORS: Record<number, { bg: string; text: string; labelBg: string; labelText: string }> = {
    1: { bg: '#FFD60A', text: '#001D3D', labelBg: '#FF9900', labelText: '#fff' },
    2: { bg: '#E2E8F0', text: '#1e293b', labelBg: '#94A3B8', labelText: '#1e293b' },
    3: { bg: '#FED7AA', text: '#7c2d12', labelBg: '#EA580C', labelText: '#fff' },
};

const getPrizeInfo = (position: number) =>
    PRIZE_LABELS[position] || {
        label: `${position}º Prêmio`,
        icon: '🏅',
        color: '#4b5563',
        bg: '#F3F4F6',
        border: '#9CA3AF',
    };

const getPrintColors = (position: number) =>
    PRIZE_PRINT_COLORS[position] || { bg: '#334155', text: '#fff', labelBg: '#475569', labelText: '#fff' };

const RaffleGridView: React.FC<RaffleGridViewProps> = ({ raffle, onBack }) => {
    const [reservations, setReservations] = useState<Record<string, { status: string; name: string }>>({});
    const [isLoading, setIsLoading] = useState(true);
    // Feature 4: Winners with prize positions
    const [winners, setWinners] = useState<WinnerEntry[]>([]);
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

    // Feature 4: Click a number to toggle winner status, cycling through positions
    const handleNumberClick = (num: string) => {
        setWinners(prev => {
            const existing = prev.find(w => w.number === num);
            if (existing) {
                // Remove from winners list
                return prev.filter(w => w.number !== num);
            } else {
                // Add as next prize position
                const nextPosition = (prev.length > 0 ? Math.max(...prev.map(w => w.position)) : 0) + 1;
                return [...prev, {
                    number: num,
                    position: nextPosition,
                    customName: reservations[num]?.name || undefined,
                }];
            }
        });
    };

    // Feature 4: Update the custom name (override) for a winner
    const updateWinnerName = (number: string, name: string) => {
        setWinners(prev => prev.map(w => w.number === number ? { ...w, customName: name } : w));
    };

    const downloadScreenshot = async () => {
        if (!printRef.current) return;

        setIsCapturing(true);
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            const canvas = await html2canvas(printRef.current, {
                useCORS: true,
                scale: 3,
                backgroundColor: '#001D3D',
                width: 420,
                height: printRef.current.offsetHeight,
                logging: false,
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('print-area-capture');
                    if (el) {
                        el.style.display = 'block';
                        el.style.margin = '0';
                        el.style.padding = '48px';
                    }
                }
            });

            const image = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = image;
            const winnersText = winners.length > 0 ? `vencedores` : 'resultado';
            link.download = `ganhadores-top-sorte-${winnersText}.png`;
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
    const sortedWinners = [...winners].sort((a, b) => a.position - b.position);

    return (
        <div className="space-y-10 pb-20">
            {/* Header Control */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-3xl">📸</div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gerador de Prints</h2>
                        <p className="text-lg text-slate-500 font-bold">Defina a sequência de ganhadores e gere o resultado</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={downloadScreenshot}
                        disabled={isCapturing || winners.length === 0}
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
                    {/* Instruction callout */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-6 py-4 flex items-start gap-3">
                        <span className="text-xl mt-0.5">ℹ️</span>
                        <div>
                            <p className="font-black text-blue-800 text-sm">Como definir os ganhadores</p>
                            <p className="text-blue-600 text-xs font-medium mt-0.5">Clique nos números para marcá-los como prêmios. O primeiro número clicado vira 🥇 1º Prêmio, o segundo 🥈 2º, e assim por diante. Clique novamente para remover.</p>
                        </div>
                    </div>

                    {/* Management Grid */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                🔢 Seleção de Vencedores
                            </h3>
                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest">
                                {winners.length} SELECIONADOS
                            </div>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">
                            {numbers.map((num) => {
                                const reservation = reservations[num];
                                const winner = winners.find(w => w.number === num);
                                const isPaid = reservation?.status === 'paid';
                                const prizeInfo = winner ? getPrizeInfo(winner.position) : null;

                                return (
                                    <div
                                        key={num}
                                        onClick={() => handleNumberClick(num)}
                                        title={winner ? `${prizeInfo?.label}: ${winner.customName || reservations[num]?.name || '---'}` : reservation?.name}
                                        className={`
                                            aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all cursor-pointer select-none relative
                                            ${winner
                                                ? 'scale-110 z-10 shadow-lg ring-4 ring-yellow-100'
                                                : isPaid
                                                    ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-500'
                                                    : 'bg-slate-50 border-slate-200 text-slate-300 hover:bg-slate-100'}
                                        `}
                                        style={winner ? { backgroundColor: prizeInfo?.bg, borderColor: prizeInfo?.border } : {}}
                                    >
                                        {winner && (
                                            <span className="absolute -top-2 -right-2 text-base leading-none">{prizeInfo?.icon}</span>
                                        )}
                                        <span className={`text-sm font-black`} style={winner ? { color: prizeInfo?.color } : {}}>
                                            {num}
                                        </span>
                                        {winner && (
                                            <span className="text-[8px] font-black uppercase" style={{ color: prizeInfo?.color }}>
                                                {winner.position}º
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Feature 4: Winners Management Table with positions and editable names */}
                        {winners.length > 0 && (
                            <div className="overflow-hidden bg-white rounded-3xl border-2 border-slate-100 shadow-sm mt-10">
                                <div className="bg-slate-50 py-4 px-6 border-b border-slate-100">
                                    <h4 className="font-black text-slate-500 uppercase text-xs tracking-widest">Sequência de Ganhadores</h4>
                                </div>
                                <table className="w-full">
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedWinners.map((winner) => {
                                            const prizeInfo = getPrizeInfo(winner.position);
                                            const dbName = reservations[winner.number]?.name;
                                            return (
                                                <tr key={winner.number} className="group">
                                                    <td className="px-4 py-4 w-28">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div
                                                                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md"
                                                                style={{ backgroundColor: prizeInfo.bg, color: prizeInfo.color, border: `2px solid ${prizeInfo.border}` }}
                                                            >
                                                                {winner.number}
                                                            </div>
                                                            <span className="text-[10px] font-black uppercase" style={{ color: prizeInfo.color }}>
                                                                {prizeInfo.icon} {prizeInfo.label}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Nome do Ganhador</p>
                                                        <input
                                                            type="text"
                                                            value={winner.customName || ''}
                                                            onChange={e => updateWinnerName(winner.number, e.target.value)}
                                                            placeholder={dbName || 'Nome manual...'}
                                                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800 text-sm outline-none focus:border-blue-500 transition-colors"
                                                        />
                                                        {dbName && winner.customName !== dbName && (
                                                            <button
                                                                onClick={() => updateWinnerName(winner.number, dbName)}
                                                                className="text-xs text-blue-500 hover:text-blue-700 font-bold mt-1"
                                                            >
                                                                ↩ Usar nome do banco: {dbName}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            onClick={() => handleNumberClick(winner.number)}
                                                            className="text-red-400 hover:text-red-600 font-black text-xs uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            ✕ REMOVER
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Print Preview */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 ml-4">
                        <span className="text-2xl">📱</span>
                        <h3 className="text-2xl font-black text-slate-900">Prévia do Print (Mobile)</h3>
                    </div>

                    <div className="relative">
                        <div
                            id="print-area-capture"
                            ref={printRef}
                            className="bg-[#001D3D] mx-auto p-12 text-white"
                            style={{
                                width: '420px',
                                minHeight: '800px',
                                border: '12px solid rgba(255, 255, 255, 0.05)',
                                display: 'block',
                                boxSizing: 'border-box',
                                position: 'relative'
                            }}
                        >
                            {/* Logo / Brand Header */}
                            <div style={{ marginBottom: '40px', width: '100%', display: 'flex', justifyContent: 'center' }}>
                                <div style={{
                                    backgroundColor: '#FFD60A',
                                    color: '#001D3D',
                                    padding: '12px 0',
                                    width: '260px',
                                    borderRadius: '50px',
                                    fontWeight: '900',
                                    fontSize: '18px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.2em',
                                    textAlign: 'center',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                                }}>
                                    TOPSORTE_027
                                </div>
                            </div>

                            {/* Main Title */}
                            <div style={{ marginBottom: '60px', width: '100%', textAlign: 'center' }}>
                                <h2 style={{ color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '12px', marginBottom: '15px' }}>
                                    Resultado Oficial
                                </h2>
                                <h1 style={{ color: '#ffffff', fontWeight: '900', fontSize: '36px', textTransform: 'uppercase', letterSpacing: '-0.02em', fontStyle: 'italic', lineHeight: '1.1' }}>
                                    Vencedores do <br />
                                    <span style={{ color: '#FFD60A' }}>Concurso #{raffle.code || '000'}</span>
                                </h1>
                            </div>

                            {/* Feature 4: Winners List with prize positions */}
                            <div style={{ width: '100%', marginBottom: '40px' }}>
                                {sortedWinners.length > 0 ? (
                                    sortedWinners.map((winner) => {
                                        const printColors = getPrintColors(winner.position);
                                        const prizeInfo = getPrizeInfo(winner.position);
                                        const displayName = winner.customName || reservations[winner.number]?.name || '---';
                                        return (
                                            <div key={winner.number} style={{
                                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                padding: '20px 24px',
                                                borderRadius: '35px',
                                                marginBottom: '20px',
                                                marginLeft: 'auto',
                                                marginRight: 'auto',
                                                width: '320px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                textAlign: 'left',
                                                boxSizing: 'border-box'
                                            }}>
                                                {/* Prize number badge */}
                                                <div style={{
                                                    width: '60px',
                                                    height: '60px',
                                                    minWidth: '60px',
                                                    backgroundColor: printColors.bg,
                                                    color: printColors.text,
                                                    borderRadius: '18px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: '900',
                                                    fontSize: '22px',
                                                    lineHeight: '1'
                                                }}>
                                                    {winner.number}
                                                </div>
                                                {/* Name & prize label */}
                                                <div style={{ flex: '1', minWidth: '0' }}>
                                                    <div style={{
                                                        display: 'inline-block',
                                                        backgroundColor: printColors.labelBg,
                                                        color: printColors.labelText,
                                                        fontWeight: '900',
                                                        fontSize: '9px',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.12em',
                                                        padding: '3px 10px',
                                                        borderRadius: '50px',
                                                        marginBottom: '6px'
                                                    }}>
                                                        {prizeInfo.icon} {prizeInfo.label}
                                                    </div>
                                                    <p style={{ color: '#ffffff', fontWeight: '900', fontSize: '22px', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1', margin: 0 }}>
                                                        {displayName}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(255, 255, 255, 0.1)', borderRadius: '40px', margin: '0 auto', width: '320px' }}>
                                        <p style={{ color: 'rgba(255, 255, 255, 0.2)', fontWeight: '900', textTransform: 'uppercase', textAlign: 'center', padding: '0 40px', fontStyle: 'italic' }}>
                                            Selecione os números na tabela <br /> para gerar o resultado
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div style={{ width: '100%', textAlign: 'center', marginTop: 'auto', paddingBottom: '20px' }}>
                                <div style={{ height: '2px', width: '60px', backgroundColor: 'rgba(255, 214, 10, 0.3)', margin: '0 auto 30px' }}></div>
                                <h3 style={{ color: '#FFD60A', fontWeight: '900', fontSize: '28px', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', marginBottom: '10px' }}>
                                    PARABÉNS AOS GANHADORES!
                                </h3>
                                <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    Obrigado a todos por participar
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RaffleGridView;
