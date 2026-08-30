-- ==================================================================================
-- 🎯 TOP SORTE 027 - PAINEL DE MONITORAMENTO SQL (SUPABASE)
-- Execute estas consultas no SQL Editor do Supabase para acompanhar em tempo real:
-- 1. Resumo Geral de Vendas e Arrecadação
-- 2. Últimos Pagamentos Confirmados (PIX Aprovados)
-- 3. Reservas Pendentes (Aguardando PIX com contagem de minutos restantes)
-- 4. Atrasos / Reservas Expiradas (Números que precisam ser liberados)
-- 5. Auditoria de Falhas e Transações EFI (Webhook e PIX)
-- 6. Verificação de Inconsistências
-- 7. Liberação Imediata de Números Expirados
-- ==================================================================================

-- ==================================================================================
-- 📊 1. RESUMO GERAL DA RIFA ATIVA
-- ==================================================================================
SELECT 
    r.title AS "Rifa",
    r.status AS "Status Rifa",
    r.price_per_number AS "Preço Unitário (R$)",
    r.total_numbers AS "Total Números",
    COUNT(res.id) FILTER (WHERE res.status = 'paid') AS "Números Pagos",
    COUNT(res.id) FILTER (WHERE res.status = 'pending' AND (res.expires_at IS NULL OR res.expires_at > NOW())) AS "Reservas Ativas",
    COUNT(res.id) FILTER (WHERE res.status = 'pending' AND res.expires_at <= NOW()) AS "Reservas Expiradas",
    (r.total_numbers - COUNT(res.id) FILTER (WHERE res.status IN ('paid', 'pending') AND (res.expires_at IS NULL OR res.expires_at > NOW()))) AS "Números Livres",
    COALESCE(SUM(res.payment_amount) FILTER (WHERE res.status = 'paid'), 0) AS "Total Arrecadado (R$)"
FROM raffles r
LEFT JOIN reservations res ON res.raffle_id = r.id
WHERE r.status = 'active'
GROUP BY r.id, r.title, r.status, r.price_per_number, r.total_numbers;


-- ==================================================================================
-- 🟢 2. ÚLTIMOS PAGAMENTOS CONFIRMADOS (PAGOS)
-- ==================================================================================
SELECT 
    res.number AS "Nº Bilhete",
    res.buyer_name AS "Comprador",
    res.buyer_phone AS "WhatsApp",
    res.payment_amount AS "Valor (R$)",
    res.payment_method AS "Método",
    res.status AS "Status",
    to_char(res.updated_at, 'DD/MM/YYYY HH24:MI:SS') AS "Data/Hora Pagamento",
    res.efi_txid AS "TXID",
    res.payment_proof_url AS "Comprovante"
FROM reservations res
JOIN raffles r ON r.id = res.raffle_id
WHERE res.status = 'paid'
ORDER BY res.updated_at DESC
LIMIT 25;


-- ==================================================================================
-- 🟡 3. RESERVAS PENDENTES (AGUARDANDO PAGAMENTO PIX)
-- Mostra quanto tempo falta para expirar
-- ==================================================================================
SELECT 
    res.number AS "Nº Bilhete",
    res.buyer_name AS "Comprador",
    res.buyer_phone AS "WhatsApp",
    res.payment_amount AS "Valor (R$)",
    ROUND(EXTRACT(EPOCH FROM (res.expires_at - NOW())) / 60, 1) AS "Minutos Restantes",
    CASE 
        WHEN res.expires_at > NOW() THEN '⏳ Aguardando PIX'
        ELSE '⚠️ EXPIRADO (Atrasado)'
    END AS "Situação",
    res.efi_txid AS "TXID EFI",
    to_char(res.created_at, 'DD/MM/YYYY HH24:MI:SS') AS "Reservado Em",
    to_char(res.expires_at, 'DD/MM/YYYY HH24:MI:SS') AS "Expira Em"
FROM reservations res
JOIN raffles r ON r.id = res.raffle_id
WHERE res.status = 'pending'
ORDER BY res.expires_at ASC;


-- ==================================================================================
-- 🔴 4. ATRASOS: RESERVAS QUE EXPIRARAM E ESTÃO BLOQUEANDO NÚMEROS
-- ==================================================================================
SELECT 
    res.id AS "Reserva ID",
    res.number AS "Nº Preso",
    res.buyer_name AS "Comprador",
    res.buyer_phone AS "WhatsApp",
    ROUND(EXTRACT(EPOCH FROM (NOW() - res.expires_at)) / 60, 1) AS "Minutos em Atraso",
    to_char(res.expires_at, 'DD/MM/YYYY HH24:MI:SS') AS "Expirou Em",
    res.efi_txid AS "TXID"
FROM reservations res
WHERE res.status = 'pending'
  AND res.expires_at IS NOT NULL
  AND res.expires_at < NOW()
ORDER BY res.expires_at ASC;


-- ==================================================================================
-- ⚠️ 5. AUDITORIA DE TRANSAÇÕES EFI / PIX (Histórico de Cobranças)
-- ==================================================================================
SELECT 
    t.txid AS "TXID",
    t.status AS "Status Transação",
    t.buyer_name AS "Comprador",
    t.buyer_phone AS "WhatsApp",
    t.amount AS "Valor (R$)",
    to_char(t.created_at, 'DD/MM/YYYY HH24:MI:SS') AS "Criado Em",
    to_char(t.paid_at, 'DD/MM/YYYY HH24:MI:SS') AS "Pago Em"
FROM efi_transactions t
ORDER BY t.created_at DESC
LIMIT 20;


-- ==================================================================================
-- 🔍 6. INCONSISTÊNCIAS / FALHAS DE SINCRONIZAÇÃO
-- Verifica se há PIX pago na EFI que não atualizou a reserva para 'paid'
-- ==================================================================================
SELECT 
    t.txid AS "TXID",
    t.buyer_name AS "Comprador",
    t.amount AS "Valor EFI",
    t.status AS "Status na EFI",
    r.status AS "Status na Reserva",
    r.number AS "Nº Bilhete"
FROM efi_transactions t
JOIN reservations r ON r.efi_txid = t.txid
WHERE t.status = 'paid' AND r.status != 'paid';


-- ==================================================================================
-- 🧹 7. LIBERAÇÃO IMEDIATA: LIMPAR RESERVAS EXPIRADAS (EXECUTE QUANDO QUISER LIMPAR)
-- ==================================================================================
-- Descomente e execute a linha abaixo para apagar na hora reservas vencidas:
-- DELETE FROM reservations WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW();
