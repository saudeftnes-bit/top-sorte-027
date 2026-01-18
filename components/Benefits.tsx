
import React from 'react';

const Benefits: React.FC = () => {
  return (
    <section className="bg-slate-50 py-20">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
            POR QUE PARTICIPAR DA TOP SORTE?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Benefit 1 */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all border border-slate-100">
            <div className="w-full h-48 mb-8 overflow-hidden rounded-2xl bg-green-50 flex items-center justify-center">
              <img src="https://picsum.photos/seed/prizes/400/300" alt="Prêmios" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              🎁 MAIS CHANCES
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Você participa por números, com sorteios oficiais e regras claras. Nada de promessas vazias.
            </p>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all border border-slate-100">
            <div className="w-full h-48 mb-8 overflow-hidden rounded-2xl bg-blue-50 flex items-center justify-center">
              <img src="https://picsum.photos/seed/whatsapp/400/300" alt="WhatsApp" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              ⚡ RÁPIDO E FÁCIL
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Em poucos minutos você já está concorrendo. Sem burocracia, sem complicação — tudo pelo celular.
            </p>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm hover:shadow-xl transition-all border border-slate-100">
            <div className="w-full h-48 mb-8 overflow-hidden rounded-2xl bg-yellow-50 flex items-center justify-center">
              <img src="https://picsum.photos/seed/security/400/300" alt="Segurança" className="w-full h-full object-cover" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              🔒 TRANSPARÊNCIA
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Sorteios pela Loteria Federal e histórico real de ganhadores. Aqui a confiança vem primeiro.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
