
import React from 'react';
import { WhatsAppIcon } from '../App';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-white pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-6">
            PRONTO PARA CONCORRER AO PRÓXIMO PRÊMIO?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            As vagas são limitadas por número. Quanto antes você participa, maiores são suas chances. Não deixe a sorte passar!
          </p>
          
          <a 
            href="https://wa.me/yournumber" 
            className="inline-flex items-center gap-3 bg-green-600 hover:bg-green-700 text-white text-xl font-bold px-10 py-5 rounded-2xl transition-all shadow-2xl hover:shadow-green-900/40 transform hover:-translate-y-1"
          >
            <span className="text-2xl">🎯</span>
            Participar da Top Sorte no WhatsApp
          </a>
        </div>

        <div className="border-t border-slate-800 pt-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center font-bold text-white">T</div>
            <span className="text-xl font-bold tracking-tight">TOP <span className="text-green-600">SORTE</span></span>
          </div>
          
          <p className="text-slate-500 text-sm text-center md:text-left">
            &copy; {new Date().getFullYear()} Top Sorte Brasil. Todos os direitos reservados.<br />
            Sorteios baseados na Loteria Federal. Jogue com responsabilidade.
          </p>

          <div className="flex items-center gap-6">
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Instagram</a>
            <a href="#" className="text-slate-400 hover:text-white transition-colors">Termos de Uso</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
