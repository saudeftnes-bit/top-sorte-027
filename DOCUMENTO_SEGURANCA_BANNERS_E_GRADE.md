# 📘 Manual Oficial: Segurança, Banners e Grade de Cotas — Top Sorte 027

**Sistema:** Top Sorte 027  
**Data da Revisão Técnica:** 02/11/2026  
**Status do Ambiente:** Produção Ativa e Blindada  

---

## 1. 🛡️ Arquitetura de Segurança e Blindagem do Sistema

### 1.1. O Problema Identificado Anteriormente
No modelo inicial, a validação de acesso ao painel de administração continha fragilidades comuns em aplicações puramente estáticas:
- **Exposição de Variáveis no Bundle:** Variáveis com o prefixo `VITE_` (como `VITE_ADMIN_PASSWORD`) eram compiladas estaticamente para dentro do arquivo JavaScript (`dist/assets/index-*.js`), permitindo que qualquer visitante inspecionasse o código no **F12 (DevTools)** e lesse a senha em texto puro.
- **Armazenamento de Sessão Frágil:** A validação se apoiava apenas em uma flag `admin_authenticated = 'true'` no `localStorage`, facilmente alterada via console do navegador.
- **Ausência de Rate Limiting:** Não havia limitação de tentativas consecutivas, viabilizando tentativas de adivinhação automatizadas.

---

### 1.2. As Correções e Proteções Implementadas

#### A. Autenticação 100% no Servidor (Zero Exposição no F12)
- **Criação da Rota Serverless:** Arquivo [`api/admin-login.ts`](./api/admin-login.ts).
- **Isolamento de Variáveis:** A senha de administração agora reside exclusivamente nos servidores de nuvem da Vercel (`ADMIN_PASSWORD`), sem qualquer injeção no bundle de frontend do cliente.
- **Assinatura Criptográfica:** O servidor valida o hash SHA-256 e emite um token assinado com HMAC-SHA256 e timestamp, com expiração automática.
- **Proteção contra Timing Attacks:** Uso de comparação segura e delay artificial de 800ms em tentativas com senha incorreta para mitigar ataques de força bruta.

#### B. Rate Limiting no Cliente (Bloqueio Automático)
- Se forem digitadas **5 senhas incorretas consecutivas**, o painel administrativo bloqueia o usuário imediatamente por **5 minutos**.
- Um cronômetro decrescente (`MM:SS`) é renderizado na tela e os campos de entrada são desabilitados.

#### C. Sessão com Expiração Automática
- A sessão (`admin_session`) possui validade estrita de **8 horas**. 
- Ao final desse período, ou caso o token sofra adulteração, o sistema expulsa o usuário de volta à tela de login.

#### D. Gatilho Secreto de Acesso ao Painel
- Para exibir o botão de login administrativo na interface pública, agora são exigidos **7 cliques rápidos consecutivos no logotipo** do cabeçalho (anteriormente 5).
- Acesso direto via rota `/admin` permanece disponível, porém sujeito à autenticação obrigatória pelo servidor.

#### E. Módulo Interno de Gestão de Senha ([`components/admin/AdminSecurity.tsx`](./components/admin/AdminSecurity.tsx))
- Interface visual no painel para troca de senha com medidor de força (mínimo 12 caracteres, maiúsculas, minúsculas, números e caracteres especiais).
- Validação da senha antiga via API do servidor antes de emitir as instruções de atualização.

---

## 2. 🎨 Módulo de Banners e Identidade Visual

O visual do Top Sorte 027 é segmentado em componentes visuais de alto impacto para converter visitantes em compradores:

### 2.1. Banner Hero Principal ([`components/Hero.tsx`](./components/Hero.tsx))
- **Destaque do Prêmio:** Exibe a imagem principal da rifa ativa com efeito de zoom cinematográfico suave (*Ken Burns effect*).
- **Informações Dinâmicas:** 
  - Nome do concurso / prêmio em destaque.
  - Preço unitário da cota (ex: R$ 13,00) formatado em moeda brasileira.
  - Barra de progresso ao vivo com percentual de cotas vendidas.
  - Selo animado "ÚLTIMOS NÚMEROS" ou "EDIÇÃO DISPONÍVEL".
- **Botão de Ação (CTA):** Botão verde pulsante que rola suavemente até a grade de números ou abre diretamente o seletor.

### 2.2. Prova Social e Galeria de Ganhadores ([`components/Testimonials.tsx`](./components/Testimonials.tsx))
- Carrossel com fotos reais de compradores que já foram contemplados em sorteios anteriores.
- Exibição de comprovantes de transferências PIX e depoimentos gravados para gerar confiança imediata.

### 2.3. Banners de Diferenciais e Garantias ([`components/Benefits.tsx`](./components/Benefits.tsx))
- Cards com ícones explicativos destacando:
  - ⚡ *Pagamento e baixa instantânea via PIX.*
  - 🔒 *Sorteio 100% auditável baseado na Loteria Federal.*
  - 💬 *Suporte humano e assistente virtual 24h via WhatsApp.*

---

## 3. 🔢 Arquitetura da Grade de Números e Reservas

A grade de cotas é o coração do sistema, localizada em [`components/RaffleSelection.tsx`](./components/RaffleSelection.tsx) e alimentada em tempo real pelo banco de dados Supabase.

### 3.1. Estados Visuais das Cotas
| Cor | Estado | Significado Técnico |
| :--- | :--- | :--- |
| **Cinza** | `available` (Disponível) | Número livre no banco de dados. Qualquer usuário pode clicar para selecionar. |
| **Verde** | `selected` (Selecionado) | Cota escolhida pelo usuário atual nesta sessão (armazenada temporariamente com lease). |
| **Amarelo** | `pending` (Pendente / PIX) | Cobrança gerada com QR Code aguardando pagamento. Fica bloqueada para terceiros durante o tempo do timeout. |
| **Roxo** | `paid` (Paga / Confirmada) | Cota com pagamento confirmado via Webhook PIX da EFI. Bloqueada permanentemente contra qualquer alteração. |

---

### 3.2. Mecanismo de Reserva Temporária e Prevenção de Conflitos
- **Identificador de Sessão Único:** Cada visitante recebe um UUID exclusivo (`sessionId`).
- **Reserva Atômica no Banco:** Ao clicar em um número livre, o sistema grava uma reserva provisória com data de expiração (`expires_at`). Se outro participante tentar o mesmo número na mesma fração de segundo, o banco rejeita a segunda tentativa (prevenção de *Race Condition*).
- **Limite por Compra:** Trava de segurança configurada para limitar o número máximo de cotas por transação (ex: 10 cotas), evitando que um único participante esgote a grade sem pagar.
- **Cronômetro de Reserva:** Cronômetro regressivo visível na barra de seleção que devolve os números automaticamente para a grade caso o comprador feche o navegador ou desista.

---

### 3.3. Grade e Gerador de Print no Admin ([`components/admin/RaffleGridView.tsx`](./components/admin/RaffleGridView.tsx))
- **Visão Geral Completa:** Permite ao administrador visualizar todos os números de `00` a `99` (ou `000` a `999`), com os nomes dos compradores sobre cada cota.
- **Marcação de Ganhadores:** Permite clicar nos números sorteados ou digitá-los manualmente para definir 1º, 2º, 3º lugar, etc.
- **Exportação de Print em Alta Resolução (DPR = 3):** Gera automaticamente uma imagem vertical estilizada pronta para publicação nos Stories do Instagram e Status do WhatsApp com:
  - Logotipo oficial do Top Sorte 027.
  - Nome do sorteio e data.
  - Selos dourados com o número contemplado e o nome do ganhador.
  - Link direto para enviar mensagem de congratulações no WhatsApp do ganhador.

---

## 4. 📋 Checklist de Operação Segura para a Administração

1. **Nunca compartilhe a chave `ADMIN_PASSWORD`** por mensagens abertas.
2. **Atualizações de senha** devem ser feitas sempre pelo painel do Vercel em **Settings ➔ Environment Variables**.
3. **Logs de Auditoria:** O arquivo de auditoria em produção pode ser verificado inspecionando a resposta de `/api/admin-login`.
4. **Deploy Automático:** Qualquer alteração enviada para o ramo `main` do GitHub dispara a compilação e deploy protegidos na Vercel instantaneamente.
