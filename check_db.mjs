import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kbhfiemyyxalzonqirry.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiaGZpZW15eXhhbHpvbnFpcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjc1NjcsImV4cCI6MjA4NTQwMzU2N30.onhCubvuKnZSogzQdGRVB7j2v6IxtMzZoCokU3as0fg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
    console.log('Checking database status...');

    const { data: raffles, error: rErr } = await supabase.from('raffles').select('*').limit(5);
    console.log('Raffles:', rErr ? rErr.message : (raffles ? raffles.length : 0));

    const { data: operations, error: opErr } = await supabase.from('operations').select('*').limit(5);
    console.log('Operations:', opErr ? opErr.message : (operations ? operations.length : 0));

    const { data: reservations, error: resErr } = await supabase.from('reservations').select('*').limit(5);
    console.log('Reservations:', resErr ? resErr.message : (reservations ? reservations.length : 0));

    const { data: settings, error: sErr } = await supabase.from('system_settings').select('*');
    console.log('Settings:', sErr ? sErr.message : (settings ? settings.length : 0));

    console.log('Done checking database.');
}

checkDb();
