# 🛡️ Relatório Técnico de Atualização: Blindagem Total de Concorrência, Limpeza Automática e Deploy

**Data da Atualização:** 24/09/2026  
**Sistema:** TopPix / PremiaMax  
**Deploy Produção (Vercel):** [https://premiamax.vercel.app](https://premiamax.vercel.app)  
**Deployment ID:** `dpl_EiFgNW6AuGGDErya5YBBaFn1rzkn`  
**Ambientes Afetados:** Banco de Dados (Supabase PostgreSQL), Serverless Functions (Vercel API), Frontend SPA (React/Vite) e Painel Administrativo.

---

## 1. Sumário Executivo

Esta atualização implementou uma arquitetura atômica em nível de banco de dados para eliminar de forma definitiva problemas de **Race Condition (concorrência simultânea)** na escolha de números, checkout PIX, resgates de brindes gratuitos e sincronização de pagamentos, além de corrigir a persistência e visualização de sessões temporárias expiradas no Painel Administrativo.

---

## 2. Diagnóstico das Causas-Raiz

| Problema Identificado | Causa-Raiz | Solução Aplicada |
|---|---|---|
| **Conflito no Clique Simultâneo** | Frontend executava `upsert` permissivo direto na tabela sem lock relacional. | Função RPC `reserve_number_atomic` com `SELECT ... FOR UPDATE SKIP LOCKED`. |
| **Compra Duplicada no Checkout** | SELECT de validação e UPSERT de reserva eram desacoplados (janela de milissegundos). | Função RPC `lock_numbers_for_pix` com política de transação "tudo-ou-nada". |
| **Sobrescrita de Comprador no Webhook** | Webhook executava `upsert` com base apenas no número, podendo trocar o `buyer_name` de um número já pago. | Função RPC `confirm_payment_by_txid` como única autoridade de pagamento com travas de integridade. |
| **Perda de Reservas com PIX Ativo** | A rotina de limpeza deletava qualquer reserva `pending` sem verificar se possuía cobrança PIX emitida. | Função `expire_old_reservations` com margem de 10 minutos de tolerância para PIX pendentes e exclusão apenas de registros sem `efi_txid`. |
| **Sessões Temporárias no Painel Admin** | Reservas temporárias de carrinho (`session_...`) expiradas permaneciam visíveis no painel. | Execução automática de `cleanupExpiredReservations` ao carregar telas e filtro defensivo de sessões expiradas no `PaymentManager`. |

---

## 3. Alterações Implementadas por Camada

### A. Banco de Dados (Supabase PostgreSQL)
Arquivo criado e executado: [`CORRECAO_DEFINITIVA_RACE_CONDITION.sql`](./CORRECAO_DEFINITIVA_RACE_CONDITION.sql)

1. **`reserve_number_atomic(p_raffle_id, p_number, p_session_id, p_expires_at)`**:
   - Bloqueia a linha a nível de transação relacional (`SELECT FOR UPDATE SKIP LOCKED`).
   - Se 2 pessoas clicarem no mesmo número ao mesmo tempo, uma adquire o lock e a outra é imediatamente recusada com código `concurrent` ou `reserved`.
2. **`lock_numbers_for_pix(...)`**:
   - Trava atomicamente todo o lote de números antes de emitir a cobrança na EFI.
   - Aplica política "tudo ou nada": havendo qualquer conflito em 1 número, a transação reverte 100% e a cobrança não é criada.
3. **`confirm_payment_by_txid(...)`**:
   - Única autoridade para marcar reservas como `paid`.
   - Protege o comprador original contra alterações ou sobrescritas de outros eventos.
   - Executa encerramento automático da rifa se todas as cotas forem vendidas.
4. **`expire_old_reservations()`**:
   - Deleta apenas seleções temporárias sem PIX (`efi_txid IS NULL`).
   - Mantém tolerância segura de 10 minutos para pagamentos PIX pendentes antes de marcar como `cancelled`.
   - **Nunca** altera ou remove registros com status `paid`.
5. **Triggers Protetores**:
   - `trg_prevent_delete_paid`: Bloqueia qualquer instrução `DELETE` em números pagos.
   - `trg_prevent_overwrite_paid`: Bloqueia tentativas de rebaixar status de `paid` ou alterar o titular de números pagos.
   - `trg_prevent_overwrite_active_pix`: Bloqueia sobrescrita de números com PIX ativo de outro comprador dentro do prazo de validade.

---

### B. Backend & Serverless Functions (Vercel API)

1. **[`api/efi-charge.ts`](./api/efi-charge.ts)**:
   - Invoca `lock_numbers_for_pix` antes de se comunicar com a API da EFI.
   - Se houver conflito, retorna imediatamente `HTTP 409 Conflict` com o motivo (`paid`, `reserved`, `concurrent`), sem gerar cobrança indevida.
   - Após obter o QR Code da EFI, utiliza `UPDATE` estrito (não `UPSERT`).
2. **[`api/efi-webhook.ts`](./api/efi-webhook.ts)**:
   - Integrado à RPC central `confirm_payment_by_txid`.
   - Fallback defensivo que apenas atualiza por `efi_txid` sem tocar no comprador gravado.
3. **[`api/efi-status.ts`](./api/efi-status.ts)**:
   - Polling de consulta unificado com a mesma RPC do webhook, garantindo idempotência absoluta.

---

### C. Frontend & Aplicação React

1. **[`lib/selection-manager.ts`](./lib/selection-manager.ts)**:
   - Substituído `upsert` direto pela chamada à RPC `reserve_number_atomic`.
   - Remoção de seleção restrita a registros com `efi_txid IS NULL`.
2. **[`App.tsx`](./App.tsx)**:
   - Tratamento de mensagens amigáveis e específicas por motivo de recusa atômica.
   - Chamada automática de `cleanupExpiredReservations` na montagem e sincronização da grade.
3. **[`components/admin/PaymentManager.tsx`](./components/admin/PaymentManager.tsx)**:
   - Execução automática de `cleanupExpiredReservations` ao abrir o painel.
   - Filtro inteligente que oculta sessões temporárias de carrinho (`session_...`) expiradas sem PIX gerado.
4. **Correções de Tipagem e Imports:**
   - [`components/HistoricalRaffleView.tsx`](./components/HistoricalRaffleView.tsx), [`components/FAQChatbot.tsx`](./components/FAQChatbot.tsx), [`components/WhatsAppButton.tsx`](./components/WhatsAppButton.tsx), [`lib/icons.tsx`](./lib/icons.tsx).

---

## 4. Fluxo Operacional Após a Atualização

```
[Cliente Clica na Grade] ────────> RPC reserve_number_atomic (Lock Adquirido) ──> Amarelo na Grade
                                              │
[Outro Cliente Clica Junto] ──────────────────┴──> RPC Recusa Imediatamente (409) ──> Alerta no App

[Cliente vai ao Checkout] ──────> lock_numbers_for_pix ──> Trava Atômica Total ──> Gera Cobrança PIX
                                                                                       │
                                                                               Cliente Realiza PIX
                                                                                       │
                                                        confirm_payment_by_txid <──────┘
                                                        (Webhook / Polling Idempotente)
                                                                       │
                                                         Número cravado como PAID
                                                         (Triggers protegem o registro)
```

---

## 5. Validação e Status de Produção

- **TypeScript Compilation (`tsc --noEmit`):** ✅ 0 erros (código de saída `0`).
- **Vite Production Build (`npm run build`):** ✅ Compilado com sucesso (15.27s).
- **Triggers do Banco (Supabase):** ✅ Ativos e validados.
- **Deploy Vercel:** ✅ Produção ativa em **[https://premiamax.vercel.app](https://premiamax.vercel.app)**.
