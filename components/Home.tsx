import React, { useState, useEffect } from 'react';
import { WhatsAppIcon } from '../App';
import { getWinnerPhotos } from '../lib/supabase-admin';
import { getYouTubeEmbedUrl } from '../lib/video-utils';
import type { Raffle, WinnerPhoto } from '../types/database';

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
  const themeAccentColor = isBicho ? 'bg-green-600' : 'bg-purple-600';
  const themeHoverAccentColor = isBicho ? 'hover:bg-green-700' : 'hover:bg-purple-700';
  const themeBadgeColor = isBicho ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700';
  const raffleTypeLabel = isBicho ? 'Sorteio pelo Jogo do Bicho' : 'Sorteio pela Loteria Federal';

  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic data from Supabase
  const [winnersPhotos, setWinnersPhotos] = useState<WinnerPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter other raffles (exclude current active one)
  const otherRaffles = raffles.filter(r => r.id !== featuredRaffle?.id);

  // Mensagens aleatórias para quando não há rifa ativa
  const waitingMessages = [
    { icon: '🏆', title: 'Em breve uma nova oportunidade de ganhar!', sub: 'Prepare-se para o próximo sorteio.' },
    { icon: '🎁', title: 'Nosso próximo sorteio está sendo preparado com carinho para você!', sub: 'Fique ligado e não perca!' },
    { icon: '🍀', title: 'Aguarde... O próximo ganhador pode ser você!', sub: 'A sorte é de quem participa.' },
    { icon: '✨', title: 'Novidades chegando! Fique ligado e seja o primeiro a participar.', sub: 'Novos números, novo ganhador.' },
    { icon: '🕒', title: 'Estamos finalizando os detalhes do próximo sorteio. Volte logo!', sub: 'Está quase na hora da sorte.' },
    { icon: '🎯', title: 'A próxima rifa está a caminho! Prepare seus números da sorte.', sub: 'Sua chance vem aí.' },
    { icon: '👥', title: 'Sorteio em breve! Enquanto isso, convide seus amigos para participar.', sub: 'Mais amigos, mais chance de ganhar!' },
  ];
  const [waitMsgIdx, setWaitMsgIdx] = useState(() => Math.floor(Math.random() * 7));
  const [waitFading, setWaitFading] = useState(false);

  useEffect(() => {
    if (featuredRaffle) return; // só roda quando não há rifa ativa
    const interval = setInterval(() => {
      setWaitFading(true);
      setTimeout(() => {
        setWaitMsgIdx(prev => (prev + 1) % waitingMessages.length);
        setWaitFading(false);
      }, 400);
    }, 4000);
    return () => clearInterval(interval);
  }, [featuredRaffle]);

  const currentWaitMsg = waitingMessages[waitMsgIdx];


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

    // Processar imediatamente e também após um delay (para garantir que o React terminou de pintar)
    handleProcess();
    const timer = setTimeout(handleProcess, 500);

    // Intervalo de segurança para casos onde o script demora a carregar
    const interval = setInterval(() => {
      if (window.instgrm) {
        const unprocessed = document.querySelectorAll('blockquote.instagram-media:not([data-instgrm-processed])');
        if (unprocessed.length > 0) {
          window.instgrm.Embeds.process();
        } else {
          // Se tudo processado, podemos parar o intervalo de segurança (opcional)
          // Mas manteremos para o caso de novos itens dinâmicos
        }
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [winnersPhotos, currentSlide]);

  // Fallback static data (usado se Supabase falhar)
  const fallbackWinnersPhotos = [
    {
      id: '1',
      url: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=600&auto=format&fit=crop",
      name: "João Silva",
      prize: "Moto CG 160 Fan",
      photo_url: "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=600&auto=format&fit=crop",
      display_order: 0,
      created_at: ''
    },
    {
      id: '2',
      url: "https://images.unsplash.com/photo-1593642532400-2682810df593?q=80&w=600&auto=format&fit=crop",
      name: "Maria Santos",
      prize: "R$ 8.000 no PIX",
      photo_url: "https://images.unsplash.com/photo-1593642532400-2682810df593?q=80&w=600&auto=format&fit=crop",
      display_order: 1,
      created_at: ''
    },
    {
      id: '3',
      url: "https://images.unsplash.com/photo-1605152276897-4f618f831968?q=80&w=600&auto=format&fit=crop",
      name: "Pedro Oliveira",
      prize: "iPhone 15 Pro",
      photo_url: "https://images.unsplash.com/photo-1605152276897-4f618f831968?q=80&w=600&auto=format&fit=crop",
      display_order: 2,
      created_at: ''
    },
    {
      id: '4',
      url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
      name: "Ana Costa",
      prize: "R$ 15.000 no PIX",
      photo_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
      display_order: 3,
      created_at: ''
    }
  ];

  // Load data from Supabase (photos only, raffle comes from props)
  useEffect(() => {
    const loadData = async () => {
      try {
        const photosData = await getWinnerPhotos();

        if (photosData && photosData.length > 0) {
          setWinnersPhotos(photosData);
        } else {
          setWinnersPhotos(fallbackWinnersPhotos);
        }
      } catch (error) {
        console.error('Error loading data from Supabase:', error);
        setWinnersPhotos(fallbackWinnersPhotos);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-advance slideshow
  useEffect(() => {
    if (winnersPhotos.length === 0) return;

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
        <section className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl border border-slate-100 mt-4 flex flex-col">
          {/* Status Badge Above Image */}
          <div className={`w-full text-white font-black px-4 py-3 text-center text-xs sm:text-sm relative overflow-hidden ${featuredRaffle.status === 'active' ? (isBicho ? 'bg-green-600' : 'bg-[#003B73]') :
            featuredRaffle.status === 'scheduled' ? 'bg-yellow-500' :
              'bg-red-600'
            }`}>
            {featuredRaffle.status === 'finished' && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-gradient-text bg-[length:200%_auto]"></div>
            )}
            <span className="relative z-10">
              {featuredRaffle.status === 'active' ? '🟢 SORTEIO ATIVO' : '🔴 RIFA FINALIZADA / PAUSADA (VISUALIZAÇÃO)'}
            </span>
          </div>

          <div className="bg-slate-50 overflow-hidden w-full">
            <img
              src={featuredRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
              alt="Prêmio do Sorteio"
              className="w-full h-auto block transition-transform duration-700 hover:scale-105"
            />
          </div>

          {/* Sorteio Info Label */}
          <div className={`mt-4 mx-4 py-3 px-4 rounded-2xl text-center font-black text-sm uppercase tracking-widest border-2 shadow-sm ${isBicho ? 'border-green-400 bg-green-600 text-white' : 'border-blue-400 bg-[#003B73] text-white'}`}>
            {raffleTypeLabel}
          </div>

          <div className="p-6">
            {featuredRaffle.status === 'finished' && (
              <div className="mb-6 text-center">
                <div className="inline-block relative">
                  <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic py-2 px-6 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-[length:200%_auto] animate-gradient-text text-transparent bg-clip-text drop-shadow-sm select-none">
                    Sorteio Pausado
                  </h2>
                  <div className="absolute -inset-1 bg-red-500 opacity-20 blur-xl animate-pulse rounded-full -z-10"></div>
                </div>
              </div>
            )}

            <h2 className="text-2xl font-black text-[#003B73] mb-2 text-center uppercase tracking-tight">
              {featuredRaffle.title || 'MOTO 0KM OU R$ 15.000 NO PIX'}
            </h2>
            {featuredRaffle.code && (
              <div className="text-center mb-2">
                <span className={`${themeBadgeColor} text-xs font-black px-3 py-1 rounded-full`}>
                  EDIÇÃO #{featuredRaffle.code}
                </span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 mb-6 text-slate-500 font-bold text-sm">
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Apenas R$ {featuredRaffle.price_per_number?.toFixed(2).replace('.', ',') || '13,00'} por número
            </div>
            {/* Botão de CTA Premium */}
            <div className="relative mt-2">
              {featuredRaffle.status === 'active' && (
                <>
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-yellow-400 to-orange-500 animate-ring-pulse" />
                  <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 opacity-30 blur-lg" />
                </>
              )}
              <button
                onClick={onStart}
                className={`relative w-full font-black py-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 text-xl tracking-wide ${
                  featuredRaffle.status === 'active'
                    ? 'bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 text-slate-900 animate-cta-glow'
                    : 'bg-slate-600 hover:bg-slate-700 text-white shadow-lg'
                }`}
              >
                {featuredRaffle.status === 'active' ? (
                  <>
                    <span className="text-2xl">🍀</span>
                    <span>ESCOLHER MEUS NÚMEROS</span>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                ) : <><span className="animate-blink-eyes">👀</span><span>VER RESULTADOS</span></>}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-white rounded-3xl shadow-lg border border-slate-100 mt-4 p-10 text-center overflow-hidden relative">
          {/* Soft gradient top bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300 rounded-t-3xl" />

          <div
            style={{
              opacity: waitFading ? 0 : 1,
              transition: 'opacity 0.5s ease',
            }}
          >
            {/* Icon */}
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-100">
              <span className="text-3xl">{currentWaitMsg.icon}</span>
            </div>

            {/* Title */}
            <h2 className="text-xl font-black text-slate-900 mb-2 leading-snug">
              {currentWaitMsg.title}
            </h2>

            {/* Subtitle */}
            <p className="text-slate-400 text-sm font-medium">
              {currentWaitMsg.sub}
            </p>

            {/* WhatsApp hint */}
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400 text-xs">
              <span>📲</span>
              <span>Ative as notificações para saber quando abrir!</span>
            </div>
          </div>
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

          <div className="grid grid-cols-1 gap-6">
            {otherRaffles.map((otherRaffle) => (
              <div key={otherRaffle.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 flex flex-col">
                <div className="relative overflow-hidden bg-slate-50 w-full">
                  <img
                    src={otherRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
                    alt={otherRaffle.title}
                    className="w-full h-auto block"
                  />
                  <div className={`absolute top-2 left-2 text-white font-bold px-2 py-1 rounded-lg text-[10px] uppercase ${otherRaffle.status === 'active' ? 'bg-green-500' :
                    otherRaffle.status === 'scheduled' ? 'bg-yellow-500' :
                      otherRaffle.status === 'paused' ? 'bg-red-500' : 'bg-slate-500'
                    }`}>
                    {otherRaffle.status === 'active' ? 'ATIVO' :
                      otherRaffle.status === 'scheduled' ? 'AGENDADO' :
                        otherRaffle.status === 'paused' ? 'PAUSADO' : 'FINALIZADO'}
                  </div>
                  {otherRaffle.code && (
                    <div className={`absolute bottom-2 right-2 ${otherRaffle.selection_mode === 'jogo_bicho' ? 'bg-green-600' : 'bg-purple-600'} text-white font-black px-2 py-1 rounded-lg text-[10px]`}>
                      #{otherRaffle.code}
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h4 className="text-xl font-black text-[#003B73] mb-2 text-center uppercase tracking-tight">
                    {otherRaffle.title}
                  </h4>
                  <div className="flex items-center justify-center gap-2 mb-6 text-slate-500 font-bold text-sm">
                    R$ {otherRaffle.price_per_number.toFixed(2).replace('.', ',')} por número
                  </div>
                  <button
                    onClick={() => onSelectRaffle?.(otherRaffle)}
                    className="w-full bg-slate-600 hover:bg-slate-700 text-white font-black py-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 text-lg"
                  >
                    <span className="animate-blink-eyes">👀</span> Visualizar rifa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── COMO FUNCIONA ── */}
      <section>
        {/* Section title */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span>📋</span> Como Funciona
          </h3>
          <span className="bg-purple-100 text-purple-700 font-black text-xs px-3 py-1 rounded-full border border-purple-200">
            Simples e Rápido ⚡
          </span>
        </div>

        {/* Dark card container */}
        <div className="relative bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-3xl overflow-hidden shadow-2xl p-6">
          {/* bg decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500 rounded-full opacity-10 translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

          {/* Steps */}
          <div className="relative z-10 flex flex-col gap-0">
            {[
              {
                num: '01', icon: '📱', title: 'Escolha Seus Números',
                desc: 'Navegue pela grade e selecione os números da sorte que deseja.',
                from: 'from-purple-500', to: 'to-violet-600', dot: 'bg-purple-400'
              },
              {
                num: '02', icon: '💳', title: 'Faça o Pagamento PIX',
                desc: 'Pague de forma rápida, fácil e 100% segura via PIX.',
                from: 'from-sky-500', to: 'to-blue-600', dot: 'bg-sky-400'
              },
              {
                num: '03', icon: '⚡', title: 'Aprovação Imediata',
                desc: 'O sistema confirma seu pagamento em segundos automaticamente.',
                from: 'from-green-500', to: 'to-emerald-600', dot: 'bg-green-400'
              },
              {
                num: '04', icon: '🏆', title: 'Concorra ao Prêmio',
                desc: 'Seus números estão confirmados e concorrendo ao sorteio!',
                from: 'from-amber-500', to: 'to-orange-500', dot: 'bg-amber-400'
              },
            ].map(({ num, icon, title, desc, from, to, dot }, i, arr) => (
              <div key={num} className="flex gap-4">
                {/* Left: number + connector */}
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 bg-gradient-to-br ${from} ${to} rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <span className="text-white font-black text-xs">{num}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex flex-col items-center flex-1 py-2 gap-1">
                      {[...Array(4)].map((_, di) => (
                        <div key={di} className={`w-1 h-1 rounded-full ${dot} opacity-50`} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Right: content card */}
                <div className={`flex-1 bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 ${i < arr.length - 1 ? 'mb-3' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h4 className="font-black text-white text-sm leading-tight">{title}</h4>
                      <p className="text-white/50 text-xs mt-0.5 leading-snug">{desc}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div className="relative z-10 mt-5 pt-5 border-t border-white/10 grid grid-cols-3 gap-3">
            {[
              { icon: '🔒', label: 'Pagamento\nSeguro' },
              { icon: '✅', label: 'Sorteio\nTransparente' },
              { icon: '🏆', label: 'Prêmios\nGarantidos' },
            ].map(({ icon, label }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 border border-white/10 text-center">
                <span className="text-xl block mb-1">{icon}</span>
                <p className="text-white/60 text-[10px] font-bold leading-tight whitespace-pre-line">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof Section - Slideshow de Ganhadores */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="text-yellow-500">🏆</span> Ganhadores Reais
          </h3>
          <span className="bg-green-100 text-green-700 font-black text-xs px-3 py-1 rounded-full border border-green-200">✓ Prova Real</span>
        </div>

        {/* Slideshow Premium com Ken Burns */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-slate-900 h-[350px] sm:h-[450px] md:h-[550px]">
          <div className="relative w-full h-full">
            {winnersPhotos.map((photo, index) => (
              <div
                key={photo.id || index}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                {/* Imagem com Ken Burns */}
                <div className="w-full h-full overflow-hidden">
                  <img
                    src={photo.photo_url}
                    alt={photo.name}
                    className={`w-full h-full object-cover ${index === currentSlide ? 'animate-kenburns' : ''}`}
                  />
                </div>

                {/* Gradiente duplo: topo escuro + base bem escura */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-black/50" />

                {/* Card do ganhador com glassmorphism */}
                <div className="absolute bottom-10 left-4 right-4 z-20">
                  <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-2xl">
                    <p className="text-2xl md:text-3xl font-black text-white mb-2 drop-shadow-lg">🏆 {photo.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="bg-green-500 text-white text-xs font-black px-3 py-1 rounded-full shadow">GANHOU</span>
                      <p className="text-sm md:text-base font-bold text-green-300">{photo.prize}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Barra de progresso animada */}
          <div className="absolute bottom-0 left-0 right-0 h-1 z-30 bg-white/10">
            <div key={currentSlide} className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 animate-slide-progress" />
          </div>

          {/* Indicadores */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
            {winnersPhotos.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${index === currentSlide ? 'w-8 bg-white shadow-lg' : 'w-2 bg-white/40 hover:bg-white/70'}`}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Badge topo com gradiente dourado */}
          <div className="absolute top-4 left-4 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-4 py-2 rounded-full text-xs font-black shadow-xl flex items-center gap-2 z-30">
            <span>👑</span>
            GANHADORES REAIS
          </div>

          {/* Setas de Navegação */}
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + winnersPhotos.length) % winnersPhotos.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all hover:scale-110 z-30 border border-white/20"
            aria-label="Anterior"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % winnersPhotos.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white p-3 rounded-full transition-all hover:scale-110 z-30 border border-white/20"
            aria-label="Próximo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
            </svg>
          </button>
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
