import React, { useState, useEffect, useCallback } from 'react';
import { getRaffleAnalytics } from '../../lib/supabase-admin';
import type { RaffleAnalytics, Raffle } from '../../types/database';

interface AdminDashboardProps {
    raffleId: string;
    raffle: Raffle;
    onNavigate: (section: 'raffle' | 'payments' | 'users' | 'grid' | 'offlineViewer') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ raffleId, raffle, onNavigate }) => {
    const [analytics, setAnalytics] = useState<RaffleAnalytics & { totalPossible: number }>({
        totalRevenue: 0,
        numbersSold: 0,
        numbersPending: 0,
        numbersAvailable: raffle.total_numbers || 100,
        totalBuyers: 0,
        totalPossible: raffle.total_numbers || 100
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const [maintenanceMode, setMaintenanceModeState] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [isSavingMaintenance, setIsSavingMaintenance] = useState(false);

    const loadAnalytics = useCallback(async () => {
        if (!raffleId) return;
        setIsRefreshing(true);
        const data = await getRaffleAnalytics(raffleId);
        setAnalytics({
            ...data,
            totalPossible: raffle.total_numbers || 100
        });

        try {
            const { getReservationsByRaffle } = await import('../../lib/supabase-admin');
            await getReservationsByRaffle(raffleId);
        } catch (e) {
            console.error('[AdminDashboard] Erro na atualização silenciosa do cache', e);
        }

        setIsLoading(false);
        setIsRefreshing(false);
    }, [raffleId]);

    useEffect(() => {
        loadAnalytics();
        const interval = setInterval(loadAnalytics, 30000);
        return () => clearInterval(interval);
    }, [loadAnalytics]);

    useEffect(() => {
        const handleAdminUpdate = () => loadAnalytics();
        window.addEventListener('adminDataUpdated', handleAdminUpdate);
        return () => window.removeEventListener('adminDataUpdated', handleAdminUpdate);
    }, [loadAnalytics]);

    useEffect(() => {
        const loadMaintenance = async () => {
            try {
                const { checkMaintenanceMode } = await import('../../lib/supabase-admin');
                const maint = await checkMaintenanceMode();
                setMaintenanceModeState(maint.isMaintenance);
                setMaintenanceMessage(maint.message || '');
            } catch (e) { }
        };
        loadMaintenance();
    }, []);

    const handleToggleMaintenance = async () => {
        if (!confirm(`Deseja realmente ${maintenanceMode ? 'DESATIVAR' : 'ATIVAR'} o modo de manutenção?`)) return;
        setIsSavingMaintenance(true);
        try {
            const { setMaintenanceMode } = await import('../../lib/supabase-admin');
            const newMode = !maintenanceMode;
            const msgToSave = maintenanceMessage.trim() !== '' ? maintenanceMessage : 'Estamos passando por instabilidades. Voltaremos em instantes.';
            const success = await setMaintenanceMode(newMode, msgToSave);
            if (success) {
                setMaintenanceModeState(newMode);
                if (newMode && maintenanceMessage.trim() === '') setMaintenanceMessage(msgToSave);
                alert(`Modo manutenção ${newMode ? 'ATIVADO' : 'DESATIVADO'} com sucesso.`);
            } else {
                alert('Erro ao alterar modo de manutenção.');
            }
        } catch (e) {
            alert('Erro ao processar sua requisição.');
        } finally {
            setIsSavingMaintenance(false);
        }
    };

    const handleExportCSV = async () => {
        try {
            setIsRefreshing(true);
            const { getReservationsByRaffle } = await import('../../lib/supabase-admin');
            const reservations = await getReservationsByRaffle(raffleId);
            if (!reservations || reservations.length === 0) {
                alert('Não há dados para exportar.');
                setIsRefreshing(false);
                return;
            }
            let csvContent = "Nome do Comprador,Telefone,Email,Numeros,Status,Valor Pago,Data da Reserva\n";
            reservations.forEach(r => {
                const name = `"${r.buyer_name || ''}"`;
                const phone = `"${r.buyer_phone || ''}"`;
                const email = `"${r.buyer_email || ''}"`;
                const numbers = `"${r.number || ''}"`;
                const status = `"${r.status || ''}"`;
                const value = r.payment_amount ? `"${r.payment_amount.toString().replace('.', ',')}"` : '0';
                const date = `"${new Date(r.created_at).toLocaleDateString('pt-BR')}"`;
                csvContent += `${name},${phone},${email},${numbers},${status},${value},${date}\n`;
            });
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `compradores_rifa_${raffle.code || raffleId}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setIsRefreshing(false);
        } catch (error) {
            alert("Ocorreu um erro ao gerar o arquivo. Tente novamente.");
            setIsRefreshing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-14 w-14 border-4 border-purple-600 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-slate-500 font-medium">Carregando dados...</p>
                </div>
            </div>
        );
    }

    const progressPct = Math.min(Math.round((analytics.numbersSold / analytics.totalPossible) * 100), 100);

    return (
        <div className="space-y-5">

            {/* ── HERO HEADER ── */}
            <div className="relative bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 rounded-3xl p-7 text-white shadow-2xl overflow-hidden">
                {/* decorative circles */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600 rounded-full opacity-10 -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-52 h-52 bg-violet-500 rounded-full opacity-10 translate-y-1/3 -translate-x-1/3 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-sm">
                            <span className="text-3xl">📊</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black leading-tight">Dashboard Admin</h1>
                            <p className="text-purple-300 text-sm font-semibold truncate max-w-[220px]">{raffle.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-4 py-1.5 rounded-full text-xs font-black border backdrop-blur-sm ${raffle.status === 'active'
                            ? 'bg-green-500/20 border-green-400/40 text-green-300'
                            : raffle.status === 'scheduled'
                                ? 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300'
                                : 'bg-red-500/20 border-red-400/40 text-red-300'}`}>
                            {raffle.status === 'active' ? '🟢 Ativo' : raffle.status === 'scheduled' ? '🟡 Agendado' : '🔴 Finalizado'}
                        </span>
                        <button
                            onClick={loadAnalytics}
                            disabled={isRefreshing}
                            className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                        >
                            {isRefreshing ? '⏳ Atualizando...' : '🔄 Atualizar'}
                        </button>
                    </div>
                </div>

                {/* quick stats */}
                <div className="relative z-10 grid grid-cols-3 gap-3">
                    {[
                        { label: 'Arrecadado', value: `R$ ${analytics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'text-green-300' },
                        { label: 'Vendidos', value: `${analytics.numbersSold}`, color: 'text-purple-300' },
                        { label: 'Progresso', value: `${progressPct}%`, color: 'text-amber-300' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3 border border-white/10 text-center">
                            <p className={`text-xl font-black ${color}`}>{value}</p>
                            <p className="text-white/50 text-xs mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>

                {/* progress bar */}
                <div className="relative z-10 mt-4">
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-700"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="text-white/40 text-xs mt-1">{analytics.numbersSold} de {analytics.totalPossible} números vendidos</p>
                </div>
            </div>

            {/* ── ANALYTICS CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                    { icon: '💰', label: 'Total Arrecadado', value: `R$ ${analytics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: 'confirmados', from: 'from-green-500', to: 'to-emerald-600' },
                    { icon: '🎯', label: 'Núm. Vendidos', value: `${analytics.numbersSold}`, sub: `de ${analytics.totalPossible}`, from: 'from-purple-500', to: 'to-violet-600' },
                    { icon: '⏳', label: 'Pendentes', value: `${analytics.numbersPending}`, sub: 'aguardando pag.', from: 'from-amber-500', to: 'to-orange-500' },
                    { icon: '✨', label: 'Disponíveis', value: `${analytics.numbersAvailable}`, sub: 'prontos p/ venda', from: 'from-sky-500', to: 'to-blue-600' },
                    { icon: '👥', label: 'Compradores', value: `${analytics.totalBuyers}`, sub: 'únicos', from: 'from-rose-500', to: 'to-pink-600' },
                    { icon: '📈', label: 'Progresso', value: `${progressPct}%`, sub: 'da meta atingida', from: 'from-slate-600', to: 'to-slate-800' },
                ].map(({ icon, label, value, sub, from, to }) => (
                    <div key={label} className={`bg-gradient-to-br ${from} ${to} rounded-2xl p-5 shadow-lg text-white`}>
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                            <span className="text-xl">{icon}</span>
                        </div>
                        <p className="text-xs font-bold text-white/70 uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-2xl font-black leading-none">{value}</p>
                        <p className="text-xs text-white/50 mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            {/* ── ACTION BUTTONS ── */}
            <div>
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider mb-3 px-1">Ações Rápidas</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                        { section: 'raffle' as const, icon: '🎯', label: 'Gerenciar Sorteio', desc: 'Editar textos e imagens', from: 'from-purple-500', to: 'to-violet-600' },
                        { section: 'payments' as const, icon: '💳', label: 'Pagamentos', desc: 'Confirmar reservas PIX', from: 'from-green-500', to: 'to-emerald-600' },
                        { section: 'users' as const, icon: '👥', label: 'Usuários', desc: 'Lista de compradores', from: 'from-sky-500', to: 'to-blue-600' },
                        { section: 'grid' as const, icon: '📸', label: 'Grade e Print', desc: 'Marcar vencedor', from: 'from-orange-500', to: 'to-amber-500' },
                        { section: 'offlineViewer' as const, icon: '👁️', label: 'Backup Interno', desc: 'Cache local / offline', from: 'from-slate-600', to: 'to-slate-800' },
                    ].map(({ section, icon, label, desc, from, to }) => (
                        <button
                            key={section}
                            onClick={() => onNavigate(section)}
                            className={`bg-gradient-to-br ${from} ${to} text-white rounded-2xl p-5 shadow-lg hover:shadow-xl hover:brightness-110 transition-all active:scale-95 text-left`}
                        >
                            <span className="text-3xl mb-3 block">{icon}</span>
                            <p className="font-black text-sm leading-tight">{label}</p>
                            <p className="text-xs text-white/60 mt-1">{desc}</p>
                        </button>
                    ))}

                    <button
                        onClick={handleExportCSV}
                        disabled={isRefreshing}
                        className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-2xl p-5 shadow-lg hover:shadow-xl hover:brightness-110 transition-all active:scale-95 text-left"
                    >
                        <span className="text-3xl mb-3 block">{isRefreshing ? '⏳' : '📥'}</span>
                        <p className="font-black text-sm leading-tight">Exportar CSV</p>
                        <p className="text-xs text-white/60 mt-1">Baixar lista .csv</p>
                    </button>
                </div>
            </div>

            {/* ── MAINTENANCE TOGGLE ── */}
            <div className={`rounded-2xl p-6 shadow-lg border-l-4 transition-colors ${maintenanceMode ? 'bg-red-50 border-red-500' : 'bg-white border-slate-300'}`}>
                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center justify-between">
                    <div className="flex-1 w-full">
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-1">
                            <span>⚠️</span>
                            Modo Manutenção
                            {maintenanceMode && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">ATIVO</span>}
                        </h3>
                        <p className="text-sm text-slate-500 mb-3">Ative para exibir um aviso aos clientes durante atualizações ou instabilidades.</p>
                        <input
                            type="text"
                            value={maintenanceMessage}
                            onChange={(e) => setMaintenanceMessage(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:ring-2 focus:ring-red-400 outline-none"
                            placeholder="Mensagem para os clientes..."
                        />
                    </div>
                    <button
                        onClick={handleToggleMaintenance}
                        disabled={isSavingMaintenance}
                        className={`px-6 py-3 rounded-xl font-black text-white shadow-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap ${maintenanceMode ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-500 hover:bg-slate-600'}`}
                    >
                        <span className="text-xl">{isSavingMaintenance ? '⏳' : maintenanceMode ? '🛑' : '✅'}</span>
                        {maintenanceMode ? 'Desativar' : 'Ativar Manutenção'}
                    </button>
                </div>
            </div>

        </div>
    );
};

export default AdminDashboard;
