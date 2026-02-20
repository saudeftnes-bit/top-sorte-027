import React from 'react';
import { ReservationMap } from '../App';
import { BICHO_ANIMALS } from '../lib/bicho-data';

interface RaffleSelectionProps {
  selectedNumbers: string[];
  onToggleNumber: (num: string) => void;
  reservations: ReservationMap;
  totalNumbers?: number;
  selectionMode?: 'loteria' | 'jogo_bicho';
  sessionId?: string;
  isReadOnly?: boolean;
  raffleCode?: string;
}

const RaffleSelection: React.FC<RaffleSelectionProps> = ({
  selectedNumbers,
  onToggleNumber,
  reservations,
  totalNumbers = 100,
  selectionMode = 'loteria',
  sessionId,
  isReadOnly = false,
  raffleCode
}) => {
  // Gerar números baseado na quantidade total
  const numbers = Array.from({ length: totalNumbers }, (_, i) => {
    const num = i;
    // Formatar com zeros à esquerda baseado no tamanho do total
    const padLength = totalNumbers > 1000 ? 4 : totalNumbers > 100 ? 3 : 2;
    return num.toString().padStart(padLength, '0');
  });

  // Função auxiliar para renderizar o botão de número
  const renderNumberButton = (num: string, size: 'normal' | 'small' = 'normal') => {
    const reservation = reservations[num];
    const isUserSelected = selectedNumbers.includes(num);
    const isOtherPending = reservation?.status === 'pending' && reservation.name !== sessionId;
    const isPaid = reservation?.status === 'paid';

    let buttonClasses = "transition-all transform active:scale-95 rounded-xl border-2 flex flex-col items-center justify-center ";
    let spanClasses = "font-black ";

    const isBicho = selectionMode === 'jogo_bicho';
    const accentColor = isBicho ? 'bg-green-600' : 'bg-purple-600';
    const accentBorder = isBicho ? 'border-green-600' : 'border-purple-600';
    const accentText = isBicho ? 'text-green-600' : 'text-purple-600';
    const accentLightBg = isBicho ? 'bg-green-100' : 'bg-purple-100';
    const accentLightText = isBicho ? 'text-green-700' : 'text-purple-700';

    if (isUserSelected) {
      buttonClasses += `bg-white ${accentBorder} shadow-lg z-10 animate-pop animate-selection `;
      spanClasses += `${accentText} `;
    } else if (isOtherPending) {
      buttonClasses += "bg-yellow-400 border-yellow-400 shadow-md cursor-not-allowed animate-pulse-yellow z-10 ";
      spanClasses += "text-white ";
    } else if (isPaid) {
      buttonClasses += `${accentColor} ${accentBorder} shadow-md opacity-90 cursor-not-allowed `;
      spanClasses += "text-white ";
    } else {
      buttonClasses += "bg-green-500 border-green-500 shadow-md hover:bg-green-600 hover:border-green-600 hover:scale-110 hover:shadow-xl hover:z-20 ";
      spanClasses += "text-white ";
    }

    if (size === 'small') {
      buttonClasses += " py-1 px-1";
      spanClasses += "text-[10px]";
    } else {
      buttonClasses += " py-3 sm:py-4";
      spanClasses += "text-lg";
    }

    return (
      <button
        key={num}
        onClick={() => !isReadOnly && onToggleNumber(num)}
        disabled={isReadOnly}
        className={buttonClasses + (isReadOnly ? ' opacity-90 cursor-default' : '')}
        title={reservation ? `Reservado para ${reservation.name}` : `Número ${num}`}
      >
        <span className={spanClasses}>{num}</span>
        {reservation?.status === 'pending' && (
          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tighter text-white mt-1 animate-pulse leading-none">
            RESERVA...
          </span>
        )}
        {isPaid && reservation?.name && (
          <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-tighter text-white mt-1 leading-none w-full px-1 truncate text-center">
            {reservation.name.split(' ')[0]}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="p-4 max-w-2xl mx-auto pb-32">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl mb-6 border border-slate-100 relative overflow-hidden">
        {isReadOnly && (
          <div className="absolute top-0 left-0 right-0 bg-amber-400 text-amber-900 text-center text-xs font-black py-2 uppercase tracking-wider z-20 shadow-sm animate-pulse">
            Grade Completa - Apenas Visualização
          </div>
        )}

        <div className={`text-center mb-6 transition-opacity ${isReadOnly ? 'mt-8 opacity-50' : ''}`}>
          <h2 className="text-2xl font-black text-[#003B73]">
            {selectionMode === 'jogo_bicho' ? 'ESCOLHA SEU ANIMAL' : 'GRADE DE NÚMEROS'}
          </h2>
          {/* Padronização do Descritivo */}
          <div className={`mt-2 inline-block px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 ${selectionMode === 'jogo_bicho' ? 'border-green-200 bg-green-50 text-green-700' : 'border-purple-200 bg-purple-50 text-purple-700'}`}>
            {selectionMode === 'jogo_bicho' ? '🍀 Sorteio pelo Jogo do Bicho' : '🏛️ Sorteio pela Loteria Federal'}
          </div>
          <div className="flex flex-col items-center gap-1 mt-3">
            {raffleCode && (
              <span className={`${selectionMode === 'jogo_bicho' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'} text-[10px] font-black px-2.5 py-0.5 rounded-full`}>
                EDIÇÃO #{raffleCode}
              </span>
            )}
            {!isReadOnly && <p className="text-slate-500 text-[11px] font-bold italic">Selecione os números em verde</p>}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-lg shadow-sm"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded-lg shadow-sm animate-pulse-yellow"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Em Reserva</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 ${selectionMode === 'jogo_bicho' ? 'bg-green-600' : 'bg-purple-600'} rounded-lg shadow-sm`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 border-2 ${selectionMode === 'jogo_bicho' ? 'border-green-600' : 'border-purple-600'} bg-white rounded-lg shadow-sm animate-selection`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Selecionado</span>
          </div>
        </div>

        {/* Content based on Mode */}
        {selectionMode === 'jogo_bicho' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {BICHO_ANIMALS.map((animal) => (
              <div key={animal.name} className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-100">
                <div className="flex items-center gap-3 mb-3 pb-2 border-b border-slate-200">
                  <span className="text-2xl">{animal.emoji}</span>
                  <span className="font-black text-[#003B73] uppercase tracking-tight">{animal.name}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {animal.numbers.map(num => renderNumberButton(num, 'small'))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
            {numbers.map((num) => renderNumberButton(num))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RaffleSelection;
