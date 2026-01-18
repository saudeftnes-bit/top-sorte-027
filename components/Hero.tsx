
import React from 'react';
import { WhatsAppIcon } from '../App';

const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-white py-16 md:py-24">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-green-100 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div className="relative z-10 text-center lg:text-left">
          <div className="inline-flex items-center space-x-2 bg-green-50 border border-green-100 px-3 py-1 rounded-full text-green-700 text-sm font-semibold mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Sorteios Oficiais pela Loteria Federal</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight mb-6">
            👉 Ganhe prêmios incríveis <span className="text-green-600">todo mês</span> de forma simples e transparente
          </h1>
          
          <p className="text-lg md:text-xl text-slate-600 mb-8 max-w-2xl mx-auto lg:mx-0">
            Você participa em poucos minutos, acompanha o sorteio pela Loteria Federal e pode ser o próximo ganhador da Top Sorte.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <a 
              href="https://wa.me/yournumber" 
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-lg font-bold px-8 py-4 rounded-2xl transition-all shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 transform hover:-translate-y-1"
            >
              <WhatsAppIcon className="w-6 h-6" />
              Participar Agora pelo WhatsApp
            </a>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <span className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                  <img key={i} className="w-8 h-8 rounded-full border-2 border-white" src={`https://picsum.photos/seed/${i + 20}/64/64`} alt="Ganhador" />
                ))}
              </span>
              <span className="text-sm">+500 prêmios entregues</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 lg:block">
          <div className="relative mx-auto max-w-[500px]">
            <div className="absolute inset-0 bg-green-500 rounded-[2rem] rotate-3 opacity-10"></div>
            <img 
              src="https://picsum.photos/seed/winner/600/800" 
              alt="Pessoa feliz comemorando um prêmio" 
              className="rounded-[2rem] shadow-2xl relative z-10 w-full h-[400px] md:h-[550px] object-cover border-4 border-white"
            />
            
            {/* Floating badge */}
            <div className="absolute -bottom-6 -left-6 md:-left-12 bg-white p-4 rounded-2xl shadow-xl z-20 animate-float">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1.115.99l.115.01zm5 0a1 1 0 10-1.115-.99l.115.01zM3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 2a2 2 0 00-2 2v1a2 2 0 002 2h12a2 2 0 002-2v-1a2 2 0 00-2-2H4z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Último Ganhador</p>
                  <p className="text-slate-800 font-bold">R$ 5.000,00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
