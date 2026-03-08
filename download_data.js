import fs from 'fs';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://kbhfiemyyxalzonqirry.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiaGZpZW15eXhhbHpvbnFpcnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjc1NjcsImV4cCI6MjA4NTQwMzU2N30.onhCubvuKnZSogzQdGRVB7j2v6IxtMzZoCokU3as0fg';

async function fetchData(table) {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*`, {
            method: 'GET',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`Error fetching ${table}:`, err);
            return null;
        }

        const data = await response.json();
        fs.writeFileSync(`backup_${table}.json`, JSON.stringify(data, null, 2));
        console.log(`Saved ${data.length} records to backup_${table}.json`);
        return data;
    } catch (err) {
        console.error(`Fetch exception on ${table}:`, err);
        return null;
    }
}

async function run() {
    console.log('Attempting to download data locally limit 20...');
    await fetchData('raffles');
    await fetchData('reservations');
    console.log('Finished download attempt.');
}

run();
