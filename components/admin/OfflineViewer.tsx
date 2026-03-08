import React, { useState, useEffect } from 'react';
import type { Reservation, Raffle } from '../../types/database';

interface OfflineViewerProps {
    raffleId: string;
    onBack: () => void;
}

const OfflineViewer: React.FC<OfflineViewerProps> = ({ raffleId, onBack }) => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'all' | 'number'>('all');

    useEffect(() => {
        const loadCache = () => {
            try {
                const cachedData = localStorage.getItem(`admin_cache_reservations_${raffleId}`);
                if (cachedData) {
                    setReservations(JSON.parse(cachedData));
                }
            } catch (error) {
                console.error("Erro ao ler cache offline:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadCache();
    }, [raffleId]);

    const formatPhone = (phone: string | null) => {
        if (!phone) return '-';
        return phone.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
    };

    const getWhatsAppLink = (phone: string | null) => {
        if (!phone) return null;
        const cleanPhone = phone.replace(/\D/g, '');
        return `https://wa.me/55${cleanPhone}`;
    };

    const filteredReservations = reservations.filter(res => {
        // Status filter
        if (filter !== 'all' && res.status !== filter) return false;

        // Text search filter
        if (searchQuery.trim().length > 0) {
            const lowerQuery = searchQuery.toLowerCase().trim();

            // Melhoria na busca por números:
            // Dividir a string de números (ex: "12, 45") e buscar exatamente o número digitado
            let numberMatch = false;
            if (res.number) {
                const numbersArray = res.number.toString().split(',').map(n => n.trim().toLowerCase());
                if (numbersArray.includes(lowerQuery)) {
                    numberMatch = true; // Busca exata (digitou "1", acha apenas o "1" e não o "10")
                } else if (res.number.toLowerCase().includes(lowerQuery) && lowerQuery.includes(',')) {
                    numberMatch = true; // Caso a pessoa digite "1, 2" buscar na string inteira
                }
            }

            if (searchType === 'number') {
                return numberMatch; // Restringe a busca EXCLUSIVAMENTE ao campo de números de bilhete
            }

            const nameMatch = res.buyer_name?.toLowerCase().includes(lowerQuery) || false;
            const phoneMatch = res.buyer_phone?.includes(lowerQuery) || false;
            const emailMatch = res.buyer_email?.toLowerCase().includes(lowerQuery) || false;

            return nameMatch || phoneMatch || emailMatch || numberMatch;
        }

        return true;
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
                >
                    <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <span>👁️</span> Visualizador de Backup Interno
                    </h2>
                    <p className="text-slate-500 font-medium">Lendo do Cache Local (Última cópia salva)</p>
                </div>
            </div>

            <div className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200 w-fit">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                    Todos ({reservations.length})
                </button>
                <button
                    onClick={() => setFilter('paid')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filter === 'paid' ? 'bg-green-600 text-white' : 'text-slate-600 hover:bg-green-50'}`}
                >
                    Pagos ({reservations.filter(r => r.status === 'paid').length})
                </button>
                <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${filter === 'pending' ? 'bg-yellow-500 text-white' : 'text-slate-600 hover:bg-yellow-50'}`}
                >
                    Pendentes ({reservations.filter(r => r.status === 'pending').length})
                </button>
            </div>

            {/* Search Box */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder={searchType === 'number' ? "Digite apenas o número do bilhete..." : "Buscar por nome, telefone ou número..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-slate-50 text-slate-900"
                        />
                    </div>
                    <select
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value as 'all' | 'number')}
                        className="p-3 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 bg-slate-50 text-slate-900 font-medium outline-none md:w-auto w-full"
                    >
                        <option value="all">🔍 Buscar em tudo</option>
                        <option value="number">🔢 Apenas Nº da Rifa</option>
                    </select>
                </div>
            </div>

            {/* List */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                {reservations.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 font-medium">
                        <p className="text-4xl mb-2">📭</p>
                        <p>Nenhum dado salvo no cache local para esta rifa.</p>
                        <p className="text-xs text-slate-400 mt-2">Você precisará que a conexão com o banco retorne para buscar os dados pela primeira vez.</p>
                    </div>
                ) : filteredReservations.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 font-medium">
                        Nenhum registro encontrado para este filtro.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
                                    <th className="font-bold py-4 px-6">Comprador</th>
                                    <th className="font-bold py-4 px-6">Contato</th>
                                    <th className="font-bold py-4 px-6">Números</th>
                                    <th className="font-bold py-4 px-6">Status</th>
                                    <th className="font-bold py-4 px-6 text-right">Data/Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredReservations.map((res) => (
                                    <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="py-4 px-6">
                                            <p className="font-bold text-slate-900">{res.buyer_name || 'Desconhecido'}</p>
                                            <p className="text-xs text-slate-500">{res.buyer_email || 'Sem email'}</p>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-slate-700">{formatPhone(res.buyer_phone)}</span>
                                                {res.buyer_phone && (
                                                    <a
                                                        href={getWhatsAppLink(res.buyer_phone)!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-green-500 hover:text-green-600 transition-colors"
                                                        title="Conversar no WhatsApp"
                                                    >
                                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded">
                                                    {res.number}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {res.status === 'paid' && <span className="text-green-600 bg-green-50 font-bold px-3 py-1 rounded-full text-xs">PAGO</span>}
                                            {res.status === 'pending' && <span className="text-yellow-600 bg-yellow-50 font-bold px-3 py-1 rounded-full text-xs">PENDENTE</span>}
                                            {res.status === 'cancelled' && <span className="text-red-500 font-bold px-3 py-1 rounded-full text-xs">CANCELADO</span>}
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <p className="text-xs text-slate-500">{new Date(res.created_at).toLocaleDateString('pt-BR')} {new Date(res.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                                            {res.payment_amount && res.payment_amount > 0 && (
                                                <p className="font-bold text-green-600 mt-1">R$ {res.payment_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OfflineViewer;
