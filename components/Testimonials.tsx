
import React from 'react';

const Testimonials: React.FC = () => {
  const reviews = [
    { name: "Carlos S.", quote: "Participei, acompanhei o sorteio e ganhei. A transparência é o que mais me chamou atenção.", role: "Ganhador R$ 2.000" },
    { name: "Mariana F.", quote: "Fácil de participar e muito transparente. O administrador explicou tudo certinho no WhatsApp.", role: "Participante" },
    { name: "José R.", quote: "Nunca imaginei ganhar, mas ganhei. Já estou participando de novo!", role: "Ganhador Moto 0km" }
  ];

  return (
    <section className="bg-white py-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 mb-16">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
              QUEM JÁ PARTICIPOU, APROVOU
            </h2>
            <div className="flex items-center gap-4 text-green-600 mb-6">
              <span className="text-4xl font-black">🏆</span>
              <p className="text-xl font-bold">Mais de 500 prêmios já entregues</p>
            </div>
          </div>
          <div className="flex -space-x-4">
            {[1, 2, 3, 4, 5].map(i => (
              <img key={i} src={`https://picsum.photos/seed/${i + 100}/100/100`} alt="Testemunho" className="w-16 h-16 rounded-full border-4 border-white shadow-md" />
            ))}
            <div className="w-16 h-16 rounded-full border-4 border-white shadow-md bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm">
              +1k
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {reviews.map((rev, i) => (
            <div key={i} className="bg-slate-50 p-8 rounded-3xl border border-slate-100 relative">
              <span className="absolute top-4 right-8 text-6xl text-slate-200 font-serif leading-none">“</span>
              <p className="text-lg italic text-slate-700 mb-6 relative z-10">
                {rev.quote}
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                  <img src={`https://picsum.photos/seed/user${i}/100/100`} alt={rev.name} />
                </div>
                <div>
                  <p className="font-bold text-slate-900">{rev.name}</p>
                  <p className="text-sm text-green-600 font-semibold">{rev.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <p className="text-slate-500 font-medium mb-8">Participação transparente através do WhatsApp</p>
          <div className="inline-flex flex-wrap justify-center gap-4 opacity-50 grayscale">
            {/* Simulation of payment/trust badges */}
            <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-400">LOTERIA FEDERAL</div>
            <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-400">PIX SEGURO</div>
            <div className="bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-400">100% TRANSPARENTE</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
