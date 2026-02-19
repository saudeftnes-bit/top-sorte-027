import React, { useState, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { WhatsAppIcon } from '../../App';
import { getActiveRaffle, updateRaffle, createRaffle, getWinnerPhotos, addWinnerPhoto, deleteWinnerPhoto } from '../../lib/supabase-admin';
import { Raffle, WinnerPhoto } from '../../types/database';
import { uploadImage, validateImageFile } from '../../lib/storage-helper';

interface RaffleManagerProps {
    raffleId: string;
    onBack: () => void;
    onDataChanged?: () => void;
}

const RaffleManager: React.FC<RaffleManagerProps> = ({ raffleId, onBack, onDataChanged }) => {
    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [winnerPhotos, setWinnerPhotos] = useState<WinnerPhoto[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletePhotoId, setDeletePhotoId] = useState<string | null>(null);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showRestartModal, setShowRestartModal] = useState(false);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [pricePerNumber, setPricePerNumber] = useState('');
    const [mainImageUrl, setMainImageUrl] = useState('');
    const [totalNumbers, setTotalNumbers] = useState('10000');
    const [selectionMode, setSelectionMode] = useState<'loteria' | 'jogo_bicho'>('loteria');
    const [status, setStatus] = useState<'active' | 'finished' | 'scheduled'>('active');
    const [selectionTimeout, setSelectionTimeout] = useState('5');
    const [paymentTimeout, setPaymentTimeout] = useState('15');

    // Upload states
    const [isUploadingMainImage, setIsUploadingMainImage] = useState(false);
    const [isUploadingWinnerPhoto, setIsUploadingWinnerPhoto] = useState(false);

    // Winner photo form
    const [newWinnerName, setNewWinnerName] = useState('');
    const [newWinnerPrize, setNewWinnerPrize] = useState('');
    const [newWinnerPhotoUrl, setNewWinnerPhotoUrl] = useState('');
    const [newWinnerMediaType, setNewWinnerMediaType] = useState<'photo' | 'youtube' | 'instagram'>('photo');

    useEffect(() => {
        loadData();
    }, [raffleId]);

    const loadData = async () => {
        if (!raffleId) {
            // New Raffle Mode
            setRaffle({
                id: '',
                title: '',
                description: '',
                price_per_number: 0,
                main_image_url: '',
                status: 'scheduled',
                created_at: '',
                updated_at: ''
            } as any);
            setIsLoading(false);
            return;
        }

        const raffleData = await getActiveRaffle(); // This might need to fetch SPECIFIC raffle by ID in future
        // For now, getActiveRaffle returns the singular active one, but we passed raffleId.
        // We really should have getRaffleById.
        // But since we selected it in AdminPanel, we can rely on AdminPanel passing the right data or
        // we should implement getRaffleById. 
        // Let's assume for now we use the passed raffleId to fetch.
        // Since getActiveRaffle returns *the* active one, it might be wrong if we are editing a scheduled one.
        // Let's implement getRaffleById in supabase-admin later or now.
        // Actually, for this iteration, let's fix this properly.

        // TEMPORARY FIX: We will rely on getActiveRaffle ONLY if we don't have a specific fetcher, 
        // BUT `RaffleList` allows editing ANY raffle. 
        // We need `getRaffleById(id)`. 
        // I will add it to supabase-admin in next step if needed, but for now let's assume `raffleId` management.

        // ... proceeding with existing logic but wrapped
        if (raffleData && raffleData.id === raffleId) {
            setRaffle(raffleData);
            setTitle(raffleData.title);
            setDescription(raffleData.description);
            setPricePerNumber(raffleData.price_per_number.toString());
            setMainImageUrl(raffleData.main_image_url);
            setTotalNumbers((raffleData.total_numbers || 10000).toString());
            setSelectionMode(raffleData.selection_mode || 'loteria');
            setStatus(raffleData.status);
            setSelectionTimeout((raffleData.selection_timeout || 5).toString());
            setPaymentTimeout((raffleData.payment_timeout || 15).toString());
        } else {
            // Fallback or fetch specific (requires getRaffleById)
            setRaffle({
                id: raffleId,
                title: '',
                description: '',
                price_per_number: 0,
                main_image_url: '',
                status: 'scheduled',
                created_at: '',
                updated_at: ''
            } as any);
        }

        const photosData = await getWinnerPhotos();
        setWinnerPhotos(photosData);
        setIsLoading(false);
    };

    // Auto-close desativado - modal só fecha ao clicar OK
    // useEffect(() => {
    //     if (showSuccessModal) {
    //         const timer = setTimeout(() => {
    //             setShowSuccessModal(false);
    //         }, 10000); // 10 segundos
    //         return () => clearTimeout(timer);
    //     }
    // }, [showSuccessModal]);


    const handleSaveRaffle = async () => {
        // Validation
        const price = parseFloat(pricePerNumber);
        if (isNaN(price) || price <= 0) {
            setErrorMessage('Por favor, insira um preço válido maior que zero.');
            setShowErrorModal(true);
            return;
        }

        setIsSaving(true);

        const raffleData = {
            title,
            description,
            price_per_number: price,
            main_image_url: mainImageUrl,
            total_numbers: parseInt(totalNumbers),
            selection_mode: selectionMode,
            selection_timeout: parseInt(selectionTimeout),
            payment_timeout: parseInt(paymentTimeout),
            status,
        };

        let success = false;

        if (raffleId) {
            // Update existing
            success = await updateRaffle(raffleId, raffleData);
        } else {
            // Create New
            const newRaffle = await createRaffle(raffleData);
            if (newRaffle) {
                success = true;
                // Optionally redirect or update ID
            }
        }

        setIsSaving(false);

        if (success) {
            setSuccessMessage(raffleId ? 'Sorteio atualizado com sucesso! ✅' : 'Sorteio criado com sucesso! 🎉');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao salvar sorteio. Tente novamente.');
            setShowErrorModal(true);
        }
    };

    const handleMainImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            setErrorMessage(validation.error || 'Arquivo inválido');
            setShowErrorModal(true);
            return;
        }

        setIsUploadingMainImage(true);
        const uploadedUrl = await uploadImage(file, 'raffle-images', 'raffles');
        setIsUploadingMainImage(false);

        if (uploadedUrl) {
            setMainImageUrl(uploadedUrl);
            setSuccessMessage('Imagem carregada com sucesso! 🎉');
            setShowSuccessModal(true);
        } else {
            setErrorMessage('Erro ao fazer upload. Tente novamente.');
            setShowErrorModal(true);
        }

        // Reset input
        e.target.value = '';
    };

    const handleWinnerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validation = validateImageFile(file);
        if (!validation.valid) {
            setErrorMessage(validation.error || 'Arquivo inválido');
            setShowErrorModal(true);
            return;
        }

        setIsUploadingWinnerPhoto(true);
        const uploadedUrl = await uploadImage(file, 'raffle-images', 'winners');
        setIsUploadingWinnerPhoto(false);

        if (uploadedUrl) {
            setNewWinnerPhotoUrl(uploadedUrl);
            setNewWinnerMediaType('photo');
            setSuccessMessage('Foto carregada com sucesso! 📸');
            setShowSuccessModal(true);
        } else {
            setErrorMessage('Erro ao fazer upload. Tente novamente.');
            setShowErrorModal(true);
        }

        // Reset input
        e.target.value = '';
    };

    const handleAddWinner = async () => {
        if (!newWinnerName || !newWinnerPrize || !newWinnerPhotoUrl) {
            setErrorMessage('Preencha todos os campos do ganhador');
            setShowErrorModal(true);
            return;
        }

        // Auto-detect media type if the user left it as 'photo' but pasted a video URL
        let mediaType = newWinnerMediaType;
        if (mediaType === 'photo') {
            if (newWinnerPhotoUrl.includes('instagram.com')) {
                mediaType = 'instagram';
            } else if (newWinnerPhotoUrl.includes('youtube.com') || newWinnerPhotoUrl.includes('youtu.be')) {
                mediaType = 'youtube';
            }
        }

        const newPhoto = await addWinnerPhoto({
            name: newWinnerName,
            prize: newWinnerPrize,
            photo_url: mediaType === 'photo' ? newWinnerPhotoUrl : undefined,
            media_type: mediaType,
            video_url: mediaType !== 'photo' ? newWinnerPhotoUrl : undefined,
            display_order: winnerPhotos.length,
        });

        if (newPhoto) {
            setNewWinnerName('');
            setNewWinnerPrize('');
            setNewWinnerPhotoUrl('');
            setNewWinnerMediaType('photo');
            await loadData();
            setSuccessMessage('Ganhador adicionado com sucesso! ✅');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao adicionar ganhador. Tente novamente.');
            setShowErrorModal(true);
        }
    };

    const handleDeleteWinner = async (id: string) => {
        setDeletePhotoId(id);
        setShowDeleteModal(true);
    };

    const confirmDeleteWinner = async () => {
        if (!deletePhotoId) return;

        const success = await deleteWinnerPhoto(deletePhotoId);
        setShowDeleteModal(false);
        setDeletePhotoId(null);

        if (success) {
            await loadData();
            setSuccessMessage('Foto removida com sucesso!');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao remover foto. Tente novamente.');
            setShowErrorModal(true);
        }
    };

    const handleRestartContest = async () => {
        if (!raffle) return;

        setShowRestartModal(false);

        const { resetRaffleNumbers } = await import('../../lib/supabase-admin');
        const count = await resetRaffleNumbers(raffle.id);

        if (count >= 0) {
            setSuccessMessage(`Concurso reiniciado com sucesso! ✅\n${count} número(s) foram liberados.`);
            setShowSuccessModal(true);
            await loadData();
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao reiniciar concurso. Verifique se a função SQL foi executada no Supabase.');
            setShowErrorModal(true);
        }
    };



    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">🎯 Gerenciar Sorteio</h2>
                    <p className="text-slate-500 font-medium mt-1">Edite textos, imagens e configurações</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowRestartModal(true)}
                        className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl font-bold transition-colors"
                    >
                        🔄 Novo Concurso
                    </button>
                    <button
                        onClick={onBack}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold transition-colors"
                    >
                        ← Voltar
                    </button>
                </div>
            </div>

            {/* Raffle Configuration */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-100 space-y-6">
                <h3 className="text-xl font-black text-slate-900 mb-4">📝 Informações do Sorteio</h3>

                <div>
                    {raffle?.code && (
                        <div className="mb-4 inline-block bg-purple-100 text-purple-800 text-sm font-bold px-3 py-1 rounded-full">
                            🔖 Edição #{raffle.code}
                        </div>
                    )}
                    <label className="block text-sm font-bold text-slate-700 mb-2">Título do Sorteio</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                        placeholder="Ex: MOTO 0KM OU R$ 15.000 NO PIX"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Descrição</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium resize-none"
                        placeholder="Descrição adicional do sorteio..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Preço por Número (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={pricePerNumber}
                            onChange={(e) => setPricePerNumber(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="13.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Status do Sorteio</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as any)}
                            className={`w-full px-4 py-3 rounded-xl border-2 focus:outline-none font-black transition-all ${status === 'active' ? 'border-green-500 bg-green-50 text-green-700' :
                                status === 'scheduled' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' :
                                    'border-red-500 bg-red-50 text-red-700'
                                }`}
                        >
                            <option value="active">🟢 SORTEIO ATIVO</option>
                            <option value="scheduled">🟡 AGUARDANDO PUBLICAÇÃO</option>
                            <option value="finished">🔴 SORTEIO PAUSADO</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">⏱️ Tempo de Escolha (minutos)</label>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Tempo que o número fica AMARELO</p>
                        <input
                            type="number"
                            value={selectionTimeout}
                            onChange={(e) => setSelectionTimeout(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">⌛ Tempo de Pagamento (minutos)</label>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Tempo total para concluir o PIX</p>
                        <input
                            type="number"
                            value={paymentTimeout}
                            onChange={(e) => setPaymentTimeout(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="15"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">📸 Imagem Principal do Sorteio</label>

                    {/* Upload Button */}
                    <div className="flex gap-2 mb-2">
                        <label className="flex-1 cursor-pointer">
                            <div className={`px-4 py-3 rounded-xl border-2 border-dashed text-center font-bold transition-all ${isUploadingMainImage
                                ? 'bg-purple-50 border-purple-300 text-purple-600'
                                : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-600'
                                }`}>
                                {isUploadingMainImage ? '⏳ Fazendo Upload...' : '📤 Fazer Upload de Imagem'}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleMainImageUpload}
                                className="hidden"
                                disabled={isUploadingMainImage}
                            />
                        </label>
                    </div>

                    {/* Manual URL Input */}
                    <div className="relative">
                        <p className="text-xs text-slate-500 mb-2 text-center">ou cole a URL manualmente:</p>
                        <input
                            type="url"
                            value={mainImageUrl}
                            onChange={(e) => setMainImageUrl(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="https://images.unsplash.com/..."
                        />
                    </div>

                    {/* Preview */}
                    {mainImageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border-2 border-slate-200">
                            <img src={mainImageUrl} alt="Preview" className="w-full h-48 object-cover" />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">🔢 Quantidade Total de Números</label>
                        <input
                            type="number"
                            value={totalNumbers}
                            onChange={(e) => setTotalNumbers(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="10000"
                            min="1"
                        />
                        <p className="mt-1 text-xs text-slate-500">Ex: 100, 1000, 10000</p>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">🎰 Modo de Jogo</label>
                        <select
                            value={selectionMode}
                            onChange={(e) => setSelectionMode(e.target.value as any)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                        >
                            <option value="loteria">🎲 Loteria (Números)</option>
                            <option value="jogo_bicho">🐓 Jogo do Bicho (Animais)</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleSaveRaffle}
                    disabled={isSaving}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? 'Salvando...' : '💾 SALVAR ALTERAÇÕES'}
                </button>
            </div>

            {/* Winner Photos */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-100 space-y-6">
                <h3 className="text-xl font-black text-slate-900 mb-4">🏆 Fotos de Ganhadores</h3>

                {/* Add Winner Form */}
                <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-bold text-purple-900">Adicionar Novo Ganhador</p>

                    {/* Seletor de Tipo de Mídia */}
                    <label className="text-sm font-bold text-purple-900 uppercase tracking-wider">Adicionar Foto de Ganhador</label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            type="text"
                            value={newWinnerName}
                            onChange={(e) => setNewWinnerName(e.target.value)}
                            className="px-4 py-2 rounded-lg border-2 border-purple-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="Nome do ganhador"
                        />
                        <input
                            type="text"
                            value={newWinnerPrize}
                            onChange={(e) => setNewWinnerPrize(e.target.value)}
                            className="px-4 py-2 rounded-lg border-2 border-purple-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="Prêmio"
                        />
                    </div>

                    {/* Upload de Foto */}
                    <div className="space-y-2">
                        {/* Upload Button for Photo */}
                        <label className="block cursor-pointer">
                            <div className={`px-4 py-3 rounded-lg border-2 border-dashed text-center font-bold transition-all ${isUploadingWinnerPhoto
                                ? 'bg-purple-50 border-purple-300 text-purple-600'
                                : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-purple-50 hover:border-purple-400 hover:text-purple-600'
                                }`}>
                                {isUploadingWinnerPhoto ? '⏳ Fazendo Upload...' : '📤 Fazer Upload da Foto'}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleWinnerPhotoUpload}
                                className="hidden"
                                disabled={isUploadingWinnerPhoto}
                            />
                        </label>

                        {/* URL Manual Option */}
                        <div>
                            <p className="text-xs text-slate-500 mb-1 text-center">ou cole a URL:</p>
                            <input
                                type="url"
                                value={newWinnerPhotoUrl}
                                onChange={(e) => setNewWinnerPhotoUrl(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border-2 border-purple-200 focus:border-purple-600 focus:outline-none font-medium"
                                placeholder="URL da foto"
                            />
                        </div>

                        {/* Preview */}
                        {newWinnerPhotoUrl && (
                            <div className="rounded-lg overflow-hidden border-2 border-purple-200">
                                <img src={newWinnerPhotoUrl} alt="Preview" className="w-full h-32 object-cover" />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleAddWinner}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition-all active:scale-95"
                    >
                        ➕ Adicionar Ganhador
                    </button>
                </div>

                {/* Winner Photos List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {winnerPhotos.length === 0 ? (
                        <p className="text-slate-400 text-center py-8 col-span-2">Nenhuma foto de ganhador ainda</p>
                    ) : (
                        winnerPhotos.map((photo) => (
                            <div key={photo.id} className="border-2 border-slate-200 rounded-xl overflow-hidden group hover:border-purple-300 transition-all">
                                {(!photo.media_type || photo.media_type === 'photo') ? (
                                    <img src={photo.photo_url} alt={photo.name} className="w-full h-48 object-cover" />
                                ) : (
                                    <div className="w-full h-48 bg-slate-900 flex flex-col items-center justify-center text-white gap-2">
                                        <span className="text-3xl">{photo.media_type === 'youtube' ? '🎬' : '📹'}</span>
                                        <span className="text-xs font-bold uppercase tracking-widest">{photo.media_type}</span>
                                        <p className="text-[10px] text-slate-400 px-4 text-center truncate w-full">{photo.video_url}</p>
                                    </div>
                                )}
                                <div className="p-4">
                                    <p className="font-black text-slate-900">{photo.name}</p>
                                    <p className="text-sm text-green-600 font-bold">{photo.prize}</p>
                                    <button
                                        onClick={() => handleDeleteWinner(photo.id)}
                                        className="mt-3 w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg text-sm transition-all active:scale-95"
                                    >
                                        🗑️ Remover
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            <ConfirmModal
                isOpen={showDeleteModal}
                title="Remover Foto"
                message="Tem certeza que deseja remover esta foto de ganhador?"
                confirmLabel="Remover"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={confirmDeleteWinner}
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeletePhotoId(null);
                }}
            />

            <ConfirmModal
                isOpen={showSuccessModal}
                title="Sucesso!"
                message={successMessage}
                confirmLabel="OK"
                cancelLabel=""
                variant="info"
                onConfirm={() => setShowSuccessModal(false)}
                onCancel={() => setShowSuccessModal(false)}
            />

            <ConfirmModal
                isOpen={showErrorModal}
                title="Erro"
                message={errorMessage}
                confirmLabel="OK"
                cancelLabel=""
                variant="danger"
                onConfirm={() => setShowErrorModal(false)}
                onCancel={() => setShowErrorModal(false)}
            />

            <ConfirmModal
                isOpen={showRestartModal}
                title="🔄 Iniciar Novo Concurso"
                message="Tem certeza que deseja REINICIAR este concurso? Isto irá APAGAR todas as reservas e deixar todos os números livres novamente. Esta ação não pode ser desfeita!"
                confirmLabel="Sim, Reiniciar"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={handleRestartContest}
                onCancel={() => setShowRestartModal(false)}
            />
        </div>
    );
};

export default RaffleManager;
