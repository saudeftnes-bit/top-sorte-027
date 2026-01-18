
import React from 'react';

const PainPoints: React.FC = () => {
  const points = [
    { title: 'Acha que “é tudo difícil demais”', icon: '🤯' },
    { title: 'Fica desconfiada se o sorteio é real', icon: '🤨' },
    { title: 'Não sabe por onde começar', icon: '❓' },
    { title: 'Já participou e nunca ganhou nada', icon: '📉' },
  ];

  return (
    <section className="bg-slate-50 py-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="w-full lg:w-1/2 order-2 lg:order-1">
            <img 
              src="https://picsum.photos/seed/thinking/800/600" 
              alt="Pessoa pensativa olhando o celular" 
              className="rounded-3xl shadow-lg w-full h-[400px] object-cover grayscale-[20%]"
            />
          </div>
          
          <div className="w-full lg:w-1/2 order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
              JÁ IMAGINOU SER O PRÓXIMO GANHADOR?
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Muita gente quer ganhar prêmios, mas enfrenta essas barreiras:
            </p>
            
            <div className="space-y-4 mb-10">
              {points.map((point, index) => (
                <div key={index} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm transition-transform hover:translate-x-2">
                  <span className="text-2xl">{point.icon}</span>
                  <span className="font-semibold text-slate-700">{point.title}</span>
                </div>
              ))}
            </div>

            <div className="bg-green-600/5 border border-green-600/20 p-6 rounded-2xl">
              <p className="text-green-800 font-medium text-lg mb-4">
                Você só quer algo simples, justo e transparente. Algo onde você possa dizer:
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-3 text-green-700 font-bold">
                  <span className="text-green-500">👉</span> “É fácil participar”
                </li>
                <li className="flex items-center gap-3 text-green-700 font-bold">
                  <span className="text-green-500">👉</span> “O sorteio é confiável”
                </li>
                <li className="flex items-center gap-3 text-green-700 font-bold">
                  <span className="text-green-500">👉</span> “Aqui a chance é real”
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainPoints;
