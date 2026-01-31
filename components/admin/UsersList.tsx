import React, { useState, useEffect } from 'react';
import { getReservationsByRaffle } from '../../lib/supabase-admin';
import type { Reservation } from '../../types/database';

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

    useEffect(() => {
        loadBuyers();
    }, [raffleId]);

    const loadBuyers = async () => {
        const reservations = await getReservationsByRaffle(raffleId);

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
                buyer.totalPaid += reservation.payment_amount;
            } else if (reservation.status === 'pending') {
                buyer.totalPending += reservation.payment_amount;
            }
        });

        const buyersArray = Array.from(buyersMap.values());
        buyersArray.sort((a, b) => (b.totalPaid + b.totalPending) - (a.totalPaid + a.totalPending));

        setBuyers(buyersArray);
        setIsLoading(false);
    };

    const filteredBuyers = buyers.filter((buyer) =>
        buyer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        buyer.phone?.includes(searchTerm) ||
        buyer.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <button
                    onClick={onBack}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold transition-colors"
                >
                    ← Voltar
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nome, telefone ou email..."
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
                {filteredBuyers.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border-2 border-slate-100">
                        <p className="text-4xl mb-4">🔍</p>
                        <p className="text-lg font-bold text-slate-400">
                            {searchTerm ? 'Nenhum comprador encontrado' : 'Nenhum comprador ainda'}
                        </p>
                    </div>
                ) : (
                    filteredBuyers.map((buyer, index) => (
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
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default UsersList;
