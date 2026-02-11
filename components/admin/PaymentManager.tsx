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

    // Modal state
    const [showConfirmPaymentModal, setShowConfirmPaymentModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
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

    const handleConfirmPayment = async (id: string) => {
        setPendingActionId(id);
        setShowConfirmPaymentModal(true);
    };

    const confirmPayment = async () => {
        if (!pendingActionId) return;

        const success = await updateReservationStatus(pendingActionId, 'paid');
        setShowConfirmPaymentModal(false);
        setPendingActionId(null);

        if (success) {
            await loadReservations();
            setSelectedReservation(null);
            setSuccessMessage('Pagamento confirmado com sucesso! ✅');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao confirmar pagamento. Tente novamente.');
            setShowErrorModal(true);
        }
    };

    const handleCancelReservation = async (id: string) => {
        setPendingActionId(id);
        setShowCancelModal(true);
    };

    const confirmCancelReservation = async () => {
        if (!pendingActionId) return;

        const success = await updateReservationStatus(pendingActionId, 'cancelled');
        setShowCancelModal(false);
        setPendingActionId(null);

        if (success) {
            await loadReservations();
            setSelectedReservation(null);
            setSuccessMessage('Reserva cancelada com sucesso!');
            setShowSuccessModal(true);
            onDataChanged?.();
        } else {
            setErrorMessage('Erro ao cancelar reserva. Tente novamente.');
            setShowErrorModal(true);
        }
    };

    const filteredReservations = reservations.filter((r) => {
        if (filter === 'all') return r.status !== 'cancelled';
        return r.status === filter;
    });

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
                    <p className="text-slate-500 font-medium mt-1">{filteredReservations.length} reservas encontradas</p>
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
                    🟡 Pendentes ({reservations.filter(r => r.status === 'pending').length})
                </button>
                <button
                    onClick={() => setFilter('paid')}
                    className={`px-4 py-2 rounded-xl font-bold transition-all ${filter === 'paid'
                        ? 'bg-green-500 text-white shadow-lg'
                        : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-green-300'
                        }`}
                >
                    ✅ Pagos ({reservations.filter(r => r.status === 'paid').length})
                </button>
            </div>

            {/* Reservations List */}
            <div className="space-y-3">
                {filteredReservations.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-slate-100">
                        <p className="text-4xl mb-4">📭</p>
                        <p className="text-lg font-bold text-slate-400">Nenhuma reserva encontrada</p>
                    </div>
                ) : (
                    filteredReservations.map((reservation) => (
                        <div
                            key={reservation.id}
                            className="bg-white rounded-2xl p-6 shadow-lg border-2 border-slate-100 hover:border-purple-200 transition-all"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                            <span className="text-lg font-black text-purple-600">#{reservation.number}</span>
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-900">{reservation.buyer_name}</h3>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {new Date(reservation.created_at).toLocaleDateString('pt-BR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                        {reservation.buyer_phone && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">📱</span>
                                                <span className="text-sm font-medium text-slate-600">{reservation.buyer_phone}</span>
                                            </div>
                                        )}
                                        {reservation.buyer_email && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-400">📧</span>
                                                <span className="text-sm font-medium text-slate-600">{reservation.buyer_email}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400">💰</span>
                                            <span className="text-sm font-bold text-green-600">
                                                R$ {reservation.payment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        {getStatusBadge(reservation.status)}
                                        {getPaymentMethodBadge(reservation.payment_method)}
                                    </div>

                                    {/* Informações Efi */}
                                    {reservation.payment_method === 'efi' && reservation.efi_txid && (
                                        <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                            <p className="text-xs font-bold text-blue-700 mb-1">📝 Detalhes Efi:</p>
                                            <div className="space-y-1">
                                                <p className="text-xs text-blue-600">
                                                    <span className="font-bold">TXID:</span> {reservation.efi_txid.substring(0, 20)}...
                                                </p>
                                                {reservation.efi_status && (
                                                    <p className="text-xs text-blue-600">
                                                        <span className="font-bold">Status Efi:</span> {reservation.efi_status}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {reservation.status === 'pending' && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handleConfirmPayment(reservation.id)}
                                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap"
                                        >
                                            ✅ Confirmar
                                        </button>
                                        <button
                                            onClick={() => handleCancelReservation(reservation.id)}
                                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all active:scale-95 whitespace-nowrap"
                                        >
                                            ❌ Cancelar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

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
                    setPendingActionId(null);
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
                    setPendingActionId(null);
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
