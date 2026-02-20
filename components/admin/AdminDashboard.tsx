import React, { useState, useEffect, useCallback } from 'react';
import { getRaffleAnalytics } from '../../lib/supabase-admin';
import type { RaffleAnalytics, Raffle } from '../../types/database';

interface AdminDashboardProps {
    raffleId: string;
    raffle: Raffle;
    onNavigate: (section: 'raffle' | 'payments' | 'users') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ raffleId, raffle, onNavigate }) => {
    const [analytics, setAnalytics] = useState<RaffleAnalytics & { totalPossible: number }>({
        totalRevenue: 0,
        numbersSold: 0,
        numbersPending: 0,
        numbersAvailable: raffle.total_numbers || 10000,
        totalBuyers: 0,
        totalPossible: raffle.total_numbers || 10000
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadAnalytics = useCallback(async () => {
        if (!raffleId) return;
        console.log('[AdminDashboard] Loading analytics...');
        setIsRefreshing(true);
        const data = await getRaffleAnalytics(raffleId);
        setAnalytics({
            ...data,
            totalPossible: raffle.total_numbers || 10000
        });
        setIsLoading(false);
        setIsRefreshing(false);
        console.log('[AdminDashboard] Analytics loaded:', data);
    }, [raffleId]);

    useEffect(() => {
        console.log('[AdminDashboard] Setting up initial load and interval...');
        loadAnalytics();
        // Refresh every 30 seconds
        const interval = setInterval(loadAnalytics, 30000);
        return () => clearInterval(interval);
    }, [loadAnalytics]);

    // Listen for admin data updates
    useEffect(() => {
        console.log('[AdminDashboard] Setting up event listener for adminDataUpdated...');

        const handleAdminUpdate = () => {
            console.log('[AdminDashboard] Admin update event received, reloading analytics...');
            loadAnalytics();
        };

        window.addEventListener('adminDataUpdated', handleAdminUpdate);

        return () => {
            console.log('[AdminDashboard] Cleaning up event listener...');
            window.removeEventListener('adminDataUpdated', handleAdminUpdate);
        };
    }, [loadAnalytics]);

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
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-3xl p-8 text-white shadow-xl">
                <h1 className="text-3xl font-black mb-2">📊 Dashboard Admin</h1>
                <p className="text-purple-100 font-medium">Gestão completa do sorteio</p>
            </div>

            {/* Current Raffle Info Card */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 shadow-lg border-2 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🎯</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Sorteio Atual</h2>
                        <p className="text-xs text-slate-500 font-medium">Configurações cadastradas</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Título</p>
                        <p className="text-sm font-black text-slate-900">{raffle.title}</p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Preço por Número</p>
                        <p className="text-lg font-black text-green-600">
                            R$ {raffle.price_per_number.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Status</p>
                        <p className="text-sm font-black">
                            {raffle.status === 'active' && <span className="text-green-600">🟢 Ativo</span>}
                            {raffle.status === 'scheduled' && <span className="text-yellow-600">🟡 Agendado</span>}
                            {raffle.status === 'finished' && <span className="text-red-600">🔴 Finalizado</span>}
                        </p>
                    </div>
                </div>
                {raffle.description && (
                    <div className="mt-4 bg-white rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-bold text-slate-500 uppercase mb-1">Descrição</p>
                        <p className="text-sm text-slate-700">{raffle.description}</p>
                    </div>
                )}
            </div>

            {/* Analytics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Revenue */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-green-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <span className="text-2xl">💰</span>
                        </div>
                        <button
                            onClick={loadAnalytics}
                            disabled={isRefreshing}
                            className={`text-xs font-bold transition-colors ${isRefreshing
                                ? 'text-purple-600 animate-spin'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                            title={isRefreshing ? 'Atualizando...' : 'Atualizar dados'}
                        >
                            🔄 {isRefreshing ? '' : 'Atualizar'}
                        </button>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Arrecadado</p>
                    <p className="text-3xl font-black text-green-600">
                        R$ {analytics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                {/* Numbers Sold */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-purple-100">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                        <span className="text-2xl">🎯</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Números Vendidos</p>
                    <p className="text-3xl font-black text-purple-600">{analytics.numbersSold}</p>
                    <p className="text-xs text-slate-400 mt-1">de {analytics.totalPossible} números</p>
                </div>

                {/* Numbers Pending */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-yellow-100">
                    <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mb-3">
                        <span className="text-2xl">⏳</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Pendentes</p>
                    <p className="text-3xl font-black text-yellow-600">{analytics.numbersPending}</p>
                    <p className="text-xs text-slate-400 mt-1">aguardando pagamento</p>
                </div>

                {/* Numbers Available */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-blue-100">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                        <span className="text-2xl">✨</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Disponíveis</p>
                    <p className="text-3xl font-black text-blue-600">{analytics.numbersAvailable}</p>
                    <p className="text-xs text-slate-400 mt-1">prontos para venda</p>
                </div>

                {/* Total Buyers */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-orange-100">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                        <span className="text-2xl">👥</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Compradores</p>
                    <p className="text-3xl font-black text-orange-600">{analytics.totalBuyers}</p>
                    <p className="text-xs text-slate-400 mt-1">participantes únicos</p>
                </div>

                {/* Completion Rate */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-pink-100">
                    <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center mb-3">
                        <span className="text-2xl">📈</span>
                    </div>
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Progresso</p>
                    <p className="text-3xl font-black text-pink-600">
                        {Math.round((analytics.numbersSold / analytics.totalPossible) * 100)}%
                    </p>
                    <div className="w-full bg-pink-100 rounded-full h-2 mt-2">
                        <div
                            className="bg-pink-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${(analytics.numbersSold / analytics.totalPossible) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                    onClick={() => onNavigate('raffle')}
                    className="bg-white hover:bg-purple-50 border-2 border-purple-200 rounded-2xl p-6 transition-all active:scale-95 shadow-lg group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-purple-100 group-hover:bg-purple-200 rounded-xl flex items-center justify-center transition-colors">
                            <span className="text-3xl">🎯</span>
                        </div>
                        <div className="text-left">
                            <p className="text-lg font-black text-slate-900">Gerenciar Sorteio</p>
                            <p className="text-xs text-slate-500 font-medium">Editar textos, imagens e preços</p>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('payments')}
                    className="bg-white hover:bg-green-50 border-2 border-green-200 rounded-2xl p-6 transition-all active:scale-95 shadow-lg group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-green-100 group-hover:bg-green-200 rounded-xl flex items-center justify-center transition-colors">
                            <span className="text-3xl">💳</span>
                        </div>
                        <div className="text-left">
                            <p className="text-lg font-black text-slate-900">Pagamentos</p>
                            <p className="text-xs text-slate-500 font-medium">Confirmar e gerenciar reservas</p>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onNavigate('users')}
                    className="bg-white hover:bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 transition-all active:scale-95 shadow-lg group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-100 group-hover:bg-blue-200 rounded-xl flex items-center justify-center transition-colors">
                            <span className="text-3xl">👥</span>
                        </div>
                        <div className="text-left">
                            <p className="text-lg font-black text-slate-900">Usuários</p>
                            <p className="text-xs text-slate-500 font-medium">Lista de compradores</p>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );
};

export default AdminDashboard;
