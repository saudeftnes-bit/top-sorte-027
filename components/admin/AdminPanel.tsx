import React, { useState, useEffect } from 'react';
import AdminAuth from './AdminAuth';
import AdminDashboard from './AdminDashboard';
import RaffleManager from './RaffleManager';
import PaymentManager from './PaymentManager';
import UsersList from './UsersList';
import RaffleList from './RaffleList';
import ConfirmModal from '../ConfirmModal';
import { getActiveRaffle } from '../../lib/supabase-admin';
import type { Raffle } from '../../types/database';

type AdminSection = 'dashboard' | 'raffle' | 'payments' | 'users';

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
        // Check if already authenticated
        const isAuth = localStorage.getItem('admin_authenticated') === 'true';
        setIsAuthenticated(isAuth);

        if (isAuth) {
            loadActiveRaffle();
        } else {
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
        setIsLoading(true);
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
        localStorage.removeItem('admin_authenticated');
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
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Sorte 027</p>
                        </div>
                    </div>

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
                                raffleId={activeRaffle?.id || ''} // Empty ID means creation mode
                                onBack={() => {
                                    if (activeRaffle?.id) {
                                        setCurrentSection('dashboard');
                                    } else {
                                        setShowRaffleList(true);
                                        setActiveRaffle(null);
                                    }
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
