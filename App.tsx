
import React, { useState, useEffect, useRef } from 'react';
import Home from './components/Home';
import RaffleSelection from './components/RaffleSelection';
import CheckoutModal from './components/CheckoutModal';
import FAQChatbot from './components/FAQChatbot';
import { HistoricalRaffleView } from './components/HistoricalRaffleView';
import AdminPanel from './components/admin/AdminPanel';
import InstagramVideos from './components/InstagramVideos';
import { getActiveRaffle, getReservationsByRaffle, subscribeToReservations } from './lib/supabase-admin';
import { getOrCreateSessionId, cleanupSessionSelections } from './lib/selection-manager';
import type { Raffle, Reservation } from './types/database';

export type NumberStatus = 'available' | 'pending' | 'paid';
export type ReservationMap = Record<string, { name: string; status: NumberStatus }>;

export type RaffleState = 'home' | 'selecting' | 'admin' | 'videos';

const App: React.FC = () => {
  const [view, setView] = useState<RaffleState>('home');
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Supabase state
  const [featuredRaffle, setFeaturedRaffle] = useState<Raffle | null>(null); // The main 'active' raffle for the site
  const [selectedRaffle, setSelectedRaffle] = useState<Raffle | null>(null); // The raffle currently being viewed in grid
  const [publicRaffles, setPublicRaffles] = useState<Raffle[]>([]);
  const [dbReservations, setDbReservations] = useState<Reservation[]>([]);

  // Estado centralizado com status reais
  const [reservations, setReservations] = useState<ReservationMap>({});

  // Estatísticas específicas da rifa principal (Home) para evitar vazamento
  const [featuredStats, setFeaturedStats] = useState({ paid: 0, pending: 0 });

  // Session ID para identificar este usuário
  const sessionId = useRef<string>(getOrCreateSessionId());

  // Timer de seleção
  const [selectionStartTime, setSelectionStartTime] = useState<number | null>(null);
  const [selectionTimeRemaining, setSelectionTimeRemaining] = useState<number | null>(null);

  // FAQ Chatbot state
  const [isFAQOpen, setIsFAQOpen] = useState(false);

  // Secret admin mode toggle (5 clicks on logo)
  const [clickCount, setClickCount] = useState(0);
  const [showAdminButton, setShowAdminButton] = useState(() => {
    return localStorage.getItem('adminMode') === 'true';
  });
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Ref para rastrear a ID da rifa pedida por último (evita race conditions)
  const lastRequestedRaffleId = useRef<string | null>(null);

  // Render Guard: Garante que a UI só mostre dados se a ID bater com a solicitada
  // Se houver qualquer inconsistência momentânea no estado, a UI mostrará a grade vazia
  const visibleReservations = React.useMemo(() => {
    if (!selectedRaffle || lastRequestedRaffleId.current !== selectedRaffle.id) {
      return {};
    }
    return reservations;
  }, [reservations, selectedRaffle?.id]);

  const PRICE_PER_NUMBER = (selectedRaffle || featuredRaffle)?.price_per_number || 13.00;

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
      if (featuredRaffle) {
        cleanupSessionSelections(featuredRaffle.id, sessionId.current);
      }
    };
  }, []);

  // Separate effect for real-time subscription to prevent multiple subscriptions
  useEffect(() => {
    // IMPORTANTE: Só assina realtime se o sorteio selecionado estiver ATIVO
    if (!selectedRaffle || selectedRaffle.status !== 'active') {
      console.log('📴 [Real-time] Sorteio selecionado não está ativo ou não existe. Ignorando inscrição.');
      return;
    }

    console.log('🔔 [Real-time] Setting up subscription for raffle:', selectedRaffle.id);

    // Ref para evitar múltiplas recargas simultâneas (debounce)
    let reloadTimeout: NodeJS.Timeout | null = null;

    const subscription = subscribeToReservations(selectedRaffle.id, (payload) => {
      console.log(`🔔 [Real-time] Mudança detectada no sorteio ${selectedRaffle.id}:`, {
        evento: payload.eventType,
        numero: (payload.new as any)?.number || (payload.old as any)?.number
      });

      // Debounce: Recarregar dados após 200ms de calma (evita sobrecarga se selecionar muitos rápido)
      if (reloadTimeout) clearTimeout(reloadTimeout);
      reloadTimeout = setTimeout(() => {
        // Garantir que ainda estamos interessados neste sorteio antes de carregar
        if (lastRequestedRaffleId.current === selectedRaffle.id) {
          loadDataForActiveRaffle(selectedRaffle.id);
        }
      }, 200);
    });

    // Check subscription status
    subscription.subscribe((status) => {
      console.log('🔔 [Real-time] Subscription status:', status);
      if (status === 'SUBSCRIBED') {
        console.log('🔔 [Real-time] Subscription confirmed, loading fresh data...');
        if (lastRequestedRaffleId.current === selectedRaffle.id) {
          loadDataForActiveRaffle(selectedRaffle.id);
        }
      }
    });

    return () => {
      console.log('🔔 [Real-time] Cleaning up subscription for raffle:', selectedRaffle.id);
      subscription.unsubscribe();
    };
  }, [selectedRaffle?.id]);

  // Cleanup periódico de reservas expiradas (Garante que números pendurados sejam liberados)
  useEffect(() => {
    if (view !== 'selecting' || !selectedRaffle || selectedRaffle.status !== 'active') return;

    console.log('🧹 [Cleanup] Agendando limpeza periódica a cada 60s');
    const interval = setInterval(async () => {
      try {
        const { cleanupExpiredReservations } = await import('./lib/cleanup');
        const count = await cleanupExpiredReservations();
        if (count > 0) {
          console.log(`🧹 [Cleanup] Limpeza periódica liberou ${count} número(s)`);
          if (selectedRaffle) loadDataForActiveRaffle(selectedRaffle.id);
        }
      } catch (err) {
        console.warn('⚠️ [Cleanup] Erro na limpeza periódica:', err);
      }
    }, 60000); // 1 minuto

    return () => clearInterval(interval);
  }, [view, selectedRaffle?.id]);

  // FALLBACK: Polling para garantir sincronização se realtime DELETE falhar
  useEffect(() => {
    if (!selectedRaffle || selectedRaffle.status !== 'active' || view !== 'selecting') return;

    console.log('🔄 [Polling] Iniciando polling de sincronização a cada 5s');

    const pollingInterval = setInterval(() => {
      if (lastRequestedRaffleId.current === selectedRaffle.id) {
        console.log('🔄 [Polling] Verificando novos status...');
        loadDataForActiveRaffle(selectedRaffle.id);
      }
    }, 5000);

    return () => {
      console.log('🔄 [Polling] Parando polling');
      clearInterval(pollingInterval);
    };
  }, [selectedRaffle?.id, view]);

  // O cleanup de estado agora é feito síncronamente nas funções de transição (handleParticipate/handleSelectRaffle)
  // para evitar race conditions com o render do React.

  // Timer de seleção: Iniciar quando primeiro número for selecionado
  useEffect(() => {
    if (selectedNumbers.length > 0 && !selectionStartTime) {
      console.log('⏱️ [Timer] Iniciando timer de seleção');
      setSelectionStartTime(Date.now());
    } else if (selectedNumbers.length === 0) {
      console.log('⏱️ [Timer] Resetando timer (sem seleções)');
      setSelectionStartTime(null);
      setSelectionTimeRemaining(null);
    }
  }, [selectedNumbers.length, selectionStartTime]);

  // Countdown: Atualizar tempo restante a cada segundo
  useEffect(() => {
    if (!selectionStartTime || !selectedRaffle) return;

    // If raffle is not active, do not run countdown for selections
    if (selectedRaffle.status !== 'active') {
      return;
    }

    const timeoutMinutes = selectedRaffle.selection_timeout || 5;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const interval = setInterval(() => {
      // Se o checkout estiver aberto, não expiramos a reserva para evitar erros de UI e liberação indevida
      if (isCheckoutOpen) return;

      const elapsed = Date.now() - selectionStartTime;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        console.log('⏱️ [Timer] Tempo esgotado! Limpando seleções...');
        // Limpar seleções automaticamente
        handleClearAll();
        clearInterval(interval);
      } else {
        setSelectionTimeRemaining(Math.ceil(remaining / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectionStartTime, selectedRaffle, isCheckoutOpen]);

  // Cleanup ao sair do app (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedRaffle && selectedRaffle.status === 'active' && sessionId.current && selectedNumbers.length > 0) {
        console.log('🧹 [Cleanup] Usuário fechando app...');
        cleanupSessionSelections(selectedRaffle.id, sessionId.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedRaffle, selectedNumbers.length]);

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      if (selectedRaffle && sessionId.current && selectedNumbers.length > 0) {
        console.log('🧹 [Cleanup] Componente desmontando...');
        cleanupSessionSelections(selectedRaffle.id, sessionId.current);
      }
    };
  }, [selectedRaffle?.id]);


  const loadRaffleData = async () => {
    try {
      console.log('📊 [Data] Loading raffle data...');

      // 1. Limpar reservas expiradas ANTES de carregar dados
      try {
        const { cleanupExpiredReservations } = await import('./lib/cleanup');
        await cleanupExpiredReservations();
      } catch (cleanupError) {
        console.warn('⚠️ [Data] Erro ao limpar reservas expiradas:', cleanupError);
        // Continuar mesmo se limpeza falhar
      }

      // 2. Carregar APENAS sorteios públicos (ativos)
      const { getPublicRaffles } = await import('./lib/supabase-admin');
      const raffles = await getPublicRaffles();
      setPublicRaffles(raffles);

      // Se não tiver nenhum raffle ativo setado, pega o primeiro (mais recente)
      // Mas se já tivermos um activeRaffle, mantemos ele (a menos que ele não exista mais na lista?)
      // Na verdade, se recarregarmos, pode ser bom atualizar o activeRaffle com os dados mais novos da lista
      // Mas cuidado para não mudar o raffle que o usuário está vendo se o usuário selecionou um específico.

      if (raffles.length > 0) {
        // Encontrar a rifa principal (featured)
        const activeOne = raffles[0] || null; // Since list is only active, first is latest active
        setFeaturedRaffle(activeOne);

        if (activeOne) {
          // Carregar estatísticas exclusivas da rifa principal (Home)
          const activeOneReservations = await getReservationsByRaffle(activeOne.id);
          const paid = activeOneReservations.filter(r => r.status === 'paid').length;
          const pending = activeOneReservations.filter(r => r.status === 'pending').length;
          setFeaturedStats({ paid, pending });

          // Se o usuário ainda não escolheu uma para ver, a selecionada inicial é a featured
          if (!selectedRaffle) {
            setSelectedRaffle(activeOne);
            lastRequestedRaffleId.current = activeOne.id;
            loadDataForActiveRaffle(activeOne.id);
          }
        } else {
          // Se não houver rifa ativa (mesmo que haja finalizadas), limpar featuredStats
          setFeaturedStats({ paid: 0, pending: 0 });
          // Não limpamos selectedRaffle aqui para permitir navegação nas finalizadas se o usuário já estiver nelas
        }
        // Atualizar dados da que já estava selecionada se ela ainda existir na lista
        // Este bloco deve ser executado independentemente de haver um activeOne ou não,
        // para atualizar o selectedRaffle se o usuário já tinha um selecionado.
        if (selectedRaffle) { // Check if selectedRaffle exists before trying to update it
          const updatedSelected = raffles.find(r => r.id === selectedRaffle.id);
          if (updatedSelected) {
            setSelectedRaffle(updatedSelected);
            // Só recarrega os números se estiver na visualização de seleção E NÃO FOR HISTÓRICO
            if (view === 'selecting' && updatedSelected.status !== 'finished') {
              lastRequestedRaffleId.current = updatedSelected.id;
              loadDataForActiveRaffle(updatedSelected.id);
            }
          }
        }
      } else {
        // Nenhuma rifa encontrada - Limpar tudo
        setFeaturedRaffle(null);
        setSelectedRaffle(null);
        setReservations({});
        setDbReservations([]);
        setFeaturedStats({ paid: 0, pending: 0 });
        console.log('🧹 [Cleanup] Nenhuma rifa encontrada. Estado limpo.');
      }

    } catch (error) {
      console.error('❌ [Data] Error loading raffle data:', error);
    }
  };

  const loadDataForActiveRaffle = async (raffleId: string) => {
    try {
      // GUARDRAIL 0: Verificar se esta ainda é a ID de interesse ANTES de gastar rede
      if (lastRequestedRaffleId.current !== raffleId) return;

      // Load reservations
      const reservationsData = await getReservationsByRaffle(raffleId);

      // GUARDRAIL 1: Verificar se esta ainda é a última ID que o usuário pediu
      if (lastRequestedRaffleId.current !== raffleId) {
        console.warn('⚠️ [Data] Descartando resposta de sorteio antigo:', raffleId);
        return;
      }

      console.log('📊 [Data] Aplicando dados para rifa:', raffleId);

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

      // Aplicar estados de forma coordenada
      setDbReservations(reservationsData);
      setReservations(reservationsMap);

      // Verificação final preventiva
      setSelectedRaffle(current => {
        if (current?.id !== raffleId) {
          console.warn('⚠️ [Data] Limpando resquícios - rida mudou durante processamento:', raffleId);
          setReservations({});
          setDbReservations([]);
        }
        return current;
      });

    } catch (error) {
      console.error("Error loading reservations:", error)
    }
  }

  const handleSelectRaffle = async (raffle: Raffle) => {
    // Se já havia outro sorteio e tínhamos seleções, limpamos no banco primeiro
    if (selectedRaffle && selectedRaffle.id !== raffle.id && selectedNumbers.length > 0) {
      console.log('🧹 [Cleanup] Limpando seleções do sorteio anterior antes de trocar...');
      const { cleanupSessionSelections } = await import('./lib/selection-manager');
      await cleanupSessionSelections(selectedRaffle.id, sessionId.current);
      await cleanupSessionSelections(selectedRaffle.id, sessionId.current);
    }

    // Reset total dos estados ANTES de carregar o novo (LIMPEZA SÍNCRONA)
    setSelectedNumbers([]);
    setReservations({});
    setDbReservations([]);
    setSelectionStartTime(null);
    setSelectionTimeRemaining(null);

    setSelectedRaffle(raffle);
    lastRequestedRaffleId.current = raffle.id;

    // SE A RIFA ESTIVER ENCERRADA: Não carregamos dados no estado global
    // O componente HistoricalRaffleView cuidará disso internamente
    if (raffle.status === 'finished') {
      console.log('🔒 [Isolation] Rifa encerrada selecionada. Modo histórico ativado.');
      setView('selecting'); // A view 'selecting' agora vai renderizar o histórico se status=finished
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Se for ativa/agendada, carregamos normalmente
    loadDataForActiveRaffle(raffle.id);
    setView('selecting');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearAll = async () => {
    if (!selectedRaffle) return;

    console.log('🧹 [Clear] Limpando todas as seleções...');

    // 1. Limpar do banco primeiro
    const { cleanupSessionSelections } = await import('./lib/selection-manager');
    await cleanupSessionSelections(selectedRaffle.id, sessionId.current);

    // 2. Aguardar processamento do realtime
    await new Promise(resolve => setTimeout(resolve, 200));

    // 3. Limpar estados locais
    setSelectedNumbers([]);
    setReservations(prev => {
      const updated = { ...prev };
      // Remover todas as reservations desta sessão
      Object.keys(updated).forEach(num => {
        if (updated[num]?.name === sessionId.current) {
          delete updated[num];
        }
      });
      return updated;
    });

    // 4. Resetar timer
    setSelectionStartTime(null);
    setSelectionTimeRemaining(null);

    console.log('✅ [Clear] Todas as seleções foram limpas');
  };


  const toggleNumber = async (num: string) => {
    if (!selectedRaffle) return;

    const reservation = reservations[num];
    const isSelected = selectedNumbers.includes(num);

    // Se o número já estiver reservado/pago por alguém, não permite mexer
    if (reservation?.status === 'paid') return;

    // Se o número estiver pendente por OUTRO usuário, não permite mexer
    if (reservation?.status === 'pending' && reservation.name !== sessionId.current) return;

    if (isSelected) {
      // Desselecionar: PRIMEIRO remover do banco, DEPOIS limpar estado local

      // 1. Remover do banco primeiro
      const { removeTemporarySelection } = await import('./lib/selection-manager');
      const removed = await removeTemporarySelection(selectedRaffle.id, num, sessionId.current);

      if (removed) {
        // 2. Aguardar processamento do realtime
        await new Promise(resolve => setTimeout(resolve, 150));

        // 3. Agora sim limpar estado local
        setSelectedNumbers(prev => prev.filter(n => n !== num));
        setReservations(prev => {
          const updated = { ...prev };
          delete updated[num];
          return updated;
        });

        console.log(`✅ Número ${num} desselecionado completamente`);
      }
    } else {
      // Selecionar: criar seleção temporária no Supabase
      setSelectedNumbers(prev => [...prev, num]);

      // Importar função dinamicamente para evitar problemas de build
      const { createTemporarySelection } = await import('./lib/selection-manager');
      await createTemporarySelection(
        selectedRaffle.id,
        num,
        sessionId.current,
        selectedRaffle.selection_timeout || 30
      );
    }
  };

  const handleParticipate = () => {
    // LIMPEZA SÍNCRONA: Antes de entrar, limpamos tudo para garantir que não herda dados de outras rifas
    setSelectedNumbers([]);
    setReservations({});
    setDbReservations([]);
    setSelectionStartTime(null);
    setSelectionTimeRemaining(null);

    setSelectedRaffle(featuredRaffle);
    if (featuredRaffle) {
      lastRequestedRaffleId.current = featuredRaffle.id;
      loadDataForActiveRaffle(featuredRaffle.id);
    }
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

          {/* Atendente Virtual */}
          <button
            onClick={() => setIsFAQOpen(!isFAQOpen)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black shadow-md hover:scale-105 transition-all uppercase tracking-tight"
            title="Atendente Virtual"
          >
            <span className="text-sm">💬</span>
            <span className="hidden sm:inline">Atendente Virtual</span>
          </button>


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
          <Home
            onStart={handleParticipate}
            onSelectRaffle={handleSelectRaffle}
            featuredRaffle={featuredRaffle}
            raffles={publicRaffles}
            activeReservationsCount={featuredStats.paid + featuredStats.pending}
          />
        ) : view === 'videos' ? (
          <InstagramVideos onBack={() => setView('home')} />
        ) : selectedRaffle && selectedRaffle.status === 'finished' ? (
          <HistoricalRaffleView
            raffle={selectedRaffle}
            onBack={() => setView('home')}
          />
        ) : (
          <RaffleSelection
            selectedNumbers={selectedNumbers}
            onToggleNumber={toggleNumber}
            reservations={visibleReservations}
            totalNumbers={selectedRaffle?.total_numbers}
            selectionMode={selectedRaffle?.selection_mode}
            sessionId={sessionId.current}
            isReadOnly={
              (selectedRaffle?.status === 'finished') ||
              (selectedRaffle && selectedRaffle.total_numbers > 0 &&
                Object.values(visibleReservations).filter((r: any) => r.status === 'paid' || r.status === 'pending').length >= selectedRaffle.total_numbers)
            }
            raffleCode={selectedRaffle?.code}
          />
        )}
        <footer className="py-8 px-4 text-center border-t border-slate-100 flex flex-col items-center gap-2">
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            Top Sorte 027 © 2026 - Todos os direitos reservados
          </p>
          <p className="text-slate-300 text-[8px] font-mono">
            BUILD_VER: 2026-02-20_15:15
          </p>
        </footer>
      </main>

      {
        selectedNumbers.length > 0 && view === 'selecting' && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-full">
            <div className="max-w-md mx-auto flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">{selectedNumbers.length} Números selecionados</span>
                  {selectionTimeRemaining && (
                    <span className={`text-xs font-bold ${selectionTimeRemaining < 60 ? 'text-red-600 animate-pulse' : 'text-orange-600'
                      }`}>
                      ⏱️ {Math.floor(selectionTimeRemaining / 60)}:{String(selectionTimeRemaining % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <span className="text-xl font-black text-[#003B73]">
                  Total: R$ {(selectedNumbers.length * PRICE_PER_NUMBER).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold px-4 py-3 rounded-xl transition-colors active:scale-95 text-xs uppercase"
                >
                  Limpar
                </button>
                <button
                  onClick={() => setIsCheckoutOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-black px-6 py-3 rounded-xl shadow-lg transition-transform active:scale-95 animate-button-pulse"
                >
                  RESERVAR AGORA
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        isCheckoutOpen && (
          <CheckoutModal
            selectedNumbers={selectedNumbers}
            totalPrice={selectedNumbers.length * PRICE_PER_NUMBER}
            raffleId={selectedRaffle?.id}
            raffle={selectedRaffle || undefined}
            reservations={visibleReservations}
            onClose={async () => {
              if (selectedNumbers.length > 0 && selectedRaffle) {
                // 1. Limpar do banco
                const { cleanupSessionSelections } = await import('./lib/selection-manager');
                await cleanupSessionSelections(selectedRaffle.id, sessionId.current);

                // 2. Aguardar processamento
                await new Promise(resolve => setTimeout(resolve, 150));

                // 3. Limpar estados locais
                setSelectedNumbers([]);
                setReservations(prev => {
                  const updated = { ...prev };
                  Object.keys(updated).forEach(num => {
                    if (updated[num]?.name === sessionId.current) {
                      delete updated[num];
                    }
                  });
                  return updated;
                });
              }
              setIsCheckoutOpen(false);
              setView('selecting');
            }}
            onConfirmPurchase={confirmPurchase}
            onSetPending={setPending}
          />
        )
      }


      <FAQChatbot
        raffle={selectedRaffle || undefined}
        reservations={visibleReservations}
        isOpen={isFAQOpen}
        onToggle={setIsFAQOpen}
      />
    </div >
  );
};

export const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

export default App;
