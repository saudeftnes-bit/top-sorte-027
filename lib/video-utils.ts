// Utilitários para trabalhar com URLs de vídeo do YouTube e Instagram

/**
 * Converte URL do YouTube para formato embed
 * Ex: https://youtube.com/watch?v=ABC123 → https://youtube.com/embed/ABC123
 */
export function getYouTubeEmbedUrl(url: string): string {
    try {
        const urlObj = new URL(url);

        // youtube.com/watch?v=...
        if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
            const videoId = urlObj.searchParams.get('v');
            return `https://www.youtube.com/embed/${videoId}`;
        }

        // youtu.be/...
        if (urlObj.hostname === 'youtu.be') {
            const videoId = urlObj.pathname.slice(1);
            return `https://www.youtube.com/embed/${videoId}`;
        }

        // Se já estiver em formato embed, retornar como está
        if (url.includes('/embed/')) {
            return url;
        }

        return url;
    } catch (error) {
        console.error('Invalid YouTube URL:', url);
        return url;
    }
}

/**
 * Valida se a URL é do YouTube
 */
export function isYouTubeUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes('youtube.com') || urlObj.hostname === 'youtu.be';
    } catch {
        return false;
    }
}

/**
 * Valida se a URL é do Instagram
 */
export function isInstagramUrl(url: string): boolean {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.includes('instagram.com');
    } catch {
        return false;
    }
}

/**
 * Determina o tipo de mídia baseado na URL
 */
export function detectMediaType(url: string): 'photo' | 'youtube' | 'instagram' {
    if (isYouTubeUrl(url)) return 'youtube';
    if (isInstagramUrl(url)) return 'instagram';
    return 'photo';
}
