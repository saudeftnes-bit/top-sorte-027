
import React, { useState, useEffect, useRef } from 'react';
import { WhatsAppIcon } from '../App';
import { useReservationTimer } from '../hooks/useReservationTimer';
import { useEfiPayment } from '../hooks/useEfiPayment';
import { getOrCreateSessionId, cleanupSessionSelections } from '../lib/selection-manager';
import ConfirmModal from './ConfirmModal';
import PaymentReceipt from './PaymentReceipt';

import { Raffle } from '../types/database';

interface CheckoutModalProps {
  selectedNumbers: string[];
  totalPrice: number;
  raffleId?: string;
  raffle?: Raffle;
  onClose: () => void;
  onConfirmPurchase: (name: string, numbers: string[]) => void;
  onSetPending: (name: string, numbers: string[]) => void;
  onBuyMore?: () => void;
  reservations?: import('../App').ReservationMap;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ selectedNumbers, totalPrice, raffleId, raffle, onClose, onConfirmPurchase, onSetPending, onBuyMore, reservations }) => {
  const [step, setStep] = useState<'info' | 'payment'>('info');

  // Feature 1: Pre-fill from localStorage (phone-based identification)
  const [formData, setFormData] = useState(() => ({
    name: localStorage.getItem('buyer_name') || '',
    phone: localStorage.getItem('buyer_phone') || '',
  }));
  const [nameError, setNameError] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  // Valida nome completo: mínimo 2 palavras, cada uma com pelo menos 2 letras
  const validateFullName = (name: string): string | null => {
    const parts = name.trim().split(/\s+/).filter(p => p.length >= 2);
    if (parts.length < 2) return 'Informe seu nome e sobrenome completos.';
    return null;
  };

  // Theme logic
  const isBicho = raffle?.selection_mode === 'jogo_bicho';
  const themeBg = isBicho ? 'bg-green-600' : 'bg-[#003B73]';
  const themeText = isBicho ? 'text-green-600' : 'text-[#003B73]';
  const themeDarkText = isBicho ? 'text-green-700' : 'text-[#003B73]';
  const themeLightBg = isBicho ? 'bg-green-50' : 'bg-blue-50';
  const themeLightBorder = isBicho ? 'border-green-100' : 'border-blue-100';
  const themeFocusBorder = isBicho ? 'focus:border-green-600' : 'focus:border-blue-600';

  // Estados Efi
  const [efiTxid, setEfiTxid] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pixCopiaCola, setPixCopiaCola] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isCreatingCharge, setIsCreatingCharge] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [finalPrice, setFinalPrice] = useState<number>(totalPrice);

  // Polling de status Efi
  const { status: efiStatus, stopPolling } = useEfiPayment(efiTxid, step === 'payment');
  const timer = useReservationTimer(expiresAt);
  const successFired = useRef(false);

  // Monitorar confirmação via banco de dados (Global State)
  useEffect(() => {
    if (step === 'payment' && reservations && selectedNumbers.length > 0) {
      const allPaid = selectedNumbers.every(num => reservations[num]?.status === 'paid');

      if (allPaid) {
        console.log('✅ [Checkout] Pagamento confirmado via Banco de Dados!');
        handleSuccess();
      }
    }
  }, [reservations, selectedNumbers, step]);

  // States para modal personalizado
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    variant: 'info' as 'info' | 'warning' | 'danger',
    confirmLabel: 'OK',
    cancelLabel: undefined as string | undefined,
    onConfirm: () => { },
    onCancel: undefined as (() => void) | undefined,
  });

  // Session ID para identificar este usuário
  const sessionId = useRef<string>(getOrCreateSessionId());

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

  // Feature 3: Post-payment UX flow
  const handleSuccess = () => {
    if (successFired.current) return;
    successFired.current = true;

    stopPolling();
    setExpiresAt(null);

    // Atualizar UI
    onConfirmPurchase(formData.name, selectedNumbers);

    // Modal 1: "Deseja comprar mais?"
    setModalConfig({
      title: 'Compra Realizada! 🎉',
      message: `✅ Pagamento confirmado com sucesso!\n\n🎯 Números: ${selectedNumbers.join(', ')}\n\nDeseja adquirir mais números para aumentar suas chances de ganhar?`,
      variant: 'info',
      confirmLabel: 'Sim, quero mais! 🔥',
      cancelLabel: 'Não, obrigado',
      onConfirm: () => {
        setShowModal(false);
        // Volta para a grade sem fechar a rifa
        if (onBuyMore) {
          onBuyMore();
        } else {
          onClose();
        }
      },
      onCancel: () => {
        setShowModal(false);
        // Modal 2: Boa sorte!
        setTimeout(() => {
          setModalConfig({
            title: 'Boa Sorte! 🍀',
            message: `🌟 Você está na disputa!\n\n"A sorte favorece os corajosos — e você acabou de provar isso!"\n\nFique ligado no nosso Instagram @topsorte_027 para acompanhar o resultado. Torce que o seu número sai! 🏆✨`,
            variant: 'info',
            confirmLabel: '🙏 Valeu, até a próxima!',
            cancelLabel: undefined,
            onConfirm: () => {
              setShowModal(false);
              onClose();
            },
            onCancel: undefined,
          });
          setShowModal(true);
        }, 300);
      },
    });
    setShowModal(true);
  };

  // Handle payment confirmation via Efi
  useEffect(() => {
    if (efiStatus?.isPaid) {
      console.log('✅ [Checkout] Pagamento confirmado via Efi!');
      handleSuccess();
    }
  }, [efiStatus?.isPaid]);

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
          variant: 'warning',
          confirmLabel: 'OK',
          cancelLabel: undefined,
          onConfirm: () => {
            setShowModal(false);
            onClose();
          },
          onCancel: undefined,
        });
        setShowModal(true);
      };
      handleExpiration();
    }
  }, [timer.isExpired, step, onClose, raffleId]);

  const handleCopy = () => {
    if (pixCopiaCola) {
      navigator.clipboard.writeText(pixCopiaCola);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();

    // Valida nome completo (nome + sobrenome obrigatório)
    const nameValidation = validateFullName(formData.name);
    if (nameValidation) {
      setNameError(nameValidation);
      return;
    }
    setNameError(null);

    if (!formData.name || !formData.phone || !raffleId) {
      return;
    }

    // Feature 1: Save buyer identity to localStorage
    localStorage.setItem('buyer_name', formData.name);
    localStorage.setItem('buyer_phone', formData.phone);

    setIsCreatingCharge(true);
    setChargeError(null);

    try {
      console.log('💳 [Checkout] Criando cobrança PIX Efi...');

      // Chamar API para criar cobrança Efi
      const response = await fetch('/api/efi-charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raffleId,
          numbers: selectedNumbers,
          buyer: {
            name: formData.name,
            phone: formData.phone,
            email: '', // Sending empty email as backend might expect the field
          },
          totalPrice,
          paymentTimeout: raffle?.payment_timeout || 15,
          sessionId: sessionId.current,
        }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          throw new Error("Erro de conexão com a API. (Lembre-se: 'npm run dev' não processa a pasta /api, você precisa usar a Vercel ou testar em produção).");
        }
        const detailMsg = errorData?.message || errorData?.details || '';
        throw new Error(`${errorData?.error || 'Erro desconhecido'}${detailMsg ? `: ${detailMsg}` : ''}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Erro inesperado no servidor. O servidor retornou uma resposta vazia ou em formato HTML. Se estiver rodando localmente, garanta compatibilidade da Vercel.");
      }

      console.log('✅ [Checkout] Cobrança criada:', data.txid);

      // Salvar dados do PIX
      setEfiTxid(data.txid);
      setQrCode(data.qrCode);
      setPixCopiaCola(data.pixCopiaCola);
      setExpiresAt(data.expiresAt);
      setFinalPrice(totalPrice);

      // Atualizar local state como PENDING
      onSetPending(formData.name, selectedNumbers);

      // Mostrar modal de confirmação
      setModalConfig({
        title: 'Números Confirmados',
        message: `Seus números foram reservados com sucesso!\n\n🎯 Números: ${selectedNumbers.join(', ')}\n\n⏰ Complete o pagamento PIX para garantir sua participação!`,
        variant: 'info',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        onConfirm: () => {
          setShowModal(false);
          setStep('payment');

          // Rolar modal para o topo
          setTimeout(() => {
            const modal = document.querySelector('.checkout-modal');
            if (modal) {
              modal.scrollTop = 0;
            }
          }, 100);
        },
        onCancel: undefined,
      });
      setShowModal(true);

    } catch (error: any) {
      console.error('❌ [Checkout] Erro:', error);
      setChargeError(error.message || 'Erro ao processar pagamento');
      setModalConfig({
        title: 'Aviso Importante',
        message: error.message || 'Erro ao processar pagamento. Tente novamente.',
        variant: 'danger',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        onConfirm: () => setShowModal(false),
        onCancel: undefined,
      });
      setShowModal(true);
    } finally {
      setIsCreatingCharge(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-full duration-300 checkout-modal" style={{ maxHeight: '90vh' }}>
        <div className={`p-6 text-center border-b border-slate-100 flex justify-between items-center ${themeBg} text-white`}>
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
                    <span key={n} className={`${themeLightBg} ${themeText} border ${themeLightBorder} font-black px-3 py-1 rounded-lg text-sm`}>{n}</span>
                  ))}
                </div>
                <p className="text-3xl font-black text-[#003B73]">R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">Nome e Sobrenome</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => {
                      setFormData({ ...formData, name: e.target.value });
                      if (nameError) setNameError(validateFullName(e.target.value));
                    }}
                    placeholder="Ex: João Silva"
                    className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none transition-colors ${nameError ? 'border-red-400 focus:border-red-500' : `border-slate-100 ${themeFocusBorder}`
                      }`}
                  />
                  {nameError ? (
                    <p className="text-red-500 text-xs font-bold mt-1 ml-1">⚠️ {nameError}</p>
                  ) : (
                    <p className="text-slate-400 text-[10px] font-bold mt-1 ml-1">Digite seu nome e sobrenome — apelidos não são aceitos.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-1 ml-1">
                    Seu WhatsApp
                    {localStorage.getItem('buyer_phone') && (
                      <span className="ml-2 text-green-600 normal-case font-bold">✓ identificado</span>
                    )}
                  </label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    placeholder="(27) 99999-9999"
                    maxLength={15}
                    className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none ${themeFocusBorder} transition-colors`}
                  />
                  <p className="text-[10px] text-slate-400 font-bold mt-1 ml-1">Seu WhatsApp é usado como identificação nas próximas compras.</p>
                </div>
              </div>
              {chargeError && (
                <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                  <p className="text-red-700 font-bold text-sm text-center">{chargeError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreatingCharge}
                className={`w-full ${themeBg} text-white font-black py-5 rounded-2xl shadow-xl transition-transform active:scale-95 text-lg disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isCreatingCharge ? 'PROCESSANDO...' : 'PROSSEGUIR PARA PAGAMENTO'}
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

              {/* Status do Pagamento */}
              {efiStatus && (
                <div className={`text-center p-6 rounded-[2rem] border-2 ${efiStatus.isPaid ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'
                  }`}>
                  <p className={`font-black text-lg mb-1 ${efiStatus.isPaid ? 'text-green-700' : 'text-blue-700'
                    }`}>
                    {efiStatus.isPaid ? '✅ Pagamento Confirmado!' : '🔄 Aguardando Pagamento...'}
                  </p>
                  <p className="text-xs font-medium text-slate-600">
                    {efiStatus.isPaid ? 'Você já está concorrendo!' : 'Realize o PIX abaixo'}
                  </p>
                </div>
              )}

              {/* PIX Copia e Cola (Visualização Única) */}
              {pixCopiaCola && !efiStatus?.isPaid && (
                <>
                  <div className="space-y-3">
                    <p className={`text-center text-sm font-black ${themeDarkText} uppercase tracking-widest`}>
                      ⏳ Quase lá! Seu número está reservado.
                    </p>
                    <p className="text-center text-xs text-slate-500 font-medium px-4 mb-2">
                      Copie o código abaixo e pague no aplicativo do seu banco para garantir o seu bilhete da sorte antes que o tempo acabe.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-center text-sm font-black text-green-700 uppercase tracking-widest">💳 PIX Copia e Cola</p>
                    <div className="bg-green-50 p-4 rounded-2xl border-2 border-green-200">
                      <div className="bg-white p-3 rounded-xl mb-3 max-h-20 overflow-y-auto">
                        <code className="text-[10px] text-slate-600 font-mono break-all">{pixCopiaCola}</code>
                      </div>
                      <button
                        onClick={handleCopy}
                        className="w-full bg-green-600 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-md active:scale-95 transition-transform"
                      >
                        {copied ? '✅ CÓDIGO COPIADO!' : '📋 COPIAR CÓDIGO PIX'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Comprovante de Pagamento - aparece após confirmação */}
              {efiStatus?.isPaid && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 px-1 justify-center bg-emerald-50 py-3 rounded-2xl border border-emerald-100">
                    <span className="text-xl">✨</span>
                    <p className="text-sm font-black text-emerald-800 uppercase tracking-wide">Seu Pagamento foi Aprovado!</p>
                  </div>
                  <PaymentReceipt
                    buyerName={formData.name}
                    buyerPhone={formData.phone}
                    numbers={selectedNumbers}
                    totalPrice={finalPrice}
                    txid={efiTxid || undefined}
                    raffleCode={raffle?.code || undefined}
                    raffleName={raffle?.title || 'Top Sorte'}
                    paymentDate={new Date()}
                  />
                </div>
              )}

              {/* Valor */}
              <div className="p-6 border-2 border-dashed border-slate-200 rounded-[2rem] space-y-4">
                <p className="text-center text-sm font-bold text-slate-500 leading-relaxed px-2">
                  Valor: <span className={`${themeDarkText} font-black`}>R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </p>
                <p className="text-center text-xs text-slate-400">
                  O pagamento será confirmado automaticamente após o processamento PIX.
                </p>
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
        variant={modalConfig.variant}
        confirmLabel={modalConfig.confirmLabel}
        cancelLabel={modalConfig.cancelLabel}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel || (() => setShowModal(false))}
      />
    </div >
  );
};

export default CheckoutModal;
