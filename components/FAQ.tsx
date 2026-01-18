
import React, { useState } from 'react';

const FAQ: React.FC = () => {
  const questions = [
    { 
      q: "Como funciona o sorteio?", 
      a: "Os sorteios são realizados com base nos números da Loteria Federal, garantindo transparência total. Você escolhe seus números e, no dia do sorteio oficial, se os seus números coincidirem com os premiados da Federal, você ganha!" 
    },
    { 
      q: "É difícil participar?", 
      a: "Não. Você escolhe seus números, segue as orientações do administrador via WhatsApp e pronto — já está concorrendo. Sem cadastros complexos ou aplicativos pesados." 
    },
    { 
      q: "Onde vejo os valores?", 
      a: "Os valores de participação são informados diretamente pelo administrador no WhatsApp, variando de acordo com cada sorteio e quantidade de números escolhidos." 
    },
    {
      q: "Como recebo o prêmio?",
      a: "Nossa equipe entra em contato via WhatsApp e telefone imediatamente após a apuração do resultado. O pagamento é feito via PIX ou transferência bancária para prêmios em dinheiro, ou entrega física para bens."
    }
  ];

  return (
    <section className="bg-slate-50 py-20" id="faq">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
            PERGUNTAS FREQUENTES
          </h2>
          <p className="text-slate-600">Tudo o que você precisa saber antes de participar.</p>
        </div>

        <div className="space-y-4">
          {questions.map((item, i) => (
            <FAQItem key={i} question={item.q} answer={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
};

// Using React.FC to properly handle React-specific props like 'key' when mapped in a list
const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-6 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="text-lg font-bold text-slate-800">❓ {question}</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </span>
      </button>
      {isOpen && (
        <div className="p-6 pt-0 text-slate-600 bg-white">
          <p className="leading-relaxed border-t border-slate-100 pt-4">{answer}</p>
        </div>
      )}
    </div>
  );
};

export default FAQ;
