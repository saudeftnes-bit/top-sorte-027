import React, { useState, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { getActiveRaffle, updateRaffle, getWinnerPhotos, addWinnerPhoto, deleteWinnerPhoto } from '../../lib/supabase-admin';
import type { Raffle, WinnerPhoto } from '../../types/database';

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

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [pricePerNumber, setPricePerNumber] = useState('');
    const [mainImageUrl, setMainImageUrl] = useState('');
    const [status, setStatus] = useState<'active' | 'finished' | 'scheduled'>('active');

    // Winner photo form
    const [newWinnerName, setNewWinnerName] = useState('');
    const [newWinnerPrize, setNewWinnerPrize] = useState('');
    const [newWinnerPhotoUrl, setNewWinnerPhotoUrl] = useState('');

    useEffect(() => {
        loadData();
    }, [raffleId]);

    const loadData = async () => {
        const raffleData = await getActiveRaffle();
        const photosData = await getWinnerPhotos();

        if (raffleData) {
            setRaffle(raffleData);
            setTitle(raffleData.title);
            setDescription(raffleData.description);
            setPricePerNumber(raffleData.price_per_number.toString());
            setMainImageUrl(raffleData.main_image_url);
            setStatus(raffleData.status);
        }

        setWinnerPhotos(photosData);
        setIsLoading(false);
    };

    const handleSaveRaffle = async () => {
        if (!raffle) return;

        setIsSaving(true);

        const success = await updateRaffle(raffle.id, {
            title,
            description,
            price_per_number: parseFloat(pricePerNumber),
            main_image_url: mainImageUrl,
            status,
        });

        setIsSaving(false);

        if (success) {
            setSuccessMessage('Sorteio atualizado com sucesso! ✅');
            setShowSuccessModal(true);
            await loadData();
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao atualizar sorteio. Tente novamente.');
            setShowErrorModal(true);
        }
    };

    const handleAddWinner = async () => {
        if (!newWinnerName || !newWinnerPrize || !newWinnerPhotoUrl) {
            setErrorMessage('Preencha todos os campos do ganhador');
            setShowErrorModal(true);
            return;
        }

        const newPhoto = await addWinnerPhoto({
            name: newWinnerName,
            prize: newWinnerPrize,
            photo_url: newWinnerPhotoUrl,
            display_order: winnerPhotos.length,
        });

        if (newPhoto) {
            setNewWinnerName('');
            setNewWinnerPrize('');
            setNewWinnerPhotoUrl('');
            await loadData();
            setSuccessMessage('Foto de ganhador adicionada! ✅');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao adicionar foto. Tente novamente.');
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
                <button
                    onClick={onBack}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold transition-colors"
                >
                    ← Voltar
                </button>
            </div>

            {/* Raffle Configuration */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-100 space-y-6">
                <h3 className="text-xl font-black text-slate-900 mb-4">📝 Informações do Sorteio</h3>

                <div>
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
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                        >
                            <option value="active">🟢 Ativo</option>
                            <option value="scheduled">🟡 Agendado</option>
                            <option value="finished">🔴 Finalizado</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">URL da Imagem Principal</label>
                    <input
                        type="url"
                        value={mainImageUrl}
                        onChange={(e) => setMainImageUrl(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                        placeholder="https://images.unsplash.com/..."
                    />
                    {mainImageUrl && (
                        <div className="mt-3 rounded-xl overflow-hidden border-2 border-slate-200">
                            <img src={mainImageUrl} alt="Preview" className="w-full h-48 object-cover" />
                        </div>
                    )}
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                        <input
                            type="url"
                            value={newWinnerPhotoUrl}
                            onChange={(e) => setNewWinnerPhotoUrl(e.target.value)}
                            className="px-4 py-2 rounded-lg border-2 border-purple-200 focus:border-purple-600 focus:outline-none font-medium"
                            placeholder="URL da foto"
                        />
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
                                <img src={photo.photo_url} alt={photo.name} className="w-full h-48 object-cover" />
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
        </div>
    );
};

export default RaffleManager;
