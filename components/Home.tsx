import React, { useState, useEffect, useRef } from 'react';
import { WhatsAppIcon } from '../lib/icons';
import { getWinnerPhotos } from '../lib/supabase-admin';
import { getYouTubeEmbedUrl } from '../lib/video-utils';
import { supabase } from '../lib/supabase';
import type { Raffle, WinnerPhoto } from '../types/database';

// ─── Toast "Nuvenzinha" de compras recentes ───────────────────────────────────
interface ToastEntry {
  name: string;
  number: string;
  raffleType: 'paid' | 'brinde' | string;
}

const PurchaseToast: React.FC<{ raffles: Raffle[] }> = ({ raffles }) => {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const [current, setCurrent] = useState<ToastEntry | null>(null);
  const [visible, setVisible] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca reservas recentes (últimas 48h) de todas as rifas ativas
  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('reservations')
        .select('buyer_name, number, raffle_id, created_at')
        .in('status', ['paid'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!data || data.length === 0) return;

      // Monta mapa raffleId → raffle_type
      const typeMap: Record<string, string> = {};
      raffles.forEach(r => { typeMap[r.id] = r.raffle_type || 'paid'; });

      const list: ToastEntry[] = data
        .filter((r: any) => r.buyer_name)
        .map((r: any) => ({
          name: r.buyer_name,
          number: r.number,
          raffleType: typeMap[r.raffle_id] || 'paid',
        }));

      // Embaralha para variar a exibição
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }

      setEntries(list);
    };
    if (raffles.length > 0) load();
  }, [raffles]);

  // Cicla os toasts
  useEffect(() => {
    if (entries.length === 0) return;

    const show = () => {
      const entry = entries[indexRef.current % entries.length];
      indexRef.current++;
      setCurrent(entry);
      setVisible(true);

      // Depois de 3.5s, esconde
      timerRef.current = setTimeout(() => {
        setVisible(false);
        // Próximo depois de mais 2s
        timerRef.current = setTimeout(show, 2000);
      }, 3500);
    };

    // Primeira exibição após 4s do carregamento
    timerRef.current = setTimeout(show, 4000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [entries]);

  if (!current) return null;

  const isBrinde = current.raffleType === 'brinde';
  const msg = isBrinde
    ? `${current.name} acabou de escolher o nº ${current.number}! 🎁`
    : `${current.name} acabou de comprar a cota #${current.number}! 🎉`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cloudRise {
          0%   { transform: translateY(0px) scale(0.92); opacity: 0; }
          15%  { opacity: 1; transform: translateY(-12px) scale(1); }
          75%  { opacity: 1; transform: translateY(-28px) scale(1); }
          100% { transform: translateY(-55px) scale(0.95); opacity: 0; }
        }
        @keyframes cloudHide {
          0%   { transform: translateY(-28px) scale(1); opacity: 1; }
          100% { transform: translateY(-55px) scale(0.95); opacity: 0; }
        }
        .toast-cloud-enter {
          animation: cloudRise 3.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .toast-cloud-exit {
          animation: cloudHide 0.6s ease-in forwards;
        }
      `}} />
      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none ${
          visible ? 'toast-cloud-enter' : 'toast-cloud-exit'
        }`}
        style={{ maxWidth: '92vw' }}
      >
        {/* Corpo da nuvem */}
        <div className="relative flex items-center gap-3 px-5 py-3 rounded-[2.5rem] shadow-2xl border border-white/30"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(240,248,255,0.97) 100%)',
            boxShadow: '0 8px 32px rgba(0,75,141,0.25), 0 2px 8px rgba(0,0,0,0.1)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Bolinhas de nuvem decorativas */}
          <div className="absolute -top-2.5 left-10 w-7 h-7 rounded-full bg-white border border-white/60 shadow-sm" />
          <div className="absolute -top-4 left-20 w-9 h-9 rounded-full bg-white border border-white/60 shadow-sm" />
          <div className="absolute -top-2 right-12 w-6 h-6 rounded-full bg-white border border-white/60 shadow-sm" />

          {/* Ícone */}
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner text-lg ${
            isBrinde ? 'bg-emerald-100' : 'bg-[#004B8D]/10'
          }`}>
            {isBrinde ? '🎁' : '🎟️'}
          </div>

          {/* Texto */}
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#004B8D]/60 mb-0.5">
              {isBrinde ? 'Brinde escolhido' : 'Nova compra'}
            </span>
            <span className="text-sm font-black text-slate-800 whitespace-nowrap" style={{ maxWidth: '60vw', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {msg}
            </span>
          </div>

          {/* Pulse dot */}
          <span className="flex h-2.5 w-2.5 flex-shrink-0 ml-1 relative">
            <span className={`animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full opacity-75 ${isBrinde ? 'bg-emerald-400' : 'bg-[#00E676]'}`}></span>
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isBrinde ? 'bg-emerald-500' : 'bg-[#00E676]'}`}></span>
          </span>
        </div>
      </div>
    </>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const LoadingPhrases: React.FC = () => {
  const phrases = [
    { text: "Sincronizando prêmios...", style: "text-[#00E676] drop-shadow-[0_0_15px_rgba(0,230,118,0.8)]", anim: "animate-bounce" },
    { text: "Prepara sua sorte!", style: "text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]", anim: "animate-pulse" },
    { text: "O próximo ganhador é você?", style: "bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent font-black", anim: "animate-in slide-in-from-bottom duration-500" },
    { text: "Carregando sonhos...", style: "text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.6)]", anim: "animate-in zoom-in duration-300" },
    { text: "Ajustando detalhes...", style: "text-cyan-400 italic", anim: "animate-pulse" },
    { text: "PIX DA SORTE EM BREVE", style: "text-green-400 tracking-[0.2em] font-black", anim: "animate-in fade-in duration-700" }
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % phrases.length), 2500);
    return () => clearInterval(timer);
  }, [phrases.length]);

  const current = phrases[index];

  return (
    <p key={index} className={`text-2xl sm:text-3xl font-black uppercase tracking-tighter sm:tracking-normal ${current.style} ${current.anim}`}>
      {current.text}
    </p>
  );
};

interface HomeProps {
  onStart: () => void;
  onSelectRaffle?: (raffle: Raffle) => void;
  featuredRaffle: Raffle | null;
  raffles?: Raffle[];
  activeReservationsCount: number;
  maintenanceState?: { isMaintenance: boolean; message: string };
}

const Home: React.FC<HomeProps> = ({ onStart, onSelectRaffle, featuredRaffle, raffles = [], activeReservationsCount, maintenanceState }) => {
  // Theme logic
  const isBicho = featuredRaffle?.selection_mode === 'jogo_bicho';
  const themeAccentColor = isBicho ? 'bg-green-600' : 'bg-[#00E676]';
  const themeHoverAccentColor = isBicho ? 'hover:bg-green-700' : 'hover:bg-[#00C853]';
  const themeBadgeColor = isBicho ? 'bg-green-100 text-green-700' : 'bg-[#004B8D]/10 text-[#004B8D] border border-[#004B8D]/20';
  const raffleTypeLabel = isBicho ? 'Sorteio pelo Jogo do Bicho' : 'Sorteio pela Loteria Federal';

  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic data from Supabase
  const [winnersPhotos, setWinnersPhotos] = useState<WinnerPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter other raffles (exclude current active one)
  const otherRaffles = raffles.filter(r => r.id !== featuredRaffle?.id);

  // Carregar script do Instagram (apenas uma vez)
  useEffect(() => {
    if (!document.getElementById('instagram-embed-script')) {
      const script = document.createElement('script');
      script.id = 'instagram-embed-script';
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        if (window.instgrm) {
          window.instgrm.Embeds.process();
        }
      };
    } else {
      // Se já existir, processar
      if (window.instgrm) {
        window.instgrm.Embeds.process();
      }
    }
  }, []);

  // Re-processar embeds quando os dados mudarem ou o slide mudar
  useEffect(() => {
    const handleProcess = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
      }
    };

    handleProcess();
    const timer = setTimeout(handleProcess, 500);

    const interval = setInterval(() => {
      if (window.instgrm) {
        const unprocessed = document.querySelectorAll('blockquote.instagram-media:not([data-instgrm-processed])');
        if (unprocessed.length > 0) {
          window.instgrm.Embeds.process();
        }
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [winnersPhotos, currentSlide]);

  // Load data from Supabase (photos only, raffle comes from props)
  useEffect(() => {
    const loadData = async () => {
      try {
        const photosData = await getWinnerPhotos();
        if (photosData && photosData.length > 0) {
          setWinnersPhotos(photosData);
        }
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    if (winnersPhotos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % winnersPhotos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [winnersPhotos.length]);

  return (
    <div className="flex flex-col gap-8 p-4 max-w-2xl mx-auto">
      {/* Featured Raffle Card or Maintenance State */}
      {maintenanceState?.isMaintenance ? (
        <section className="bg-red-50 rounded-[2.5rem] shadow-xl border-2 border-red-200 mt-4 p-8 md:p-12 text-center animate-in fade-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-red-100 opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-red-100 opacity-50 pointer-events-none"></div>

          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-200 z-10 relative">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-red-700 mb-4 tracking-tight uppercase relative z-10">
            Atenção: Sistema Instável
          </h2>
          <div className="bg-white/60 p-4 rounded-2xl mb-6 relative z-10 backdrop-blur-sm border border-red-100">
            <p className="text-base text-red-900 font-bold max-w-lg mx-auto leading-relaxed whitespace-pre-line">
              {maintenanceState.message}
            </p>
          </div>
          <p className="text-sm text-red-600 font-medium mb-8 relative z-10">
            Não se preocupe, seus dados e compras recentes estão seguros. Tente recarregar a tela em alguns instantes.
          </p>
          <div className="relative z-10">
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 hover:bg-red-700 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-red-600/20 transition-transform active:scale-95 text-lg w-full sm:w-auto flex items-center justify-center gap-2 mx-auto"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Atualizar Página
            </button>
          </div>
        </section>
      ) : featuredRaffle ? (
        <section className="relative overflow-hidden bg-gradient-to-b from-[#004B8D] to-[#001D4A] rounded-[2rem] shadow-[0_15px_40px_-10px_rgba(0,75,141,0.6)] border border-[#00E676]/30 mt-4 flex flex-col">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-4 right-10 w-20 h-20 bg-white/5 rounded-full blur-2xl animate-pulse"></div>
            <div className="absolute bottom-10 left-4 w-32 h-32 bg-[#00E676]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
            <div className="absolute top-1/4 left-1/3 w-1 h-1 bg-white/40 rounded-full animate-pulse"></div>
            <div className="absolute top-1/2 right-1/3 w-1.5 h-1.5 bg-white/30 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>
          </div>
          {/* Status Badge Above Image */}
          <div className={`w-full font-black px-4 py-3 text-center text-xs sm:text-sm relative overflow-hidden ${featuredRaffle.status === 'active' ? (isBicho ? 'bg-green-600 text-white' : 'bg-[#00E676] text-[#001D4A] border-b border-[#00E676]') :
            featuredRaffle.status === 'scheduled' ? 'bg-yellow-500 text-slate-900' :
              'bg-red-600 text-white'
            }`}>
            {featuredRaffle.status === 'finished' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-gradient-text bg-[length:200%_auto]"></div>
            )}
            <span className="relative z-10 tracking-widest">
              {featuredRaffle.status === 'active' ? '🟢 NOVA RIFA' : '🔴 RIFA FINALIZADA / PAUSADA'}
            </span>
          </div>

          <div className="bg-[#001D4A] overflow-hidden w-full relative group">
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#001D4A] to-transparent z-10"></div>
            <img
              src={featuredRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
              alt="Prêmio do Sorteio"
              className="w-full h-auto block transition-transform duration-500 ease-out group-hover:scale-110 relative z-0 cursor-pointer"
            />
          </div>

          <div className="p-6 relative z-20 mt-0">
            {/* Sorteio Info Label */}
            <div className={`mx-auto mb-6 w-fit py-2.5 px-8 rounded-full text-center font-black text-[12px] sm:text-sm uppercase tracking-[0.25em] shadow-lg ${isBicho ? 'bg-green-500 text-white' : 'bg-[#003B73] border border-[#00E676]/50 text-[#00E676]'}`}>
              {raffleTypeLabel}
            </div>

            {featuredRaffle.status === 'finished' && (
              <div className="mb-6 text-center">
                <div className="inline-block relative">
                  <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic py-2 px-6 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-[length:200%_auto] animate-gradient-text text-transparent bg-clip-text drop-shadow-sm select-none">
                    Rifa Finalizada
                  </h2>
                  <div className="absolute -inset-1 bg-red-500 opacity-20 blur-xl animate-pulse rounded-full -z-10"></div>
                </div>
              </div>
            )}

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4 text-center uppercase tracking-tight drop-shadow-md px-2">
              {featuredRaffle.title || 'MOTO 0KM OU R$ 15.000 NO PIX'}
            </h2>

            {featuredRaffle.description && (
              <p className="text-white text-sm sm:text-base md:text-lg font-bold mb-8 text-center leading-relaxed max-w-sm mx-auto italic drop-shadow-md bg-black/10 p-4 rounded-2xl border border-white/5">
                "{featuredRaffle.description}"
              </p>
            )}

            {featuredRaffle.code && (
              <div className="text-center mb-6">
                <span className="bg-white/5 border border-white/10 text-white/50 text-[10px] font-black px-4 py-1.5 rounded-full tracking-widest">
                  EDIÇÃO #{featuredRaffle.code}
                </span>
              </div>
            )}

            {featuredRaffle.raffle_type === 'brinde' ? (
              <div className="w-full max-w-md mx-auto flex flex-wrap items-center justify-center gap-2 mb-6 text-white font-bold text-sm bg-emerald-950/70 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-emerald-400/40 shadow-inner text-center">
                <span className="text-xl flex-shrink-0">🎁</span>
                <span className="text-emerald-400 text-lg sm:text-xl font-black uppercase tracking-wide">100% Grátis</span>
                <span className="text-xs text-emerald-100/90 font-bold px-2.5 py-0.5 rounded-full bg-emerald-900/70 border border-emerald-500/30">
                  Máx. {featuredRaffle.max_numbers_per_participant || 2} { (featuredRaffle.max_numbers_per_participant || 2) === 1 ? 'número' : 'números' }
                </span>
              </div>
            ) : (
              <div className="w-full max-w-md mx-auto flex flex-wrap items-center justify-center gap-2 mb-6 text-white/90 font-bold text-sm bg-black/40 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10 shadow-inner text-center">
                <span className="flex h-3 w-3 rounded-full bg-[#00E676] animate-pulse shadow-[0_0_10px_#00E676] flex-shrink-0"></span>
                <span>Apenas <span className="text-[#00E676] text-xl font-black mx-1">R$ {featuredRaffle.price_per_number?.toFixed(2).replace('.', ',') || '13,00'}</span> / cota</span>
                <span className="text-xs text-white/70 font-semibold px-2 py-0.5 rounded-full bg-white/10 border border-white/10">
                  Máx. {featuredRaffle.max_numbers_per_participant || 2} { (featuredRaffle.max_numbers_per_participant || 2) === 1 ? 'número' : 'números' }
                </span>
              </div>
            )}

            {/* Botão de CTA Ultra Moderno com Efeito Neon Ping */}
            <div className="w-full relative mt-2">
              {featuredRaffle.status === 'active' && (
                <div className="absolute inset-0 bg-[#00E676] rounded-[1.25rem] animate-ping opacity-30"></div>
              )}
              <button
                onClick={onStart}
                className={`w-full relative ${featuredRaffle.status === 'active' ? 'bg-gradient-to-r from-[#00E676] to-[#00C853] text-[#001D4A] shadow-[0_0_20px_rgba(0,230,118,0.4)]' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-600'
                  } font-black py-5 px-4 rounded-2xl flex items-center justify-center transition-all active:scale-95 text-base sm:text-lg uppercase tracking-wider overflow-hidden group border-b-4 ${featuredRaffle.status === 'active' ? 'border-[#008c3a] hover:border-[#00E676] hover:translate-y-1' : 'border-slate-900'}`}
              >
                {featuredRaffle.status === 'active' && (
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                )}
                <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm w-full text-center">
                  {featuredRaffle.status === 'active' ? (
                    featuredRaffle.raffle_type === 'brinde' ? (
                      <span className="flex items-center justify-center gap-2 text-center">
                        <span className="text-xl sm:text-2xl leading-none">🎁</span>
                        <span className="tracking-widest font-black leading-none">PARTICIPAR DO BRINDE GRÁTIS</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2 text-center">
                        <span className="text-xl sm:text-2xl leading-none">🎟️</span>
                        <span className="tracking-widest font-black leading-none">GARANTIR NÚMEROS</span>
                      </span>
                    )
                  ) : (
                      <div className="flex items-center gap-3">
                         <style dangerouslySetInnerHTML={{ __html: `
                          @keyframes real-blink {
                            0%, 90%, 100% { transform: scaleY(1); }
                            95% { transform: scaleY(0.1); }
                          }
                          .eye-blink {
                            animation: real-blink 3.5s infinite;
                            transform-origin: center;
                          }
                        `}} />
                        <svg width="40" height="24" viewBox="0 0 40 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
                          {/* Olho Esquerdo */}
                          <g className="eye-blink">
                            <ellipse cx="12" cy="12" rx="8" ry="10" fill="white" />
                            <circle cx="12" cy="12" r="4" fill="#001D4A" />
                          </g>
                          {/* Olho Direito */}
                          <g className="eye-blink">
                            <ellipse cx="28" cy="12" rx="8" ry="10" fill="white" />
                            <circle cx="28" cy="12" r="4" fill="#001D4A" />
                          </g>
                        </svg>
                        <span className="mt-1 tracking-[0.2em] text-[#00E676] font-black">VISUALIZAR RIFA</span>
                      </div>
                  )}
                </span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-b from-[#004B8D] to-[#010B1A] rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/5 mt-4 p-8 text-center min-h-[240px] flex flex-col items-center justify-center">
          {/* LUZES DE FUNDO DINÂMICAS */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[#00E676]/5 blur-[80px] rounded-full animate-pulse"></div>
          
          <div className="relative z-10 w-full">
            <h2 className="text-lg sm:text-2xl font-black mb-4 uppercase tracking-[0.2em] italic bg-gradient-to-r from-[#00E676] via-white to-[#00E676] bg-[length:200%_auto] animate-gradient-text text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(0,230,118,0.5)] whitespace-nowrap">
              NOVIDADES CHEGANDO...
            </h2>

            {/* MOTOR DE FRASES COM EFEITOS VARIADOS */}
            <div className="h-24 flex items-center justify-center overflow-hidden">
            <div className="h-24 flex items-center justify-center overflow-hidden">
               <LoadingPhrases />
            </div>
            </div>

            {/* Barra de Progresso Estilizada */}
            <div className="w-full max-w-xs mx-auto h-1.5 bg-black/40 rounded-full mt-6 overflow-hidden border border-white/5 shadow-inner">
               <div className="h-full bg-gradient-to-r from-[#00E676] via-white to-[#00E676] w-full animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
            </div>
            
            <p className="text-[#00E676] font-black uppercase tracking-[0.2em] text-[11px] mt-6 animate-pulse">
              Fique ligado! 🚀
            </p>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            .animate-shimmer {
              animation: shimmer 2s infinite linear;
            }
          `}} />
        </section>
      )}

      {/* Outros Sorteios Disponíveis - Shown only if there are other active raffles */}
      {otherRaffles.length > 0 && (
        <section className="mt-8">
          <div className="flex flex-col items-center justify-center mb-6 px-2">
            <div className="inline-block relative">
              <h3 className="text-2xl font-black tracking-tighter uppercase italic py-2 px-6 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 bg-[length:200%_auto] animate-gradient-text text-transparent bg-clip-text drop-shadow-sm select-none flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                RIFAS FINALIZADAS
              </h3>
              <div className="absolute -inset-1 bg-purple-500 opacity-10 blur-xl animate-pulse rounded-full -z-10"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {otherRaffles.map((otherRaffle) => (
              <div key={otherRaffle.id} className="bg-gradient-to-br from-[#002654] to-[#001536] rounded-[2rem] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.4)] border border-white/10 flex flex-col group hover:border-[#00E676]/30 transition-colors">
                <div className="relative overflow-hidden bg-[#001D4A] w-full">
                  {/* Sombreamento minúsculo só pra esconder o corte da borda inferior da imagem */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#001536] to-transparent z-10"></div>
                  <img
                    src={otherRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
                    alt={otherRaffle.title}
                    className="w-full h-auto block transition-transform duration-500 ease-out group-hover:scale-110 cursor-pointer"
                  />
                  <div className={`absolute top-3 left-3 text-white font-bold px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest z-20 shadow-md ${otherRaffle.status === 'active' ? (otherRaffle.raffle_type === 'brinde' ? 'bg-emerald-500 text-white' : 'bg-[#00E676] text-[#001D4A]') :
                    otherRaffle.status === 'scheduled' ? 'bg-yellow-500 text-slate-900' :
                      otherRaffle.status === 'paused' ? 'bg-red-500' : 'bg-slate-500'
                    }`}>
                    {otherRaffle.raffle_type === 'brinde' && otherRaffle.status === 'active' ? '🎁 BRINDE GRÁTIS' : (
                      otherRaffle.status === 'active' ? 'ATIVO' :
                        otherRaffle.status === 'scheduled' ? 'AGENDADO' :
                          otherRaffle.status === 'paused' ? 'PAUSADO' : 'FINALIZADO'
                    )}
                  </div>
                  {otherRaffle.code && (
                    <div className={`absolute bottom-6 right-3 ${otherRaffle.selection_mode === 'jogo_bicho' ? 'bg-green-600' : 'bg-[#004B8D] border border-[#00E676]/30'} text-white font-black px-3 py-1 rounded-full text-[10px] tracking-widest z-20`}>
                      #{otherRaffle.code}
                    </div>
                  )}
                </div>

                <div className="p-6 relative z-20 -mt-6">
                  <h4 className="text-lg sm:text-xl font-black text-white mb-2 text-center uppercase tracking-tight drop-shadow-md">
                    {otherRaffle.title}
                  </h4>
                  <div className="flex items-center justify-center gap-2 mb-6 text-white/70 font-semibold text-sm bg-black/20 py-2 rounded-full border border-white/5 mx-auto w-fit px-4">
                    {otherRaffle.raffle_type === 'brinde' ? (
                      <span className="text-emerald-400 font-black uppercase text-xs">🎁 Grátis (máx. {otherRaffle.max_numbers_per_participant || 2} { (otherRaffle.max_numbers_per_participant || 2) === 1 ? 'cota' : 'cotas' })</span>
                    ) : (
                      <>R$ <span className="text-[#00E676] font-black">{otherRaffle.price_per_number.toFixed(2).replace('.', ',')}</span> / cota <span className="text-[11px] text-white/50">• máx. {otherRaffle.max_numbers_per_participant || 2}</span></>
                    )}
                  </div>
                  <button
                    onClick={() => onSelectRaffle?.(otherRaffle)}
                    className="w-full bg-[#004B8D] hover:bg-[#003B73] text-white font-black py-4 rounded-[1.25rem] shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 text-sm uppercase tracking-wider border border-white/10"
                  >
                    👀 Visualizar rifa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Seção Como Funciona Premium */}
      <section className="mt-10 mb-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 uppercase tracking-tight flex items-center justify-center gap-3">
            <div className="h-1 w-8 bg-[#00E676] rounded-full"></div>
            Como Participar
            <div className="h-1 w-8 bg-[#00E676] rounded-full"></div>
          </h3>
          <p className="text-slate-500 mt-2 font-medium text-sm">Passo a passo simples e rápido</p>
        </div>

        <div className="flex flex-col gap-3">
          {/* Step 1 */}
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:border-[#004B8D]/30 transition-colors">
            <div className="absolute top-0 bottom-0 left-0 w-2 bg-gradient-to-b from-[#004B8D] to-[#00E676]"></div>
            <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-100 group-hover:scale-110 transition-transform">
              🔢
            </div>
            <div>
              <div className="text-[10px] font-black text-[#00E676] uppercase tracking-widest mb-1">PASSO 01</div>
              <h4 className="font-black text-slate-800 text-lg leading-none mb-1 shadow-sm">Escolha seus Números</h4>
              <p className="text-xs text-slate-500 font-medium">Navegue pelas cotas disponíveis e clique nas suas dezenas da sorte.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:border-[#004B8D]/30 transition-colors">
            <div className="absolute top-0 bottom-0 left-0 w-2 bg-gradient-to-b from-[#004B8D] to-[#00E676]"></div>
            <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-100 group-hover:scale-110 transition-transform">
              📲
            </div>
            <div>
              <div className="text-[10px] font-black text-[#00E676] uppercase tracking-widest mb-1">PASSO 02</div>
              <h4 className="font-black text-slate-800 text-lg leading-none mb-1 shadow-sm">Pagamento PIX Instantâneo</h4>
              <p className="text-xs text-slate-500 font-medium">Faça o pagamento rápido pelo app do seu banco. Aprovamos sua cota na mesma hora.</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:border-[#004B8D]/30 transition-colors mt-1">
            <div className="absolute top-0 bottom-0 left-0 w-2 bg-gradient-to-b from-[#004B8D] to-[#00E676]"></div>
            <div className="flex-shrink-0 w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-slate-100 group-hover:scale-110 transition-transform">
              🏆
            </div>
            <div>
               <div className="text-[10px] font-black text-[#00E676] uppercase tracking-widest mb-1">PASSO 03</div>
               <h4 className="font-black text-slate-800 text-lg leading-none mb-1 shadow-sm">Aguarde o Sorteio</h4>
               <p className="text-xs text-slate-500 font-medium">Pronto, é só cruzar os dedos! O resultado sai direto pela Loteria Federal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Section - Slideshow de Ganhadores Ultra Premium */}
      {winnersPhotos.length > 0 && (
        <section className="mt-4">
          <div className="flex items-center justify-between mb-6 px-2">
            <div className="flex flex-col">
              <h3 className="text-xl md:text-2xl font-black text-[#004B8D] uppercase tracking-tighter leading-none">Ganhadores Reais</h3>
              <div className="h-1 w-12 bg-[#00E676] mt-1 rounded-full"></div>
            </div>
            <span className="bg-[#00E676]/10 text-[#00C853] font-black px-4 py-1.5 rounded-full text-[10px] tracking-widest border border-[#00E676]/20 shadow-sm">
              PROVA REAL ✓
            </span>
          </div>

          {/* Slideshow Container Con efeito de profundidade */}
          <div className="relative overflow-hidden rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] bg-[#020617] h-[400px] sm:h-[500px] md:h-[600px] group border border-white/5">
            
            {/* Barra de Progresso Superior */}
            <div className="absolute top-0 left-0 right-0 h-1.5 z-40 bg-black/20 overflow-hidden">
               <div key={currentSlide} className="h-full bg-gradient-to-r from-[#00E676] to-[#00C853] animate-progress-bar shadow-[0_0_10px_#00E676]"></div>
            </div>

            {/* Imagens/Slides */}
            <div className="relative w-full h-full">
              {winnersPhotos.map((photo, index) => (
                <div
                  key={photo.id || index}
                  className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'
                    }`}
                >
                  {/* Fundo com efeito Ken Burns */}
                  <div className="absolute inset-0 w-full h-full overflow-hidden">
                    <div className={`w-full h-full ${index === currentSlide ? 'animate-ken-burns' : ''}`}>
                       <img
                        src={photo.photo_url}
                        alt={photo.name}
                        className="w-full h-full object-cover brightness-[0.8] contrast-[1.1]"
                      />
                    </div>
                  </div>
                  
                  {/* Vinheta Premium */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40 z-20"></div>

                  {/* Info Box Flutuante (Glassmorphism) */}
                  <div className="absolute bottom-8 left-6 right-6 z-30 pointer-events-none">
                    <div 
                      className={`glass-card glass-border p-6 rounded-3xl transform transition-all duration-700 delay-300 ${index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
                    >
                      <div className="flex items-end justify-between gap-4">
                        <div>
                           <p className="text-[#00E676] text-[10px] font-black uppercase tracking-[0.3em] mb-1 drop-shadow-sm">Premiação Confirmada</p>
                           <h4 className="text-3xl md:text-5xl font-black text-white leading-none tracking-tighter drop-shadow-md">
                             {photo.name}
                           </h4>
                        </div>
                        <div className="bg-[#00E676] text-[#010C1D] h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#00E676]/30">
                           <span className="text-2xl">🏆</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-3">
                         <span className="text-white/60 text-xs font-bold uppercase tracking-widest"> Ganhou:</span>
                         <span className="text-white text-lg md:text-xl font-black italic">{photo.prize}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Controles de Navegação Transparentes */}
            <div className="absolute inset-y-0 left-0 w-20 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
               <button
                  onClick={() => setCurrentSlide((prev) => (prev - 1 + winnersPhotos.length) % winnersPhotos.length)}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Anterior"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
            </div>
            <div className="absolute inset-y-0 right-0 w-20 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setCurrentSlide((prev) => (prev + 1) % winnersPhotos.length)}
                  className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                  aria-label="Próximo"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            {/* Indicadores de Slide Minimalistas */}
            <div className="absolute top-8 right-8 flex gap-3 z-40">
              {winnersPhotos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-1.5 transition-all duration-300 rounded-full ${index === currentSlide
                    ? 'w-8 bg-[#00E676] shadow-[0_0_10px_#00E676]'
                    : 'w-2 bg-white/30 hover:bg-white/50'
                    }`}
                  aria-label={`Ir para slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Contador de Slide */}
            <div className="absolute top-8 left-8 z-40 bg-black/40 backdrop-blur-md text-white/90 text-[10px] font-black px-4 py-2 rounded-full border border-white/10 tracking-[0.2em] shadow-lg">
               {String(currentSlide + 1).padStart(2, '0')} / {String(winnersPhotos.length).padStart(2, '0')}
            </div>
          </div>
        </section>
      )}

      {/* Seção de Dúvidas/Atendimento */}
      <section className="mt-8 mb-12 text-center animate-in fade-in slide-in-from-bottom-5 duration-700">
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-[2.5rem] p-10 border-2 border-dashed border-purple-200 shadow-lg relative overflow-hidden group">
          {/* Círculos Decorativos */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-100/50 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-200/50 transition-colors"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-100/50 rounded-full blur-2xl pointer-events-none group-hover:bg-pink-200/50 transition-colors"></div>
          
          <div className="relative z-10">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-md border border-purple-100 mx-auto mb-6 transform group-hover:rotate-12 transition-transform">
              💡
            </div>
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-3">Ficou com alguma dúvida?</h3>
            <p className="text-slate-500 font-medium mb-8 max-w-sm mx-auto">
              Nossa equipe de suporte está pronta para te ajudar com qualquer pergunta sobre o sorteio!
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a 
                href="https://wa.me/5527995827661?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20o%20sorteio"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-black py-4 px-10 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 text-lg uppercase tracking-wider"
              >
                <WhatsAppIcon />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="text-2xl">🔒</div>
          <div>
            <p className="text-xs font-black text-slate-800 leading-none">Seguro</p>
            <p className="text-[10px] text-slate-400">Dados protegidos</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-3">
          <div className="text-2xl">🏛️</div>
          <div>
            <p className="text-xs font-black text-slate-800 leading-none">Oficial</p>
            <p className="text-[10px] text-slate-400">Loteria Federal</p>
          </div>
        </div>
      </section>
      {/* Toast animado de compras recentes */}
      <PurchaseToast raffles={[...(featuredRaffle ? [featuredRaffle] : []), ...otherRaffles]} />

    </div>
  );
};

export default Home;

// Declaração global para o TypeScript
declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}
