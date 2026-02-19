import React, { useState, useEffect } from 'react';
import { getAllRaffles, deleteRaffle, updateRaffle } from '../../lib/supabase-admin';
import type { Raffle } from '../../types/database';
import ConfirmModal from '../ConfirmModal';

interface RaffleListProps {
    onEditRaffle: (raffle: Raffle) => void;
    onCreateRaffle: () => void;
    onManageRaffle: (raffle: Raffle) => void;
    onBack: () => void;
    hasActiveRaffle: boolean;
}

const RaffleList: React.FC<RaffleListProps> = ({ onEditRaffle, onCreateRaffle, onManageRaffle, onBack, hasActiveRaffle }) => {
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        loadRaffles();
    }, []);

    const loadRaffles = async () => {
        setIsLoading(true);
        const data = await getAllRaffles();
        setRaffles(data);
        setIsLoading(false);
    };

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deleteId) return;

        await deleteRaffle(deleteId);
        await loadRaffles();
        setShowDeleteModal(false);
        setDeleteId(null);
    };

    const toggleStatus = async (raffle: Raffle, e: React.MouseEvent) => {
        e.stopPropagation();
        const newStatus = raffle.status === 'active' ? 'finished' : 'active';
        await updateRaffle(raffle.id, { status: newStatus });
        await loadRaffles();
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {hasActiveRaffle && (
                        <button
                            onClick={onBack}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-xl transition-colors"
                            title="Voltar ao Dashboard"
                        >
                            ⬅️
                        </button>
                    )}
                    <div>
                        <h2 className="text-2xl font-black text-slate-900">📚 Minhas Rifas</h2>
                        <p className="text-slate-500 font-medium">Gerencie seus sorteios</p>
                    </div>
                </div>
                <button
                    onClick={onCreateRaffle}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
                >
                    <span>➕</span> Nova Rifa
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {raffles.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-slate-300">
                        <p className="text-4xl mb-4">🎫</p>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Nenhuma rifa encontrada</h3>
                        <p className="text-slate-500 mb-6">Crie seu primeiro sorteio para começar!</p>
                        <button
                            onClick={onCreateRaffle}
                            className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-6 py-2 rounded-xl font-bold transition-colors"
                        >
                            Criar Agora
                        </button>
                    </div>
                ) : (
                    raffles.map((raffle) => (
                        <div
                            key={raffle.id}
                            onClick={() => onManageRaffle(raffle)}
                            className="bg-white rounded-2xl p-6 shadow-md border-2 border-slate-100 hover:border-purple-200 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                        >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                                        {raffle.main_image_url ? (
                                            <img src={raffle.main_image_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-2xl">🎟️</div>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-slate-100 text-slate-600 text-xs font-black px-2 py-1 rounded-md">
                                                #{raffle.code || '----'}
                                            </span>
                                            <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${raffle.status === 'active' ? 'bg-green-100 text-green-700' :
                                                raffle.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {raffle.status === 'active' ? 'Ativa' :
                                                    raffle.status === 'scheduled' ? 'Agendada' : 'Finalizada'}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-black text-slate-900 group-hover:text-purple-600 transition-colors">
                                            {raffle.title}
                                        </h3>
                                        <p className="text-sm text-slate-500">
                                            {new Date(raffle.created_at).toLocaleDateString('pt-BR')} •
                                            R$ {raffle.price_per_number.toFixed(2)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                                    <button
                                        onClick={(e) => toggleStatus(raffle, e)}
                                        className="flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700"
                                    >
                                        {raffle.status === 'active' ? '⏸️ Pausar' : '▶️ Ativar'}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEditRaffle(raffle); }}
                                        className="flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-sm bg-blue-50 hover:bg-blue-100 text-blue-600"
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteClick(raffle.id, e)}
                                        className="flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-sm bg-red-50 hover:bg-red-100 text-red-600"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <ConfirmModal
                isOpen={showDeleteModal}
                title="Deletar Rifa"
                message="Tem certeza que deseja deletar esta rifa? Todos os dados associados (reservas, fotos) serão perdidos. Esta ação não pode ser desfeita."
                confirmLabel="Deletar"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
};

export default RaffleList;
