import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase para rotas serverless (/api/*).
 * Prioriza SUPABASE_SERVICE_ROLE_KEY no servidor; usa ANON_KEY apenas como fallback
 * para não quebrar ambientes locais caso a service role ainda não esteja definida.
 */
export function getSupabaseServerClient() {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        '';

    return createClient(url, key);
}
