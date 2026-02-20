import React, { useState, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { getReservationsByRaffle, updateReservationStatus } from '../../lib/supabase-admin';
import { subscribeToReservations } from '../../lib/supabase-admin';
import type { Reservation } from '../../types/database';

interface PaymentManagerProps {
    raffleId: string;
    onBack: () => void;
    onDataChanged?: () => void;
}

const PaymentManager: React.FC<PaymentManagerProps> = ({ raffleId, onBack, onDataChanged }) => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [displayLimit, setDisplayLimit] = useState(50);

    // Modal state
    const [showConfirmPaymentModal, setShowConfirmPaymentModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [pendingActionIds, setPendingActionIds] = useState<string[]>([]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        loadReservations();

        // Subscribe to real-time updates
        const subscription = subscribeToReservations(raffleId, (payload) => {
            console.log('Real-time update:', payload);
            loadReservations();
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [raffleId]);

    const loadReservations = async () => {
        const data = await getReservationsByRaffle(raffleId);
        setReservations(data);
        setIsLoading(false);
    };

    const handleConfirmPayment = async (ids: string[]) => {
        setPendingActionIds(ids);
        setShowConfirmPaymentModal(true);
    };

    const confirmPayment = async () => {
        if (!pendingActionIds || pendingActionIds.length === 0) return;

        let allSuccess = true;
        for (const id of pendingActionIds) {
            const success = await updateReservationStatus(id, 'paid');
            if (!success) allSuccess = false;
        }

        setShowConfirmPaymentModal(false);
        setPendingActionIds([]);

        if (allSuccess) {
            await loadReservations();
            setSelectedReservation(null);
            setSuccessMessage('Pagamento(s) confirmado(s) com sucesso! ✅');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Ocorreu um erro ao confirmar alguns pagamentos. Verifique a lista.');
            setShowErrorModal(true);
        }
    };

    const handleCancelReservation = async (ids: string[]) => {
        setPendingActionIds(ids);
        setShowCancelModal(true);
    };

    const confirmCancelReservation = async () => {
        if (!pendingActionIds || pendingActionIds.length === 0) return;

        let allSuccess = true;
        for (const id of pendingActionIds) {
            const success = await updateReservationStatus(id, 'cancelled');
            if (!success) allSuccess = false;
        }

        setShowCancelModal(false);
        setPendingActionIds([]);

        if (allSuccess) {
            await loadReservations();
            setSelectedReservation(null);
            setSuccessMessage('Reserva(s) cancelada(s) com sucesso!');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Ocorreu um erro ao cancelar algumas reservas.');
            setShowErrorModal(true);
        }
    };

    // Lógica de agrupamento
    const groupedReservations = React.useMemo(() => {
        const filtered = reservations.filter((r) => {
            if (filter === 'all') return r.status !== 'cancelled';
            return r.status === filter;
        });

        // Agrupar por nome + telefone + txid
        const groups: Record<string, {
            id: string; // ID da primeira reserva para referência
            ids: string[]; // Todos os IDs do grupo
            buyer_name: string;
            buyer_phone: string;
            buyer_email: string;
            numbers: string[];
            status: string;
            payment_method: string;
            efi_txid?: string;
            efi_status?: string;
            payment_amount: number;
            created_at: string;
        }> = {};

        filtered.forEach(res => {
            const key = `${res.buyer_name}-${res.buyer_phone}-${res.efi_txid || 'manual'}`;
            if (!groups[key]) {
                groups[key] = {
                    id: res.id,
                    ids: [res.id],
                    buyer_name: res.buyer_name,
                    buyer_phone: res.buyer_phone || '',
                    buyer_email: res.buyer_email || '',
                    numbers: [res.number],
                    status: res.status,
                    payment_method: res.payment_method || 'manual',
                    efi_txid: res.efi_txid,
                    efi_status: res.efi_status,
                    payment_amount: res.payment_amount,
                    created_at: res.created_at
                };
            } else {
                groups[key].ids.push(res.id);
                groups[key].numbers.push(res.number);
                groups[key].payment_amount += res.payment_amount;
                // Manter o status mais "recente" ou mais importante
                if (res.status === 'paid') groups[key].status = 'paid';
            }
        });

        // Ordenar por data
        const sorted = Object.values(groups).sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return {
            allGroups: sorted,
            visibleGroups: sorted.slice(0, displayLimit)
        };
    }, [reservations, filter, displayLimit]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-black">✅ PAGO</span>;
            case 'pending':
                return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-black animate-pulse">🟡 PENDENTE</span>;
            case 'cancelled':
                return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black">❌ CANCELADO</span>;
            default:
                return null;
        }
    };

    const getPaymentMethodBadge = (method?: string) => {
        if (method === 'efi') {
            return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-black">🤖 EFI</span>;
        }
        return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-black">👤 MANUAL</span>;
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
                    <h2 className="text-2xl font-black text-slate-900">💳 Gerenciamento de Pagamentos</h2>
                    <p className="text-slate-500 font-medium mt-1">{groupedReservations.allGroups.length} grupos de compras encontrados</p>
                </div>
                <button
                    onClick={onBack}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold transition-colors"
                >
                    ← Voltar
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === 'all'
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-purple-300'
                        }`}
                >
                    📋 Todos
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === 'pending'
                        ? 'bg-yellow-500 text-white shadow-lg'
                        : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-yellow-300'
                        }`}
                >
                    🟡 Pendentes
                </button>
                <button
                    onClick={() => setFilter('paid')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === 'paid'
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-green-300'
                        }`}
                >
                    ✅ Pagos
                </button>
            </div>

            {/* Reservations List */}
            <div className="space-y-4">
                {groupedReservations.visibleGroups.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-slate-100">
                        <p className="text-4xl mb-4">📭</p>
                        <p className="text-lg font-bold text-slate-400">Nenhuma reserva encontrada</p>
                    </div>
                ) : (
                    groupedReservations.visibleGroups.map((group) => (
                        <div
                            key={group.id}
                            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-100 hover:border-purple-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                            <span className="text-lg">🎟️</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">{group.buyer_name}</h3>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {new Date(group.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Números Selecionados */}
                                    <div className="mb-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Números Escolhidos:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {group.numbers.sort().map(num => (
                                                <span key={num} className="bg-purple-50 text-purple-700 border border-purple-100 font-black px-2.5 py-1 rounded-lg text-sm">
                                                    {num}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                        {group.buyer_phone && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">📱</span>
                                                <span className="text-sm font-medium text-slate-600">{group.buyer_phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">💰</span>
                                            <span className="text-sm font-bold text-green-600">
                                                R$ {group.payment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        {getStatusBadge(group.status)}
                                        {getPaymentMethodBadge(group.payment_method)}
                                    </div>

                                    {/* Informações Efi */}
                                    {group.payment_method === 'efi' && group.efi_txid && (
                                        <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                            <p className="text-xs font-bold text-blue-700 mb-1">📝 Detalhes Efi:</p>
                                            <div className="space-y-1">
                                                <p className="text-xs text-blue-600 truncate">
                                                    <span className="font-bold">TXID:</span> {group.efi_txid}
                                                </p>
                                                {group.efi_status && (
                                                    <p className="text-xs text-blue-600">
                                                        <span className="font-bold">Status Efi:</span> {group.efi_status}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {group.status === 'pending' && (
                                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleConfirmPayment(group.ids)}
                                            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                                        >
                                            ✅ Confirmar Tudo
                                        </button>
                                        <button
                                            onClick={() => handleCancelReservation(group.ids)}
                                            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                                        >
                                            ❌ Cancelar Tudo
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Load More Button */}
            {groupedReservations.allGroups.length > groupedReservations.visibleGroups.length && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={() => setDisplayLimit(prev => prev + 50)}
                        className="bg-white hover:bg-slate-50 text-purple-600 border-2 border-purple-200 px-8 py-3 rounded-2xl font-black shadow-md transition-all active:scale-95 flex items-center gap-2"
                    >
                        <span>⬇️ Carregar mais pagamentos...</span>
                        <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full">
                            {groupedReservations.allGroups.length - groupedReservations.visibleGroups.length} restantes
                        </span>
                    </button>
                </div>
            )}

            {/* Modals */}
            <ConfirmModal
                isOpen={showConfirmPaymentModal}
                title="Confirmar Pagamento"
                message="Tem certeza que deseja confirmar o pagamento desta reserva?"
                confirmLabel="Confirmar"
                cancelLabel="Cancelar"
                variant="info"
                onConfirm={confirmPayment}
                onCancel={() => {
                    setShowConfirmPaymentModal(false);
                    setPendingActionIds([]);
                }}
            />

            <ConfirmModal
                isOpen={showCancelModal}
                title="Cancelar Reserva"
                message="Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita."
                confirmLabel="Cancelar Reserva"
                cancelLabel="Não cancelar"
                variant="danger"
                onConfirm={confirmCancelReservation}
                onCancel={() => {
                    setShowCancelModal(false);
                    setPendingActionIds([]);
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

export default PaymentManager;
