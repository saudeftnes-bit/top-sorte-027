import React, { useState, useEffect, useRef } from 'react';
import { getReservationsByRaffle } from '../../lib/supabase-admin';
import type { Raffle } from '../../types/database';

interface RaffleGridViewProps {
    raffle: Raffle;
    onBack: () => void;
}

interface WinnerEntry {
    id: string; // Identificador único de cada premiação (permite cotas repetidas)
    number: string;
    position: number; // 1, 2, 3, ...
    customName?: string; // Nome personalizado / apelido público
}

// Paletas pré-definidas de alta conversão (Seção 3.5 do documento)
const PRESET_PALETTES = [
    { name: 'Azul Marinho Oficial', hex: '#001D3D', icon: '🔵' },
    { name: 'Preto Luxo', hex: '#0A0A0A', icon: '⚫' },
    { name: 'Roxo Sorte', hex: '#2E1065', icon: '🟣' },
    { name: 'Verde Esmeralda', hex: '#022C22', icon: '🟢' },
    { name: 'Vinho Nobre', hex: '#450A0A', icon: '🔴' },
    { name: 'Dourado Nobre', hex: '#451A03', icon: '🟤' },
];

// Estilos de badges e medalhas para cada colocação
const PRIZE_LABELS: Record<number, { label: string; icon: string; color: string; bg: string; border: string }> = {
    1: { label: '1º Prêmio', icon: '🥇', color: '#001D3D', bg: '#FDE68A', border: '#D97706' },
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
        color: '#ffffff',
        bg: '#334155',
        border: '#475569',
    };

const getPrintColors = (position: number) =>
    PRIZE_PRINT_COLORS[position] || { bg: '#334155', text: '#ffffff', labelBg: '#475569', labelText: '#ffffff' };

const RaffleGridView: React.FC<RaffleGridViewProps> = ({ raffle, onBack }) => {
    const [reservations, setReservations] = useState<Record<string, { status: string; name: string; phone?: string }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [winners, setWinners] = useState<WinnerEntry[]>([]);
    const [selectedBgColor, setSelectedBgColor] = useState<string>('#001D3D');
    const [manualNumber, setManualNumber] = useState<string>('');
    const [isCapturing, setIsCapturing] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadReservations();
    }, [raffle.id]);

    const loadReservations = async () => {
        setIsLoading(true);
        try {
            const data = await getReservationsByRaffle(raffle.id);
            const map: Record<string, { status: string; name: string; phone?: string }> = {};

            data.forEach(res => {
                if (res.status !== 'cancelled') {
                    map[res.number] = {
                        status: res.status,
                        name: res.buyer_name,
                        phone: res.buyer_phone,
                    };
                }
            });

            setReservations(map);
        } catch (error) {
            console.error('Erro ao carregar reservas:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const total = raffle.total_numbers || 100;
    const hasZero = '00' in reservations || '000' in reservations || '0' in reservations;
    const hasMax = String(total) in reservations;
    const startFromZero = hasZero || (!hasMax && total === 100);
    const padLength = total >= 1000 ? (total >= 10000 ? 4 : 3) : 2;
    const numbers = Array.from({ length: total }, (_, i) =>
        (startFromZero ? i : i + 1).toString().padStart(padLength, '0')
    );

    // Adiciona uma cota premiada na sequência (suporta cotas repetidas)
    const addWinner = (rawNum: string) => {
        const formatted = rawNum.trim().padStart(padLength, '0');
        const newEntry: WinnerEntry = {
            id: `${formatted}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            number: formatted,
            position: winners.length + 1,
            customName: reservations[formatted]?.name || undefined,
        };
        setWinners(prev => [...prev, newEntry]);
    };

    // Submissão do formulário manual
    const handleManualAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualNumber.trim()) return;
        addWinner(manualNumber.trim());
        setManualNumber('');
    };

    // Remove uma cota premiada e recalcula as colocações subsequentes
    const removeWinner = (id: string) => {
        setWinners(prev => {
            const remaining = prev.filter(w => w.id !== id);
            return remaining.map((w, index) => ({
                ...w,
                position: index + 1,
            }));
        });
    };

    // Atualiza nome customizado do ganhador
    const updateWinnerName = (id: string, name: string) => {
        setWinners(prev => prev.map(w => w.id === id ? { ...w, customName: name } : w));
    };

    // Notificação via WhatsApp direto com mensagem pronta
    const openWhatsApp = (winner: WinnerEntry) => {
        const rawPhone = reservations[winner.number]?.phone || '';
        const digits = rawPhone.replace(/\D/g, '');
        let finalPhone = digits;
        if (finalPhone.length >= 10 && finalPhone.length <= 11) {
            finalPhone = '55' + finalPhone;
        }
        const prizeInfo = getPrizeInfo(winner.position);
        const winnerName = winner.customName || reservations[winner.number]?.name || 'Ganhador';
        const message = `Parabéns ${winnerName}! Você foi o ganhador do ${prizeInfo.label} no TopPix com a cota #${winner.number}! 🎉🏆`;
        const url = finalPhone
            ? `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    // Helper: desenha retângulo arredondado no Canvas
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

    // Geração do Print via Canvas 2D Ultra HD (DPR = 3)
    const downloadScreenshot = async () => {
        setIsCapturing(true);
        await new Promise(r => setTimeout(r, 100));

        try {
            const DPR = 3;           // Resolução 3x Ultra HD
            const W = 420;           // Largura lógica
            const PAD = 48;          // Padding lateral
            const CARD_W = W - PAD * 2;  // 324px
            const CARD_H = 110;
            const CARD_GAP = 20;
            const HEADER_H = 280;
            const FOOTER_H = 120;
            const totalH = HEADER_H + sortedWinners.length * (CARD_H + CARD_GAP) + FOOTER_H + PAD;

            const canvas = document.createElement('canvas');
            canvas.width = W * DPR;
            canvas.height = totalH * DPR;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(DPR, DPR);

            // ── Background com cor selecionada ─────────────────────
            ctx.fillStyle = selectedBgColor;
            ctx.fillRect(0, 0, W, totalH);

            // helper: texto centralizado
            const centredText = (text: string, y: number, font: string, color: string) => {
                ctx.font = font;
                ctx.fillStyle = color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, W / 2, y);
            };

            // ── Pílula de Marca: TOPPIX ───────────────────────────
            const pillLabel = 'TOPPIX';
            ctx.font = 'bold 18px Montserrat, Arial';
            const pillW = ctx.measureText(pillLabel).width + 64;
            const pillH = 46;
            const pillX = (W - pillW) / 2;
            const pillY = 40;
            ctx.fillStyle = '#FFD60A';
            roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
            ctx.fill();
            ctx.font = '900 18px Montserrat, Arial';
            ctx.fillStyle = '#001D3D';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pillLabel, W / 2, pillY + pillH / 2);

            // ── Subtítulo "Resultado Oficial" ──────────────────────
            centredText('RESULTADO OFICIAL', 118, '700 13px Montserrat, Arial', '#94a3b8');

            // ── Título Principal ──────────────────────────────────
            ctx.font = '900 38px Montserrat, Arial';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('VENCEDORES DO', W / 2, 165);

            ctx.font = '900 38px Montserrat, Arial';
            ctx.fillStyle = '#FFD60A';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`CONCURSO #${raffle.code || '000'}`, W / 2, 215);

            // ── Cartões de Prêmios ────────────────────────────────
            const BADGE_SIZE = 80;
            const BADGE_RADIUS = 20;

            sortedWinners.forEach((winner, i) => {
                const pc = getPrintColors(winner.position);
                const pi = getPrizeInfo(winner.position);
                const displayName = winner.customName || reservations[winner.number]?.name || '---';

                const cardY = HEADER_H + i * (CARD_H + CARD_GAP);
                const cardX = PAD;

                // Fundo do Card
                ctx.fillStyle = 'rgba(255,255,255,0.07)';
                roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 28);
                ctx.fill();

                // Borda do Card
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 1;
                roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 28);
                ctx.stroke();

                // Badge do Número da Cota (Lado esquerdo)
                const badgeX = cardX + 20;
                const badgeY = cardY + (CARD_H - BADGE_SIZE) / 2;
                ctx.fillStyle = pc.bg;
                roundRect(ctx, badgeX, badgeY, BADGE_SIZE, BADGE_SIZE, BADGE_RADIUS);
                ctx.fill();

                // Texto do Número
                ctx.font = '900 30px Montserrat, Arial';
                ctx.fillStyle = pc.text;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(winner.number, badgeX + BADGE_SIZE / 2, badgeY + BADGE_SIZE / 2);

                // Pílula da Colocação (Lado direito superior)
                const labelText = `${pi.icon} ${pi.label.toUpperCase()}`;
                ctx.font = '700 14px Montserrat, Arial';
                const labelW = ctx.measureText(labelText).width + 28;
                const labelH = 28;
                const labelX = badgeX + BADGE_SIZE + 18;
                const labelY = cardY + 22;
                ctx.fillStyle = pc.labelBg;
                roundRect(ctx, labelX, labelY, labelW, labelH, labelH / 2);
                ctx.fill();

                ctx.font = '700 13px Montserrat, Arial';
                ctx.fillStyle = pc.labelText;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, labelX + 14, labelY + labelH / 2);

                // Nome do Ganhador com algoritmo anti-quebra de texto
                const nameY = labelY + labelH + 14;
                const maxNameW = CARD_W - BADGE_SIZE - 56;
                let fontSize = 26;
                ctx.font = `900 italic ${fontSize}px Montserrat, Arial`;
                let nameDisplay = displayName.toUpperCase();

                while (ctx.measureText(nameDisplay).width > maxNameW && fontSize > 11) {
                    fontSize -= 1;
                    ctx.font = `900 italic ${fontSize}px Montserrat, Arial`;
                }

                if (fontSize <= 11) {
                    while (ctx.measureText(nameDisplay).width > maxNameW && nameDisplay.length > 3) {
                        nameDisplay = nameDisplay.slice(0, -1);
                    }
                    if (nameDisplay !== displayName.toUpperCase()) nameDisplay += '…';
                }

                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(nameDisplay, labelX, nameY);
            });

            // ── Linha Divisória Dourada ────────────────────────────
            const divY = HEADER_H + sortedWinners.length * (CARD_H + CARD_GAP) + 24;
            ctx.strokeStyle = 'rgba(255,214,10,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo((W - 60) / 2, divY);
            ctx.lineTo((W + 60) / 2, divY);
            ctx.stroke();

            // ── Rodapé Comemorativo ────────────────────────────────
            centredText('PARABÉNS AOS GANHADORES!', divY + 40, '900 italic 22px Montserrat, Arial', '#FFD60A');
            centredText('OBRIGADO A TODOS POR PARTICIPAR', divY + 80, '700 12px Montserrat, Arial', 'rgba(255,255,255,0.3)');

            // ── Download Padronizado ───────────────────────────────
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `ganhadores-toppix-${raffle.code || 'resultado'}.png`;
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
                <div className="animate-spin rounded-full h-16 w-16 border-8 border-yellow-500 border-t-transparent"></div>
            </div>
        );
    }

    const sortedWinners = [...winners].sort((a, b) => a.position - b.position);

    return (
        <div className="space-y-10 pb-20">
            {/* Barra Superior de Controle */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-yellow-100 rounded-2xl flex items-center justify-center text-3xl">
                        📸
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-yellow-400 text-blue-950 font-black text-xs px-2.5 py-0.5 rounded-full">
                                TOPPIX
                            </span>
                            <span className="text-xs font-bold text-slate-400">Concurso #{raffle.code || '000'}</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">Grade e Gerador de Print</h2>
                        <p className="text-sm text-slate-500 font-bold">Conferência visual de cotas e divulgação oficial de resultados</p>
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
                {/* Coluna 1: Gestão de Ganhadores e Grade */}
                <div className="space-y-8">
                    {/* Callout de Instrução Operacional */}
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-6 py-4 flex items-start gap-3">
                        <span className="text-2xl mt-0.5">ℹ️</span>
                        <div>
                            <p className="font-black text-blue-900 text-sm">Como definir os ganhadores</p>
                            <p className="text-blue-700 text-xs font-medium mt-1 leading-relaxed">
                                Clique diretamente em qualquer cota da grade para marcá-la na ordem dos prêmios (1º, 2º, 3º...). Para cotas repetidas ou busca rápida, utilize o campo manual abaixo.
                            </p>
                        </div>
                    </div>

                    {/* Entrada Manual de Cota / Repetida */}
                    <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                        <form onSubmit={handleManualAdd} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <div className="flex-1">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-1">
                                    Digitar Cota Manual / Repetida
                                </label>
                                <input
                                    type="text"
                                    value={manualNumber}
                                    onChange={e => setManualNumber(e.target.value)}
                                    placeholder={`Ex: 7 ou 07 (até ${total})`}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-slate-800 text-base outline-none focus:border-yellow-500 focus:bg-white transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                className="sm:self-end bg-yellow-400 hover:bg-yellow-500 text-blue-950 font-black px-6 py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm uppercase tracking-wide flex items-center justify-center gap-2"
                            >
                                <span>+</span> Adicionar Prêmio
                            </button>
                        </form>
                    </div>

                    {/* Grade Interativa de Cotas */}
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                                    🔢 Grade Interativa de Cotas
                                </h3>
                                <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-bold text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded bg-slate-200 inline-block"></span> Livre
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded bg-blue-600 inline-block"></span> Paga
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 rounded bg-yellow-300 border border-amber-600 inline-block"></span> Premiada
                                    </span>
                                </div>
                            </div>
                            <div className="bg-blue-50 text-blue-800 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider">
                                {winners.length} {winners.length === 1 ? 'PREMIADO' : 'PREMIADOS'}
                            </div>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-4 max-h-[460px] overflow-y-auto p-1 rounded-2xl border border-slate-100">
                            {numbers.map((num) => {
                                const reservation = reservations[num];
                                const matchingWinners = winners.filter(w => w.number === num);
                                const isWinner = matchingWinners.length > 0;
                                const firstWinner = matchingWinners[0];
                                const isPaid = reservation?.status === 'paid';
                                const prizeInfo = isWinner ? getPrizeInfo(firstWinner.position) : null;
                                const timesAwarded = matchingWinners.length;

                                const tooltip = isWinner
                                    ? matchingWinners.map(w => `${getPrizeInfo(w.position).label}: ${w.customName || reservations[num]?.name || '---'}`).join(' | ')
                                    : reservation?.name ? `Comprador: ${reservation.name} (${reservation.status})` : `Cota #${num} Disponível`;

                                return (
                                    <div
                                        key={num}
                                        onClick={() => addWinner(num)}
                                        title={tooltip}
                                        className={`
                                            aspect-square flex flex-col items-center justify-center rounded-xl border-2 transition-all cursor-pointer select-none relative
                                            ${isWinner
                                                ? 'scale-105 z-10 shadow-lg ring-4 ring-yellow-200 font-black'
                                                : isPaid
                                                    ? 'bg-blue-600 border-blue-700 text-white hover:bg-blue-500'
                                                    : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}
                                        `}
                                        style={isWinner ? { backgroundColor: prizeInfo?.bg, borderColor: prizeInfo?.border } : {}}
                                    >
                                        {isWinner && (
                                            <span className="absolute -top-1.5 -right-1.5 text-xs leading-none">
                                                {prizeInfo?.icon}
                                            </span>
                                        )}
                                        {timesAwarded > 1 && (
                                            <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white text-[9px] font-black px-1 rounded-full shadow">
                                                {timesAwarded}x
                                            </span>
                                        )}
                                        <span className="text-sm font-black" style={isWinner ? { color: prizeInfo?.color } : {}}>
                                            {num}
                                        </span>
                                        {isWinner && (
                                            <span className="text-[8px] font-black uppercase leading-tight" style={{ color: prizeInfo?.color }}>
                                                {firstWinner.position}º
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tabela de Gestão e Sequência de Ganhadores */}
                    {winners.length > 0 && (
                        <div className="overflow-hidden bg-white rounded-3xl border-2 border-slate-100 shadow-xl">
                            <div className="bg-slate-50 py-4 px-6 border-b border-slate-100 flex items-center justify-between">
                                <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest">
                                    Sequência Oficial de Ganhadores
                                </h4>
                                <span className="text-xs font-bold text-slate-400">Total: {winners.length} prêmios</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {sortedWinners.map((winner) => {
                                    const prizeInfo = getPrizeInfo(winner.position);
                                    const dbName = reservations[winner.number]?.name;
                                    const rawPhone = reservations[winner.number]?.phone;

                                    return (
                                        <div key={winner.id} className="p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                            {/* Badge do Prêmio */}
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shadow-md flex-shrink-0"
                                                    style={{ backgroundColor: prizeInfo.bg, color: prizeInfo.color, border: `2px solid ${prizeInfo.border}` }}
                                                >
                                                    <span className="text-base leading-none">{winner.number}</span>
                                                    <span className="text-[10px] mt-0.5 uppercase">{winner.position}º</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-black uppercase tracking-wider block" style={{ color: prizeInfo.color }}>
                                                        {prizeInfo.icon} {prizeInfo.label}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-bold">
                                                        Cota #{winner.number}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Nome Editável */}
                                            <div className="flex-1 min-w-[200px]">
                                                <input
                                                    type="text"
                                                    value={winner.customName || ''}
                                                    onChange={e => updateWinnerName(winner.id, e.target.value)}
                                                    placeholder={dbName || 'Nome do ganhador...'}
                                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-black text-slate-800 text-sm outline-none focus:border-yellow-500 focus:bg-white transition-all"
                                                />
                                                {dbName && winner.customName !== dbName && (
                                                    <button
                                                        onClick={() => updateWinnerName(winner.id, dbName)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-bold mt-1 inline-flex items-center gap-1"
                                                    >
                                                        ↩ Usar nome do banco: <strong>{dbName}</strong>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Ações: WhatsApp + Remover */}
                                            <div className="flex items-center gap-2 self-end sm:self-center">
                                                <button
                                                    onClick={() => openWhatsApp(winner)}
                                                    title={`Notificar via WhatsApp ${rawPhone ? `(${rawPhone})` : ''}`}
                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow transition-all active:scale-95"
                                                >
                                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86.174.086.275.072.376-.043.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.423-14.416c-6.627 0-12 5.373-12 12 0 2.153.57 4.175 1.564 5.921l-1.564 5.707 5.864-1.538c1.688.924 3.626 1.455 5.688 1.455 6.627 0 12-5.373 12-12s-5.373-12-12-12z" />
                                                    </svg>
                                                    WhatsApp
                                                </button>
                                                <button
                                                    onClick={() => removeWinner(winner.id)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-xl font-black text-xs uppercase transition-colors"
                                                >
                                                    ✕ Remover
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Coluna 2: Personalização Visual e Prévia do Print */}
                <div className="space-y-6">
                    {/* Seletor de Estilo Visual / Paletas (Seção 3.5) */}
                    <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                🎨 Estilo Visual do Print
                            </h3>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                Cor de Fundo
                            </span>
                        </div>

                        {/* Paletas Pré-definidas */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {PRESET_PALETTES.map((palette) => {
                                const isSelected = selectedBgColor.toLowerCase() === palette.hex.toLowerCase();
                                return (
                                    <button
                                        key={palette.hex}
                                        type="button"
                                        onClick={() => setSelectedBgColor(palette.hex)}
                                        className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 transition-all text-left text-xs font-black ${
                                            isSelected
                                                ? 'border-yellow-500 bg-yellow-50/50 shadow-md scale-102'
                                                : 'border-slate-100 hover:border-slate-200 bg-slate-50/60'
                                        }`}
                                    >
                                        <span
                                            className="w-5 h-5 rounded-full shadow-inner flex-shrink-0 border border-white/20"
                                            style={{ backgroundColor: palette.hex }}
                                        />
                                        <span className="truncate text-slate-800">{palette.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Seletor Customizado Hex */}
                        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                            <span className="text-xs font-bold text-slate-500">Cor Customizada (Hexadecimal):</span>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                                    {selectedBgColor.toUpperCase()}
                                </span>
                                <input
                                    type="color"
                                    value={selectedBgColor}
                                    onChange={e => setSelectedBgColor(e.target.value)}
                                    className="w-10 h-10 rounded-xl cursor-pointer border-2 border-slate-200 p-0.5 bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Título da Prévia */}
                    <div className="flex items-center gap-3 ml-2">
                        <span className="text-2xl">📱</span>
                        <div>
                            <h3 className="text-2xl font-black text-slate-900">Prévia do Print Oficial</h3>
                            <p className="text-xs font-bold text-slate-500">Visualização em tempo real conforme os prêmios são definidos</p>
                        </div>
                    </div>

                    {/* Contêiner da Prévia Formatada */}
                    <div className="relative w-full overflow-hidden pb-4 flex justify-center">
                        <div className="min-w-[420px] origin-top sm:transform-none transform scale-[0.80] sm:scale-100">
                            <div
                                id="print-area-capture"
                                ref={printRef}
                                className="mx-auto p-12 text-white shadow-2xl transition-colors duration-300"
                                style={{
                                    backgroundColor: selectedBgColor,
                                    width: '420px',
                                    minHeight: '800px',
                                    border: '12px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '32px',
                                    display: 'block',
                                    boxSizing: 'border-box',
                                    position: 'relative'
                                }}
                            >
                                {/* Pílula da Marca TOPPIX */}
                                <div style={{ marginBottom: '40px', width: '100%', textAlign: 'center' }}>
                                    <div style={{
                                        display: 'inline-block',
                                        backgroundColor: '#FFD60A',
                                        color: '#001D3D',
                                        padding: '12px 36px',
                                        borderRadius: '50px',
                                        fontWeight: '900',
                                        fontSize: '18px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.2em',
                                        textAlign: 'center',
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                                    }}>
                                        TOPPIX
                                    </div>
                                </div>

                                {/* Título Concurso */}
                                <div style={{ marginBottom: '60px', width: '100%', textAlign: 'center' }}>
                                    <h2 style={{ color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '13px', marginBottom: '15px' }}>
                                        Resultado Oficial
                                    </h2>
                                    <h1 style={{ color: '#ffffff', fontWeight: '900', fontSize: '38px', textTransform: 'uppercase', letterSpacing: '-0.02em', fontStyle: 'italic', lineHeight: '1.1' }}>
                                        Vencedores do <br />
                                        <span style={{ color: '#FFD60A' }}>Concurso #{raffle.code || '000'}</span>
                                    </h1>
                                </div>

                                {/* Lista de Cartões de Prêmios */}
                                <div style={{ width: '100%', marginBottom: '40px' }}>
                                    {sortedWinners.length > 0 ? (
                                        sortedWinners.map((winner) => {
                                            const printColors = getPrintColors(winner.position);
                                            const prizeInfo = getPrizeInfo(winner.position);
                                            const displayName = winner.customName || reservations[winner.number]?.name || '---';

                                            return (
                                                <div key={winner.id} style={{
                                                    display: 'block',
                                                    backgroundColor: 'rgba(255, 255, 255, 0.07)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    borderRadius: '28px',
                                                    marginBottom: '20px',
                                                    marginLeft: 'auto',
                                                    marginRight: 'auto',
                                                    width: '324px',
                                                    boxSizing: 'border-box',
                                                    padding: '16px 18px',
                                                }}>
                                                    <table style={{
                                                        width: '100%',
                                                        borderCollapse: 'collapse',
                                                        tableLayout: 'fixed',
                                                    }}>
                                                        <tbody>
                                                            <tr>
                                                                <td style={{
                                                                    width: '74px',
                                                                    verticalAlign: 'middle',
                                                                    textAlign: 'center',
                                                                    paddingRight: '14px',
                                                                }}>
                                                                    <div style={{
                                                                        width: '70px',
                                                                        height: '70px',
                                                                        backgroundColor: printColors.bg,
                                                                        color: printColors.text,
                                                                        borderRadius: '20px',
                                                                        fontWeight: '900',
                                                                        fontSize: '28px',
                                                                        lineHeight: '70px',
                                                                        textAlign: 'center',
                                                                        display: 'block',
                                                                    }}>
                                                                        {winner.number}
                                                                    </div>
                                                                </td>
                                                                <td style={{
                                                                    verticalAlign: 'middle',
                                                                    textAlign: 'left',
                                                                }}>
                                                                    <div style={{
                                                                        display: 'inline-block',
                                                                        backgroundColor: printColors.labelBg,
                                                                        color: printColors.labelText,
                                                                        fontWeight: '900',
                                                                        fontSize: '12px',
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: '0.1em',
                                                                        padding: '4px 12px',
                                                                        borderRadius: '50px',
                                                                        marginBottom: '6px',
                                                                    }}>
                                                                        {prizeInfo.icon} {prizeInfo.label}
                                                                    </div>
                                                                    <div style={{
                                                                        color: '#ffffff',
                                                                        fontWeight: '900',
                                                                        fontSize: '22px',
                                                                        textTransform: 'uppercase',
                                                                        fontStyle: 'italic',
                                                                        letterSpacing: '-0.02em',
                                                                        lineHeight: '1.1',
                                                                        wordBreak: 'break-word',
                                                                    }}>
                                                                        {displayName}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div style={{
                                            width: '320px',
                                            height: '200px',
                                            margin: '0 auto',
                                            border: '2px dashed rgba(255, 255, 255, 0.15)',
                                            borderRadius: '32px',
                                            display: 'table',
                                        }}>
                                            <div style={{
                                                display: 'table-cell',
                                                verticalAlign: 'middle',
                                                textAlign: 'center',
                                                padding: '0 30px',
                                            }}>
                                                <p style={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: '900', textTransform: 'uppercase', fontStyle: 'italic', margin: 0, fontSize: '14px', lineHeight: '1.4' }}>
                                                    Selecione as cotas na grade <br /> para gerar o resultado
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rodapé Comemorativo */}
                                <div style={{ width: '100%', textAlign: 'center', marginTop: 'auto', paddingBottom: '20px' }}>
                                    <div style={{ height: '2px', width: '60px', backgroundColor: 'rgba(255, 214, 10, 0.3)', margin: '0 auto 30px' }}></div>
                                    <h3 style={{ color: '#FFD60A', fontWeight: '900', fontSize: '22px', textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: '-0.05em', marginBottom: '10px' }}>
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
        </div>
    );
};

export default RaffleGridView;
