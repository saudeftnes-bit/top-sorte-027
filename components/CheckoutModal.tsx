
import React, { useState, useEffect, useRef } from 'react';
import { WhatsAppIcon } from '../App';
import { createReservation } from '../lib/supabase-admin';
import { useReservationTimer } from '../hooks/useReservationTimer';
import ImageUpload from './ImageUpload';
import { supabase } from '../lib/supabase';
import { getOrCreateSessionId, confirmSelections, cleanupSessionSelections } from '../lib/selection-manager';
import ConfirmModal from './ConfirmModal';

import { Raffle } from '../types/database';

interface CheckoutModalProps {
  selectedNumbers: string[];
  totalPrice: number;
  raffleId?: string;
  raffle?: Raffle;
  onClose: () => void;
  onConfirmPurchase: (name: string, numbers: string[]) => void;
  onSetPending: (name: string, numbers: string[]) => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ selectedNumbers, totalPrice, raffleId, raffle, onClose, onConfirmPurchase, onSetPending }) => {
  const [step, setStep] = useState<'info' | 'payment'>('info');
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [copied, setCopied] = useState(false);
  // Inicializar timer com 30 minutos a partir de agora
  const [expiresAt, setExpiresAt] = useState<string | null>(() => {
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutos
    return expires.toISOString();
  });
  const [reservationIds, setReservationIds] = useState<string[]>([]);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  // States para modal personalizado
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'warning' | 'error' | 'success',
    onConfirm: () => { }
  });

  // Session ID para identificar este usuário
  const sessionId = useRef<string>(getOrCreateSessionId());

  const PIX_KEY = "27992429263";
  const PIX_CODE = "00020126580014BR.GOV.BCB.PIX01364fa098ae-30c1-4f61-833d-970d0656e7055204000053039865802BR5925DEIVID AUGUSTO BANDEIRA B6005SERRA62120508topsorte63048362";
  const timer = useReservationTimer(expiresAt);

  // Função para formatar telefone: (XX) XXXXX-XXXX
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');

    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else if (numbers.length <= 11) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  // Handle expiration
  useEffect(() => {
    if (timer.isExpired && step === 'payment') {
      const handleExpiration = async () => {
        if (raffleId) {
          await cleanupSessionSelections(raffleId, sessionId.current);
        }
        setModalConfig({
          title: 'Tempo Expirado',
          message: '⏰ Tempo expirado! Seus números foram liberados. Por favor, reserve novamente.',
          type: 'warning',
          onConfirm: () => {
            setShowModal(false);
            onClose();
          }
        });
        setShowModal(true);
      };
      handleExpiration();
    }
  }, [timer.isExpired, step, onClose, raffleId]);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(PIX_CODE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.phone && formData.email && raffleId) {
      console.log('📝 [Checkout] Iniciando confirmação...');

      // Tentar converter seleções temporárias (pending) em reservas confirmadas (paid)
      let success = await confirmSelections(
        raffleId,
        sessionId.current,
        formData.name,
        formData.email,
        formData.phone
      );

      // Se não houver seleções pending (realtime não habilitado), criar reservas diretamente
      if (!success) {
        console.log('⚠️ [Checkout] Sem seleções pending, criando reservas diretamente...');

        for (const number of selectedNumbers) {
          const result = await createReservation({
            raffle_id: raffleId,
            number: number,
            buyer_name: formData.name,
            buyer_phone: formData.phone,
            buyer_email: formData.email,
            status: 'paid',
            payment_amount: totalPrice / selectedNumbers.length,
          });

          if (result) {
            console.log(`✅ [Checkout] Reserva criada para número ${number}`);
            success = true;
          }
        }
      }

      if (success) {
        console.log('✅ [Checkout] Confirmação bem-sucedida, indo para pagamento');

        // Buscar IDs das reservas para vinculação de comprovante posterior
        const { data: resData } = await supabase
          .from('reservations')
          .select('id')
          .eq('raffle_id', raffleId)
          .eq('buyer_name', formData.name)
          .eq('status', 'pending');

        if (resData) {
          setReservationIds(resData.map(r => r.id));
        }

        // Definir expiração para 1 minuto (ou valor do admin) a partir de agora
        const timeoutMinutes = raffle?.payment_timeout || 1;
        const oneMinuteFromNow = new Date();
        oneMinuteFromNow.setSeconds(oneMinuteFromNow.getSeconds() + (timeoutMinutes * 60));
        setExpiresAt(oneMinuteFromNow.toISOString());

        // Update local state as PENDING (AMARELO PULSANTE)
        onSetPending(formData.name, selectedNumbers);
        setStep('payment');

        // Rolar modal para o topo
        setTimeout(() => {
          const modal = document.querySelector('.checkout-modal');
          if (modal) {
            modal.scrollTop = 0;
          }
        }, 100);
      } else {
        console.error('❌ [Checkout] Erro ao confirmar reservas');
        setModalConfig({
          title: 'Erro',
          message: 'Erro ao confirmar reservas. Tente novamente.',
          type: 'error',
          onConfirm: () => setShowModal(false)
        });
        setShowModal(true);
      }
    }
  };

  const handleFinish = () => {
    // Cancelar o timer de expiração
    setExpiresAt(null);

    // Opcional: Aqui poderíamos mudar para 'paid' para garantir que não seja limpo
    // Mas vamos apenas abrir o WhatsApp conforme o fluxo atual
    const text = encodeURIComponent(`Olá! Acabei de realizar o PIX para os números ${selectedNumbers.join(', ')}. Meu nome é ${formData.name}. Segue o comprovante em anexo.`);
    window.open(`https://wa.me/55${PIX_KEY}?text=${text}`, '_blank');

    // Fecha o modal e limpa seleções
    onClose();
  };

  // Log quando step mudar
  useEffect(() => {
    console.log(`🔄 [Step] Modal step changed to: ${step}`);
  }, [step]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full duration-300 checkout-modal" style={{ maxHeight: '90vh' }}>
        <div className="p-6 text-center border-b border-slate-100 flex justify-between items-center bg-purple-600 text-white">
          <div className="w-10"></div>
          <h3 className="text-xl font-black uppercase tracking-tight">Reservar Meus Números</h3>
          <button onClick={async () => {
            // Limpar seleções temporárias ao fechar sem confirmar
            if (raffleId && step === 'info') {
              await cleanupSessionSelections(raffleId, sessionId.current);
            }
            onClose();
          }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
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
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                    onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    placeholder="(27) 99999-9999"
                    maxLength={15}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:border-purple-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Email</label>
                  <input
                    required
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
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

              <button
                type="button"
                onClick={async () => {
                  if (raffleId) {
                    await cleanupSessionSelections(raffleId, sessionId.current);
                  }
                  onClose();
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-3 rounded-xl transition-colors active:scale-95 text-xs uppercase text-center"
              >
                Desistir e liberar números
              </button>
            </form>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-10 duration-500">
              {/* Timer de Expiração */}
              {expiresAt && !timer.isExpired && (
                <div className={`text-center p-6 rounded-[2rem] border-2 ${timer.minutes < 5 ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'
                  }`}>
                  <p className={`font-black text-2xl mb-2 ${timer.minutes < 5 ? 'text-red-700' : 'text-orange-700'
                    }`}>
                    ⏰ {timer.formattedTime}
                  </p>
                  <p className={`text-xs font-medium ${timer.minutes < 5 ? 'text-red-600' : 'text-orange-600'
                    }`}>
                    {timer.minutes < 5 ? '🚨 Tempo acabando! Complete o pagamento agora!' : 'Tempo restante para completar o pagamento'}
                  </p>
                </div>
              )}

              <div className="text-center bg-green-50 p-6 rounded-[2rem] border border-green-200">
                <p className="text-green-800 font-bold mb-1 italic">✅ Números Confirmados!</p>
                <p className="text-xs text-green-700 font-medium leading-relaxed">Seus números já estão <span className="font-bold">ROXOS</span> (confirmados) na grade. Complete o pagamento PIX abaixo.</p>
              </div>

              {/* Upload de Comprovante */}
              <div className="space-y-3">
                <p className="text-center text-sm font-black text-slate-700 uppercase tracking-widest">📤 Enviar Comprovante</p>
                <ImageUpload
                  onUploadComplete={async (url) => {
                    // Atualizar todas as reservas com a URL do comprovante
                    for (const id of reservationIds) {
                      await supabase
                        .from('reservations')
                        .update({ payment_proof_url: url })
                        .eq('id', id);
                    }
                    setProofUploaded(true);
                    setUploadError('');
                    // Cancelar timer pois o usuário agiu
                    setExpiresAt(null);
                  }}
                  onUploadError={(error) => {
                    setUploadError(error);
                  }}
                />
                {uploadError && (
                  <p className="text-red-600 text-sm font-bold text-center">{uploadError}</p>
                )}
              </div>

              <div className="text-center text-xs text-slate-400 font-medium">
                <p>-- OU --</p>
              </div>

              {/* Opção 1: Código PIX Copia e Cola */}
              <div className="space-y-4">
                <p className="text-center text-sm font-black text-purple-700 uppercase tracking-widest">💳 Opção 1: PIX Copia e Cola</p>
                <p className="text-center text-xs text-slate-500 font-medium">Copie o código e cole no seu app de banco</p>
                <div className="bg-purple-50 p-4 rounded-2xl border-2 border-purple-200">
                  <div className="bg-white p-3 rounded-xl mb-3 max-h-20 overflow-y-auto">
                    <code className="text-[10px] text-slate-600 font-mono break-all">{PIX_CODE}</code>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="w-full bg-purple-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-md active:scale-95 transition-transform"
                  >
                    {codeCopied ? '✅ CÓDIGO COPIADO!' : '📋 COPIAR CÓDIGO PIX'}
                  </button>
                </div>
              </div>

              <div className="text-center text-xs text-slate-400 font-medium">
                <p>-- OU --</p>
              </div>

              {/* Opção 2: Chave PIX */}
              <div className="space-y-4">
                <p className="text-center text-sm font-black text-green-700 uppercase tracking-widest">📱 Opção 2: Chave PIX</p>
                <p className="text-center text-xs text-slate-500 font-medium">Digite a chave no seu app de banco</p>
                <div className="bg-slate-50 p-5 rounded-2xl flex items-center justify-between border-2 border-slate-200">
                  <span className="font-black text-slate-700 text-lg tracking-tight">{PIX_KEY}</span>
                  <button
                    onClick={handleCopyKey}
                    className="bg-green-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md active:scale-90 transition-transform"
                  >
                    {copied ? '✅ COPIADO!' : 'COPIAR'}
                  </button>
                </div>
              </div>

              <div className="p-6 border-2 border-dashed border-slate-200 rounded-[2rem] space-y-4">
                <p className="text-center text-sm font-bold text-slate-500 leading-relaxed px-2">
                  Pague <span className="text-purple-700 font-black">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> e envie o comprovante via WhatsApp.
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

      {/* Modal personalizado */}
      <ConfirmModal
        isOpen={showModal}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText="OK"
        cancelText="Fechar"
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setShowModal(false)}
      />
    </div>
  );
};

export default CheckoutModal;
