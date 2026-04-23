import React, { useState, useEffect } from 'react';
import { getAllRaffles, deleteRaffle, updateRaffle, getRaffleAnalytics, pruneOldRaffles } from '../../lib/supabase-admin';
import type { Raffle } from '../../types/database';
import ConfirmModal from '../ConfirmModal';

interface RaffleListProps {
    onEditRaffle: (raffle: Raffle) => void;
    onCreateRaffle: () => void;
    onManageRaffle: (raffle: Raffle) => void;
    onBack: () => void;
    hasActiveRaffle: boolean;
}

const statusConfig = {
    active:    { label: 'Ativa',     dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700 border-green-200',  border: 'border-l-green-500' },
    scheduled: { label: 'Agendada',  dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700 border-yellow-200', border: 'border-l-yellow-500' },
    paused:    { label: 'Pausada',   dot: 'bg-red-400',    badge: 'bg-red-100 text-red-700 border-red-200',        border: 'border-l-red-400' },
    finished:  { label: 'Finalizada',dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-600 border-slate-200',  border: 'border-l-slate-400' },
};

const RaffleList: React.FC<RaffleListProps> = ({ onEditRaffle, onCreateRaffle, onManageRaffle, onBack, hasActiveRaffle }) => {
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => { loadRaffles(); }, []);

    const loadRaffles = async () => {
        setIsLoading(true);
        await pruneOldRaffles(6);
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
        const nextStatus = raffle.status === 'active' ? 'paused' : 'active';
        if (nextStatus === 'active') {
            const allRaffles = await getAllRaffles();
            const otherActive = allRaffles.find(r => r.status === 'active' && r.id !== raffle.id);
            if (otherActive) {
                alert(`Já existe uma rifa ativa (${otherActive.title}). Encerre-a antes de ativar uma nova.`);
                return;
            }
        }
        await updateRaffle(raffle.id, { status: nextStatus });
        await loadRaffles();
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mx-auto mb-3"></div>
                    <p className="text-slate-500 text-sm font-medium">Carregando rifas...</p>
                </div>
            </div>
        );
    }

    const activeCount = raffles.filter(r => r.status === 'active').length;
    const totalRaffles = raffles.length;

    return (
        <div className="space-y-6">

            {/* ── HEADER HERO ── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-7 text-white shadow-2xl overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                    <div>
                        <h2 className="text-2xl font-black mb-1">🎫 Minhas Rifas</h2>
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-white/60 text-sm">{totalRaffles} sorteio{totalRaffles !== 1 ? 's' : ''} cadastrado{totalRaffles !== 1 ? 's' : ''}</span>
                            {activeCount > 0 && (
                                <span className="flex items-center gap-1.5 text-xs font-bold bg-green-500/20 text-green-300 border border-green-400/30 px-3 py-1 rounded-full">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                    {activeCount} ativa
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={async () => {
                            const allRaffles = await getAllRaffles();
                            if (allRaffles.some(r => r.status === 'active')) {
                                alert('Não é possível criar uma nova rifa enquanto houver uma em andamento.');
                            } else {
                                onCreateRaffle();
                            }
                        }}
                        className="bg-white text-purple-800 hover:bg-purple-50 px-6 py-3 rounded-xl font-black text-sm shadow-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                        Nova Rifa
                    </button>
                </div>
            </div>

            {/* ── RAFFLE CARDS ── */}
            <div className="grid grid-cols-1 gap-4">
                {raffles.length === 0 ? (
                    <div className="bg-white rounded-2xl p-14 text-center border-2 border-dashed border-slate-200 shadow-sm">
                        <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">🎫</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Nenhuma rifa encontrada</h3>
                        <p className="text-slate-400 mb-6 text-sm">Crie seu primeiro sorteio para começar a vender!</p>
                        <button
                            onClick={onCreateRaffle}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
                        >
                            + Criar minha primeira rifa
                        </button>
                    </div>
                ) : (
                    raffles.map((raffle) => {
                        const sc = statusConfig[raffle.status as keyof typeof statusConfig] || statusConfig.finished;
                        return (
                            <div
                                key={raffle.id}
                                onClick={() => onManageRaffle(raffle)}
                                className={`bg-white rounded-2xl shadow-md border border-slate-100 border-l-4 ${sc.border} hover:shadow-xl hover:border-l-purple-500 transition-all cursor-pointer group overflow-hidden`}
                            >
                                <div className="p-5">
                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                        {/* Image + Info */}
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200">
                                                {raffle.main_image_url ? (
                                                    <img src={raffle.main_image_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-2xl">🎟️</div>
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <span className="bg-slate-100 text-slate-600 text-xs font-black px-2 py-0.5 rounded-md border border-slate-200">
                                                        #{raffle.code || '----'}
                                                    </span>
                                                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${sc.badge}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${raffle.status === 'active' ? 'animate-pulse' : ''}`} />
                                                        {sc.label}
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-black text-slate-900 group-hover:text-purple-700 transition-colors truncate">
                                                    {raffle.title}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 font-medium">
                                                    <span>📅 {new Date(raffle.created_at).toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-green-600 font-black">R$ {raffle.price_per_number.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 w-full md:w-auto" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => toggleStatus(raffle, e)}
                                                className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-xs transition-all border ${raffle.status === 'active'
                                                    ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-200'
                                                    : 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'}`}
                                            >
                                                {raffle.status === 'active' ? '⏸ Pausar' : '▶ Ativar'}
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEditRaffle(raffle); }}
                                                className="flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-all"
                                            >
                                                ✏️ Editar
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteClick(raffle.id, e)}
                                                className="px-3 py-2 rounded-xl font-bold text-xs bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom hint */}
                                <div className="px-5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-xs text-slate-400 font-medium">Clique para gerenciar o dashboard →</span>
                                    <svg className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ConfirmModal
                isOpen={showDeleteModal}
                title="Deletar Rifa"
                message="Tem certeza que deseja deletar esta rifa? Todos os dados (reservas, fotos) serão perdidos. Esta ação não pode ser desfeita."
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
