import React, { useState, useEffect } from 'react';
import { WhatsAppIcon } from '../App';
import { getActiveRaffle, getWinnerPhotos } from '../lib/supabase-admin';
import { getYouTubeEmbedUrl } from '../lib/video-utils';
import type { Raffle, WinnerPhoto } from '../types/database';

interface HomeProps {
  onStart: () => void;
}

const Home: React.FC<HomeProps> = ({ onStart }) => {
  // Slideshow state
  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic data from Supabase
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [winnersPhotos, setWinnersPhotos] = useState<WinnerPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar script do Instagram
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.instgrm) {
        window.instgrm.Embeds.process();
      }
    };

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // Processar embeds do Instagram quando os dados mudarem ou o slide mudar
  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.Embeds.process();
    }
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

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const [raffleData, photosData] = await Promise.all([
          getActiveRaffle(),
          getWinnerPhotos()
        ]);

        if (raffleData) {
          setRaffle(raffleData);
        }

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
    }, 3500);
    return () => clearInterval(interval);
  }, [winnersPhotos.length]);

  return (
    <div className="flex flex-col gap-8 p-4 max-w-2xl mx-auto">
      {/* Featured Raffle Card */}
      <section className="relative overflow-hidden bg-white rounded-[2.5rem] shadow-xl border border-slate-100 mt-4">
        <img
          src={raffle?.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
          alt="Prêmio do Sorteio"
          className="w-full h-56 object-cover"
        />
        <div className="absolute top-4 right-4 bg-purple-600 text-white font-black px-4 py-2 rounded-full shadow-lg text-sm">
          {raffle?.status === 'active' ? 'SORTEIO ATIVO' : raffle?.status === 'finished' ? 'FINALIZADO' : 'EM BREVE'}
        </div>
        <div className="p-6">
          <h2 className="text-2xl font-black text-[#003B73] mb-2 text-center uppercase tracking-tight">
            {raffle?.title || 'MOTO 0KM OU R$ 15.000 NO PIX'}
          </h2>
          <div className="flex items-center justify-center gap-2 mb-6 text-slate-500 font-bold text-sm">
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            Apenas R$ {raffle?.price_per_number?.toFixed(2).replace('.', ',') || '13,00'} por número
          </div>
          <button
            onClick={onStart}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-5 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 text-lg"
          >
            🎯 ESCOLHER MEUS NÚMEROS
          </button>
        </div>
      </section>

      {/* Seção de Vídeos */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <span className="text-2xl">🎥</span>
            VÍDEOS TOPSORTE
          </h3>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-slate-100">
          <blockquote
            className="instagram-media"
            data-instgrm-permalink="https://www.instagram.com/reel/DS8GnYPDsPw/"
            data-instgrm-version="14"
            style={{
              background: '#FFF',
              border: 0,
              borderRadius: '3px',
              boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
              margin: '1px',
              maxWidth: '540px',
              minWidth: '326px',
              padding: 0,
              width: 'calc(100% - 2px)'
            }}
          >
            <a href="https://www.instagram.com/reel/DS8GnYPDsPw/" target="_blank" rel="noopener noreferrer">
              Ver no Instagram
            </a>
          </blockquote>
        </div>
      </section>

      {/* Proof Section - Slideshow de Ganhadores */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ganhadores Reais</h3>
          <span className="text-purple-600 font-bold text-xs">Prova Real ✓</span>
        </div>

        {/* Slideshow de Fotos dos Ganhadores - Tela Cheia */}
        <div className="relative overflow-hidden rounded-3xl shadow-2xl bg-slate-900 aspect-video">
          {/* Images */}
          <div className="relative w-full h-full">
            {winnersPhotos.map((photo, index) => (
              <div
                key={photo.id || index}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'
                  }`}
              >
                {/* Renderização condicional: Foto, YouTube ou Instagram */}
                {(!photo.media_type || photo.media_type === 'photo') && (
                  <>
                    <img
                      src={photo.photo_url}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                  </>
                )}

                {photo.media_type === 'youtube' && photo.video_url && (
                  <>
                    <iframe
                      src={getYouTubeEmbedUrl(photo.video_url)}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none"></div>
                  </>
                )}

                {photo.media_type === 'instagram' && photo.video_url && (
                  <>
                    <div className="w-full h-full flex items-center justify-center bg-slate-900">
                      <blockquote
                        className="instagram-media"
                        data-instgrm-permalink={photo.video_url}
                        data-instgrm-version="14"
                        style={{
                          background: '#FFF',
                          border: 0,
                          borderRadius: '3px',
                          boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                          margin: '1px',
                          maxWidth: '540px',
                          minWidth: '326px',
                          padding: 0,
                          width: 'calc(100% - 2px)'
                        }}
                      >
                        <a href={photo.video_url} target="_blank" rel="noopener noreferrer">
                          Ver no Instagram
                        </a>
                      </blockquote>
                    </div>
                  </>
                )}

                {/* Info do ganhador (sempre visível) */}
                <div className="absolute bottom-0 left-0 right-0 p-8 text-white z-10">
                  <p className="text-4xl md:text-5xl font-black mb-2 drop-shadow-lg">🏆 {photo.name}</p>
                  <p className="text-lg md:text-xl font-bold text-green-400 drop-shadow-lg">{photo.prize}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Indicadores */}
          <div className="absolute bottom-6 right-6 flex gap-2">
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
          <div className="absolute top-4 left-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-black shadow-xl flex items-center gap-2">
            <span className="text-xl">✨</span>
            GANHADORES
          </div>

          {/* Setas de Navegação */}
          <button
            onClick={() => setCurrentSlide((prev) => (prev - 1 + winnersPhotos.length) % winnersPhotos.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all hover:scale-110"
            aria-label="Anterior"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => (prev + 1) % winnersPhotos.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white p-3 rounded-full transition-all hover:scale-110"
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

      {/* How it works simple */}
      <section className="bg-slate-900 text-white p-8 rounded-[2.5rem] mb-4">
        <h3 className="font-black mb-6 text-xl">Como funciona?</h3>
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black flex-shrink-0">1</div>
            <div>
              <p className="font-bold">Escolha seus números</p>
              <p className="text-xs text-slate-400">Selecione na grade (Verde) e veja quem já está participando (Roxo).</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black flex-shrink-0">2</div>
            <div>
              <p className="font-bold">Confirmação Automática</p>
              <p className="text-xs text-slate-400">Ao preencher seus dados, o número fica Roxo (confirmado) automaticamente.</p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black flex-shrink-0">3</div>
            <div>
              <p className="font-bold">Acompanhe o Sorteio</p>
              <p className="text-xs text-slate-400">Resultado transparente pela Loteria Federal. Transparência acima de tudo.</p>
            </div>
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
