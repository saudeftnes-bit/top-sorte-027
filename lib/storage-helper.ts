import { supabase } from './supabase-admin';

/**
 * Upload de imagem para o Supabase Storage
 * @param file - Arquivo de imagem
 * @param bucket - Nome do bucket ('raffle-images')
 * @param folder - Pasta dentro do bucket (ex: 'raffles', 'winners')
 * @returns URL pública da imagem
 */
export async function uploadImage(
    file: File,
    bucket: string = 'raffle-images',
    folder: string = 'uploads'
): Promise<string | null> {
    try {
        // Validar tipo de arquivo
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            console.error('Tipo de arquivo não permitido. Use JPG, PNG ou WebP.');
            return null;
        }

        // Validar tamanho (máximo 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB em bytes
        if (file.size > maxSize) {
            console.error('Arquivo muito grande. Máximo permitido: 5MB');
            return null;
        }

        // Gerar nome único para o arquivo
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 9);
        const extension = file.name.split('.').pop();
        const fileName = `${folder}/${timestamp}-${randomStr}.${extension}`;

        // Fazer upload
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Erro ao fazer upload:', error);
            return null;
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from(bucket)
            .getPublicUrl(data.path);

        console.log('✅ Upload concluído:', urlData.publicUrl);
        return urlData.publicUrl;

    } catch (error) {
        console.error('Erro no upload:', error);
        return null;
    }
}

/**
 * Deletar imagem do Supabase Storage
 * @param url - URL completa da imagem
 * @param bucket - Nome do bucket
 * @returns true se deletado com sucesso
 */
export async function deleteImage(
    url: string,
    bucket: string = 'raffle-images'
): Promise<boolean> {
    try {
        // Extrair o caminho do arquivo da URL
        const urlParts = url.split(`${bucket}/`);
        if (urlParts.length < 2) {
            console.error('URL inválida');
            return false;
        }

        const filePath = urlParts[1];

        const { error } = await supabase.storage
            .from(bucket)
            .remove([filePath]);

        if (error) {
            console.error('Erro ao deletar imagem:', error);
            return false;
        }

        console.log('✅ Imagem deletada:', filePath);
        return true;

    } catch (error) {
        console.error('Erro ao deletar:', error);
        return false;
    }
}

/**
 * Validar se um arquivo é uma imagem válida
 * @param file - Arquivo para validar
 * @returns objeto com resultado da validação
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Tipo de arquivo não permitido. Use JPG, PNG ou WebP.'
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'Arquivo muito grande. Máximo: 5MB'
        };
    }

    return { valid: true };
}
