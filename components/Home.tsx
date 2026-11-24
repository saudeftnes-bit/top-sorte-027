import React, { useState, useEffect, useRef } from 'react';
import { WhatsAppIcon } from '../lib/icons';
import { getWinnerPhotos } from '../lib/supabase-admin';
import { getYouTubeEmbedUrl } from '../lib/video-utils';
import { supabase } from '../lib/supabase';
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
  const themeAccentColor = isBicho ? 'bg-green-600' : 'bg-[#00E676]';
  const themeHoverAccentColor = isBicho ? 'hover:bg-green-700' : 'hover:bg-[#00C853]';
  const themeBadgeColor = isBicho ? 'bg-green-100 text-green-700' : 'bg-[#004B8D]/10 text-[#004B8D] border border-[#004B8D]/20';
  const raffleTypeLabel = isBicho ? 'Sorteio pelo Jogo do Bicho' : 'Sorteio pela Loteria Federal';

  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic data from Supabase
  const [winnersPhotos, setWinnersPhotos] = useState<WinnerPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter other raffles — apenas finalizadas (excluindo a rifa ativa principal)
  const otherRaffles = raffles.filter(r => r.id !== featuredRaffle?.id && r.status === 'finished');

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
    <>
      {/* ============================================================ */}
      {/* BANNER MESCLADO #10 (Story / Reels Integrado) — Rifa ATIVA   */}
      {/* ============================================================ */}
      {featuredRaffle && featuredRaffle.status === 'active' && (
        <div className="w-full max-w-2xl mx-auto px-2 sm:px-4 min-h-[calc(100dvh-3.5rem)] sm:min-h-[calc(100dvh-4rem)] flex flex-col justify-center py-2">
          <div
            onClick={onStart}
            className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#004B8D] via-[#1E1B4B] to-black shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 flex flex-col justify-between min-h-[80dvh] sm:min-h-[76dvh] cursor-pointer group"
          >
            {/* Imagem principal centralizada sem cortes */}
            <div className="absolute inset-0 flex items-center justify-center p-2 pb-40 pt-14">
              <img
                src={featuredRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
                alt={featuredRaffle.title || "Prêmio do Sorteio"}
                className="w-full h-full object-contain block rounded-2xl transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
            </div>

            {/* Degradês sutis no topo e na base para leitura perfeita */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none" />

            {/* Topo Story: Avatar Top Sorte 027 + LIVE */}
            <div className="relative z-10 flex items-center justify-between p-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-[#00E676] to-pink-500 shadow-md flex-shrink-0">
                  <img
                    src="/logo.png"
                    alt="Top Sorte 027"
                    className="w-full h-full rounded-full object-cover bg-slate-950"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-xs font-black leading-tight drop-shadow">Top Sorte 027</span>
                  {featuredRaffle.code && (
                    <span className="text-[10px] text-white/75 font-bold leading-tight">Edição #{featuredRaffle.code}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-red-500/40 shadow">
                <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse" />
                <span className="text-white text-[10px] font-black uppercase tracking-widest">LIVE</span>
              </div>
            </div>

            {/* Rodapé Story: Título, Descrição, Pílula de preço + Botão Participar Agora */}
            <div className="relative z-10 p-4 space-y-2.5">
              {(featuredRaffle.title || featuredRaffle.description) && (
                <div className="space-y-1">
                  {featuredRaffle.title && (
                    <h2 className="text-base sm:text-xl font-black text-white leading-tight drop-shadow-md">
                      {featuredRaffle.title}
                    </h2>
                  )}
                  {featuredRaffle.description && (
                    <p className="text-xs sm:text-sm text-white/85 font-medium leading-snug whitespace-pre-line line-clamp-3 drop-shadow">
                      {featuredRaffle.description}
                    </p>
                  )}
                </div>
              )}

              {featuredRaffle.raffle_type === 'brinde' ? (
                <div className="inline-flex items-center gap-2 bg-emerald-950/80 backdrop-blur-md border border-emerald-400/30 px-3.5 py-1.5 rounded-full text-xs text-emerald-300 font-black uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>100% Grátis</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 bg-black/65 backdrop-blur-md border border-white/15 px-3.5 py-1.5 rounded-full text-xs text-white font-bold">
                  <span>💸 Cota:</span>
                  <strong className="text-[#00E676] text-sm font-black">
                    R$ {featuredRaffle.price_per_number?.toFixed(2).replace('.', ',') || '13,00'}
                  </strong>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 bg-[#00E676] rounded-2xl animate-ping opacity-20" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStart();
                  }}
                  className="w-full relative font-black py-4 sm:py-5 rounded-2xl flex items-center justify-center gap-2 text-base uppercase tracking-wider transition-all active:scale-95 border-b-4 overflow-hidden bg-gradient-to-r from-[#00E676] via-emerald-400 to-[#00C853] text-[#001D4A] border-[#008c3a] shadow-[0_8px_25px_rgba(0,230,118,0.4)] hover:translate-y-px"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {featuredRaffle.raffle_type === 'brinde' ? (
                      <><span>🎁</span><span>PARTICIPAR DO BRINDE GRÁTIS</span></>
                    ) : (
                      <><span>🚀</span><span>PARTICIPAR AGORA!</span></>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    <div className="flex flex-col gap-8 p-4 max-w-2xl mx-auto">
      {/* Featured Raffle Card or Maintenance State */}
      {maintenanceState?.isMaintenance ? (
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[2.5rem] shadow-xl border-2 border-blue-200 mt-4 p-8 md:p-12 text-center animate-in fade-in duration-500 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-100 opacity-50 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-24 h-24 rounded-full bg-indigo-100 opacity-50 pointer-events-none"></div>

          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-200 z-10 relative">
            <span className="text-4xl">🔧</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-blue-800 mb-4 tracking-tight relative z-10">
            Estamos realizando melhorias para você!
          </h2>
          <div className="bg-white/70 p-4 rounded-2xl mb-6 relative z-10 backdrop-blur-sm border border-blue-100">
            <p className="text-base text-blue-900 font-medium max-w-lg mx-auto leading-relaxed whitespace-pre-line">
              {maintenanceState.message}
            </p>
          </div>
          <p className="text-sm text-blue-600 font-medium mb-8 relative z-10">
            Seus dados e compras recentes estão seguros. Em breve estaremos de volta! 💙
          </p>
          <div className="relative z-10">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-10 rounded-2xl shadow-lg shadow-blue-600/20 transition-transform active:scale-95 text-lg w-full sm:w-auto flex items-center justify-center gap-2 mx-auto"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Atualizar Página
            </button>
          </div>
        </section>
      ) : featuredRaffle && featuredRaffle.status !== 'active' ? (
        <section className="relative overflow-hidden bg-black rounded-[2rem] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.9)] border border-white/10 mt-4 flex flex-col">
          {/* ── FOTO EM DESTAQUE — oculta quando ativa (banner aparece acima) ── */}
          {featuredRaffle.status !== 'active' && (
          <div className="relative w-full overflow-hidden group">
            <img
              src={featuredRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
              alt="Prêmio do Sorteio"
              className="w-full h-auto max-h-[75vh] object-contain block transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* Badge status — top-left sobreposto na foto */}
            <div className={`absolute top-3 left-3 z-20 font-black text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg ${
              featuredRaffle.status === 'active'
                ? 'bg-[#00E676] text-[#001D4A]'
                : featuredRaffle.status === 'scheduled'
                ? 'bg-yellow-400 text-slate-900'
                : 'bg-red-600 text-white'
            }`}>
              {featuredRaffle.status === 'active' ? '🟢 NOVA RIFA' : featuredRaffle.status === 'scheduled' ? '⏳ EM BREVE' : '🔴 FINALIZADA'}
            </div>

            {/* Badge edição — top-right sobreposto na foto */}
            {featuredRaffle.code && (
              <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-md border border-white/20 text-white/90 font-black text-[10px] px-3 py-1.5 rounded-full tracking-widest">
                EDIÇÃO #{featuredRaffle.code}
              </div>
            )}
          </div>
          )}

          {/* ── PAINEL INFERIOR PRETO (apenas valor + botão) ── */}
          <div className="bg-black px-4 pt-3 pb-5 space-y-3">

            {/* Card de Valor (sem informação de limite/máx de números) */}
            {featuredRaffle.raffle_type === 'brinde' ? (
              <div className="flex items-center justify-center gap-3 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl px-4 py-3 text-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="text-emerald-400 text-lg font-black uppercase tracking-wider">
                  100% Grátis
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse shadow-[0_0_8px_#00E676] flex-shrink-0" />
                <span className="text-white/90 text-sm font-bold">
                  Apenas{' '}
                  <strong className="text-[#00E676] text-xl font-black">
                    R$ {featuredRaffle.price_per_number?.toFixed(2).replace('.', ',') || '13,00'}
                  </strong>{' '}
                  / cota
                </span>
              </div>
            )}

            {/* Botão CTA */}
            <div className="relative">
              {featuredRaffle.status === 'active' && (
                <div className="absolute inset-0 bg-[#00E676] rounded-2xl animate-ping opacity-25" />
              )}
              <button
                onClick={onStart}
                className={`w-full relative font-black py-5 rounded-2xl flex items-center justify-center gap-2 text-base uppercase tracking-wider transition-all active:scale-95 border-b-4 overflow-hidden group ${
                  featuredRaffle.status === 'active'
                    ? 'bg-gradient-to-r from-[#00E676] to-[#00C853] text-[#001D4A] border-[#008c3a] shadow-[0_6px_24px_rgba(0,230,118,0.35)] hover:translate-y-px'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-900'
                }`}
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative z-10 flex items-center gap-2">
                  {featuredRaffle.status === 'active' ? (
                    featuredRaffle.raffle_type === 'brinde' ? (
                      <><span>🎁</span><span>PARTICIPAR DO BRINDE GRÁTIS</span></>
                    ) : (
                      <><span>🚀</span><span>PARTICIPAR AGORA!</span></>
                    )
                  ) : (
                    <><span>👁️</span><span>VISUALIZAR RIFA</span></>
                  )}
                </span>
              </button>
            </div>

          </div>
        </section>
      ) : null}

      {/* Rifas Finalizadas - aparece quando há rifas com status 'finished' */}
      {otherRaffles.length > 0 && (
        <section className="mt-2">
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
                  <div className={`absolute top-3 left-3 font-black px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest z-20 flex items-center gap-1.5 ${
                    otherRaffle.status === 'active'
                      ? (otherRaffle.raffle_type === 'brinde' ? 'bg-emerald-500 text-white shadow-md' : 'bg-[#00E676] text-[#001D4A] shadow-md')
                      : otherRaffle.status === 'scheduled'
                      ? 'bg-yellow-500 text-slate-900 shadow-md'
                      : otherRaffle.status === 'paused'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-gradient-to-r from-red-600 via-orange-500 to-red-600 bg-[length:200%_auto] animate-gradient-text text-white border border-white/30 shadow-[0_0_15px_rgba(239,68,68,0.65)]'
                    }`}>
                    {otherRaffle.status === 'finished' && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300"></span>
                      </span>
                    )}
                    <span>
                      {otherRaffle.raffle_type === 'brinde' && otherRaffle.status === 'active' ? '🎁 BRINDE GRÁTIS' : (
                        otherRaffle.status === 'active' ? 'ATIVO' :
                          otherRaffle.status === 'scheduled' ? 'AGENDADO' :
                            otherRaffle.status === 'paused' ? 'PAUSADO' : 'FINALIZADA'
                      )}
                    </span>
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
                href="https://wa.me/5527992429263?text=Olá!%20Tenho%20uma%20dúvida%20sobre%20o%20sorteio"
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

    </div>
    </>
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
