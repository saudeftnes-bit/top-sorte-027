import React, { useState, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { Raffle } from '../../types/database';
import { getPublicRaffles, updateRaffle, deleteRaffle } from '../../lib/supabase-admin';
import { supabase } from '../../lib/supabase';

interface RaffleListProps {
    onSelectRaffle?: (raffle: Raffle) => void;
    onManageRaffle: (raffle: Raffle) => void;
    onEditRaffle: (raffle: Raffle) => void;
    onCreateNew?: () => void;
    onCreateRaffle?: () => void;
    onBack?: () => void;
    hasActiveRaffle?: boolean;
    onRefresh?: () => void;
}

const RaffleList: React.FC<RaffleListProps> = ({
    onManageRaffle,
    onEditRaffle,
    onCreateNew,
    onCreateRaffle,
    onRefresh,
}) => {
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [isLoadingRaffles, setIsLoadingRaffles] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'finished'>('all');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    // Map raffleId -> count of sold/reserved tickets
    const [raffleCounts, setRaffleCounts] = useState<Record<string, number>>({});

    const loadRaffles = async () => {
        setIsLoadingRaffles(true);
        const data = await getPublicRaffles();
        setRaffles(data || []);

        // Buscar contagem de reservas (paid + pending) para todas as rifas em uma query só
        if (data && data.length > 0) {
            const ids = data.map(r => r.id);
            const { data: counts } = await supabase
                .from('reservations')
                .select('raffle_id')
                .in('raffle_id', ids)
                .in('status', ['paid', 'pending']);

            const countsMap: Record<string, number> = {};
            (counts || []).forEach((res: any) => {
                countsMap[res.raffle_id] = (countsMap[res.raffle_id] || 0) + 1;
            });
            setRaffleCounts(countsMap);
        }

        setIsLoadingRaffles(false);
    };

    useEffect(() => {
        loadRaffles();
    }, []);

    const filteredRaffles = (raffles || []).filter(r => {
        if (filter === 'all') return true;
        return r.status === filter;
    });

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteId(id);
        setShowDeleteModal(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteId) return;
        setIsDeleting(true);
        const res = await deleteRaffle(deleteId);
        setIsDeleting(false);
        setShowDeleteModal(false);
        setDeleteId(null);
        if (res.success) {
            loadRaffles();
            onRefresh?.();
        } else {
            alert('Erro ao excluir rifa: ' + res.error);
        }
    };

    const toggleStatus = async (raffle: Raffle, e: React.MouseEvent) => {
        e.stopPropagation();
        const nextStatus = raffle.status === 'active' ? 'paused' : 'active';
        await updateRaffle(raffle.id, { status: nextStatus });
        loadRaffles();
        onRefresh?.();
    };

    const handleCreateNew = () => {
        if (onCreateNew) onCreateNew();
        else if (onCreateRaffle) onCreateRaffle();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">🎯 Gerenciar Rifas e Brindes</h2>
                    <p className="text-sm text-slate-500 font-medium mt-1">Crie, edite e acompanhe seus sorteios</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-sm shadow-lg shadow-purple-600/30 transition-all active:scale-95 flex items-center gap-2"
                >
                    <span>✨</span> Nova Rifa / Brinde
                </button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
                {(['all', 'active', 'scheduled', 'finished'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setFilter(tab)}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                            filter === tab
                                ? 'bg-slate-900 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        {tab === 'all' ? 'Todas' : tab === 'active' ? 'Ativas' : tab === 'scheduled' ? 'Agendadas' : 'Finalizadas'}
                    </button>
                ))}
            </div>

            {/* Lista de Rifas */}
            <div className="grid grid-cols-1 gap-4">
                {isLoadingRaffles ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-400 border-t-transparent mx-auto mb-3"></div>
                        <p className="text-slate-400 font-bold">Carregando rifas...</p>
                    </div>
                ) : filteredRaffles.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                        <p className="text-slate-400 font-bold">Nenhum sorteio encontrado nesta categoria.</p>
                    </div>
                ) : (
                    filteredRaffles.map(raffle => {
                        const total = raffle.total_numbers || 0;
                        const sold = raffleCounts[raffle.id] || 0;
                        const remaining = Math.max(0, total - sold);
                        const isClosed = total > 0 && remaining === 0;
                        const progressPct = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;

                        return (
                            <div
                                key={raffle.id}
                                onClick={() => onManageRaffle(raffle)}
                                className="bg-white rounded-2xl p-6 shadow-md border border-slate-100 hover:border-cyan-200 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
                            >
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                                            {raffle.main_image_url ? (
                                                <img src={raffle.main_image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-2xl">
                                                    {raffle.raffle_type === 'brinde' ? '🎁' : '🎟️'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="bg-slate-100 text-slate-600 text-xs font-black px-2 py-1 rounded-md">
                                                    #{raffle.code || '----'}
                                                </span>
                                                {raffle.raffle_type === 'brinde' && (
                                                    <span className="text-xs font-black px-2 py-1 rounded-md uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        🎁 Brinde
                                                    </span>
                                                )}
                                                <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${
                                                    raffle.status === 'active' ? 'bg-green-100 text-green-700' :
                                                    raffle.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' :
                                                    raffle.status === 'paused' ? 'bg-red-100 text-red-700' :
                                                    'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {raffle.status === 'active' ? 'Ativa' :
                                                     raffle.status === 'scheduled' ? 'Agendada' :
                                                     raffle.status === 'paused' ? 'Pausada' : 'Finalizada'}
                                                </span>
                                                {/* Badge Rifa Fechada */}
                                                {isClosed && (
                                                    <span className="text-xs font-black px-2 py-1 rounded-md uppercase bg-red-600 text-white animate-pulse">
                                                        🔴 RIFA FECHADA
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-black text-slate-900 group-hover:text-cyan-600 transition-colors">
                                                {raffle.title}
                                            </h3>
                                            <p className="text-sm text-slate-500 font-medium">
                                                {new Date(raffle.created_at).toLocaleDateString('pt-BR')} •{' '}
                                                {raffle.raffle_type === 'brinde' ? (
                                                    <span className="text-emerald-600 font-black">
                                                        GRÁTIS (máx. {raffle.max_numbers_per_participant || 2} { (raffle.max_numbers_per_participant || 2) === 1 ? 'cota' : 'cotas' })
                                                    </span>
                                                ) : (
                                                    <span>
                                                        R$ {(raffle.price_per_number || 0).toFixed(2)} • (máx. {raffle.max_numbers_per_participant || 2} { (raffle.max_numbers_per_participant || 2) === 1 ? 'cota' : 'cotas' })
                                                    </span>
                                                )}
                                            </p>

                                            {/* Contador de Cotas Restantes */}
                                            {total > 0 && (
                                                <div className="mt-3" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                            Cotas vendidas/reservadas
                                                        </span>
                                                        {isClosed ? (
                                                            <span className="text-[11px] font-black text-red-600 uppercase tracking-wider">
                                                                Esgotada!
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] font-black text-slate-700">
                                                                <span className="text-cyan-600">{remaining}</span> restantes de {total}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${
                                                                isClosed
                                                                    ? 'bg-red-500'
                                                                    : progressPct >= 75
                                                                    ? 'bg-orange-400'
                                                                    : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                                                            }`}
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 mt-1 font-medium">
                                                        {sold} de {total} cotas ocupadas ({progressPct}%)
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                                        <button
                                            onClick={(e) => toggleStatus(raffle, e)}
                                            disabled={isClosed}
                                            className={`flex-1 md:flex-none px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                                isClosed
                                                    ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                            }`}
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
                                            🗑️ Excluir
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <ConfirmModal
                isOpen={showDeleteModal}
                title="Deletar Rifa / Brinde"
                message="Tem certeza que deseja excluir? Esta ação não pode ser desfeita e todas as reservas serão apagadas."
                confirmLabel={isDeleting ? "Excluindo..." : "Sim, Excluir"}
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteModal(false)}
            />
        </div>
    );
};

export default RaffleList;
