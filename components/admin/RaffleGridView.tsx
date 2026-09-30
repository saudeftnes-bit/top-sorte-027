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

// Paletas pré-definidas premium exclusivas do PremiaMax
const PRESET_PALETTES = [
    { name: 'Azul PremiaMax', hex: '#012B5D', icon: '🔵' },
    { name: 'Preto Luxo Onyx', hex: '#070D18', icon: '⚫' },
    { name: 'Verde Esmeralda', hex: '#022C22', icon: '🟢' },
    { name: 'Roxo Neon Tech', hex: '#1E0A3C', icon: '🟣' },
    { name: 'Vinho Real', hex: '#3B0A12', icon: '🔴' },
    { name: 'Ouro Imperial', hex: '#2E1C03', icon: '🟤' },
];

// Estilos de badges e medalhas para cada colocação
const PRIZE_LABELS: Record<number, { label: string; icon: string; color: string; bg: string; border: string }> = {
    1: { label: '1º Prêmio', icon: '🥇', color: '#012B5D', bg: '#FFD700', border: '#D97706' },
    2: { label: '2º Prêmio', icon: '🥈', color: '#0F172A', bg: '#E2E8F0', border: '#94A3B8' },
    3: { label: '3º Prêmio', icon: '🥉', color: '#7C2D12', bg: '#FED7AA', border: '#EA580C' },
};

const PRIZE_PRINT_COLORS: Record<number, { bg: string; text: string; labelBg: string; labelText: string }> = {
    1: { bg: '#FFD700', text: '#012B5D', labelBg: '#D97706', labelText: '#FFFFFF' },
    2: { bg: '#E2E8F0', text: '#0F172A', labelBg: '#64748B', labelText: '#FFFFFF' },
    3: { bg: '#FED7AA', text: '#7C2D12', labelBg: '#C2410C', labelText: '#FFFFFF' },
};

const getPrizeInfo = (position: number) =>
    PRIZE_LABELS[position] || {
        label: `${position}º Prêmio`,
        icon: '🏅',
        color: '#FFFFFF',
        bg: '#0284C7',
        border: '#0369A1',
    };

const getPrintColors = (position: number) =>
    PRIZE_PRINT_COLORS[position] || {
        bg: '#0284C7',
        text: '#FFFFFF',
        labelBg: '#0369A1',
        labelText: '#FFFFFF',
    };

const RaffleGridView: React.FC<RaffleGridViewProps> = ({ raffle, onBack }) => {
    const [reservations, setReservations] = useState<Record<string, { status: string; name: string; phone?: string }>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [winners, setWinners] = useState<WinnerEntry[]>([]);
    const [selectedBgColor, setSelectedBgColor] = useState<string>('#012B5D');
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

    // Notificação via WhatsApp direto com mensagem oficial PremiaMax
    const openWhatsApp = (winner: WinnerEntry) => {
        const rawPhone = reservations[winner.number]?.phone || '';
        const digits = rawPhone.replace(/\D/g, '');
        let finalPhone = digits;
        if (finalPhone.length >= 10 && finalPhone.length <= 11) {
            finalPhone = '55' + finalPhone;
        }
        const prizeInfo = getPrizeInfo(winner.position);
        const winnerName = winner.customName || reservations[winner.number]?.name || 'Ganhador';
        const message = `Parabéns ${winnerName}! Você foi o ganhador do ${prizeInfo.label} no PremiaMax com a cota #${winner.number}! 🎉🏆`;
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

    // Helper: carrega imagem com cross-origin
    const loadAppLogo = (): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = '/favicon.jpg';
        });
    };

    // Geração do Print Profissional PremiaMax via Canvas 2D Ultra HD (DPR = 3)
    const downloadScreenshot = async () => {
        setIsCapturing(true);
        await new Promise(r => setTimeout(r, 100));

        try {
            const DPR = 3;               // Resolução 3x Ultra HD
            const W = 450;               // Largura lógica otimizada
            const PAD = 36;              // Padding lateral
            const CARD_W = W - PAD * 2;  // 378px
            const CARD_H = 116;          // Altura do card de prêmio
            const CARD_GAP = 18;         // Espaçamento entre cards
            const HEADER_H = 340;        // Altura do cabeçalho com logo do app
            const FOOTER_H = 140;        // Altura do rodapé profissional
            const totalH = HEADER_H + sortedWinners.length * (CARD_H + CARD_GAP) + FOOTER_H;

            const canvas = document.createElement('canvas');
            canvas.width = W * DPR;
            canvas.height = totalH * DPR;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(DPR, DPR);

            // ── 1. Fundo com Gradiente Nobre PremiaMax ───────────────
            const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
            bgGrad.addColorStop(0, selectedBgColor);
            bgGrad.addColorStop(1, '#050B14');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, totalH);

            // Luz ambiente no topo (glow sutil)
            const glow = ctx.createRadialGradient(W / 2, 80, 20, W / 2, 80, 260);
            glow.addColorStop(0, 'rgba(0, 163, 255, 0.22)');
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, W, 320);

            // ── 2. Logo Oficial do App PremiaMax ──────────────────
            const logoImg = await loadAppLogo();
            const LOGO_SIZE = 100;
            const logoX = (W - LOGO_SIZE) / 2;
            const logoY = 32;

            if (logoImg) {
                // Sombra do logo
                ctx.save();
                ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
                ctx.shadowBlur = 24;
                ctx.shadowOffsetY = 8;

                // Máscara com cantos arredondados para a foto do logo
                roundRect(ctx, logoX, logoY, LOGO_SIZE, LOGO_SIZE, 26);
                ctx.fillStyle = '#012B5D';
                ctx.fill();
                ctx.restore();

                // Desenha a imagem cortada com cantos arredondados
                ctx.save();
                roundRect(ctx, logoX, logoY, LOGO_SIZE, LOGO_SIZE, 26);
                ctx.clip();
                ctx.drawImage(logoImg, logoX, logoY, LOGO_SIZE, LOGO_SIZE);
                ctx.restore();

                // Borda dourada brilhante ao redor do logo
                ctx.save();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                roundRect(ctx, logoX, logoY, LOGO_SIZE, LOGO_SIZE, 26);
                ctx.stroke();
                ctx.restore();
            }

            // ── 3. Marca PremiaMax em Destaque ─────────────────────
            ctx.font = '900 24px Montserrat, Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PREMIAMAX', W / 2, 160);

            // Slogan Oficial PremiaMax
            ctx.font = '800 11px Montserrat, Arial';
            ctx.fillStyle = '#00FF87'; // Verde neon do banner oficial
            ctx.fillText('MAIS PRÊMIO, MAIS CHANCE DE GANHAR!', W / 2, 184);

            // Pílula "Resultado Oficial"
            const pillY = 212;
            const pillH = 30;
            const pillW = 200;
            const pillX = (W - pillW) / 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            roundRect(ctx, pillX, pillY, pillW, pillH, 15);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.lineWidth = 1;
            roundRect(ctx, pillX, pillY, pillW, pillH, 15);
            ctx.stroke();

            ctx.font = '900 11px Montserrat, Arial';
            ctx.fillStyle = '#FFD700';
            ctx.fillText('★ RESULTADO OFICIAL ★', W / 2, pillY + pillH / 2);

            // Título do Concurso
            ctx.font = '900 34px Montserrat, Arial';
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText('Vencedores do', W / 2, 272);

            ctx.font = '900 34px Montserrat, Arial';
            ctx.fillStyle = '#FFD700';
            ctx.fillText(`Concurso #${raffle.code || '000'}`, W / 2, 310);

            // ── 4. Cards de Ganhadores com Acabamento Luxo ──────────
            const BADGE_W = 104;
            const BADGE_H = 92;
            const BADGE_RADIUS = 20;

            sortedWinners.forEach((winner, i) => {
                const pc = getPrintColors(winner.position);
                const pi = getPrizeInfo(winner.position);
                const displayName = winner.customName || reservations[winner.number]?.name || '---';

                const cardY = HEADER_H + i * (CARD_H + CARD_GAP);
                const cardX = PAD;

                // Fundo do card (Vidro fosco com degradê suave)
                const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX + CARD_W, cardY + CARD_H);
                cardGrad.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
                cardGrad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
                ctx.fillStyle = cardGrad;
                roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 26);
                ctx.fill();

                // Borda do card
                ctx.strokeStyle = winner.position === 1 ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 255, 255, 0.16)';
                ctx.lineWidth = winner.position === 1 ? 2 : 1;
                roundRect(ctx, cardX, cardY, CARD_W, CARD_H, 26);
                ctx.stroke();

                // Badge do Número da Cota (HERO da composição: Lado esquerdo)
                const badgeX = cardX + 14;
                const badgeY = cardY + (CARD_H - BADGE_H) / 2;

                // Fundo do Badge do Número
                ctx.fillStyle = pc.bg;
                roundRect(ctx, badgeX, badgeY, BADGE_W, BADGE_H, BADGE_RADIUS);
                ctx.fill();

                // Borda do Badge
                ctx.strokeStyle = winner.position === 1 ? '#B45309' : 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 2;
                roundRect(ctx, badgeX, badgeY, BADGE_W, BADGE_H, BADGE_RADIUS);
                ctx.stroke();

                // Rótulo "COTA" no topo do badge
                ctx.font = '900 10px Montserrat, Arial';
                ctx.fillStyle = winner.position === 1 ? 'rgba(1, 43, 93, 0.7)' : 'rgba(0, 0, 0, 0.6)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText('COTA', badgeX + BADGE_W / 2, badgeY + 12);

                // Número da Cota (GRANDE E IMPACTANTE: 44px)
                ctx.font = '900 44px Montserrat, Arial';
                ctx.fillStyle = pc.text;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(winner.number, badgeX + BADGE_W / 2, badgeY + 54);

                // Lado direito: Informações do prêmio e do ganhador
                const infoX = badgeX + BADGE_W + 16;
                const infoY = cardY + 18;

                // Pílula da Colocação
                const labelText = `${pi.icon} ${pi.label.toUpperCase()}`;
                ctx.font = '900 12px Montserrat, Arial';
                const labelW = ctx.measureText(labelText).width + 24;
                const labelH = 26;

                ctx.fillStyle = pc.labelBg;
                roundRect(ctx, infoX, infoY, labelW, labelH, labelH / 2);
                ctx.fill();

                ctx.font = '900 11px Montserrat, Arial';
                ctx.fillStyle = pc.labelText;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(labelText, infoX + 12, infoY + labelH / 2);

                // Rótulo "GANHADOR(A):"
                const labelGanhadorY = infoY + labelH + 11;
                ctx.font = '800 10px Montserrat, Arial';
                ctx.fillStyle = '#FFD700';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('GANHADOR(A):', infoX, labelGanhadorY);

                // Nome do Ganhador (MENOR E PROPORCIONAL: 16px)
                const nameY = labelGanhadorY + 14;
                const maxNameW = CARD_W - BADGE_W - 44;
                let fontSize = 16;
                ctx.font = `800 italic ${fontSize}px Montserrat, Arial`;
                let nameDisplay = displayName.toUpperCase();

                while (ctx.measureText(nameDisplay).width > maxNameW && fontSize > 10) {
                    fontSize -= 1;
                    ctx.font = `800 italic ${fontSize}px Montserrat, Arial`;
                }

                if (fontSize <= 10) {
                    while (ctx.measureText(nameDisplay).width > maxNameW && nameDisplay.length > 3) {
                        nameDisplay = nameDisplay.slice(0, -1);
                    }
                    if (nameDisplay !== displayName.toUpperCase()) nameDisplay += '…';
                }

                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(nameDisplay, infoX, nameY);
            });

            // ── 5. Rodapé Comemorativo Exclusivo PremiaMax ───────────
            const footerY = HEADER_H + sortedWinners.length * (CARD_H + CARD_GAP) + 24;

            // Linha divisória em degradê dourado
            const lineGrad = ctx.createLinearGradient((W - 140) / 2, 0, (W + 140) / 2, 0);
            lineGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
            lineGrad.addColorStop(0.5, '#FFD700');
            lineGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.strokeStyle = lineGrad;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo((W - 140) / 2, footerY);
            ctx.lineTo((W + 140) / 2, footerY);
            ctx.stroke();

            // Texto de Parabéns
            ctx.font = '900 italic 21px Montserrat, Arial';
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('PARABÉNS AOS GANHADORES!', W / 2, footerY + 36);

            // Slogan PremiaMax
            ctx.font = '800 12px Montserrat, Arial';
            ctx.fillStyle = '#00FF87';
            ctx.fillText('PREMIAMAX • MAIS PRÊMIO, MAIS CHANCE DE GANHAR!', W / 2, footerY + 66);

            // Link do App / Auditoria
            ctx.font = '700 11px Montserrat, Arial';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillText('premiamax.vercel.app', W / 2, footerY + 92);

            // ── 6. Download Padronizado ─────────────────────────────
            const link = document.createElement('a');
            link.href = canvas.toDataURL('image/png');
            link.download = `ganhadores-premiamax-${raffle.code || 'resultado'}.png`;
            link.click();
        } catch (error) {
            console.error('Erro ao gerar imagem PremiaMax:', error);
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
                <div className="flex items-center gap-5">
                    <img
                        src="/favicon.jpg"
                        alt="PremiaMax Logo"
                        className="w-16 h-16 rounded-2xl shadow-lg border-2 border-yellow-400 object-cover"
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="bg-yellow-400 text-blue-950 font-black text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                                PREMIAMAX
                            </span>
                            <span className="text-xs font-bold text-slate-400">Concurso #{raffle.code || '000'}</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-1">Grade e Gerador de Print Oficial</h2>
                        <p className="text-sm text-slate-500 font-bold">PremiaMax — Mais prêmio, Mais chance de ganhar!</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={downloadScreenshot}
                        disabled={isCapturing || winners.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl active:scale-95 flex items-center gap-3 text-lg"
                    >
                        {isCapturing ? '⌛ PROCESSANDO PRINT...' : '📥 BAIXAR PRINT OFICIAL'}
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
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl px-6 py-4 flex items-start gap-3">
                        <span className="text-2xl mt-0.5">ℹ️</span>
                        <div>
                            <p className="font-black text-blue-900 text-sm">Como definir os ganhadores no PremiaMax</p>
                            <p className="text-blue-700 text-xs font-medium mt-1 leading-relaxed">
                                Clique na cota premiada na grade para ordená-la (1º, 2º, 3º Prêmio...). Caso o mesmo ganhador tenha faturado múltiplos prêmios com a mesma cota, basta clicar novamente ou adicionar pelo campo manual.
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
                                    placeholder={`Ex: 7 ou 07 (concurso de ${total} cotas)`}
                                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-black text-slate-800 text-base outline-none focus:border-yellow-500 focus:bg-white transition-all"
                                />
                            </div>
                            <button
                                type="submit"
                                className="sm:self-end bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-blue-950 font-black px-6 py-3.5 rounded-xl shadow-md transition-all active:scale-95 text-sm uppercase tracking-wide flex items-center justify-center gap-2"
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
                                        <span className="w-3.5 h-3.5 rounded bg-yellow-400 border border-amber-600 inline-block"></span> Premiada
                                    </span>
                                </div>
                            </div>
                            <div className="bg-yellow-50 text-amber-900 border border-yellow-200 px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider">
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
                                                ? 'scale-105 z-10 shadow-lg ring-4 ring-yellow-300 font-black'
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
                                <h4 className="font-black text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
                                    <span>🏆</span> Sequência de Ganhadores PremiaMax
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
                                                    <span className="text-xs font-black uppercase tracking-wider block" style={{ color: prizeInfo.border }}>
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
                    {/* Seletor de Estilo Visual / Paletas */}
                    <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                🎨 Estilo Visual PremiaMax
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
                                                ? 'border-yellow-500 bg-yellow-50/50 shadow-md scale-102 ring-2 ring-yellow-400/40'
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
                            <p className="text-xs font-bold text-slate-500">Com o Logo Oficial e Identidade PremiaMax</p>
                        </div>
                    </div>

                    {/* Contêiner da Prévia Formatada */}
                    <div className="relative w-full overflow-hidden pb-4 flex justify-center">
                        <div className="min-w-[440px] origin-top sm:transform-none transform scale-[0.80] sm:scale-100">
                            <div
                                id="print-area-capture"
                                ref={printRef}
                                className="mx-auto p-10 text-white shadow-2xl transition-colors duration-300 relative overflow-hidden"
                                style={{
                                    backgroundColor: selectedBgColor,
                                    backgroundImage: `linear-gradient(180deg, ${selectedBgColor} 0%, #050B14 100%)`,
                                    width: '440px',
                                    minHeight: '820px',
                                    border: '12px solid rgba(255, 255, 255, 0.06)',
                                    borderRadius: '36px',
                                    display: 'block',
                                    boxSizing: 'border-box',
                                }}
                            >
                                {/* Efeito de luz de fundo (ambient glow) */}
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

                                {/* 1. Logo Oficial do App PremiaMax */}
                                <div className="text-center relative z-10 mb-4">
                                    <div className="inline-block relative">
                                        <img
                                            src="/favicon.jpg"
                                            alt="PremiaMax Logo"
                                            className="w-24 h-24 rounded-3xl shadow-2xl border-2 border-yellow-400 object-cover mx-auto ring-4 ring-yellow-400/20"
                                        />
                                    </div>
                                    <h2 className="text-2xl font-black text-white tracking-wider mt-3">
                                        PREMIAMAX
                                    </h2>
                                    <p className="text-[11px] font-black text-[#00FF87] uppercase tracking-widest mt-0.5">
                                        MAIS PRÊMIO, MAIS CHANCE DE GANHAR!
                                    </p>
                                </div>

                                {/* 2. Pílula do Resultado Oficial */}
                                <div className="text-center mb-6 relative z-10">
                                    <div className="inline-block bg-white/10 backdrop-blur-md border border-yellow-400/40 px-4 py-1.5 rounded-full shadow-lg">
                                        <span className="text-xs font-black text-yellow-400 uppercase tracking-widest">
                                            ★ RESULTADO OFICIAL ★
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-black text-white uppercase italic tracking-tight mt-3">
                                        Vencedores do <br />
                                        <span className="text-yellow-400">Concurso #{raffle.code || '000'}</span>
                                    </h1>
                                </div>

                                {/* 3. Lista de Cartões de Prêmios */}
                                <div className="w-full mb-8 relative z-10 space-y-3.5">
                                    {sortedWinners.length > 0 ? (
                                        sortedWinners.map((winner) => {
                                            const printColors = getPrintColors(winner.position);
                                            const prizeInfo = getPrizeInfo(winner.position);
                                            const displayName = winner.customName || reservations[winner.number]?.name || '---';

                                            return (
                                                <div
                                                    key={winner.id}
                                                    className="rounded-3xl p-4 border transition-all"
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.04) 100%)',
                                                        borderColor: winner.position === 1 ? 'rgba(255, 215, 0, 0.6)' : 'rgba(255, 255, 255, 0.16)',
                                                        boxShadow: winner.position === 1 ? '0 10px 25px -5px rgba(255, 215, 0, 0.2)' : 'none',
                                                    }}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        {/* Badge do Número: O Grande Destaque */}
                                                        <div
                                                            className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center shadow-xl flex-shrink-0"
                                                            style={{
                                                                backgroundColor: printColors.bg,
                                                                color: printColors.text,
                                                                border: winner.position === 1 ? '2px solid #B45309' : '2px solid rgba(0,0,0,0.15)',
                                                            }}
                                                        >
                                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">
                                                                COTA
                                                            </span>
                                                            <span className="text-4xl font-black leading-none tracking-tight">
                                                                {winner.number}
                                                            </span>
                                                        </div>

                                                        {/* Lado Direito: Prêmio e Nome do Ganhador */}
                                                        <div className="flex-1 min-w-0 text-left">
                                                            <div
                                                                className="inline-block font-black text-[11px] uppercase tracking-wider px-3 py-1 rounded-full mb-1 shadow"
                                                                style={{
                                                                    backgroundColor: printColors.labelBg,
                                                                    color: printColors.labelText,
                                                                }}
                                                            >
                                                                {prizeInfo.icon} {prizeInfo.label}
                                                            </div>

                                                            <p className="text-[10px] font-extrabold text-yellow-400 uppercase tracking-widest mt-1 mb-0.5">
                                                                Ganhador(a)
                                                            </p>

                                                            <div className="text-white font-extrabold text-base uppercase italic tracking-tight leading-snug break-words">
                                                                {displayName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="w-80 h-44 mx-auto border-2 border-dashed border-white/20 rounded-3xl flex items-center justify-center text-center p-6">
                                            <p className="text-white/40 font-black uppercase italic text-xs leading-relaxed">
                                                Selecione as cotas na grade <br /> para gerar o resultado oficial
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* 4. Rodapé Comemorativo PremiaMax */}
                                <div className="text-center relative z-10 pt-4 border-t border-yellow-400/30">
                                    <h3 className="text-yellow-400 font-black text-xl uppercase italic tracking-tight mb-1">
                                        PARABÉNS AOS GANHADORES!
                                    </h3>
                                    <p className="text-[#00FF87] font-extrabold text-[11px] uppercase tracking-wider mb-2">
                                        PREMIAMAX • MAIS PRÊMIO, MAIS CHANCE DE GANHAR!
                                    </p>
                                    <p className="text-white/40 font-bold text-[10px] uppercase tracking-widest">
                                        premiamax.vercel.app
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
