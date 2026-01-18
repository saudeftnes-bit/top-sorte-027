
import React from 'react';
import { WhatsAppIcon } from '../App';

interface HomeProps {
  onStart: () => void;
}

const Home: React.FC<HomeProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col gap-8 p-4 max-w-2xl mx-auto">
      {/* Featured Raffle Card */}
      <section className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl border border-slate-100 mt-4">
        <img 
          src="https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop" 
          alt="Moto 0km" 
          className="w-full h-56 object-cover"
        />
        <div className="absolute top-4 right-4 bg-purple-600 text-white font-black px-4 py-2 rounded-full shadow-lg text-sm">
          SORTEIO ATIVO
        </div>
        <div className="p-6">
          <h2 className="text-2xl font-black text-[#003B73] mb-2 text-center uppercase tracking-tight">MOTO 0KM OU R$ 15.000 NO PIX</h2>
          <div className="flex items-center justify-center gap-2 mb-6 text-slate-500 font-bold text-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Apenas R$ 13,00 por número
          </div>
          <button 
            onClick={onStart}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 text-lg"
          >
            🎯 ESCOLHER MEUS NÚMEROS
          </button>
        </div>
      </section>

      {/* Proof Section - Entregas Reais */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Fotos das Entregas</h3>
          <span className="text-purple-600 font-bold text-xs">Prova Real</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <div className="relative group overflow-hidden rounded-2xl shadow-md">
              <img src="https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=600&auto=format&fit=crop" alt="Entrega Moto" className="w-full h-48 object-cover transition-transform group-hover:scale-110" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-2 text-center">
                <p className="text-[10px] text-white font-bold">Entrega Moto CG 160</p>
              </div>
            </div>
            <div className="relative group overflow-hidden rounded-2xl shadow-md">
              <img src="https://images.unsplash.com/photo-1593642532400-2682810df593?q=80&w=600&auto=format&fit=crop" alt="Entrega Pix" className="w-full h-32 object-cover transition-transform group-hover:scale-110" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-2 text-center">
                <p className="text-[10px] text-white font-bold">R$ 5.000,00 no PIX</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-6">
             <div className="relative group overflow-hidden rounded-2xl shadow-md">
              <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop" alt="Ganhador Satisfeito" className="w-full h-32 object-cover transition-transform group-hover:scale-110" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-2 text-center">
                <p className="text-[10px] text-white font-bold">Sorriso de Ganhador</p>
              </div>
            </div>
            <div className="relative group overflow-hidden rounded-2xl shadow-md">
              <img src="https://images.unsplash.com/photo-1605152276897-4f618f831968?q=80&w=600&auto=format&fit=crop" alt="Entrega Produto" className="w-full h-48 object-cover transition-transform group-hover:scale-110" />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 p-2 text-center">
                <p className="text-[10px] text-white font-bold">Prêmio Entregue</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="text-2xl">🔒</div>
          <div>
            <p className="text-xs font-black text-slate-800 leading-none">Seguro</p>
            <p className="text-[10px] text-slate-400">Dados protegidos</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="text-2xl">🏛️</div>
          <div>
            <p className="text-xs font-black text-slate-800 leading-none">Oficial</p>
            <p className="text-[10px] text-slate-400">Loteria Federal</p>
          </div>
        </div>
      </section>

      {/* How it works simple */}
      <section className="bg-slate-900 text-white p-8 rounded-[2.5rem] mb-4">
        <h3 className="font-black mb-6 text-xl">Como funciona?</h3>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black flex-shrink-0">1</div>
            <div>
               <p className="font-bold">Escolha seus números</p>
               <p className="text-xs text-slate-400">Selecione na grade (Verde) e veja quem já está participando (Roxo).</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black flex-shrink-0">2</div>
            <div>
               <p className="font-bold">Bloqueio Temporário</p>
               <p className="text-xs text-slate-400">Ao preencher seus dados, o número fica Amarelo para você pagar o PIX.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black flex-shrink-0">3</div>
            <div>
               <p className="font-bold">Acompanhe o Sorteio</p>
               <p className="text-xs text-slate-400">Resultado transparente pela Loteria Federal. Transparência acima de tudo.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
