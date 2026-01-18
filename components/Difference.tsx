
import React from 'react';

const Difference: React.FC = () => {
  return (
    <section className="bg-white py-20 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4">
            A TOP SORTE FAZ DIFERENTE
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            A Top Sorte existe para quem quer ganhar prêmios de verdade, sem dor de cabeça.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <DifferenceCard 
            icon={<FederalLotteryIcon />}
            title="Sorteios Oficiais"
            description="Os sorteios são feitos pela Loteria Federal, garantindo isenção total."
          />
          <DifferenceCard 
            icon={<NumbersIcon />}
            title="Participe por Números"
            description="Você escolhe os números da sua sorte e participa diretamente."
          />
          <DifferenceCard 
            icon={<SimpleIcon />}
            title="Claro e Direto"
            description="Tudo é simples, sem letras miúdas ou complicações ocultas."
          />
          <DifferenceCard 
            icon={<SuccessIcon />}
            title="+500 Ganhadores"
            description="Um histórico real de centenas de prêmios entregues em todo Brasil."
          />
        </div>

        <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden text-center md:text-left">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Simples Assim: Participa, Acompanha, Recebe.
              </h3>
              <p className="text-green-100 text-lg mb-0">
                Sem burocracia. Se o seu número for sorteado, o prêmio é seu. Nossa equipe entra em contato imediatamente para a entrega.
              </p>
            </div>
            <img 
              src="https://picsum.photos/seed/trust/300/300" 
              alt="Administrador Top Sorte" 
              className="w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white/20 shadow-lg object-cover"
            />
          </div>
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        </div>
      </div>
    </section>
  );
};

const DifferenceCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 hover:border-green-200 hover:shadow-xl transition-all group">
    <div className="mb-6 inline-block p-4 bg-white rounded-2xl text-green-600 shadow-sm group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <h4 className="text-xl font-bold text-slate-800 mb-3">{title}</h4>
    <p className="text-slate-600">{description}</p>
  </div>
);

const FederalLotteryIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
);
const NumbersIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
);
const SimpleIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
);
const SuccessIcon = () => (
  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

export default Difference;
