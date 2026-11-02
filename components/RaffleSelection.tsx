import React from 'react';
import { ReservationMap } from '../App';

interface RaffleSelectionProps {
  selectedNumbers: string[];
  onToggleNumber: (num: string) => void;
  reservations: ReservationMap;
  totalNumbers?: number;
  selectionMode?: 'loteria' | 'jogo_bicho';
  sessionId?: string;
  isReadOnly?: boolean;
  raffleCode?: string;
  pricePerNumber?: number;
  maxSelection?: number;
  selectionTimeRemaining?: number | null;
  onProceedToCheckout?: () => void;
  onClearAll?: () => void;
}

const RaffleSelection: React.FC<RaffleSelectionProps> = ({
  selectedNumbers,
  onToggleNumber,
  reservations,
  totalNumbers = 100,
  selectionMode = 'loteria',
  sessionId,
  isReadOnly = false,
  raffleCode,
  pricePerNumber = 10,
  maxSelection = 10,
  selectionTimeRemaining,
  onProceedToCheckout,
  onClearAll
}) => {
  // Gerar números baseado na quantidade total
  const numbers = Array.from({ length: totalNumbers }, (_, i) => {
    const num = i;
    const padLength = totalNumbers > 1000 ? 4 : totalNumbers > 100 ? 3 : 2;
    return num.toString().padStart(padLength, '0');
  });

  const totalAmount = (selectedNumbers.length * pricePerNumber).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div className={`p-2 sm:p-4 max-w-2xl mx-auto w-full ${selectedNumbers.length > 0 ? 'pb-44' : 'pb-6'}`}>
      {/* Contêiner Principal Imperial Esmeralda & Ouro (Sem caixas aninhadas brancas) */}
      <div className="bg-gradient-to-b from-[#021811] via-[#032319] to-[#010D09] border border-emerald-500/30 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-2xl text-white relative overflow-hidden">
        
        {/* Banner de Somente Leitura se aplicável */}
        {isReadOnly && (
          <div className="bg-amber-400 text-amber-950 text-center text-xs font-black py-2 rounded-xl uppercase tracking-wider mb-4 shadow-md animate-pulse">
            Grade Completa - Apenas Visualização
          </div>
        )}

        {/* ── 1. HEADER OFICIAL TOPSORTE_27 (LIMPO E SEM REDUNDÂNCIAS) ── */}
        <div className="pb-4 border-b border-yellow-500/20 mb-4 px-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="TopSorte_27 Logo"
                className="w-12 h-12 rounded-xl object-cover border-2 border-yellow-400 shadow-md flex-shrink-0"
              />
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white leading-tight tracking-tight">
                  TopSorte_27
                </h2>
                <p className="text-[11px] text-[#00FF87] font-extrabold uppercase tracking-wider leading-none mt-0.5">
                  Ganhe Prêmios Reais!
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-emerald-300/80 font-bold uppercase block leading-none">
                Valor da Cota
              </span>
              <span className="text-base sm:text-lg font-black text-yellow-400 font-mono-num leading-tight">
                R$ {pricePerNumber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Pílula do Tipo de Sorteio */}
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="bg-[#022A1E] border border-emerald-400/30 text-emerald-200 px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5">
              <span>{selectionMode === 'jogo_bicho' ? '🍀' : '🏛️'}</span>
              <span>{selectionMode === 'jogo_bicho' ? 'Sorteio pelo Jogo do Bicho' : 'Sorteio pela Loteria Federal'}</span>
            </div>
            {raffleCode ? (
              <span className="bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase">
                Edição #{raffleCode}
              </span>
            ) : (
              <span className="bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase">
                Edição Ativa
              </span>
            )}
          </div>
        </div>

        {/* ── 2. LEGENDA OFICIAL EM LINHA ÚNICA ── */}
        <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold px-3 py-2 rounded-xl bg-black/40 border border-emerald-500/20 mb-3 text-slate-300 flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#0A4D39] border border-emerald-400/50"></span>
            Livre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500"></span>
            Reserva
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-700 border border-purple-400"></span>
            Pago
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-gradient-to-b from-yellow-300 to-amber-500 border border-white"></span>
            Escolhido
          </span>
        </div>

        {/* ── 3. GRADE DE COTAS EM TELA TOTAL (5 COLUNAS) ── */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-5">
          {numbers.map((num) => {
            const reservation = reservations[num];
            const isUserSelected = selectedNumbers.includes(num);
            const isOtherPending = reservation?.status === 'pending' && reservation.name !== sessionId;
            const isPaid = reservation?.status === 'paid';

            if (isUserSelected) {
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => !isReadOnly && onToggleNumber(num)}
                  disabled={isReadOnly}
                  className="aspect-square rounded-lg sm:rounded-xl bg-gradient-to-b from-yellow-300 via-yellow-400 to-amber-500 text-slate-950 font-black text-base sm:text-lg flex flex-col items-center justify-center border-2 border-white shadow-[0_0_15px_rgba(255,215,0,0.7)] scale-95 transition-all active:scale-90"
                  title="Cota Selecionada por você"
                >
                  <span className="text-[8px] leading-none text-slate-900 font-extrabold mb-0.5">✔ SEU</span>
                  <span className="leading-none">{num}</span>
                </button>
              );
            }

            if (isOtherPending) {
              return (
                <button
                  key={num}
                  type="button"
                  disabled
                  className="aspect-square rounded-lg sm:rounded-xl bg-amber-950/60 text-amber-300 font-bold text-xs flex flex-col items-center justify-center border border-amber-500/30 opacity-70 cursor-not-allowed"
                  title={`Reservado para ${reservation?.name || 'outro comprador'}`}
                >
                  <span className="font-black text-sm leading-none">{num}</span>
                  <span className="text-[7px] uppercase font-bold leading-none mt-0.5">RESERVA</span>
                </button>
              );
            }

            if (isPaid) {
              const firstName = reservation?.name?.split(' ')[0] ?? '';
              return (
                <button
                  key={num}
                  type="button"
                  disabled
                  className="aspect-square rounded-lg sm:rounded-xl bg-gradient-to-b from-purple-800 to-purple-950 text-white font-black text-xs sm:text-sm flex flex-col items-center justify-center border-2 border-purple-500/60 shadow-md cursor-not-allowed"
                  title={`Número vendido para ${reservation?.name || 'comprador'}`}
                >
                  <span className="leading-none text-xs sm:text-sm font-black">{num}</span>
                  <span className="text-[6px] font-black uppercase text-purple-300 leading-none tracking-tight">PAGO</span>
                  {firstName ? (
                    <span className="text-[8px] sm:text-[9px] font-black text-purple-100 leading-tight mt-0.5 max-w-full truncate px-0.5 text-center">
                      {firstName}
                    </span>
                  ) : null}
                </button>
              );
            }

            // Disponível para compra
            return (
              <button
                key={num}
                type="button"
                onClick={() => !isReadOnly && onToggleNumber(num)}
                disabled={isReadOnly}
                className="aspect-square rounded-lg sm:rounded-xl bg-gradient-to-b from-[#0A4D39] to-[#042B1F] hover:brightness-125 text-emerald-100 font-black text-sm sm:text-base flex items-center justify-center border border-emerald-500/30 shadow-sm active:scale-90 transition-all"
                title={`Cota #${num} Disponível`}
              >
                <span>{num}</span>
              </button>
            );
          })}
        </div>

        {/* Mensagem quando nenhuma cota selecionada */}
        {selectedNumbers.length === 0 && !isReadOnly && (
          <p className="text-xs text-emerald-300/80 font-medium text-center py-3 italic">
            👆 Toque nas cotas verdes acima para selecionar seus números da sorte!
          </p>
        )}

        {/* Rodapé Interno */}
        <div className="text-center pt-4 text-[10px] text-emerald-400/40 font-bold">
          TopSorte_27 • Compra 100% Segura via PIX
        </div>

      </div>

      {/* ── BOX FIXO NA PARTE INFERIOR ── */}
      {selectedNumbers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <style>{`
            @keyframes slideUpDock {
              from { transform: translateY(100%); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
            .dock-slide { animation: slideUpDock 0.28s ease-out both; }
          `}</style>

          {/* Gradiente de transição */}
          <div className="h-6 bg-gradient-to-t from-[#021811] to-transparent pointer-events-none" />

          <div className="dock-slide bg-gradient-to-b from-[#03301F] to-[#021811] border-t-2 border-yellow-400/70 shadow-[0_-8px_40px_rgba(0,0,0,0.9)]">
            <div className="max-w-2xl mx-auto px-4 pt-3 pb-6 space-y-2.5">

              {/* Linha 1: Tags das cotas + timer + limpar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                  {selectedNumbers.sort().map((n) => (
                    <span
                      key={n}
                      className="bg-yellow-400 text-slate-950 font-black text-xs px-2 py-0.5 rounded-md shadow-sm"
                    >
                      #{n}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectionTimeRemaining && (
                    <span
                      className={`text-xs font-bold ${
                        selectionTimeRemaining < 60 ? 'text-red-400 animate-pulse' : 'text-amber-300'
                      }`}
                    >
                      ⏱️ {Math.floor(selectionTimeRemaining / 60)}:
                      {String(selectionTimeRemaining % 60).padStart(2, '0')}
                    </span>
                  )}
                  {onClearAll && (
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="text-[11px] text-slate-400 hover:text-white uppercase font-bold underline whitespace-nowrap"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Linha 2: Contagem + valor total + botão PIX */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-emerald-300/80 font-bold uppercase block leading-none">
                    {selectedNumbers.length} cota{selectedNumbers.length > 1 ? 's' : ''} selecionada{selectedNumbers.length > 1 ? 's' : ''}
                  </span>
                  <span className="text-xl font-black text-yellow-400 leading-tight">
                    R$ {totalAmount}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onProceedToCheckout}
                  className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-400 text-slate-950 font-black px-5 py-3.5 rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-yellow-900/50 flex items-center gap-2 flex-shrink-0 active:scale-95 transition-all"
                >
                  <span>🚀</span>
                  <span>PAGAR VIA PIX</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RaffleSelection;
