# 🛡️ Relatório Técnico de Atualização: Blindagem e Correção Definitiva de Concorrência (Race Condition)

**Data:** 20/09/2026  
**Sistema:** Top Sorte — Ganhe Prêmios Reais  
**Deploy URL:** [https://topsorte-027.vercel.app](https://topsorte-027.vercel.app)  
**Ambientes Afetados:** Banco de Dados (Supabase), Serveless Functions (Vercel API) e Frontend SPA (React/Vite).

---

## 1. Contexto e Motivação

### Sintomas Relatados pelos Usuários:
1. *"Comprei tal número e na hora de pagar o mesmo já estava em nome de outra pessoa."*
2. *"Comprei o 71 no momento que estava disponível e ao confirmar o mesmo já estava em nome de outra pessoa."*
3. *"Escolhi, paguei e o mesmo continua em modo de reserva."*

---

## 2. Investigação Profunda e Causas-Raiz Descobertas

Uma auditoria exaustiva em todos os arquivos de código e scripts de migração revelou **por que as proteções anteriores não surtiam efeito**:

| Falha Identificada | Onde Ocorria | Consequência |
|---|---|---|
| **Ausência Real de RPCs** | `api/efi-charge.ts` chamava `lock_numbers_for_pix` | A função SQL **nunca havia sido criada** no banco de dados. O `try/catch` silencioso mascarava o erro e caía em um fluxo permissivo sem nenhuma trava de concorrência. |
| **Triggers Protetores Deletados** | Banco de Dados / Scripts SQL antigos | Migrações passadas executaram `DROP TRIGGER trg_prevent_overwrite_paid` para contornar erros pontuais de webhook, deixando as tabelas sem proteção nativa contra `UPSERT` sobrescrevendo registros pagos. |
| **Race Condition por Desacoplamento (SELECT + UPSERT)** | `lib/selection-manager.ts` | O clique na grade consultava o banco e, em seguida, realizava um `UPSERT`. O intervalo de milissegundos entre as duas consultas permitia que 2 ou mais pessoas lessem o número como livre e ambas enviassem a reserva. |
| **Conflito entre Webhook e Polling** | `api/efi-webhook.ts` e `api/efi-status.ts` | Ambos realizavam `UPSERT` livre com dados de compradores. Se chegasse confirmação atrasada ou divergente, o segundo evento podia sobrescrever o `buyer_name` original. |
| **Cleanup Agressivo** | `lib/cleanup.ts` / rotinas antigas | Reservas com PIX emitido cujo pagamento demorava alguns minutos podiam ser canceladas/apagadas antes da chegada do webhook da EFI. |

---

## 3. Alterações Implementadas

### A. Banco de Dados (Supabase)
Criado o script consolidado [`CORRECAO_DEFINITIVA_RACE_CONDITION.sql`](./CORRECAO_DEFINITIVA_RACE_CONDITION.sql) com travas em nível de motor relacional:

1. **Função `reserve_number_atomic`**:
   - Executa `SELECT ... FOR UPDATE SKIP LOCKED`.
   - Bloqueia a linha a nível de transação. Se dois clientes clicarem ao mesmo tempo, um garante o lock e o outro recebe imediatamente recusa segura com motivo `concurrent` ou `reserved`.
2. **Função `lock_numbers_for_pix`**:
   - Bloqueia atomicamente todo o conjunto de dezenas selecionadas pelo comprador antes de emitir a cobrança.
   - Aplica política de "tudo ou nada": se 1 número do carrinho estiver indisponível, nenhum número é reservado e a transação é revertida.
3. **Função `confirm_payment_by_txid`**:
   - Única autoridade para registrar pagamentos.
   - Atualiza para `status = 'paid'` apenas conferindo o `efi_txid` correspondente. Protege contra alteração de nome do cliente se o número já estiver como pago.
4. **Função `expire_old_reservations`**:
   - Nunca remove ou altera registros com `status = 'paid'`.
   - Limpa apenas seleções temporárias sem PIX (`efi_txid IS NULL`).
   - Concede margem de tolerância segura de 10 minutos para PIX pendentes antes de marcá-los como `cancelled` (mantendo integridade de auditoria).
5. **Triggers de Bloqueio Físico**:
   - `trg_prevent_delete_paid`: Bloqueia qualquer tentativa de `DELETE` em números pagos.
   - `trg_prevent_overwrite_paid`: Bloqueia qualquer tentativa de `UPDATE` que altere ou degrade um número já pago.
   - `trg_prevent_overwrite_active_pix`: Bloqueia tentativas de sobrescrever reservas com cobrança PIX ainda válida de outro cliente.

---

### B. Backend / Vercel Serverless Functions

1. **[`api/efi-charge.ts`](./api/efi-charge.ts)**:
   - Removido o fallback silencioso permissivo.
   - Se `lock_numbers_for_pix` rejeitar ou falhar, a API retorna `409 Conflict` imediatamente e **não cria a cobrança na EFI**, impedindo que o cliente pague por um número disputado.
   - Após a emissão do QR Code, apenas atualiza (`UPDATE`) as linhas previamente travadas, sem utilizar `UPSERT` perigoso.
2. **[`api/efi-webhook.ts`](./api/efi-webhook.ts)**:
   - Migrado para invocar a RPC central `update_efi_transaction_status` / `confirm_payment_by_txid`.
   - Fallback defensivo atualiza estritamente por `efi_txid` sem tocar no nome do comprador.
3. **[`api/efi-status.ts`](./api/efi-status.ts)**:
   - Polling unificado com a mesma RPC do webhook, garantindo idempotência e evitando colisões entre requisições.

---

### C. Frontend / Aplicação React

1. **[`lib/selection-manager.ts`](./lib/selection-manager.ts)**:
   - Substituída a lógica de `SELECT + UPSERT` pela chamada direta a `reserve_number_atomic`.
   - Remoção de reservas restrita a registros sem PIX gerado (`efi_txid IS NULL`), impedindo que o carrinho apague pagamentos em processamento.
2. **[`App.tsx`](./App.tsx)**:
   - Tratamento de retorno atômico: se o clique em um número for rejeitado no banco, a interface alerta imediatamente o comprador para selecionar outra dezena.
   - Correção dos módulos de finalização automática de sorteios para compatibilidade estrita do TypeScript.

---

## 4. Validação e Deploy

- **TypeScript Compilation:** `npx tsc --noEmit` executado com código de saída 0 (zero erros).
- **Vite Production Build:** `npm run build` gerado e empacotado com sucesso.
- **Git Commit:** Hash `08e736b` com todas as blindagens incluídas.
- **Deploy Vercel:** Concluído com status `READY` em produção:
  - Domínio: [https://topsorte-027.vercel.app](https://topsorte-027.vercel.app)
  - Deployment ID: `dpl_EYJZjjNgHDtQW4kCd6dNnULwTRnu`
- **Validação de Triggers no Banco (Supabase):**
  - `trg_prevent_delete_paid`: **ATIVO**
  - `trg_prevent_overwrite_active_pix`: **ATIVO**
  - `trg_prevent_overwrite_paid`: **ATIVO**

---

## 5. Como o Sistema se Comporta Agora

```
[Cliente 1 Clica] ────────> RPC reserve_number_atomic (Lock Adquirido) ──> Amarelo na Grade
                                       │
[Cliente 2 Clica no mesmo número] ─────┴──> RPC Bloqueia Instantaneamente (409) ──> Mensagem de Alerta

[Cliente 1 vai ao Checkout] ─> lock_numbers_for_pix ─> Trava Total Garantida ─> Gera PIX EFI
                                                                                   │
                                                                           Cliente 1 Paga
                                                                                   │
                                                      confirm_payment_by_txid <────┘
                                                      (Webhook / Polling Idempotente)
                                                                   │
                                                      Número cravado como PAID
                                                      (Triggers bloqueiam qualquer alteração futura)
```
