import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || ''; // Idealmente SERVICE_ROLE_KEY num ambiente real, mas mantemos o que existe

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ error: 'Supabase credentials missing' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase.rpc('expire_old_reservations');

        if (error) {
            console.error('❌ [Cron] Erro ao limpar reservas:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`🧹 [Cron] Limpeza concluída. Registros expirados afetados limitados pelas regras do banco.`);

        return res.status(200).json({
            success: true,
            message: 'Limpeza de reservas expiradas concluída',
            data: data
        });

    } catch (error: any) {
        console.error('❌ [Cron] Exceção:', error);
        return res.status(500).json({ error: error.message || 'Unknown error' });
    }
}
