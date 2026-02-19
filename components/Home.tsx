import React, { useState, useEffect } from 'react';
import { WhatsAppIcon } from '../App';
import { getWinnerPhotos } from '../lib/supabase-admin';
import { getYouTubeEmbedUrl } from '../lib/video-utils';
import type { Raffle, WinnerPhoto } from '../types/database';

interface HomeProps {
  onStart: () => void;
  raffle: Raffle | null;
  activeReservationsCount: number;
}

const Home: React.FC<HomeProps> = ({ onStart, raffle, activeReservationsCount }) => {
  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic data from Supabase
  const [winnersPhotos, setWinnersPhotos] = useState<WinnerPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      {/* Featured Raffle Card */}
      <section className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl border border-slate-100 mt-4 flex flex-col">
        {/* Status Badge Above Image */}
        <div className={`w-full text-white font-black px-4 py-3 text-center text-xs sm:text-sm ${raffle?.status === 'active' ? 'bg-green-500' :
          raffle?.status === 'scheduled' ? 'bg-yellow-500' :
            'bg-red-500'
          }`}>
          {raffle?.status === 'active' ? '🟢 SORTEIO ATIVO' :
            raffle?.status === 'scheduled' ? '🟡 AGUARDANDO PUBLICAÇÃO' :
              '🔴 SORTEIO PAUSADO'}
        </div>

        <img
          src={raffle?.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
          alt="Prêmio do Sorteio"
          className="w-full h-56 object-cover"
        />
        <div className="p-6">
          <h2 className="text-2xl font-black text-[#003B73] mb-2 text-center uppercase tracking-tight">
            {raffle?.title || 'MOTO 0KM OU R$ 15.000 NO PIX'}
          </h2>

          <div className="flex items-center justify-center gap-2 mb-6 text-slate-500 font-bold text-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Apenas R$ {raffle?.price_per_number?.toFixed(2).replace('.', ',') || '13,00'} por número
          </div>
          {/* Botão de CTA ou aviso de grade preenchida */}
          {(() => {
            const totalNumbers = raffle?.total_numbers || 0;
            const isSoldOut = totalNumbers > 0 && activeReservationsCount >= totalNumbers;

            if (isSoldOut) {
              return (
                <div className="w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 shadow-xl border-2 border-amber-400/50 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="text-2xl animate-bounce">🏆</span>
                    <span className="text-amber-400 font-black text-lg uppercase tracking-tight">Grade Preenchida!</span>
                    <span className="text-2xl animate-bounce">🏆</span>
                  </div>
                  <p className="text-slate-300 text-sm font-medium mb-3">
                    Todos os números já foram reservados.
                  </p>
                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 mb-4">
                    <p className="text-amber-300 font-black text-sm uppercase tracking-wider">
                      ⏳ Aguarde o sorteio!
                    </p>
                    <p className="text-slate-400 text-xs mt-1 font-medium">
                      Em breve abriremos um novo concurso. Fique ligado!
                    </p>
                  </div>

                  <button
                    onClick={onStart}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-sm uppercase"
                  >
                    <span>👁️</span> Ver Tabela Completa
                  </button>
                </div>
              );
            }

            return (
              <button
                onClick={onStart}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 text-lg animate-pulse hover:animate-none"
                style={{
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}
              >
                🎯 ESCOLHER MEUS NÚMEROS
              </button>
            );
          })()}
        </div>
      </section>


      {/* Seção Como Funciona */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="text-2xl">📋</span>
            COMO FUNCIONA
          </h3>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-white rounded-3xl shadow-xl p-6 border-2 border-purple-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Passo 1 */}
            <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-xl">
                  1
                </div>
                <div>
                  <h4 className="font-black text-purple-900 mb-1">📱 Escolha Seus Números</h4>
                  <p className="text-sm text-slate-600">Selecione os números da sorte e reserve-os por alguns minutos</p>
                </div>
              </div>
            </div>

            {/* Passo 2 */}
            <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-xl">
                  2
                </div>
                <div>
                  <h4 className="font-black text-purple-900 mb-1">💳 Faça o PIX</h4>
                  <p className="text-sm text-slate-600">Pagamento rápido, fácil e seguro via PIX</p>
                </div>
              </div>
            </div>

            {/* Passo 3 */}
            <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-xl">
                  3
                </div>
                <div>
                  <h4 className="font-black text-purple-900 mb-1">⚡ Aprovação Imediata</h4>
                  <p className="text-sm text-slate-600">O sistema identifica seu pagamento em segundos e libera seus números</p>
                </div>
              </div>
            </div>

            {/* Passo 4 */}
            <div className="bg-white rounded-2xl p-4 shadow-md border-2 border-purple-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-xl">
                  4
                </div>
                <div>
                  <h4 className="font-black text-purple-900 mb-1">🎯 Participe do Sorteio</h4>
                  <p className="text-sm text-slate-600">Seus números já estão concorrendo ao prêmio!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Proof Section - Slideshow de Ganhadores */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ganhadores Reais</h3>
          <span className="text-purple-600 font-bold text-xs">Prova Real ✓</span>
        </div>

        {/* Slideshow de Fotos dos Ganhadores - Altura fixa para evitar tela preta */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-slate-900 h-[350px] sm:h-[450px] md:h-[550px]">
          {/* Images */}
          <div className="relative w-full h-full">
            {winnersPhotos.map((photo, index) => (
              <div
                key={photo.id || index}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
              >
                {/* Foto do Ganhador */}
                <img
                  src={photo.photo_url}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>

                {/* Info do ganhador */}
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white z-20 pointer-events-none">
                  <p className="text-4xl md:text-5xl font-black mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">🏆 {photo.name}</p>
                  <p className="text-lg md:text-xl font-bold text-green-400 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">{photo.prize}</p>
                </div>
              </div>
            ))}
          </div>


          {/* Indicadores */}
          <div className="absolute bottom-6 right-6 flex gap-2 z-30">
            {winnersPhotos.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${index === currentSlide
                  ? 'w-10 bg-white shadow-lg'
                  : 'w-2 bg-white/50 hover:bg-white/75'
                  }`}
                aria-label={`Slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Badge de Ganhador */}
          <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-black shadow-xl flex items-center gap-2 z-30">
            <span className="text-xl">✨</span>
            GANHADORES
          </div>

          {/* Setas de Navegação */}
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + winnersPhotos.length) % winnersPhotos.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all hover:scale-110 z-30"
            aria-label="Anterior"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % winnersPhotos.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all hover:scale-110 z-30"
            aria-label="Próximo"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
