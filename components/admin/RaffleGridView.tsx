import React, { useState, useEffect, useRef } from 'react';
import { getReservationsByRaffle } from '../../lib/supabase-admin';
import type { Raffle, Reservation } from '../../types/database';

interface RaffleGridViewProps {
    raffle: Raffle;
    onBack: () => void;
}

interface WinnerEntry {
    id: string;
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
    const [reservations, setReservations] = useState<Record<string, { status: string; name: string; phone?: string }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [winners, setWinners] = useState<WinnerEntry[]>([]);
    const [isCapturing, setIsCapturing] = useState(false);
    const [bgStyle, setBgStyle] = useState<string>('#001D3D');
    const [manualNum, setManualNum] = useState('');
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadReservations();
    }, [raffle.id]);

    const loadReservations = async () => {
        setIsLoading(true);
        const data = await getReservationsByRaffle(raffle.id);
        const map: Record<string, { status: string; name: string; phone?: string }> = {};

        data.forEach(res => {
            if (res.status !== 'cancelled') {
                map[res.number] = {
                    status: res.status,
                    name: res.buyer_name,
                    phone: res.buyer_phone
                };
            }
        });

        setReservations(map);
        setIsLoading(false);
    };

    // Add a number as winner (allows adding the same number multiple times!)
    const handleNumberClick = (num: string) => {
        setWinners(prev => {
            const nextPosition = prev.length + 1;
            return [...prev, {
                id: `${num}_${Date.now()}_${Math.random()}`,
                number: num,
                position: nextPosition,
                customName: reservations[num]?.name || undefined,
            }];
        });
    };

    // Add manual number via input form
    const handleAddManualNumber = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualNum.trim()) return;
        const cleanNum = manualNum.trim().padStart(raffle.total_numbers >= 1000 ? 3 : 2, '0');
        handleNumberClick(cleanNum);
        setManualNum('');
    };

    // Remove a specific winner entry by ID and recalculate positions
    const removeWinnerById = (id: string) => {
        setWinners(prev => {
            const filtered = prev.filter(w => w.id !== id);
            return filtered.map((w, idx) => ({
                ...w,
                position: idx + 1
            }));
        });
    };

    // Update custom name for a specific winner entry ID
    const updateWinnerNameById = (id: string, name: string) => {
        setWinners(prev => prev.map(w => w.id === id ? { ...w, customName: name } : w));
    };

    // Helper: draw a rounded rectangle
    const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    };

    const downloadScreenshot = async () => {
        setIsCapturing(true);
        await new Promise(r => setTimeout(r, 100));

        try {
            const DPR = 3;           // High resolution
            const W = 460;           // Logical width
            const PAD = 30;          // Side padding
            const CARD_W = W - PAD * 2;  // 400px
            const CARD_H = 105;       // Compact card height for visible info
            const CARD_GAP = 16;
            const HEADER_H = 210;
            const FOOTER_H = 85;
            const totalH = HEADER_H + sortedWinners.length * (CARD_H + CARD_GAP) + FOOTER_H + PAD;

            const canvas = document.createElement('canvas');
            canvas.width = W * DPR;
            canvas.height = totalH * DPR;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(DPR, DPR);

            // ── Background ────────────────────────────────────────
            ctx.fillStyle = bgStyle;
            ctx.fillRect(0, 0, W, totalH);

            // helper: centred text
            const centredText = (text: string, y: number, font: string, color: string) => {
                ctx.font = font;
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, W / 2, y);
            };

            // ── TOPSORTE pill ─────────────────────────────────────
            const pillLabel = 'TOPSORTE_027';
            ctx.font = 'bold 16px Montserrat, Arial';
            const pillW = ctx.measureText(pillLabel).width + 56;
            const pillH = 40;
            const pillX = (W - pillW) / 2;
            const pillY = 28;
            ctx.fillStyle = '#FFD60A';
            roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
            ctx.fill();
            ctx.font = '900 16px Montserrat, Arial';
            ctx.fillStyle = '#001D3D';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pillLabel, W / 2, pillY + pillH / 2);

            // ── "Resultado Oficial" subtitle ──────────────────────
            centredText('RESULTADO OFICIAL', 92, '800 12px Montserrat, Arial', '#94a3b8');

            // ── Main Title ────────────────────────────────────────
            ctx.font = '900 32px Montserrat, Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('VENCEDORES DO', W / 2, 134);

            ctx.font = '900 32px Montserrat, Arial';
            ctx.fillStyle = '#FFD60A';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`CONCURSO #${raffle.code || '000'}`, W / 2, 174);

            // ── Winner Cards (Compact & Centered) ────────────────
            sortedWinners.forEach((winner, i) => {
                const pc = getPrintColors(winner.position);
                const pi = getPrizeInfo(winner.position);
                const displayName = winner.customName || reservations[winner.number]?.name || '---';

                const cardY = HEADER_H + i * (CARD_H + CARD_GAP);
                const cardX = PAD;

                // Card background
                ctx.fillStyle = 'rgba(255,255,255,0.08)';
                roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 24);
                ctx.fill();

                // Card border
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1.5;
                roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 24);
                ctx.stroke();

                // 1. Prize label pill (Centered top)
                const labelText = `${pi.icon} ${pi.label.toUpperCase()}`;
                ctx.font = '900 14px Montserrat, Arial';
                const labelW = ctx.measureText(labelText).width + 30;
                const labelH = 28;
                const labelX = (W - labelW) / 2;
                const labelY = cardY + 14;

                ctx.fillStyle = pc.labelBg;
                roundRect(ctx, labelX, labelY, labelW, labelH, labelH / 2);
                ctx.fill();

                ctx.font = '900 13px Montserrat, Arial';
                ctx.fillStyle = pc.labelText;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, W / 2, labelY + labelH / 2);

                // 2. Cota Badge + Winner Name (Centered row)
                const cotaText = `#${winner.number}`;
                ctx.font = '900 22px Montserrat, Arial';
                const cotaW = ctx.measureText(cotaText).width + 24;
                const cotaH = 34;

                const nameText = displayName.toUpperCase();
                let fontSize = 24;
                ctx.font = `900 italic ${fontSize}px Montserrat, Arial`;
                const maxNameW = CARD_W - cotaW - 50;

                while (ctx.measureText(nameText).width > maxNameW && fontSize > 12) {
                    fontSize -= 1;
                    ctx.font = `900 italic ${fontSize}px Montserrat, Arial`;
                }

                const nameW = ctx.measureText(nameText).width;
                const totalRowW = cotaW + 12 + nameW;
                const startX = (W - totalRowW) / 2;
                const rowY = labelY + labelH + 12;

                // Draw Cota badge
                ctx.fillStyle = pc.bg;
                roundRect(ctx, startX, rowY, cotaW, cotaH, 14);
                ctx.fill();

                ctx.fillStyle = pc.text;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '900 20px Montserrat, Arial';
                ctx.fillText(cotaText, startX + cotaW / 2, rowY + cotaH / 2);

                // Draw Name
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.font = `900 italic ${fontSize}px Montserrat, Arial`;
                ctx.fillText(nameText, startX + cotaW + 12, rowY + cotaH / 2);
            });

            // ── Divider ───────────────────────────────────────────
            const divY = HEADER_H + sortedWinners.length * (CARD_H + CARD_GAP) + 12;
            ctx.strokeStyle = 'rgba(255,214,10,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo((W - 60) / 2, divY);
            ctx.lineTo((W + 60) / 2, divY);
            ctx.stroke();

            // ── Footer ────────────────────────────────────────────
            centredText('PARABÉNS AOS GANHADORES!', divY + 32, '900 italic 20px Montserrat, Arial', '#FFD60A');
            centredText('OBRIGADO A TODOS POR PARTICIPAR', divY + 62, '700 11px Montserrat, Arial', 'rgba(255,255,255,0.3)');

            // ── Download ──────────────────────────────────────────
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `ganhadores-top-sorte-${raffle.code || 'resultado'}.png`;
            link.click();
        } catch (error) {
            console.error('Erro ao gerar imagem:', error);
            alert('Erro ao gerar o print. Tente novamente.');
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
                            <p className="text-blue-600 text-xs font-medium mt-0.5">
                                Clique nos números na grade (ou digite a cota abaixo) para adicioná-los. Você pode clicar no mesmo número várias vezes para premiá-lo em posições diferentes (ex: 1º, 2º e 3º prêmio).
                            </p>
                        </div>
                    </div>

                    {/* Manual Number Quick Input */}
                    <form onSubmit={handleAddManualNumber} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 flex flex-wrap sm:flex-nowrap gap-3 items-center">
                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                                Digitar Cota Manual / Repetida
                            </label>
                            <input
                                type="text"
                                value={manualNum}
                                onChange={e => setManualNum(e.target.value)}
                                placeholder="Ex: 06"
                                className="w-full bg-white border-2 border-slate-300 focus:border-purple-600 rounded-xl px-4 py-2.5 font-black text-slate-900 text-base outline-none shadow-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-black transition-all shadow-md active:scale-95 self-end text-sm whitespace-nowrap"
                        >
                            + ADICIONAR PRÊMIO
                        </button>
                    </form>

                    {/* Management Grid */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                🔢 Seleção de Vencedores
                            </h3>
                            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-widest">
                                {winners.length} PRÊMIOS DEFINIDOS
                            </div>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-8">
                            {numbers.map((num) => {
                                const reservation = reservations[num];
                                const numberWinners = winners.filter(w => w.number === num);
                                const isWinner = numberWinners.length > 0;
                                const firstWinner = numberWinners[0];
                                const isPaid = reservation?.status === 'paid';
                                const prizeInfo = firstWinner ? getPrizeInfo(firstWinner.position) : null;

                                return (
                                    <div
                                        key={num}
                                        onClick={() => handleNumberClick(num)}
                                        title={isWinner ? `Cota #${num} (${numberWinners.length}x prêmio): ${firstWinner?.customName || reservations[num]?.name || '---'}` : reservation?.name}
                                        className={`
                                            aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all cursor-pointer select-none relative
                                            ${isWinner
                                                ? 'scale-110 z-10 shadow-lg ring-4 ring-yellow-100'
                                                : isPaid
                                                    ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-500'
                                                    : 'bg-slate-50 border-slate-200 text-slate-300 hover:bg-slate-100'}
                                        `}
                                        style={isWinner ? { backgroundColor: prizeInfo?.bg, borderColor: prizeInfo?.border } : {}}
                                    >
                                        {isWinner && (
                                            <span className="absolute -top-2 -right-2 text-xs font-black bg-purple-600 text-white px-1.5 py-0.5 rounded-full shadow-sm leading-none">
                                                {numberWinners.length > 1 ? `${numberWinners.length}x` : prizeInfo?.icon}
                                            </span>
                                        )}
                                        <span className={`text-sm font-black`} style={isWinner ? { color: prizeInfo?.color } : {}}>
                                            {num}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Winners Management Table with positions, editable names, and removal */}
                        {winners.length > 0 && (
                            <div className="overflow-hidden bg-white rounded-3xl border-2 border-slate-100 shadow-sm mt-10">
                                <div className="bg-slate-50 py-4 px-6 border-b border-slate-100 flex items-center justify-between">
                                    <h4 className="font-black text-slate-500 uppercase text-xs tracking-widest">Sequência de Ganhadores</h4>
                                    <span className="text-xs text-slate-400 font-bold">Total: {winners.length} prêmios</span>
                                </div>
                                <table className="w-full">
                                    <tbody className="divide-y divide-slate-100">
                                        {sortedWinners.map((winner) => {
                                            const prizeInfo = getPrizeInfo(winner.position);
                                            const dbName = reservations[winner.number]?.name;
                                            return (
                                                <tr key={winner.id} className="group">
                                                    <td className="px-5 py-5 w-36">
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <div
                                                                className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-md border-2"
                                                                style={{ backgroundColor: prizeInfo.bg, color: prizeInfo.color, borderColor: prizeInfo.border }}
                                                            >
                                                                #{winner.number}
                                                            </div>
                                                            <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm whitespace-nowrap" style={{ backgroundColor: prizeInfo.bg, color: prizeInfo.color, border: `1px solid ${prizeInfo.border}` }}>
                                                                {prizeInfo.icon} {prizeInfo.label}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-5">
                                                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1">Nome do Ganhador ({prizeInfo.label})</p>
                                                        <input
                                                            type="text"
                                                            value={winner.customName || ''}
                                                            onChange={e => updateWinnerNameById(winner.id, e.target.value)}
                                                            placeholder={dbName || 'Nome manual...'}
                                                            className="w-full bg-white border-2 border-slate-300 focus:border-blue-600 rounded-xl px-4 py-2.5 font-black text-slate-900 text-base shadow-sm outline-none transition-colors"
                                                        />
                                                        {dbName && winner.customName !== dbName && (
                                                            <button
                                                                type="button"
                                                                onClick={() => updateWinnerNameById(winner.id, dbName)}
                                                                className="text-xs text-blue-500 hover:text-blue-700 font-bold mt-1 block"
                                                            >
                                                                ↩ Usar nome do banco: {dbName}
                                                            </button>
                                                        )}
                                                        {reservations[winner.number]?.phone && (
                                                            <div className="mt-2">
                                                                <a
                                                                    href={`https://wa.me/55${reservations[winner.number].phone!.replace(/\D/g, '')}?text=${encodeURIComponent(`Parabéns ${winner.customName || dbName || 'Ganhador'}! Você foi o ganhador do ${prizeInfo.label} no Top Sorte 027 com a cota #${winner.number}! 🎉🏆`)}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
                                                                >
                                                                    <span>💬</span> WhatsApp: {reservations[winner.number].phone}
                                                                </a>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => removeWinnerById(winner.id)}
                                                            className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl font-black text-xs uppercase transition-colors"
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
                    <div className="flex items-center justify-between ml-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📱</span>
                            <h3 className="text-2xl font-black text-slate-900">Prévia do Print (Mobile)</h3>
                        </div>
                    </div>

                    {/* Color Selector Controls */}
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-lg space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-black text-slate-800 flex items-center gap-2">
                                🎨 Cor de Fundo do Print
                            </span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Escolha a cor
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            {[
                                { name: 'Azul Marinho', hex: '#001D3D' },
                                { name: 'Preto Luxo', hex: '#0A0A0A' },
                                { name: 'Roxo Sorte', hex: '#2E1065' },
                                { name: 'Verde Esmeralda', hex: '#022C22' },
                                { name: 'Vinho Nobre', hex: '#450A0A' },
                                { name: 'Dourado', hex: '#451A03' },
                            ].map(c => (
                                <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => setBgStyle(c.hex)}
                                    className={`w-10 h-10 rounded-2xl border-2 transition-all flex items-center justify-center shadow-sm ${bgStyle === c.hex ? 'ring-4 ring-purple-300 scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'}`}
                                    style={{ backgroundColor: c.hex }}
                                    title={c.name}
                                >
                                    {bgStyle === c.hex && <span className="text-white text-xs font-black">✓</span>}
                                </button>
                            ))}

                            {/* Custom Color Picker */}
                            <label className="relative cursor-pointer flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-2xl border-2 border-slate-200 transition-colors ml-auto text-xs font-black text-slate-700 shadow-sm active:scale-95">
                                <span>🎨 Personalizada</span>
                                <input
                                    type="color"
                                    value={bgStyle}
                                    onChange={e => setBgStyle(e.target.value)}
                                    className="w-6 h-6 rounded-lg cursor-pointer border-0 bg-transparent"
                                />
                            </label>
                        </div>
                    </div>

                    <div className="w-full flex justify-center items-center py-4 overflow-x-auto">
                        <div
                            id="print-area-capture"
                            ref={printRef}
                            className="mx-auto text-white shadow-2xl transition-colors duration-300 rounded-[2.5rem]"
                            style={{
                                backgroundColor: bgStyle,
                                width: '100%',
                                maxWidth: '420px',
                                minHeight: '560px',
                                padding: '36px 20px',
                                border: '8px solid rgba(255, 255, 255, 0.08)',
                                display: 'block',
                                boxSizing: 'border-box',
                                position: 'relative'
                            }}
                        >
                            {/* Logo / Brand Header */}
                            <div style={{ marginBottom: '24px', width: '100%', textAlign: 'center' }}>
                                <div style={{
                                    display: 'inline-block',
                                    backgroundColor: '#FFD60A',
                                    color: '#001D3D',
                                    padding: '10px 32px',
                                    borderRadius: '50px',
                                    fontWeight: '900',
                                    fontSize: '16px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    textAlign: 'center',
                                    boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
                                }}>
                                    TOPSORTE_027
                                </div>
                            </div>

                            {/* Main Title */}
                            <div style={{ marginBottom: '32px', width: '100%', textAlign: 'center' }}>
                                <h2 style={{ color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '11px', marginBottom: '8px' }}>
                                    Resultado Oficial
                                </h2>
                                <h1 style={{ color: '#ffffff', fontWeight: '900', fontSize: '30px', textTransform: 'uppercase', letterSpacing: '-0.02em', fontStyle: 'italic', lineHeight: '1.1' }}>
                                    Vencedores do <br />
                                    <span style={{ color: '#FFD60A' }}>Concurso #{raffle.code || '000'}</span>
                                </h1>
                            </div>

                            {/* Winners List (Compact & Centered) */}
                            <div style={{ width: '100%', marginBottom: '28px' }}>
                                {sortedWinners.length > 0 ? (
                                    sortedWinners.map((winner) => {
                                        const printColors = getPrintColors(winner.position);
                                        const prizeInfo = getPrizeInfo(winner.position);
                                        const displayName = winner.customName || reservations[winner.number]?.name || '---';
                                        return (
                                            <div key={winner.id} style={{
                                                display: 'block',
                                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                                border: '1.5px solid rgba(255, 255, 255, 0.18)',
                                                borderRadius: '24px',
                                                marginBottom: '16px',
                                                marginLeft: 'auto',
                                                marginRight: 'auto',
                                                width: '100%',
                                                maxWidth: '360px',
                                                boxSizing: 'border-box',
                                                padding: '14px 16px',
                                                textAlign: 'center',
                                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                                            }}>
                                                {/* Prize label pill */}
                                                <div style={{
                                                    display: 'inline-block',
                                                    backgroundColor: printColors.labelBg,
                                                    color: printColors.labelText,
                                                    fontWeight: '900',
                                                    fontSize: '13px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.08em',
                                                    padding: '4px 16px',
                                                    borderRadius: '50px',
                                                    marginBottom: '10px',
                                                    boxShadow: '0 3px 10px rgba(0,0,0,0.2)'
                                                }}>
                                                    {prizeInfo.icon} {prizeInfo.label}
                                                </div>

                                                {/* Cota Badge + Name Centered Row */}
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '10px',
                                                    width: '100%'
                                                }}>
                                                    <div style={{
                                                        backgroundColor: printColors.bg,
                                                        color: printColors.text,
                                                        borderRadius: '14px',
                                                        fontWeight: '900',
                                                        fontSize: '20px',
                                                        padding: '4px 14px',
                                                        lineHeight: '1.3',
                                                        textAlign: 'center',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                                        whiteSpace: 'nowrap',
                                                        flexShrink: 0
                                                    }}>
                                                        #{winner.number}
                                                    </div>
                                                    <div style={{
                                                        color: '#ffffff',
                                                        fontWeight: '900',
                                                        fontSize: '20px',
                                                        textTransform: 'uppercase',
                                                        fontStyle: 'italic',
                                                        letterSpacing: '-0.02em',
                                                        lineHeight: '1.1',
                                                        wordBreak: 'break-word',
                                                        textAlign: 'center'
                                                    }}>
                                                        {displayName}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '320px',
                                        height: '160px',
                                        margin: '0 auto',
                                        border: '2px dashed rgba(255, 255, 255, 0.1)',
                                        borderRadius: '30px',
                                        display: 'table',
                                    }}>
                                        <div style={{
                                            display: 'table-cell',
                                            verticalAlign: 'middle',
                                            textAlign: 'center',
                                            padding: '0 20px',
                                        }}>
                                            <p style={{ color: 'rgba(255, 255, 255, 0.2)', fontWeight: '900', textTransform: 'uppercase', fontStyle: 'italic', margin: 0 }}>
                                                Selecione os números na tabela <br /> para gerar o resultado
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                                <div style={{ width: '100%', textAlign: 'center', marginTop: 'auto', paddingBottom: '16px' }}>
                                    <div style={{ height: '2px', width: '50px', backgroundColor: 'rgba(255, 214, 10, 0.3)', margin: '0 auto 20px' }}></div>
                                    <h3 style={{ color: '#FFD60A', fontWeight: '900', fontSize: '20px', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', marginBottom: '8px' }}>
                                        PARABÉNS AOS GANHADORES!
                                    </h3>
                                    <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: '800', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                        Obrigado a todos por participar
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RaffleGridView;
