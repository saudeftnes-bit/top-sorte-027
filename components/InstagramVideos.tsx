import React, { useEffect } from 'react';

interface InstagramVideosProps {
    onBack: () => void;
}

const InstagramVideos: React.FC<InstagramVideosProps> = ({ onBack }) => {
    const videos = [
        {
            id: 1,
            url: 'https://www.instagram.com/reel/DS8GnYPDsPw/',
            title: 'Vídeo do Sorteio'
        }
    ];

    useEffect(() => {
        // Carregar o script do Instagram embed
        const script = document.createElement('script');
        script.src = 'https://www.instagram.com/embed.js';
        script.async = true;
        document.body.appendChild(script);

        // Processar embeds quando o script carregar
        script.onload = () => {
            if (window.instgrm) {
                window.instgrm.Embeds.process();
            }
        };

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-6 sticky top-16 z-30">
                <div className="max-w-4xl mx-auto">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-bold mb-3 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                        </svg>
                        Voltar
                    </button>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-2">
                        <span className="text-3xl">📹</span>
                        Vídeos do Sorteio
                    </h1>
                    <p className="text-slate-600 mt-2">Confira nossos vídeos e sorteios anteriores!</p>
                </div>
            </div>

            {/* Videos Grid */}
            <div className="max-w-4xl mx-auto px-4 py-8">
                <div className="space-y-8">
                    {videos.map((video) => (
                        <div key={video.id} className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-slate-100">
                            {/* Instagram Embed */}
                            <blockquote
                                className="instagram-media"
                                data-instgrm-permalink={video.url}
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
                                <a href={video.url} target="_blank" rel="noopener noreferrer">
                                    Ver no Instagram
                                </a>
                            </blockquote>
                        </div>
                    ))}
                </div>

                {/* Call to Action */}
                <div className="mt-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-8 text-white text-center shadow-2xl">
                    <h2 className="text-2xl font-black mb-3">🎯 Quer Participar?</h2>
                    <p className="text-lg mb-6 opacity-90">
                        Escolha seus números da sorte e concorra a prêmios incríveis!
                    </p>
                    <button
                        onClick={onBack}
                        className="bg-white text-purple-600 font-black px-8 py-4 rounded-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        PARTICIPAR AGORA
                    </button>
                </div>
            </div>
        </div>
    );
};

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

export default InstagramVideos;
