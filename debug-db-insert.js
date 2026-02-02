
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
    console.log('Attempting to insert winner with NULL photo_url...');

    // Attempt to insert a record that requires the schema fix
    const { data, error } = await supabase
        .from('winner_photos')
        .insert([
            {
                name: 'Debug Test User',
                prize: 'Debug Prize',
                photo_url: null, // This triggers the error if schema is strictly NOT NULL
                media_type: 'instagram',
                video_url: 'https://instagram.com/debug',
                display_order: 9999
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('❌ INSERT FAILED!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        console.error('Error Details:', error.details);
        console.error('Error Hint:', error.hint);
    } else {
        console.log('✅ INSERT SUCCESS!');
        console.log('Inserted ID:', data.id);

        // Cleanup
        await supabase.from('winner_photos').delete().eq('id', data.id);
    }
}

testInsert();
