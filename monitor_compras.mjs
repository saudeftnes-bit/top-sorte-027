import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Carregar variáveis do .env.local
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["'](.*)["']$/, '$1');
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zkddlmyflftfwfybrzsi.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('\x1b[31m❌ Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configurados no .env.local\x1b[0m');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function formatCurrency(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr) {
  if (!dateStr) return '--:--:--';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' ' + d.toLocaleDateString('pt-BR');
}

async function getFullData() {
  const { data: raffles, error: rErr } = await supabase
    .from('raffles')
    .select('*')
    .order('created_at', { ascending: false });

  if (rErr) {
    console.error('\x1b[31mErro ao buscar rifas:\x1b[0m', rErr.message);
    return null;
  }

  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (resErr) {
    console.error('\x1b[31mErro ao buscar reservas:\x1b[0m', resErr.message);
    return null;
  }

  return { raffles: raffles || [], reservations: reservations || [] };
}

export async function buscarComprador(termo) {
  console.log(`\x1b[34m🔍 Buscando por: "${termo}"...\x1b[0m\n`);
  const data = await getFullData();
  if (!data) return;

  const termoLower = termo.toLowerCase();
  const raffleMap = Object.fromEntries(data.raffles.map(r => [r.id, r]));

  const matches = data.reservations.filter(r => {
    const nome = (r.buyer_name || '').toLowerCase();
    const tel = (r.buyer_phone || '').toLowerCase();
    const num = (r.number || '').toString().toLowerCase();
    return nome.includes(termoLower) || tel.includes(termoLower) || num === termoLower;
  });

  if (matches.length === 0) {
    console.log('\x1b[33mNenhum registro encontrado para essa busca.\x1b[0m');
    return;
  }

  console.log(`\x1b[32mEncontrados ${matches.length} resultado(s):\x1b[0m\n`);
  matches.forEach(r => {
    const rifa = raffleMap[r.raffle_id]?.title || 'Rifa desconhecida';
    const statusTag = r.status === 'paid' 
      ? '\x1b[32m[PAGO]\x1b[0m' 
      : r.status === 'pending' 
      ? '\x1b[33m[PENDENTE]\x1b[0m' 
      : '\x1b[31m[CANCELADO]\x1b[0m';

    console.log(`${statusTag} Nº \x1b[1m${r.number}\x1b[0m | Comprador: \x1b[1m${r.buyer_name || 'Anônimo'}\x1b[0m | Tel: ${r.buyer_phone || 'S/N'}`);
    console.log(`   Rifa: ${rifa} | Valor: ${formatCurrency(r.payment_amount)} | Data: ${formatDate(r.created_at)}`);
    if (r.payment_proof_url) {
      console.log(`   Comprovante: ${r.payment_proof_url}`);
    }
    console.log('-------------------------------------------------------------');
  });
}

export async function exportarRelatorio() {
  console.log('\x1b[34mGerando relatório completo de compras...\x1b[0m');
  const data = await getFullData();
  if (!data) return;

  const raffleMap = Object.fromEntries(data.raffles.map(r => [r.id, r]));

  let csvContent = 'RIFA;STATUS_RIFA;NUMERO;STATUS_PAGAMENTO;COMPRADOR;TELEFONE;VALOR;DATA;METODO;COMPROVANTE\n';
  let txtContent = '=======================================================================\n';
  txtContent += '               TOP SORTE 027 - RELATÓRIO DE VENDAS\n';
  txtContent += `               Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;
  txtContent += '=======================================================================\n\n';

  for (const raffle of data.raffles) {
    const res = data.reservations.filter(r => r.raffle_id === raffle.id);
    const paid = res.filter(r => r.status === 'paid');
    const totalRev = paid.reduce((s, i) => s + (Number(i.payment_amount) || Number(raffle.price_per_number)), 0);

    txtContent += `🏆 RIFA: ${raffle.title} [Status: ${raffle.status.toUpperCase()}]\n`;
    txtContent += `   Total Pagos: ${paid.length} / ${raffle.total_numbers} | Arrecadado: ${formatCurrency(totalRev)}\n`;
    txtContent += `-----------------------------------------------------------------------\n`;

    res.sort((a, b) => Number(a.number) - Number(b.number)).forEach(r => {
      const line = `"${raffle.title}";"${raffle.status}";"${r.number}";"${r.status}";"${r.buyer_name || ''}";"${r.buyer_phone || ''}";"${r.payment_amount || raffle.price_per_number}";"${r.created_at || ''}";"${r.payment_method || 'PIX'}";"${r.payment_proof_url || ''}"\n`;
      csvContent += line;

      txtContent += `Nº ${r.number.toString().padStart(4, '0')} | [${r.status.toUpperCase()}] | ${r.buyer_name || 'Anônimo'} | Tel: ${r.buyer_phone || 'S/N'} | ${formatDate(r.created_at)}\n`;
    });
    txtContent += '\n\n';
  }

  fs.writeFileSync('relatorio_compras.csv', '\uFEFF' + csvContent, 'utf8');
  fs.writeFileSync('relatorio_compras.txt', txtContent, 'utf8');

  console.log('\x1b[32m✅ Relatórios gerados com sucesso no diretório do projeto:\x1b[0m');
  console.log('  📄 \x1b[1mrelatorio_compras.csv\x1b[0m (Planilha Excel)');
  console.log('  📄 \x1b[1mrelatorio_compras.txt\x1b[0m (Texto para impressão)\n');
}

function renderDashboard(data) {
  console.clear();
  console.log('\x1b[36m========================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[32m           🎉 TOP SORTE 027 - MONITOR DE VENDAS EM TEMPO REAL 🎉         \x1b[0m');
  console.log('\x1b[36m========================================================================\x1b[0m');
  console.log(`\x1b[90mAtualizado em: ${new Date().toLocaleTimeString('pt-BR')} | Pressione CTRL+C para sair\x1b[0m\n`);

  const activeRaffles = data.raffles.filter(r => r.status === 'active');
  const displayRaffles = activeRaffles.length > 0 ? activeRaffles : data.raffles.slice(0, 1);
  const raffleMap = Object.fromEntries(data.raffles.map(r => [r.id, r]));

  if (activeRaffles.length === 0) {
    console.log('\x1b[33mℹ️ Nenhuma rifa ativa no momento. Exibindo última rifa registrada:\x1b[0m\n');
  }

  for (const raffle of displayRaffles) {
    const res = data.reservations.filter(r => r.raffle_id === raffle.id);
    const paid = res.filter(r => r.status === 'paid');
    const pending = res.filter(r => r.status === 'pending');
    
    const totalNumbers = raffle.total_numbers || 100;
    const pricePerNum = Number(raffle.price_per_number || 0);
    const totalRevenue = paid.reduce((sum, item) => sum + (Number(item.payment_amount) || pricePerNum), 0);
    const pct = totalNumbers > 0 ? ((paid.length / totalNumbers) * 100).toFixed(1) : 0;

    console.log(`\x1b[1m\x1b[34m🏆 RIFA ATIVA: ${raffle.title}\x1b[0m [Preço: ${formatCurrency(pricePerNum)} cada]`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`  🟢 \x1b[32mPagos / Confirmados:\x1b[0m  ${paid.length} bilhetes (${pct}%)`);
    console.log(`  🟡 \x1b[33mReservas Pendentes:\x1b[0m   ${pending.length} bilhetes`);
    console.log(`  ⚪ \x1b[37mNúmeros Livres:\x1b[0m        ${Math.max(0, totalNumbers - paid.length - pending.length)} bilhetes`);
    console.log(`  💰 \x1b[32mTotal Arrecadado:\x1b[0m     ${formatCurrency(totalRevenue)}`);
    console.log(`------------------------------------------------------------------------\n`);

    // Top 5 Compradores
    const buyerMap = {};
    for (const p of paid) {
      const key = p.buyer_name ? `${p.buyer_name} (${p.buyer_phone || 'S/ Tel'})` : 'Desconhecido';
      buyerMap[key] = (buyerMap[key] || 0) + 1;
    }

    const topBuyers = Object.entries(buyerMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topBuyers.length > 0) {
      console.log(`\x1b[1m🥇 MAIORES COMPRADORES (PAGOS):\x1b[0m`);
      topBuyers.forEach(([buyer, count], idx) => {
        console.log(`  ${idx + 1}º. ${buyer} -> \x1b[32m${count} bilhetes\x1b[0m (${formatCurrency(count * pricePerNum)})`);
      });
      console.log('');
    }
  }

  console.log('\x1b[1m\x1b[36m🕒 ÚLTIMAS 10 ATIVIDADES:\x1b[0m');
  const sortedRes = [...data.reservations].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 10);

  if (sortedRes.length === 0) {
    console.log('  Nenhuma compra ou reserva registrada ainda.\n');
  } else {
    sortedRes.forEach(r => {
      const rifaNome = raffleMap[r.raffle_id]?.title || '';
      const statusTag = r.status === 'paid' 
        ? '\x1b[32m[PAGO]\x1b[0m' 
        : r.status === 'pending' 
        ? '\x1b[33m[PENDENTE]\x1b[0m' 
        : '\x1b[31m[CANCELADO]\x1b[0m';
      console.log(`  ${statusTag} Nº \x1b[1m${r.number}\x1b[0m | ${r.buyer_name || 'Anônimo'} (${r.buyer_phone || 'S/ Tel'}) | ${formatDate(r.created_at)} ${rifaNome ? `\x1b[90m[${rifaNome}]\x1b[0m` : ''}`);
    });
    console.log('');
  }

  console.log('\x1b[36m========================================================================\x1b[0m');
  console.log('\x1b[32m🔔 Monitorando compras em TEMPO REAL (Supabase Realtime)...\x1b[0m');
  console.log('\x1b[90mComandos úteis em outro terminal:');
  console.log('  • Gerar Excel/CSV:  node monitor_compras.mjs --export');
  console.log('  • Buscar Comprador: node monitor_compras.mjs --busca "Nome ou Telefone"\x1b[0m');
  console.log('\x1b[36m========================================================================\x1b[0m\n');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--export') || args.includes('-e')) {
    await exportarRelatorio();
    process.exit(0);
  }

  const buscaIdx = args.findIndex(a => a === '--busca' || a === '-b');
  if (buscaIdx !== -1 && args[buscaIdx + 1]) {
    await buscarComprador(args[buscaIdx + 1]);
    process.exit(0);
  }

  console.log('\x1b[34mIniciando conexão com Supabase Realtime...\x1b[0m');
  const initialData = await getFullData();
  if (initialData) {
    renderDashboard(initialData);
  }

  // Ouvir mudanças em tempo real na tabela reservations
  supabase
    .channel('reservations_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, async (payload) => {
      process.stdout.write('\x07'); // Beep sonoro no Windows/Terminal
      
      const time = new Date().toLocaleTimeString('pt-BR');
      if (payload.eventType === 'INSERT') {
        const item = payload.new;
        if (item.status === 'paid') {
          console.log(`\n\x1b[42m\x1b[30m 🟢 NOVO PAGAMENTO CONFIRMADO! [${time}] \x1b[0m`);
          console.log(`\x1b[32m  Bilhete: \x1b[1m${item.number}\x1b[0m | Comprador: \x1b[1m${item.buyer_name}\x1b[0m | Tel: ${item.buyer_phone} | Valor: ${formatCurrency(item.payment_amount)}`);
        } else {
          console.log(`\n\x1b[43m\x1b[30m 🟡 NOVA RESERVA GERADA! [${time}] \x1b[0m`);
          console.log(`\x1b[33m  Bilhete: \x1b[1m${item.number}\x1b[0m | Comprador: \x1b[1m${item.buyer_name}\x1b[0m | Tel: ${item.buyer_phone} (Aguardando PIX)`);
        }
      } else if (payload.eventType === 'UPDATE') {
        const item = payload.new;
        if (item.status === 'paid' && payload.old && payload.old.status !== 'paid') {
          console.log(`\n\x1b[42m\x1b[30m 🟢 PIX PAGO COM SUCESSO! [${time}] \x1b[0m`);
          console.log(`\x1b[32m  Bilhete: \x1b[1m${item.number}\x1b[0m | Comprador: \x1b[1m${item.buyer_name}\x1b[0m | Tel: ${item.buyer_phone} | Status: PAGO`);
        } else {
          console.log(`\n\x1b[36m🔄 Atualização: Bilhete ${item.number} -> Status: ${item.status}\x1b[0m`);
        }
      } else if (payload.eventType === 'DELETE') {
        console.log(`\n\x1b[31m🔴 Bilhete liberado/cancelado [${time}]\x1b[0m`);
      }

      const freshData = await getFullData();
      if (freshData) {
        setTimeout(() => renderDashboard(freshData), 2500);
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('\x1b[32m✅ Conectado com sucesso ao canal de Realtime do Supabase!\x1b[0m\n');
      }
    });

  // Atualização periódica de backup a cada 30 segundos
  setInterval(async () => {
    const freshData = await getFullData();
    if (freshData) {
      renderDashboard(freshData);
    }
  }, 30000);
}

main();
