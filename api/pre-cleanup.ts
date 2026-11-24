import type { VercelRequest, VercelResponse } from '@vercel/node';
import EfiPay from 'sdk-node-apis-efi';
import { getSupabaseServerClient } from '../lib/supabase-server';

// Cooldown em memória por instância serverless (evita sobrecarga na EFI com muitos usuários simultâneos)
let lastPreCleanupAt = 0;
const PRE_CLEANUP_COOLDOWN_MS = 30_000; // 30 segundos

/**
 * GET /api/pre-cleanup
 * Verifica reservas pending prestes a expirar e confirma na EFI.
 * Chamada pelo cleanup.ts (browser) ANTES de rodar expire_old_reservations().
 * Roda no Node.js (serverless) — pode usar SDK da EFI com segurança.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const now = Date.now();
        if (now - lastPreCleanupAt < PRE_CLEANUP_COOLDOWN_MS) {
            return res.status(200).json({ confirmed: 0, checked: 0, skipped: 'cooldown' });
        }
        lastPreCleanupAt = now;

        const supabase = getSupabaseServerClient();

        // Buscar reservas pending com efi_txid que já expiraram ou expiram em 5 minutos
        const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const { data: pendingReservations, error } = await supabase
            .from('reservations')
            .select('efi_txid, raffle_id, number, expires_at')
            .eq('status', 'pending')
            .not('efi_txid', 'is', null)
            .lt('expires_at', fiveMinutesFromNow)
            .limit(50);

        if (error || !pendingReservations || pendingReservations.length === 0) {
            console.log('✅ [PreCleanup] Nenhuma reserva EFI prestes a expirar.');
            return res.status(200).json({ confirmed: 0, checked: 0 });
        }

        // Agrupar por txid (evita consultas duplicadas)
        const txidSet = new Set<string>();
        pendingReservations.forEach(r => { if (r.efi_txid) txidSet.add(r.efi_txid); });

        console.log(`🔍 [PreCleanup] Verificando ${txidSet.size} txid(s) na EFI...`);

        // Inicializar cliente EFI
        const efipay = new EfiPay({
            sandbox: process.env.EFI_SANDBOX === 'true',
            client_id: process.env.EFI_CLIENT_ID || '',
            client_secret: process.env.EFI_CLIENT_SECRET || '',
            certificate: (process.env.EFI_CERTIFICATE_BASE64 || '').trim(),
            cert_base64: true,
            validateMtls: false,
        });

        let confirmedTotal = 0;

        for (const txid of txidSet) {
            try {
                const response = await efipay.pixDetailCharge({ txid });
                const status = response.status;
                const paidAt = response.pix?.[0]?.horario || null;

                console.log(`📊 [PreCleanup] txid ${txid} → status EFI: ${status}`);

                if (status === 'CONCLUIDA') {
                    console.log(`💰 [PreCleanup] txid ${txid} está PAGO! Confirmando antes do cleanup...`);

                    // Usar a mesma RPC atômica/idempotente do webhook
                    const { data: rpcData, error: rpcErr } = await supabase.rpc('confirm_efi_payment', {
                        p_txid: txid,
                        p_paid_at: paidAt || new Date().toISOString(),
                    });

                    let count = 0;
                    if (!rpcErr && rpcData) {
                        count = typeof rpcData === 'number' ? rpcData : (rpcData.updated ?? 0);
                    } else {
                        // Fallback seguro caso RPC ainda não exista
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

                        count = updated?.length || 0;

                        await supabase
                            .from('efi_transactions')
                            .update({
                                status: 'CONCLUIDA',
                                paid_at: paidAt || new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('txid', txid);
                    }

                    confirmedTotal += count;
                    console.log(`✅ [PreCleanup] ${count} reserva(s) salvas do cleanup para txid ${txid}`);
                }
            } catch (efiError: any) {
                console.warn(`⚠️ [PreCleanup] Erro ao consultar EFI para txid ${txid}:`, efiError?.message || efiError);
            }
        }

        if (confirmedTotal > 0) {
            console.log(`✅ [PreCleanup] Total: ${confirmedTotal} reserva(s) confirmadas como PAID.`);
        }

        return res.status(200).json({
            confirmed: confirmedTotal,
            checked: txidSet.size,
        });

    } catch (err: any) {
        console.error('❌ [PreCleanup] Erro geral:', err?.message || err);
        return res.status(500).json({ error: 'Erro interno no pre-cleanup', confirmed: 0 });
    }
}
