
import React, { useState, useEffect, useRef } from 'react';
import Home from './components/Home';
import RaffleSelection from './components/RaffleSelection';
import CheckoutModal from './components/CheckoutModal';
import GeminiAssistant from './components/GeminiAssistant';
import AdminPanel from './components/admin/AdminPanel';
import { getActiveRaffle, getReservationsByRaffle, subscribeToReservations } from './lib/supabase-admin';
import { getOrCreateSessionId, cleanupSessionSelections } from './lib/selection-manager';
import type { Raffle, Reservation } from './types/database';

export type NumberStatus = 'available' | 'pending' | 'paid';
export type ReservationMap = Record<string, { name: string; status: NumberStatus }>;

export type RaffleState = 'home' | 'selecting' | 'admin';

const App: React.FC = () => {
  const [view, setView] = useState<RaffleState>('home');
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Supabase state
  const [activeRaffle, setActiveRaffle] = useState<Raffle | null>(null);
  const [dbReservations, setDbReservations] = useState<Reservation[]>([]);

  // Estado centralizado com status reais: Verde (livre), Roxo (pago), Amarelo (em reserva)
  const [reservations, setReservations] = useState<ReservationMap>({});

  // Session ID para identificar este usuário
  const sessionId = useRef<string>(getOrCreateSessionId());

  // Secret admin mode toggle (5 clicks on logo)
  const [clickCount, setClickCount] = useState(0);
  const [showAdminButton, setShowAdminButton] = useState(() => {
    return localStorage.getItem('adminMode') === 'true';
  });
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  const PRICE_PER_NUMBER = activeRaffle?.price_per_number || 13.00;

  // Check for admin route
  useEffect(() => {
    if (window.location.pathname === '/admin') {
      setView('admin');
    }
  }, []);

  // Load active raffle and reservations from Supabase
  useEffect(() => {
    loadRaffleData();

    // Add visibility change listener to reload data when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Tab became visible, reloading data...');
        loadRaffleData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for custom admin update events (for multi-tab sync)
    const handleAdminUpdate = () => {
      console.log('Admin update detected, reloading data...');
      loadRaffleData();
    };

    window.addEventListener('adminDataUpdated', handleAdminUpdate);

    // Listen for localStorage changes from admin in other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'lastAdminUpdate' && e.newValue) {
        console.log('Admin update from another tab detected, reloading data...');
        loadRaffleData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('adminDataUpdated', handleAdminUpdate);
      window.removeEventListener('storage', handleStorageChange);

      // Limpar seleções temporárias ao sair da página
      if (activeRaffle) {
        cleanupSessionSelections(activeRaffle.id, sessionId.current);
      }
    };
  }, []);

  // Separate effect for real-time subscription to prevent multiple subscriptions
  useEffect(() => {
    if (!activeRaffle) return;

    console.log('🔔 [Real-time] Setting up subscription for raffle:', activeRaffle.id);

    const subscription = subscribeToReservations(activeRaffle.id, (payload) => {
      console.log('🔔 [Real-time] Update received!', {
        eventType: payload.eventType,
        table: payload.table,
        new: payload.new,
        old: payload.old
      });

      // Reload data when real-time update is received
      console.log('🔔 [Real-time] Reloading raffle data...');
      loadRaffleData();
    });

    // Check subscription status
    subscription.on('system', (message) => {
      console.log('🔔 [Real-time] System message:', message);
    });

    return () => {
      console.log('🔔 [Real-time] Cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [activeRaffle?.id]);

  const loadRaffleData = async () => {
    try {
      console.log('📊 [Data] Loading raffle data...');
      const raffle = await getActiveRaffle();
      if (raffle) {
        setActiveRaffle(raffle);

        // Load reservations
        const reservationsData = await getReservationsByRaffle(raffle.id);
        console.log('📊 [Data] Loaded', reservationsData.length, 'reservations');
        setDbReservations(reservationsData);

        // Convert to legacy format for compatibility
        const reservationsMap: ReservationMap = {};
        reservationsData.forEach((res) => {
          if (res.status !== 'cancelled') {
            reservationsMap[res.number] = {
              name: res.buyer_name,
              status: res.status as NumberStatus,
            };
          }
        });
        setReservations(reservationsMap);
        console.log('📊 [Data] Updated UI with', Object.keys(reservationsMap).length, 'active reservations');
      }
    } catch (error) {
      console.error('❌ [Data] Error loading raffle data:', error);
    }
  };

  const toggleNumber = async (num: string) => {
    // Não permite selecionar se já estiver reservado ou pendente por outro
    if (reservations[num]) return;
    if (!activeRaffle) return;

    const isSelected = selectedNumbers.includes(num);

    if (isSelected) {
      // Desselecionar: remover seleção temporária do Supabase
      setSelectedNumbers(prev => prev.filter(n => n !== num));

      // Importar função dinamicamente para evitar problemas de build
      const { removeTemporarySelection } = await import('./lib/selection-manager');
      await removeTemporarySelection(activeRaffle.id, num, sessionId.current);
    } else {
      // Selecionar: criar seleção temporária no Supabase
      setSelectedNumbers(prev => [...prev, num]);

      // Importar função dinamicamente para evitar problemas de build
      const { createTemporarySelection } = await import('./lib/selection-manager');
      await createTemporarySelection(activeRaffle.id, num, sessionId.current);
    }
  };

  const handleParticipate = () => {
    setView('selecting');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Secret admin mode toggle (5 clicks on logo)
  const handleLogoClick = () => {
    if (view !== 'home') {
      setView('home');
      return;
    }

    // Count clicks
    const newCount = clickCount + 1;
    setClickCount(newCount);

    // Clear previous timer
    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    // Reset counter after 2 seconds
    const timer = setTimeout(() => {
      setClickCount(0);
    }, 2000);
    setClickTimer(timer);

    // Toggle admin mode on 5 clicks
    if (newCount === 5) {
      const newAdminMode = !showAdminButton;
      setShowAdminButton(newAdminMode);
      localStorage.setItem('adminMode', newAdminMode.toString());
      setClickCount(0);

      // Visual feedback
      if (newAdminMode) {
        console.log('✅ Admin mode activated');
      } else {
        console.log('❌ Admin mode deactivated');
      }
    }
  };

  // Quando o usuário entra no checkout, marcamos como "Pendente" (Amarelo)
  const setPending = (name: string, numbers: string[]) => {
    const newReservations = { ...reservations };
    numbers.forEach(num => {
      newReservations[num] = { name, status: 'pending' };
    });
    setReservations(newReservations);
  };

  // Quando confirma o PIX, vira "Reservado/Pago" (Roxo)
  const confirmPurchase = (name: string, numbers: string[]) => {
    const newReservations = { ...reservations };
    numbers.forEach(num => {
      newReservations[num] = { name, status: 'paid' };
    });
    setReservations(newReservations);

    // NÃO fechar o modal ainda - usuário precisa ver a tela de pagamento
    // O modal será fechado quando o usuário clicar no X ou completar o pagamento
    // setSelectedNumbers([]);
    // setIsCheckoutOpen(false);
    // setView('selecting');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      <header className="sticky top-0 z-40 bg-white shadow-sm px-4 h-16 flex items-center justify-between border-b border-slate-100">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={handleLogoClick}
        >
          <img
            src="/logo.png"
            alt="Top Sorte 027"
            className="h-12 w-auto object-contain rounded-full"
          />
          <div className="flex flex-col">
            <span className="text-lg font-black leading-none text-[#003B73]">TOP <span className="text-[#4ADE80]">$ORTE</span></span>
            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">027</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Instagram */}
          <a
            href="https://www.instagram.com/topsorte_027?igsh=MW4wZGN0enFobHJldw=="
            target="_blank"
            rel="noopener noreferrer"
            className="w-9 h-9 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform"
            title="Siga-nos no Instagram"
          >
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          </a>

          {/* WhatsApp Atendimento */}
          <a
            href="https://wa.me/550270999762623"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md hover:bg-[#20BA5A] hover:scale-105 transition-all"
            title="Fale com o atendente"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <span className="hidden sm:inline">Atendimento</span>
          </a>

          {/* Admin Button - Só aparece com o código secreto (5 cliques no logo) */}
          {showAdminButton && view !== 'admin' && (
            <button
              onClick={() => setView('admin')}
              className="w-9 h-9 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform group"
              title="Painel Admin"
            >
              <svg className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}

          {view === 'selecting' && (
            <button
              onClick={() => setView('home')}
              className="text-sm font-bold text-slate-500 hover:text-[#003B73] ml-2"
            >
              Voltar
            </button>
          )}
        </div>
      </header>

      <main>
        {view === 'admin' ? (
          <AdminPanel />
        ) : view === 'home' ? (
          <Home onStart={handleParticipate} />
        ) : (
          <RaffleSelection
            selectedNumbers={selectedNumbers}
            onToggleNumber={toggleNumber}
            reservations={reservations}
          />
        )}
      </main>

      {selectedNumbers.length > 0 && view === 'selecting' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-500 uppercase">{selectedNumbers.length} Números selecionados</span>
              <span className="text-xl font-black text-[#003B73]">
                Total: R$ {(selectedNumbers.length * PRICE_PER_NUMBER).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-3 rounded-xl shadow-lg transition-transform active:scale-95"
            >
              RESERVAR AGORA
            </button>
          </div>
        </div>
      )}

      {isCheckoutOpen && (
        <CheckoutModal
          selectedNumbers={selectedNumbers}
          totalPrice={selectedNumbers.length * PRICE_PER_NUMBER}
          raffleId={activeRaffle?.id}
          onClose={() => {
            setIsCheckoutOpen(false);
            setSelectedNumbers([]);
            setView('selecting');
          }}
          onConfirmPurchase={confirmPurchase}
          onSetPending={setPending}
        />
      )}


      <GeminiAssistant />
    </div>
  );
};

export const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

export default App;
