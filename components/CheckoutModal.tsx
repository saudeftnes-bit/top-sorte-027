
import React, { useState } from 'react';
import { WhatsAppIcon } from '../App';

interface CheckoutModalProps {
  selectedNumbers: string[];
  totalPrice: number;
  onClose: () => void;
  onConfirmPurchase: (name: string, numbers: string[]) => void;
  onSetPending: (name: string, numbers: string[]) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ selectedNumbers, totalPrice, onClose, onConfirmPurchase, onSetPending }) => {
  const [step, setStep] = useState<'info' | 'payment'>('info');
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [copied, setCopied] = useState(false);

  const PIX_KEY = "27992429263";

  const handleCopy = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone) {
      // Assim que ele preenche os dados, bloqueamos os números como Pendente (Amarelo)
      onSetPending(formData.name, selectedNumbers);
      setStep('payment');
    }
  };

  const handleFinish = () => {
    // Confirma como Reservado (Roxo)
    onConfirmPurchase(formData.name, selectedNumbers);
    
    const text = encodeURIComponent(`Olá! Acabei de realizar o PIX para os números ${selectedNumbers.join(', ')}. Meu nome é ${formData.name}. Segue o comprovante em anexo.`);
    window.open(`https://wa.me/55${PIX_KEY}?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full duration-300">
        <div className="p-6 text-center border-b border-slate-100 flex justify-between items-center bg-purple-600 text-white">
          <div className="w-10"></div>
          <h3 className="text-xl font-black uppercase tracking-tight">Reservar Meus Números</h3>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8">
          {step === 'info' ? (
            <form onSubmit={handleNext} className="space-y-6">
              <div className="text-center mb-6">
                <p className="text-slate-400 font-bold mb-2 uppercase text-[10px] tracking-widest">Resumo da sua sorte</p>
                <div className="flex flex-wrap justify-center gap-2 mb-4">
                  {selectedNumbers.map(n => (
                    <span key={n} className="bg-purple-50 text-purple-700 border border-purple-100 font-black px-3 py-1 rounded-lg text-sm">{n}</span>
                  ))}
                </div>
                <p className="text-3xl font-black text-[#003B73]">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Quem está concorrendo?</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Nome Completo" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:border-purple-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Seu WhatsApp</label>
                  <input 
                    required
                    type="tel" 
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="(27) 99999-9999" 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:border-purple-600 transition-colors"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl shadow-xl transition-transform active:scale-95 text-lg"
              >
                PROSSEGUIR PARA PAGAMENTO
              </button>
            </form>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="text-center bg-yellow-50 p-6 rounded-[2rem] border border-yellow-200">
                <p className="text-yellow-800 font-bold mb-1 italic">Reserva Temporária Ativa!</p>
                <p className="text-xs text-yellow-700 font-medium leading-relaxed">Seus números já estão <span className="font-bold">AMARELOS</span> na grade. Outros usuários não podem selecioná-los enquanto você finaliza.</p>
              </div>

              <div className="space-y-4">
                <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Chave PIX (Celular)</p>
                <div className="bg-slate-50 p-5 rounded-2xl flex items-center justify-between border-2 border-slate-200">
                  <span className="font-black text-slate-700 text-lg tracking-tight">{PIX_KEY}</span>
                  <button 
                    onClick={handleCopy}
                    className="bg-purple-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md active:scale-90 transition-transform"
                  >
                    {copied ? 'COPIADO!' : 'COPIAR'}
                  </button>
                </div>
              </div>

              <div className="p-6 border-2 border-dashed border-slate-200 rounded-[2rem] space-y-4">
                <p className="text-center text-sm font-bold text-slate-500 leading-relaxed px-2">
                  Pague <span className="text-purple-700 font-black">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> e envie o comprovante para validar sua reserva como <span className="text-purple-700 font-black">ROXA</span>.
                </p>
                <button 
                  onClick={handleFinish}
                  className="w-full bg-green-600 text-white font-black py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95"
                >
                  <WhatsAppIcon className="w-6 h-6" />
                  CONFIRMAR NO WHATSAPP
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
