import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials missing' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const startTime = Date.now();
        const nowIso = new Date().toISOString();

        console.log(`🧹 [Cron Cleanup] Iniciando ciclo de expiração automática às ${nowIso}...`);

        // 1. Chamar RPC principal no banco
        const { data: rpcCount, error: rpcError } = await supabase.rpc('expire_old_reservations');

        if (rpcError) {
            console.warn('⚠️ [Cron Cleanup] RPC expire_old_reservations falhou, executando limpeza direta:', rpcError.message);
        }

        // 2. Limpeza de contingência direta
        // A) Deletar seleções temporárias na grade que já expiraram (sem PIX gerado)
        const { data: deletedTemp, error: delErr } = await supabase
            .from('reservations')
            .delete()
            .eq('status', 'pending')
            .is('efi_txid', null)
            .or(`expires_at.lt.${nowIso},expires_at.is.null`)
            .select('number');

        // B) Marcar como canceladas reservas com PIX expirado que não foram pagas
        const { data: cancelledPix, error: cancelErr } = await supabase
            .from('reservations')
            .update({ status: 'cancelled', updated_at: nowIso })
            .eq('status', 'pending')
            .not('efi_txid', 'is', null)
            .lt('expires_at', nowIso)
            .select('number');

        const tempCount = deletedTemp?.length || 0;
        const pixCancelCount = cancelledPix?.length || 0;
        const totalLiberados = (typeof rpcCount === 'number' ? rpcCount : 0) + tempCount + pixCancelCount;
        const durationMs = Date.now() - startTime;

        console.log(`✅ [Cron Cleanup] Concluído em ${durationMs}ms. Liberados: ${tempCount} temporários, ${pixCancelCount} PIX expirados.`);

        return res.status(200).json({
            success: true,
            timestamp: nowIso,
            durationMs,
            liberados: {
                rpc: rpcCount,
                temporariosDeletados: tempCount,
                pixExpiradosCancelados: pixCancelCount,
                total: totalLiberados
            }
        });

    } catch (error: any) {
        console.error('❌ [Cron Cleanup] Exceção crítica:', error);
        return res.status(500).json({ error: error.message || 'Unknown error' });
    }
}
