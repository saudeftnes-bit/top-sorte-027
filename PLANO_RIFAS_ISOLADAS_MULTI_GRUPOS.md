# 📋 Planejamento de Atualização: Rifas Isoladas por Grupos (Multi-Campanhas)

> **Status:** Documentado e pronto para implementação quando você estiver com o Grupo 2 estruturado.  
> **Objetivo:** Permitir rodar várias rifas ao mesmo tempo de forma 100% isolada (Grupo 1 só enxerga a Rifa 1, Grupo 2 só enxerga a Rifa 2) usando a **mesma conta Efí Bank (Pix)** e o **mesmo banco Supabase**, com risco zero para rifas em andamento.

---

## 🎯 1. Como Funciona a Modalidade

1. **Rifa 1 (Grupo 1):** Divulgada com o link `seusite.com/?r=0001`
   - O visitante entra e vê **apenas** as informações, fotos, prêmios e números da Rifa 1.
   - A lista de "Outras Rifas" fica completamente oculta.
   - O participante não tem acesso nem sabe da existência de outras rifas ativas.

2. **Rifa 2 (Grupo 2):** Divulgada com o link `seusite.com/?r=0002`
   - O visitante entra e vê **apenas** a Rifa 2.
   - Totalmente blindada e independente.

3. **Acesso Direto Sem Parâmetro (`seusite.com`):**
   - Mantém o comportamento atual (abre a rifa principal ativa em destaque), garantindo **100% de compatibilidade** com pessoas que já possuem o link antigo salvo.

---

## 🛡️ 2. Garantias Técnicas de Segurança (Por que não quebra nada?)

* **Efí Bank (Pix Automático):**  
  A Efí só aceita 1 URL de Webhook por chave Pix. Como todas as rifas continuam no mesmo site/servidor, o Webhook continua recebendo e confirmando os pagamentos de todas as rifas sem qualquer conflito, pois cada Pix tem um identificador único (`txid`).
* **Banco de Dados (Supabase):**  
  Todas as reservas e números já são indexados por `(raffle_id, number)`. O número `50` da Rifa 1 e o número `50` da Rifa 2 são tratados como registros totalmente distintos.
* **Blindagem de Concorrência:**  
  A proteção contra race conditions e o timer de reservas continuam funcionando isoladamente por rifa.

---

## 🛠️ 3. Roteiro de Implementação (Para a Próxima Atualização)

Quando você for liberar a atualização, os seguintes pontos já estão mapeados para alteração:

### Arquivo 1: `App.tsx`
- **Leitura do Parâmetro de URL:**
  Capturar o parâmetro `?r=` ou `?rifa=` na carga inicial:
  ```ts
  const searchParams = new URLSearchParams(window.location.search);
  const targetCode = searchParams.get('r') || searchParams.get('rifa');
  ```
- **Filtro de Rifa:**
  Se `targetCode` existir, buscar a rifa correspondente e travar o estado `isIsolatedMode = true`.
- **Navegação Restrita:**
  Se `isIsolatedMode` estiver ativo, o botão "Voltar" da seleção de números sempre retorna para a página daquela rifa específica, sem exibir catálogo global.

### Arquivo 2: `components/Home.tsx`
- **Ocultar Outras Rifas:**
  Quando `isIsolatedMode` estiver ativo, esconder a seção de *Outras Rifas* (`otherRaffles`), deixando a página visualmente 100% dedicada àquela campanha.

### Arquivo 3: `components/admin/RaffleList.tsx`
- **Botão "🔗 Copiar Link Exclusivo":**
  Adicionar em cada cartão de rifa um botão para copiar direto o link formatado com o código da rifa (ex: `https://seusite.com/?r=0001`), facilitando o envio para o WhatsApp do grupo correspondente.

---

## 📌 4. Checklist para quando for ativar

- [ ] Criar a Rifa 2 no Painel Admin (definir prêmio, cotas e valor).
- [ ] Solicitar a ativação do código documentado acima.
- [ ] Testar no navegador:
  - Abrir `/?r=CODIGO_RIFA_1` -> Confirmar que só aparece a Rifa 1.
  - Abrir `/?r=CODIGO_RIFA_2` -> Confirmar que só aparece a Rifa 2.
  - Abrir sem parâmetro -> Confirmar que o fluxo padrão continua funcionando perfeitamente.
- [ ] Divulgar cada link para o seu respectivo grupo.

---
*Documento salvo no projeto para execução imediata assim que você solicitar.*
