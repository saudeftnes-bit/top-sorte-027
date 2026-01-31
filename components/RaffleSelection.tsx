
import React from 'react';
import { ReservationMap } from '../App';

interface RaffleSelectionProps {
  selectedNumbers: string[];
  onToggleNumber: (num: string) => void;
  reservations: ReservationMap;
}

const RaffleSelection: React.FC<RaffleSelectionProps> = ({ selectedNumbers, onToggleNumber, reservations }) => {
  const numbers = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="bg-white rounded-[2.5rem] p-6 shadow-xl mb-6 border border-slate-100">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-black text-[#003B73]">GRADE DE NÚMEROS</h2>
          <p className="text-slate-500 text-sm font-medium italic">Selecione os números em verde</p>
        </div>

        {/* Legend - Updated with new colors */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-lg shadow-sm"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Disponível</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 rounded-lg shadow-sm"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Em Reserva</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-purple-600 rounded-lg shadow-sm"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reservado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-purple-600 bg-white rounded-lg shadow-sm"></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider tracking-tighter">Selecionado</span>
          </div>
        </div>

        {/* Number Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
          {numbers.map((num) => {
            const isUserSelected = selectedNumbers.includes(num);
            const reservation = reservations[num];

            // Lógica de cores baseada no status
            let buttonClasses = "transition-all transform active:scale-95";
            let spanClasses = "text-lg font-black";
            let labelName = "";

            if (reservation) {
              if (reservation.status === 'paid') {
                buttonClasses += " bg-purple-600 text-white shadow-inner cursor-not-allowed";
                labelName = reservation.name;
              } else if (reservation.status === 'pending') {
                buttonClasses += " bg-yellow-400 text-slate-800 shadow-sm cursor-not-allowed animate-pulse";
                labelName = "Aguardando...";
              }
            } else if (isUserSelected) {
              buttonClasses += " bg-white border-4 border-purple-600 text-purple-600 shadow-lg scale-105 z-10";
            } else {
              buttonClasses += " bg-green-500 text-white hover:bg-green-600 shadow-md border border-green-400";
            }

            return (
              <button
                key={num}
                disabled={!!reservation}
                onClick={() => onToggleNumber(num)}
                className={`
                  relative aspect-square rounded-[1.25rem] flex flex-col items-center justify-center overflow-hidden
                  ${buttonClasses}
                `}
              >
                <span className={`${spanClasses} ${reservation ? 'mb-1.5' : ''}`}>
                  {num}
                </span>

                {reservation && (
                  <div className={`absolute inset-x-0 bottom-0 py-1 px-1 flex items-center justify-center ${reservation.status === 'paid' ? 'bg-purple-900/60' : 'bg-yellow-600/30'}`}>
                    <p className={`text-[9px] font-bold truncate uppercase leading-none text-center ${reservation.status === 'paid' ? 'text-purple-50' : 'text-yellow-900'}`}>
                      {labelName || reservation.name}
                    </p>
                  </div>
                )}

                {isUserSelected && (
                  <div className="absolute top-1 right-1 bg-purple-600 rounded-full p-0.5 shadow-sm">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 text-center shadow-md">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944" /></svg>
          </div>
          <p className="text-sm font-black text-[#003B73] uppercase tracking-widest">Segurança & Transparência</p>
        </div>
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Nomes reais de participantes são exibidos publicamente. O status <span className="text-yellow-600 font-bold">Amarelo</span> indica que o número está <span className="text-yellow-600 font-bold">Em Reserva</span> (aguardando confirmação de pagamento).
        </p>
      </div>
    </div>
  );
};

export default RaffleSelection;
