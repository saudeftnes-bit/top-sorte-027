import React, { useState, useEffect } from 'react';
import { getReservationsByRaffle, confirmManualPayment, reactivateReservation, deleteReservation, getRaffleById, createManualReservation } from '../../lib/supabase-admin';
import type { Reservation, Raffle } from '../../types/database';
import ConfirmModal from '../ConfirmModal';
import ManualReservationModal from './ManualReservationModal';

interface UsersListProps {
    raffleId: string;
    onBack: () => void;
}

interface BuyerData {
    name: string;
    phone?: string;
    email?: string;
    numbers: string[];
    totalPaid: number;
    totalPending: number;
    reservations: Reservation[];
}

const UsersList: React.FC<UsersListProps> = ({ raffleId, onBack }) => {
    const [buyers, setBuyers] = useState<BuyerData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedBuyer, setExpandedBuyer] = useState<string | null>(null);
    const [displayLimit, setDisplayLimit] = useState(50);
    const [activeRaffle, setActiveRaffle] = useState<Raffle | null>(null);

    // Modal states
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showManualReservationModal, setShowManualReservationModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<{ id: string; type: 'confirm' | 'delete' | 'reactivate'; number: string } | null>(null);

    useEffect(() => {
        loadBuyers();
    }, [raffleId]);

    const loadBuyers = async () => {
        setIsLoading(true);
        const [reservations, raffle] = await Promise.all([
            getReservationsByRaffle(raffleId),
            getRaffleById(raffleId)
        ]);
        setActiveRaffle(raffle);

        // Group by buyer (using phone or email as unique identifier)
        const buyersMap = new Map<string, BuyerData>();

        reservations.forEach((reservation) => {
            const key = reservation.buyer_phone || reservation.buyer_email || reservation.buyer_name;

            if (!buyersMap.has(key)) {
                buyersMap.set(key, {
                    name: reservation.buyer_name,
                    phone: reservation.buyer_phone,
                    email: reservation.buyer_email,
                    numbers: [],
                    totalPaid: 0,
                    totalPending: 0,
                    reservations: [],
                });
            }

            const buyer = buyersMap.get(key)!;
            buyer.numbers.push(reservation.number);
            buyer.reservations.push(reservation);

            if (reservation.status === 'paid') {
                buyer.totalPaid += (reservation.payment_amount || 0);
            } else if (reservation.status === 'pending') {
                buyer.totalPending += (reservation.payment_amount || 0);
            }
        });

        const buyersArray = Array.from(buyersMap.values());
        buyersArray.sort((a, b) => (b.totalPaid + b.totalPending) - (a.totalPaid + a.totalPending));

        setBuyers(buyersArray);
        setIsLoading(false);
    };

    const handleAction = async () => {
        if (!pendingAction) return;

        let success = false;
        if (pendingAction.type === 'confirm') {
            success = await confirmManualPayment(pendingAction.id, activeRaffle?.price_per_number || 0);
        } else if (pendingAction.type === 'reactivate') {
            success = await reactivateReservation(pendingAction.id, activeRaffle?.selection_timeout || 5);
        } else if (pendingAction.type === 'delete') {
            success = await deleteReservation(pendingAction.id);
        }

        if (success) {
            await loadBuyers();
        }
        setShowConfirmModal(false);
        setShowDeleteModal(false);
        setPendingAction(null);
    };

    const handleManualReservation = async (data: {
        name: string;
        phone: string;
        email: string;
        paymentAmount: number;
        numbers: string[];
        status: 'paid' | 'pending'
    }) => {
        if (!activeRaffle) return false;

        const result = await createManualReservation(
            raffleId,
            data.name,
            data.phone,
            data.numbers,
            data.status,
            data.email,
            data.paymentAmount
        );

        if (result.success) {
            await loadBuyers();
            return true;
        } else {
            return false;
        }
    };

    const { allFilteredBuyers, visibleBuyers } = React.useMemo(() => {
        const searchLower = searchTerm.toLowerCase().trim();

        if (!searchLower) {
            return {
                allFilteredBuyers: buyers,
                visibleBuyers: buyers.slice(0, displayLimit)
            };
        }

        const filtered = buyers.filter((buyer) => {
            // Check direct contact fields
            const matchesContact =
                buyer.name.toLowerCase().includes(searchLower) ||
                buyer.phone?.includes(searchLower) ||
                buyer.email?.toLowerCase().includes(searchLower);

            // Check specific numbers
            // We only match if the number EXACTLY starts with or equals the search term 
            // to avoid returning "10" for "1" if there are thousands of numbers.
            const matchesNumbers = buyer.numbers.some(num =>
                num === searchLower || num.startsWith(searchLower)
            );

            return matchesContact || matchesNumbers;
        });

        return {
            allFilteredBuyers: filtered,
            visibleBuyers: filtered.slice(0, displayLimit)
        };
    }, [buyers, searchTerm, displayLimit]);

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
                    <h2 className="text-2xl font-black text-slate-900">👥 Usuários Compradores</h2>
                    <p className="text-slate-500 font-medium mt-1">Total de {buyers.length} compradores</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowManualReservationModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-purple-200 active:scale-95 flex items-center gap-2"
                    >
                        <span>📝</span> Nova Reserva Manual
                    </button>
                    <button
                        onClick={onBack}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold transition-colors"
                    >
                        ← Voltar
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, telefone, email ou número da cota..."
                    className="w-full px-5 py-4 pl-12 rounded-2xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-medium"
                />
                <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-sm font-bold opacity-90 mb-1">Total de Compradores</p>
                    <p className="text-4xl font-black">{buyers.length}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-sm font-bold opacity-90 mb-1">Números Vendidos</p>
                    <p className="text-4xl font-black">
                        {buyers.reduce((sum, b) => sum + b.reservations.filter(r => r.status === 'paid').length, 0)}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
                    <p className="text-sm font-bold opacity-90 mb-1">Receita Total</p>
                    <p className="text-4xl font-black">
                        R$ {buyers.reduce((sum, b) => sum + b.totalPaid, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Buyers List */}
            <div className="space-y-4">
                {visibleBuyers.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-slate-100">
                        <p className="text-4xl mb-4">🔍</p>
                        <p className="text-lg font-bold text-slate-400">
                            {searchTerm ? 'Nenhum comprador encontrado' : 'Nenhum comprador ainda'}
                        </p>
                    </div>
                ) : (
                    visibleBuyers.map((buyer, index) => {
                        const key = buyer.phone || buyer.email || buyer.name;
                        return (
                            <div
                                key={index}
                                className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-100 hover:border-purple-200 transition-all"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                                                <span className="text-2xl">👤</span>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900">{buyer.name}</h3>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {buyer.phone && (
                                                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                            📱 {buyer.phone}
                                                        </span>
                                                    )}
                                                    {buyer.email && (
                                                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                                            📧 {buyer.email}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="bg-purple-50 rounded-xl p-4">
                                                <p className="text-xs font-bold text-purple-600 uppercase mb-1">Números</p>
                                                <p className="text-lg font-black text-purple-900">{buyer.numbers.join(', ')}</p>
                                                <p className="text-xs text-purple-600 mt-1">{buyer.numbers.length} número(s)</p>
                                            </div>

                                            <div className="bg-green-50 rounded-xl p-4">
                                                <p className="text-xs font-bold text-green-600 uppercase mb-1">Total Pago</p>
                                                <p className="text-lg font-black text-green-900">
                                                    R$ {buyer.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-xs text-green-600 mt-1">
                                                    {buyer.reservations.filter(r => r.status === 'paid').length} confirmado(s)
                                                </p>
                                            </div>

                                            <div className="bg-yellow-50 rounded-xl p-4">
                                                <p className="text-xs font-bold text-yellow-600 uppercase mb-1">Pendente</p>
                                                <p className="text-lg font-black text-yellow-900">
                                                    R$ {buyer.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                <p className="text-xs text-yellow-600 mt-1">
                                                    {buyer.reservations.filter(r => r.status === 'pending').length} aguardando
                                                </p>
                                            </div>

                                            <div className="bg-blue-50 rounded-xl p-4">
                                                <p className="text-xs font-bold text-blue-600 uppercase mb-1">Status</p>
                                                <p className="text-lg font-black text-blue-900">
                                                    {buyer.totalPending > 0 ? '🟡 Pendente' : '✅ Ativo'}
                                                </p>
                                                <p className="text-xs text-blue-600 mt-1">
                                                    {buyer.reservations.length} reserva(s)
                                                </p>
                                            </div>
                                        </div>

                                        {/* Expandable Details Section */}
                                        <div className="mt-4 border-t border-slate-100 pt-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Detalhamento por Número</h4>
                                                <button
                                                    onClick={() => setExpandedBuyer(expandedBuyer === key ? null : key)}
                                                    className="text-xs font-bold text-purple-600 hover:text-purple-700 underline"
                                                >
                                                    {expandedBuyer === key ? 'Ocultar Detalhes' : 'Gerenciar Números'}
                                                </button>
                                            </div>

                                            {expandedBuyer === key && (
                                                <div className="space-y-2">
                                                    {buyer.reservations.sort((a, b) => a.number.localeCompare(b.number)).map((res) => (
                                                        <div key={res.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                                                            <div className="flex items-center gap-4">
                                                                <span className="w-12 h-12 flex items-center justify-center bg-white rounded-lg border-2 border-slate-200 font-black text-slate-700">
                                                                    {res.number}
                                                                </span>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-black text-slate-800">
                                                                            R$ {(res.payment_amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </p>
                                                                        {res.status === 'paid' ? (
                                                                            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase">Pago</span>
                                                                        ) : res.status === 'pending' ? (
                                                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">Pendente</span>
                                                                        ) : (
                                                                            <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">Cancelado</span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-[10px] text-slate-400 font-medium">{new Date(res.created_at).toLocaleString()}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex gap-1">
                                                                {res.status !== 'paid' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setPendingAction({ id: res.id, type: 'confirm', number: res.number });
                                                                            setShowConfirmModal(true);
                                                                        }}
                                                                        className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg"
                                                                        title="Confirmar Pagamento e Ativar"
                                                                    >
                                                                        ✅
                                                                    </button>
                                                                )}
                                                                {res.status === 'cancelled' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setPendingAction({ id: res.id, type: 'reactivate', number: res.number });
                                                                            setShowConfirmModal(true);
                                                                        }}
                                                                        className="bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-lg"
                                                                        title="Reativar Reserva"
                                                                    >
                                                                        🎟️
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => {
                                                                        setPendingAction({ id: res.id, type: 'delete', number: res.number });
                                                                        setShowDeleteModal(true);
                                                                    }}
                                                                    className="bg-slate-200 hover:bg-red-100 hover:text-red-600 text-slate-500 p-2 rounded-lg"
                                                                    title="Excluir Permanentemente"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Load More Button */}
            {allFilteredBuyers.length > visibleBuyers.length && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => setDisplayLimit(prev => prev + 50)}
                        className="bg-white hover:bg-slate-50 text-purple-600 border-2 border-purple-200 px-8 py-3 rounded-2xl font-black shadow-md transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>⬇️ Carregar mais compradores...</span>
                        <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full">
                            {allFilteredBuyers.length - visibleBuyers.length} restantes
                        </span>
                    </button>
                </div>
            )}

            <ConfirmModal
                isOpen={showDeleteModal}
                title="Excluir Reserva"
                message={`Tem certeza que deseja EXCLUIR permanentemente o registro do número ${pendingAction?.number}? Esta ação não pode ser desfeita.`}
                confirmLabel="Sim, Excluir"
                cancelLabel="Cancelar"
                variant="danger"
                onConfirm={handleAction}
                onCancel={() => { setShowDeleteModal(false); setPendingAction(null); }}
            />

            <ManualReservationModal
                isOpen={showManualReservationModal}
                onClose={() => setShowManualReservationModal(false)}
                onConfirm={handleManualReservation}
            />
        </div>
    );
};

export default UsersList;
