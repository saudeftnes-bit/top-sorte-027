

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { WhatsAppIcon } from '../App';

const GeminiAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHumanMode, setIsHumanMode] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model' | 'system', text: string }[]>([
    { role: 'model', text: 'Olá! Sou o assistente automático da Top Sorte. Se precisar de algo mais pessoal, pode me chamar pra falar com o dono a qualquer momento. 🍀' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isConnecting]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      // Verifica se a API key está configurada
      if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          role: 'model',
          text: isHumanMode
            ? 'Opa! O sistema automático está em manutenção. Me chama no WhatsApp que te respondo rapidinho! 📱'
            : 'Sistema em manutenção. Por favor, clique em "FALAR COM O DAVID AGORA" ou use o WhatsApp no topo da página. 🔧'
        }]);
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);

      // Persona ultra-humanizada do "David" com foco em Webhook e Fechamento
      const systemInstruction = isHumanMode
        ? `Você é o DAVID, o PROPRIETÁRIO da Top Sorte. 
           REGRAS DE OURO:
           1. NUNCA diga que é uma IA. Use gírias de dono de negócio (Opa, fala fera, show, tamo junto).
           2. VALIDAÇÃO: Informe que NÃO precisa mandar comprovante no WhatsApp. O sistema valida tudo automático via webhook assim que o PIX cai.
           3. PERSUASÃO: Se o cliente estiver enrolando, diga que os números estão voando e o sistema vai liberar a reserva dele logo.
           4. ENCERRAMENTO: No final de TODA resposta, você DEVE perguntar se pode ajudar em algo mais ("Ajudo em algo mais?", "Mais alguma dúvida?", "Posso te ajudar com mais algum número?").
           5. Se o usuário quiser encerrar, despeça-se desejando boa sorte.`
        : `Você é o suporte automático da Top Sorte. Rápido e objetivo. Informações: PIX 27992429263, Valor R$ 13,00.`;

      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction
      });

      const result = await model.generateContent(userText);
      const response = result.response;

      const delay = isHumanMode ? 1200 : 500;
      setTimeout(() => {
        const aiText = response.text() || "Deu uma travada aqui no sinal. O que você disse?";
        setMessages(prev => [...prev, { role: 'model', text: aiText }]);
        setIsTyping(false);
      }, delay);

    } catch (error) {
      console.error('Gemini API Error:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'model', text: "Opa, meu sinal caiu aqui. Tenta de novo ou me chama no WhatsApp!" }]);
    }
  };

  const startHumanConnection = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsHumanMode(true);
      setMessages(prev => [
        ...prev,
        { role: 'system', text: 'David entrou no chat.' },
        { role: 'model', text: 'Opa, beleza? David aqui na área! Vi que você chamou. Como posso te ajudar a garantir esse prêmio hoje? Pode falar que eu resolvo aqui. 🤝' }
      ]);
    }, 2000);
  };

  const endSession = () => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { role: 'model', text: 'Show de bola! Qualquer coisa é só chamar de novo. Boa sorte no sorteio, tamo junto! 🚀' },
        { role: 'system', text: 'Atendimento finalizado pelo David.' }
      ]);
      setIsHumanMode(false);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <>
      {/* Botão Flutuante - No mobile fica no topo direito (abaixo do header), no desktop fica embaixo */}
      <div className="fixed top-[72px] sm:top-auto sm:bottom-6 right-2 sm:right-6 z-[60]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-2.5 sm:p-3.5 rounded-full shadow-2xl flex items-center justify-center border-2 transition-all active:scale-90 ${isOpen ? 'bg-slate-800 border-slate-700' : 'bg-white border-[#4ADE80]'}`}
        >
          {isOpen ? (
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
          ) : (
            <div className="relative">
              <svg className="w-6 h-6 sm:w-7 sm:h-7 text-[#003B73]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 bg-green-500"></span>
              </span>
            </div>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-20 sm:right-6 z-[70] w-full h-full sm:w-[360px] sm:h-[520px] bg-white sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Cabeçalho do Chat */}
          <div className={`p-6 flex flex-col gap-3 text-white transition-all duration-700 ${isHumanMode ? 'bg-[#003B73]' : 'bg-slate-900'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-all border-2 border-white/20 ${isHumanMode ? 'bg-purple-500 shadow-lg' : 'bg-[#4ADE80] text-slate-900'}`}>
                    {isHumanMode ? 'D' : 'AI'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-sm uppercase tracking-tight">{isHumanMode ? 'David - Proprietário' : 'Suporte Automático'}</p>
                    {isHumanMode && <span className="text-blue-400">
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293l-4 4a1 1 0 01-1.414 0l-2-2a1 1 0 111.414-1.414L9 10.586l3.293-3.293a1 1 0 111.414 1.414z" /></svg>
                    </span>}
                  </div>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest">
                    {isHumanMode ? 'Respondendo você' : 'Online'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 bg-white/10 rounded-full">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>

            {isHumanMode ? (
              <button
                onClick={endSession}
                className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                🚪 ENCERRAR ATENDIMENTO
              </button>
            ) : !isConnecting && (
              <button
                onClick={startHumanConnection}
                className="w-full bg-[#4ADE80] hover:bg-green-400 text-slate-900 text-[10px] font-black py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
              >
                👤 FALAR COM O DAVID AGORA
              </button>
            )}
          </div>

          {/* Área de Mensagens */}
          <div ref={scrollRef} className="flex-grow overflow-y-auto p-5 space-y-4 bg-slate-50 no-scrollbar relative">
            {isConnecting ? (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 border-4 border-slate-100 border-t-[#003B73] rounded-full animate-spin mb-4"></div>
                <p className="text-[#003B73] font-black uppercase text-xs tracking-widest">Chamando David...</p>
                <p className="text-slate-400 text-[10px] mt-2 font-bold uppercase">Ele já vai te responder</p>
              </div>
            ) : null}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'system' ? (
                  <div className="w-full text-center py-2">
                    <span className="bg-slate-200 text-slate-500 text-[9px] font-black uppercase px-4 py-1.5 rounded-full">
                      {m.text}
                    </span>
                  </div>
                ) : (
                  <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] font-bold leading-relaxed shadow-sm transition-all ${m.role === 'user'
                    ? 'bg-slate-800 text-white rounded-tr-none'
                    : isHumanMode
                      ? 'bg-white text-[#003B73] border-l-4 border-l-purple-500 rounded-tl-none'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}>
                    {m.text}
                  </div>
                )}
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 p-4 rounded-2xl flex gap-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input de Mensagem */}
          <div className="p-5 bg-white border-t border-slate-100">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isHumanMode ? "Fale com o David..." : "Dúvida sobre os números?"}
                className="flex-grow bg-slate-100 border-2 border-transparent rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 focus:border-[#003B73] focus:bg-white outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isTyping || isConnecting || !input.trim()}
                className={`p-4 rounded-2xl shadow-lg disabled:opacity-50 transition-all active:scale-90 ${isHumanMode ? 'bg-[#003B73]' : 'bg-slate-900'} text-white`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </form>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              {isHumanMode && <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>}
              <p className="text-[9px] text-center text-slate-400 font-black uppercase tracking-tighter">
                {isHumanMode ? 'O David está online agora' : 'Processamento Inteligente 24h'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GeminiAssistant;
