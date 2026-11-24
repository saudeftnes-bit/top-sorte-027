import React, { useState, useEffect } from 'react';
import AdminAuth from './AdminAuth';
import AdminDashboard from './AdminDashboard';
import RaffleManager from './RaffleManager';
import PaymentManager from './PaymentManager';
import UsersList from './UsersList';
import RaffleList from './RaffleList';
import RaffleGridView from './RaffleGridView';
import OfflineViewer from './OfflineViewer';
import AdminSecurity from './AdminSecurity';
import ConfirmModal from '../ConfirmModal';
import { getActiveRaffle } from '../../lib/supabase-admin';
import type { Raffle } from '../../types/database';

type AdminSection = 'dashboard' | 'raffle' | 'payments' | 'users' | 'grid' | 'offlineViewer' | 'security' | 'preview';

interface AdminSession {
    token: string;
    expires: number;
}

/** Returns true only if admin_session exists and has not expired */
const isSessionValid = (): boolean => {
    try {
        const raw = localStorage.getItem('admin_session');
        if (!raw) return false;
        const session: AdminSession = JSON.parse(raw);
        return !!session.token && session.expires > Date.now();
    } catch {
        return false;
    }
};

const AdminPanel: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentSection, setCurrentSection] = useState<AdminSection>('dashboard');
    const [activeRaffle, setActiveRaffle] = useState<Raffle | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [dashboardKey, setDashboardKey] = useState(0);

    // New state for multiple raffles
    const [showRaffleList, setShowRaffleList] = useState(true);

    useEffect(() => {
        // Check if already authenticated with a valid, non-expired session
        const valid = isSessionValid();
        setIsAuthenticated(valid);

        if (valid) {
            loadActiveRaffle();
        } else {
            // Clear any stale session data
            localStorage.removeItem('admin_session');
            setIsLoading(false);
        }
    }, []);

    const loadActiveRaffle = async () => {
        // We load the active raffle for the dashboard, but now we also rely on the list
        const raffle = await getActiveRaffle();
        // Only auto-select if we don't have one and not showing list
        if (raffle && !activeRaffle) {
            // For now, let's just set it but keep list open if user wants to switch.
            // Actually, the new flow starts with the List.
            // setActiveRaffle(raffle);
        }
        setIsLoading(false);
    };

    const handleAuthenticated = () => {
        setIsAuthenticated(true);
        loadActiveRaffle();
    };

    const refreshData = async () => {
        console.log('[AdminPanel] 🔄 Starting data refresh...');
        await loadActiveRaffle();
        setDashboardKey(prev => prev + 1);

        // Broadcast to other tabs/windows that data has been updated
        try {
            // Dispatch custom event for same-tab components
            console.log('[AdminPanel] 📢 Dispatching adminDataUpdated event...');
            window.dispatchEvent(new Event('adminDataUpdated'));

            // Update localStorage to trigger storage event in other tabs
            localStorage.setItem('lastAdminUpdate', Date.now().toString());

            console.log('[AdminPanel] ✅ Data refreshed and broadcast to other tabs (dashboardKey:', dashboardKey + 1, ')');
        } catch (error) {
            console.error('[AdminPanel] ❌ Error broadcasting update:', error);
        }
    };

    const handleLogout = () => {
        setShowLogoutModal(true);
    };

    const confirmLogout = () => {
        // Remove the session object (replaces the old 'admin_authenticated' key)
        localStorage.removeItem('admin_session');
        setIsAuthenticated(false);
        setCurrentSection('dashboard');
        setShowLogoutModal(false);
        // Redirect to home page
        window.location.href = '/';
    };

    if (!isAuthenticated) {
        return <AdminAuth onAuthenticated={handleAuthenticated} />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!activeRaffle && !showRaffleList) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-12 shadow-xl text-center max-w-md">
                    <p className="text-6xl mb-4">⚠️</p>
                    <h2 className="text-2xl font-black text-slate-900 mb-3">Nenhum Sorteio Selecionado</h2>
                    <p className="text-slate-500 mb-6">
                        Selecione um sorteio na lista para gerenciar.
                    </p>
                    <button
                        onClick={() => setShowRaffleList(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-lg"
                    >
                        Voltar para Lista
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Top Bar */}
            <header className="sticky top-0 z-40 bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                            <span className="text-xl">🔐</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900">Admin Panel</h1>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {!showRaffleList && activeRaffle ? (
                                    <button
                                        onClick={() => { setShowRaffleList(true); }}
                                        className="text-purple-500 hover:text-purple-700 font-bold flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                        Rifas / {activeRaffle.title?.substring(0, 20) || 'Rifa'}
                                    </button>
                                ) : 'Top Sorte 027'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!showRaffleList && (
                            <button
                                onClick={() => { setShowRaffleList(true); setActiveRaffle(null); }}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h8" /></svg>
                                Rifas
                            </button>
                        )}
                        {/* Security button */}
                        <button
                            onClick={() => { setShowRaffleList(false); setCurrentSection('security'); }}
                            className={`px-3 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2 ${currentSection === 'security' && !showRaffleList ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                        >
                            🔐 Segurança
                        </button>
                        <button
                            onClick={handleLogout}
                            className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sair
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {showRaffleList ? (
                    <RaffleList
                        onManageRaffle={(raffle) => {
                            setActiveRaffle(raffle);
                            setShowRaffleList(false);
                            setCurrentSection('dashboard');
                        }}
                        onViewRaffle={(raffle) => {
                            setActiveRaffle(raffle);
                            setShowRaffleList(false);
                            setCurrentSection('preview');
                        }}
                        onCreateRaffle={() => {
                            setActiveRaffle({ id: '', title: '', description: '', price_per_number: 0, main_image_url: '', status: 'scheduled', created_at: '', updated_at: '' }); // Empty raffle for creation
                            setShowRaffleList(false);
                            setCurrentSection('raffle');
                        }}
                        onEditRaffle={(raffle) => {
                            setActiveRaffle(raffle);
                            setShowRaffleList(false);
                            setCurrentSection('raffle');
                        }}
                        onBack={() => {
                            // If we have an active raffle, go back to dashboard.
                            // If not, maybe just stay or go to a safe state?
                            // For now, let's assume if there is an active raffle we go to dashboard,
                            // otherwise staying in list is the default state if no raffle is selected.
                            // But usually "Back" from list implies going to the main view if list is a sub-view.
                            // In this architecture, List IS a main view when no raffle is active.
                            // If the user wants to go to the "Dashboard" of a specific raffle, they select it.
                            // If they want to just "go back" from the list... where to?
                            // Maybe the user meant "Dashboard" as in "Raffle Dashboard" but they are in the list.
                            // If they are in the list, there IS NO active raffle to go to the dashboard OF.
                            // So "Back" might strictly mean "Close List".
                            // But wait, if showRaffleList is true, activeRaffle might be null.
                            // If activeRaffle IS set, we can go back to it.
                            if (activeRaffle) {
                                setShowRaffleList(false);
                                setCurrentSection('dashboard');
                            }
                        }}
                        hasActiveRaffle={!!activeRaffle}
                    />
                ) : (
                    <>

                        {currentSection === 'security' && (
                            <AdminSecurity />
                        )}

                        {currentSection === 'preview' && activeRaffle && (
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => {
                                            setShowRaffleList(true);
                                            setActiveRaffle(null);
                                        }}
                                        className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-sm transition-colors"
                                    >
                                        ← Voltar para Rifas
                                    </button>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Prévia do Banner
                                    </span>
                                </div>

                                <div className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#004B8D] via-[#1E1B4B] to-black shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-white/10 flex flex-col justify-between min-h-[75dvh]">
                                    <div className="absolute inset-0 flex items-center justify-center p-2 pb-40 pt-14">
                                        <img
                                            src={activeRaffle.main_image_url || "https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop"}
                                            alt={activeRaffle.title || "Prêmio do Sorteio"}
                                            className="w-full h-full object-contain block rounded-2xl"
                                        />
                                    </div>

                                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/75 via-black/30 to-transparent pointer-events-none" />
                                    <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none" />

                                    <div className="relative z-10 flex items-center justify-between p-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-full p-0.5 bg-gradient-to-tr from-[#00E676] to-pink-500 shadow-md flex-shrink-0">
                                                <img
                                                    src="/logo.png"
                                                    alt="Top Sorte 027"
                                                    className="w-full h-full rounded-full object-cover bg-slate-950"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white text-xs font-black leading-tight drop-shadow">Top Sorte 027</span>
                                                {activeRaffle.code && (
                                                    <span className="text-[10px] text-white/75 font-bold leading-tight">Edição #{activeRaffle.code}</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full border border-red-500/40 shadow">
                                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)] animate-pulse" />
                                            <span className="text-white text-[10px] font-black uppercase tracking-widest">LIVE</span>
                                        </div>
                                    </div>

                                    <div className="relative z-10 p-4 space-y-3 text-center">
                                        {(activeRaffle.title || activeRaffle.description) && (
                                            <div className="space-y-1 text-center">
                                                {activeRaffle.title && (
                                                    <h2 className="text-base sm:text-xl font-black text-white leading-tight drop-shadow-md">
                                                        {activeRaffle.title}
                                                    </h2>
                                                )}
                                                {activeRaffle.description && (
                                                    <p className="text-xs sm:text-sm text-white/85 font-medium leading-snug whitespace-pre-line line-clamp-3 drop-shadow">
                                                        {activeRaffle.description}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {(activeRaffle as any).raffle_type === 'brinde' ? (
                                            <div className="inline-flex items-center justify-center gap-2 bg-emerald-950/80 backdrop-blur-md border border-emerald-400/30 px-5 py-2 rounded-full text-sm sm:text-base text-emerald-300 font-black uppercase tracking-wider mx-auto">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                                <span>100% Grátis</span>
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center justify-center gap-2 bg-black/65 backdrop-blur-md border border-white/15 px-5 py-2 rounded-full text-sm sm:text-base text-white font-bold mx-auto">
                                                <span>💸 Cota:</span>
                                                <strong className="text-[#00E676] text-lg sm:text-xl font-black">
                                                    R$ {activeRaffle.price_per_number?.toFixed(2).replace('.', ',') || '13,00'}
                                                </strong>
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setCurrentSection('grid')}
                                            className="w-full font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-base uppercase tracking-wider border-b-4 bg-gradient-to-r from-[#00E676] via-emerald-400 to-[#00C853] text-[#001D4A] border-[#008c3a] shadow-[0_8px_25px_rgba(0,230,118,0.4)]"
                                        >
                                            {(activeRaffle as any).raffle_type === 'brinde' ? (
                                                <><span>🎁</span><span>PARTICIPAR DO BRINDE GRÁTIS</span></>
                                            ) : (
                                                <><span>🚀</span><span>PARTICIPAR AGORA!</span></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentSection === 'dashboard' && activeRaffle && (
                            <AdminDashboard
                                key={dashboardKey}
                                raffleId={activeRaffle.id}
                                raffle={activeRaffle}
                                onNavigate={(section) => setCurrentSection(section)}
                            />
                        )}

                        {currentSection === 'raffle' && (
                            <RaffleManager
                                raffleId={activeRaffle?.id || ''}
                                onBack={() => {
                                    setShowRaffleList(true);
                                    setActiveRaffle(null);
                                    refreshData();
                                }}
                                onGoToList={() => {
                                    setShowRaffleList(true);
                                    setActiveRaffle(null);
                                }}
                                onGoToDashboard={activeRaffle?.id ? () => {
                                    setCurrentSection('dashboard');
                                    refreshData();
                                } : undefined}
                                onDataChanged={refreshData}
                            />
                        )}

                        {currentSection === 'payments' && activeRaffle && (
                            <PaymentManager
                                raffleId={activeRaffle.id}
                                raffle={activeRaffle}
                                onBack={() => {
                                    setCurrentSection('dashboard');
                                    refreshData();
                                }}
                                onDataChanged={refreshData}
                            />
                        )}

                        {currentSection === 'users' && activeRaffle && (
                            <UsersList
                                raffleId={activeRaffle.id}
                                onBack={() => {
                                    setCurrentSection('dashboard');
                                    refreshData();
                                }}
                                onDataChanged={refreshData}
                            />
                        )}

                        {currentSection === 'grid' && activeRaffle && (
                            <RaffleGridView
                                raffle={activeRaffle}
                                onBack={() => {
                                    setCurrentSection('dashboard');
                                }}
                            />
                        )}

                        {currentSection === 'offlineViewer' && activeRaffle && (
                            <OfflineViewer
                                raffleId={activeRaffle.id}
                                onBack={() => {
                                    setCurrentSection('dashboard');
                                }}
                            />
                        )}
                    </>
                )}
            </main>

            {/* Logout Confirmation Modal */}
            <ConfirmModal
                isOpen={showLogoutModal}
                title="Sair do Admin"
                message="Tem certeza que deseja sair do painel administrativo?"
                confirmLabel="Sair"
                cancelLabel="Cancelar"
                variant="warning"
                onConfirm={confirmLogout}
                onCancel={() => setShowLogoutModal(false)}
            />
        </div>
    );
};

export default AdminPanel;
