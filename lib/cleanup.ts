import { supabase } from './supabase';
import EfiPay from 'sdk-node-apis-efi';

// EFI client (server-side usa process.env)
const getEfiClient = () => {
    return new EfiPay({
        sandbox: process.env.EFI_SANDBOX === 'true',
        client_id: process.env.EFI_CLIENT_ID || '',
        client_secret: process.env.EFI_CLIENT_SECRET || '',
        certificate: (process.env.EFI_CERTIFICATE_BASE64 || '').trim(),
        cert_base64: true,
        validateMtls: false,
    });
};

/**
 * Antes de limpar reservas expiradas, verifica quais txids EFI foram pagos
 * e confirma as reservas no banco para evitar deleção indevida.
 *
 * Lógica:
 * 1. Busca reservas pending prestes a expirar (nos próximos 5 min ou já expiradas)
 * 2. Para cada reserva com efi_txid, consulta status na EFI
 * 3. Se CONCLUIDA: atualiza para paid antes do cleanup deletar
 */
async function confirmPaidBeforeCleanup(): Promise<number> {
    try {
        console.log('🔍 [Cleanup] Verificando pagamentos EFI antes de limpar reservas...');

        // Pegar reservas pending com efi_txid que expiram nos próximos 5 minutos ou já expiraram
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const { data: pendingReservations, error } = await supabase
            .from('reservations')
            .select('efi_txid, raffle_id, number, expires_at')
            .eq('status', 'pending')
            .not('efi_txid', 'is', null)
            .lt('expires_at', fiveMinutesFromNow)
            .limit(50); // Processar em lotes para evitar timeout

        if (error || !pendingReservations || pendingReservations.length === 0) {
            console.log('✅ [Cleanup] Nenhuma reserva EFI prestes a expirar.');
            return 0;
        }

        // Agrupar por txid (para evitar consultas duplicadas)
        const txidSet = new Set<string>();
        pendingReservations.forEach(r => {
            if (r.efi_txid) txidSet.add(r.efi_txid);
        });

        console.log(`🔍 [Cleanup] Verificando ${txidSet.size} txid(s) EFI antes do cleanup...`);

        let confirmedTotal = 0;

        // Tentar criar cliente EFI; se falhar (ambiente browser/sem credenciais), pular
        let efipay: any = null;
        try {
            efipay = getEfiClient();
        } catch (e) {
            console.warn('⚠️ [Cleanup] Não foi possível criar cliente EFI (ambiente sem credenciais). Pulando verificação pré-cleanup.');
            return 0;
        }

        for (const txid of txidSet) {
            try {
                const response = await efipay.pixDetailCharge({ txid });
                const status = response.status;
                const paidAt = response.pix?.[0]?.horario || null;

                console.log(`📊 [Cleanup] txid ${txid} → status EFI: ${status}`);

                if (status === 'CONCLUIDA') {
                    console.log(`💰 [Cleanup] txid ${txid} está PAGO! Confirmando antes do cleanup...`);

                    const { data: updated } = await supabase
                        .from('reservations')
                        .update({
                            status: 'paid',
                            expires_at: null,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('efi_txid', txid)
                        .eq('status', 'pending')
                        .select();

                    const count = updated?.length || 0;
                    confirmedTotal += count;

                    // Atualizar transação
                    await supabase
                        .from('efi_transactions')
                        .update({
                            status: 'CONCLUIDA',
                            paid_at: paidAt || new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('txid', txid);

                    console.log(`✅ [Cleanup] ${count} reserva(s) salvas do cleanup para txid ${txid}`);
                }
            } catch (efiError: any) {
                // Se a EFI não achar o txid ou der erro, ignorar e deixar cleanup decidir
                console.warn(`⚠️ [Cleanup] Erro ao consultar EFI para txid ${txid}:`, efiError?.message || efiError);
            }
        }

        if (confirmedTotal > 0) {
            console.log(`✅ [Cleanup] ${confirmedTotal} reserva(s) confirmadas como PAID antes do cleanup.`);
        }

        return confirmedTotal;
    } catch (err) {
        console.error('❌ [Cleanup] Erro em confirmPaidBeforeCleanup:', err);
        return 0;
    }
}

/**
 * Deleta reservas expiradas do banco de dados.
 * ANTES de deletar, confirma pagamentos EFI pendentes para evitar deleção indevida.
 * Chama função SQL delete_expired_reservations() (que agora tem grace period de 30 min).
 * Deve ser chamada periodicamente (ex: ao carregar dados da página).
 */
export async function cleanupExpiredReservations(): Promise<number> {
    try {
        console.log('🧹 [Cleanup] Iniciando limpeza de reservas expiradas...');

        // ⚡ PROTEÇÃO: Verificar pagamentos EFI antes de deletar
        await confirmPaidBeforeCleanup();

        // Agora limpar reservas realmente expiradas
        let { data, error } = await supabase.rpc('expire_old_reservations');

        if (error) {
            console.warn('⚠️ [Cleanup] expire_old_reservations falhou, tentando delete_expired_reservations:', error.message);
            const retry = await supabase.rpc('delete_expired_reservations');
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            console.error('❌ [Cleanup] Erro crítico ao limpar reservas expiradas:', error);
            return 0;
        }

        const count = data || 0;
        if (count > 0) {
            console.log(`✅ [Cleanup] ${count} reserva(s) removida(s)/cancelada(s)`);
        } else {
            console.log('✅ [Cleanup] Nenhuma reserva expirada encontrada');
        }

        return count;
    } catch (error) {
        console.error('❌ [Cleanup] Exceção geral no cleanup:', error);
        return 0;
    }
}
