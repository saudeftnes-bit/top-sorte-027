import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface ImageUploadProps {
    onUploadComplete: (url: string) => void;
    onUploadError?: (error: string) => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onUploadComplete, onUploadError }) => {
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            onUploadError?.('Por favor, selecione uma imagem válida (JPG, PNG, etc.)');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            onUploadError?.('Arquivo muito grande. Máximo 5MB.');
            return;
        }

        // Show preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);

        // Upload to Supabase
        await uploadFile(file);
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        setProgress(0);

        try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('payment-proofs')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                });

            if (error) {
                console.error('Upload error:', error);
                onUploadError?.('Erro ao fazer upload. Tente novamente.');
                setPreview(null);
                return;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('payment-proofs')
                .getPublicUrl(filePath);

            if (urlData?.publicUrl) {
                setProgress(100);
                onUploadComplete(urlData.publicUrl);
            }
        } catch (error) {
            console.error('Upload error:', error);
            onUploadError?.('Erro ao fazer upload. Tente novamente.');
            setPreview(null);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
            />

            {!preview ? (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-purple-300 rounded-2xl p-8 hover:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-purple-50"
                >
                    <div className="text-center space-y-3">
                        <div className="text-5xl">📸</div>
                        <p className="text-sm font-bold text-purple-900">
                            Clique para enviar comprovante
                        </p>
                        <p className="text-xs text-purple-600">
                            JPG, PNG ou PDF - Máximo 5MB
                        </p>
                    </div>
                </button>
            ) : (
                <div className="relative">
                    <img
                        src={preview}
                        alt="Preview do comprovante"
                        className="w-full rounded-2xl border-2 border-green-200 shadow-lg"
                    />

                    {uploading ? (
                        <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                            <div className="bg-white rounded-xl p-6 text-center space-y-3">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto"></div>
                                <p className="font-bold text-purple-900">Enviando... {progress}%</p>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-black shadow-lg flex items-center gap-2">
                            <span>✅</span>
                            <span>Enviado!</span>
                        </div>
                    )}

                    {!uploading && (
                        <button
                            type="button"
                            onClick={() => {
                                setPreview(null);
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                            className="absolute bottom-4 right-4 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95"
                        >
                            🗑️ Remover
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ImageUpload;
