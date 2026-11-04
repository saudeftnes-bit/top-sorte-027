# 📋 Documentação Técnica e Operacional: Banners de Propaganda e Grade de Números

**Sistema:** Top Sorte 027 (TopPix)  
**Versão:** Produção Blindada 2.0  
**Ambiente:** React + TypeScript + Tailwind CSS + Supabase Realtime + HTML5 Canvas  

---

## 📌 Sumário
1. [Visão Geral](#1-visão-geral)
2. [Módulo de Banners de Propaganda e Identidade Visual](#2-módulo-de-banners-de-propaganda-e-identidade-visual)
   - 2.1 [Banner Principal (Hero da Rifa em Destaque)](#21-banner-principal-hero-da-rifa-em-destaque)
   - 2.2 [Banner de "Novidades Chegando" (Sem Rifa Ativa)](#22-banner-de-novidades-chegando-sem-rifa-ativa)
   - 2.3 [Banners de Campanhas Concluídas / Outras Rifas](#23-banners-de-campanhas-concluídas--outras-rifas)
   - 2.4 [Carrossel Cinematográfico de Ganhadores (Prova Social)](#24-carrossel-cinematográfico-de-ganhadores-prova-social)
   - 2.5 [Banner Institucional de Conversão e Dúvidas](#25-banner-institucional-de-conversão-e-dúvidas)
3. [Módulo da Grade de Números (Cotas)](#3-módulo-da-grade-de-números-cotas)
   - 3.1 [Arquitetura e Layout da Grade Pública](#31-arquitetura-e-layout-da-grade-pública)
   - 3.2 [Estados Visuais e Códigos de Cor](#32-estados-visuais-e-códigos-de-cor)
   - 3.3 [Modalidades de Sorteio (Federal vs Jogo do Bicho)](#33-modalidades-de-sorteio-federal-vs-jogo-do-bicho)
   - 3.4 [Dock Inferior Fixo de Seleção e Checkout](#34-dock-inferior-fixo-de-seleção-e-checkout)
   - 3.5 [Segurança, Concorrência e Blindagem de Reservas](#35-segurança-concorrência-e-blindagem-de-reservas)
4. [Grade Administrativa e Gerador de Print de Resultados](#4-grade-administrativa-e-gerador-de-print-de-resultados)
   - 4.1 [Conferência de Cotas no Painel](#41-conferência-de-cotas-no-painel)
   - 4.2 [Apuração e Marcação de Vencedores](#42-apuração-e-marcação-de-vencedores)
   - 4.3 [Gerador de Imagem Ultra HD para Stories/WhatsApp (Canvas 2D)](#43-gerador-de-imagem-ultra-hd-para-storieswhatsapp-canvas-2d)
5. [Tabela de Referência Rápida de Arquivos](#5-tabela-de-referência-rápida-de-arquivos)

---

## 1. Visão Geral

O sistema **Top Sorte 027** foi estruturado para proporcionar a mais alta taxa de conversão em dispositivos móveis e desktops, combinando:
- **Banners publicitários imersivos** com carregamento otimizado, gatilhos de urgência e prova social instantânea.
- **Grade de números ultra interativa** que atualiza em tempo real via WebSockets (Supabase Realtime), garantindo que compradores nunca selecionem uma cota já paga ou em processo de checkout por outro participante.

---

## 2. Módulo de Banners de Propaganda e Identidade Visual

### 2.1. Banner Principal (Hero da Rifa em Destaque)
**Arquivo:** [`components/Home.tsx`](./components/Home.tsx) (Linhas 170–250)

O banner da rifa ativa é o primeiro elemento visual de grande impacto ao acessar a página inicial:
- **Imagem do Prêmio em Destaque:** 
  - Proporção adaptativa com altura máxima (`max-h-[75vh]`) e efeito de zoom suave ao passar o cursor (*group-hover:scale-105*).
  - Imagem limpa sem sobreposições escuras opacas, preservando 100% da nitidez, brilho e atratividade do prêmio.
- **Badges de Urgência Flutuantes:**
  - *Canto Superior Esquerdo:* Pílula com status em tempo real:
    - `🟢 NOVA RIFA` (Verde vibrante `#00E676`)
    - `⏳ EM BREVE` (Amarelo dourado `#FACC15`)
    - `🔴 FINALIZADA` (Vermelho `#DC2626`)
  - *Canto Superior Direito:* Pílula com vidro fosco (*Backdrop Blur* `bg-black/60`) exibindo o código oficial da edição (Ex: `EDIÇÃO #027`).
- **Painel de Ação e Conversão:**
  - **Preço da Cota:** Destaque em tipografia expandida (Ex: `Apenas R$ 13,00 / cota`) com ponto de luz pulsante. Para sorteios de brinde, exibe automaticamente o badge comemorativo `100% Grátis`.
  - **Botão CTA Pulsante:** Botão largo em gradiente verde esmeralda com efeito de brilho e pulso (`animate-ping opacity-25`), direcionando o participante diretamente para a seleção de números.

---

### 2.2. Banner de "Novidades Chegando" (Sem Rifa Ativa)
**Arquivo:** [`components/Home.tsx`](./components/Home.tsx) (Linhas 253–289)

Exibido dinamicamente quando todos os sorteios foram encerrados e não há concurso em andamento:
- **Efeito Visual:** Fundo em gradiente profundo (`#004B8D` até `#010B1A`) com luzes dinâmicas pulsantes.
- **Motor de Frases Rotativas (`LoadingPhrases`):**
  - "Sincronizando prêmios..."
  - "Prepara sua sorte!"
  - "O próximo ganhador é você?"
  - "Carregando sonhos..."
  - "PIX DA SORTE EM BREVE"
- **Barra Shimmer:** Animação de feixe de luz contínuo que transmite dinamismo e expectativa para a próxima edição.

---

### 2.3. Banners de Campanhas Concluídas / Outras Rifas
**Arquivo:** [`components/Home.tsx`](./components/Home.tsx) (Linhas 292–356)

- Grade em cards responsivos (1 ou 2 colunas no celular/desktop).
- Título estilizado em gradiente animado (`RIFAS FINALIZADAS`).
- Miniatura da foto com efeito de corte em degradê e botão `👀 Visualizar rifa`.

---

### 2.4. Carrossel Cinematográfico de Ganhadores (Prova Social)
**Arquivo:** [`components/Home.tsx`](./components/Home.tsx) (Linhas 413–521)

O mais potente elemento de credibilidade para novos compradores:
- **Sincronização em Nuvem:** Alimentado dinamicamente pela tabela de fotos de ganhadores no Supabase (`getWinnerPhotos()`).
- **Transição com Efeito Ken Burns:** Imagens realizam zoom cinematográfico contínuo enquanto o slide está ativo.
- **Barra de Progresso no Topo:** Indicador em linha fina verde que se preenche nos 5 segundos de exibição de cada ganhador.
- **Card Glassmorphism Flutuante:**
  - Nome do premiado com tipografia de alta legibilidade.
  - Troféu dourado em relevo 🏆.
  - Discriminação do prêmio ganho (ex: *"R$ 5.000,00 no PIX"* ou *"iPhone 15 Pro"*).
- **Controles de Navegação:** Setas com vidro translúcido ao passar o mouse, contador numérico (`01 / 06`) e pílulas inferiores de salto rápido.

---

### 2.5. Banner Institucional de Conversão e Dúvidas
**Arquivo:** [`components/Home.tsx`](./components/Home.tsx) (Linhas 358–409 e 524–572)

- **Banner 3 Passos da Vitória:** Cards com ícones 3D explicando a jornada simples (1. Escolha seus Números ➔ 2. Pagamento PIX Instantâneo ➔ 3. Aguarde o Sorteio Oficial).
- **Banner de Atendimento WhatsApp:** Card de suporte humanizado com redirecionamento direto para a conversa do suporte oficial no WhatsApp (`wa.me`).
- **Selos de Confiança:** Badges fixos de segurança de dados (SSL 256-bit) e sorteio atrelado à **Loteria Federal / Jogo do Bicho**.

---

## 3. Módulo da Grade de Números (Cotas)

### 3.1. Arquitetura e Layout da Grade Pública
**Arquivo:** [`components/RaffleSelection.tsx`](./components/RaffleSelection.tsx)

A grade adota a identidade **Imperial Esmeralda & Ouro**, otimizada para toque rápido em telas de smartphones:
- **Distribuição em 5 Colunas:** Proporção perfeita para dedos em smartphones (tamanho `aspect-square`), evitando toques acidentais.
- **Formatação Automática de Dígitos:**
  - Até 100 números: formatação `00` a `99`.
  - Até 1.000 números: formatação `000` a `999`.
  - Acima de 1.000 números: formatação `0000` a `9999`.
- **Cabeçalho Integrado:** Logotipo oficial da TopSorte_27, valor da cota em fonte monospace dourada e selo da edição.

---

### 3.2. Estados Visuais e Códigos de Cor

| Estado da Cota | Cor de Fundo / Estilo | Identificação Visual | Ação ao Tocar |
| :--- | :--- | :--- | :--- |
| **Livre (Disponível)** | Verde escuro esmeralda (`#0A4D39` ➔ `#042B1F`) | Número em branco/esmeralda com brilho suave ao toque | Seleciona a cota para compra |
| **Selecionado (Seu)** | Dourado vibrante (`yellow-300` a `amber-500`) | Selo superior `✔ SEU` com sombra dourada neon | Desmarca a cota |
| **Reserva (Outro)** | Marrom escuro âmbar (`amber-950/60`) | Tag superior `RESERVA` em tom âmbar suave | Desabilitado (Não clicável) |
| **Pago (Confirmado)** | Roxo imperial profundo (`purple-800` a `purple-950`) | Tag `PAGO` + Primeiro nome do comprador gravado | Desabilitado (Não clicável) |

> 🔒 **Privacidade:** Para cotas pagas, a grade pública exibe apenas o **primeiro nome** do comprador (ex: *"Edvaldo"*), preservando sobrenomes e telefones.

---

### 3.3. Modalidades de Sorteio (Federal vs Jogo do Bicho)
O sistema adapta os selos e badges da grade dependendo da configuração da rifa:
- 🏛️ **Loteria Federal:** Concurso associado às extrações semanais da Caixa Econômica Federal.
- 🍀 **Jogo do Bicho:** Sorteio baseado nas dezenas/grupos da apuração estadual selecionada.

---

### 3.4. Dock Inferior Fixo de Seleção e Checkout
Quando o usuário seleciona 1 ou mais cotas, um menu inferior inteligente desliza suavemente (`slideUpDock`):
1. **Chips das Cotas Escolhidas:** Lista com os números marcados em badges dourados (ex: `#07`, `#23`, `#88`).
2. **Cronômetro Regressivo de Reserva:**
   - Exibe o tempo restante para conclusão (ex: `⏱️ 14:59`).
   - Se o tempo for inferior a 60 segundos, o cronômetro entra em **alerta vermelho piscante**, estimulando o fechamento do pedido.
3. **Botão Limpar Tudo:** Permite desmarcar todas as cotas selecionadas com um único clique.
4. **Resumo Financeiro:** Exibe a quantidade de cotas e o valor total formatado em Reais (`R$`).
5. **Botão de Pagamento:** Botão verde grande `PAGAR VIA PIX ➔` que abre imediatamente o modal de checkout e geração de QR Code.

---

### 3.5. Segurança, Concorrência e Blindagem de Reservas
- **Identificador de Sessão Exclusivo (`sessionId`):** Cada participante recebe um UUID temporário para garantir que suas seleções não interfiram com as de terceiros.
- **Prevenção de Race Condition (Concorrência):** A reserva provisória é registrada com expiração atômica no banco de dados. Caso dois usuários cliquem no mesmo número no mesmo milissegundo, a transação mais rápida assume a posse e a outra é informada que a cota acabou de ser reservada.
- **Liberação Automática:** Se o PIX não for liquidado antes do timeout (ou caso o cliente feche a aba), as rotinas automáticas devolvem os números livres à grade sem intervenção manual.

---

## 4. Grade Administrativa e Gerador de Print de Resultados

**Arquivo:** [`components/admin/RaffleGridView.tsx`](./components/admin/RaffleGridView.tsx)  
**Acesso:** Painel Admin ➔ Gerenciar Rifa ➔ **Grade e Print**

### 4.1. Conferência de Cotas no Painel
- Visão panorâmica de 100% da grade de cotas.
- Ao posicionar o mouse sobre as cotas pagas, exibe o nome completo do comprador e o comprovante atrelado.
- Contadores ao vivo de cotas livres, pendentes e pagas.

---

### 4.2. Apuração e Marcação de Vencedores
O administrador pode registrar os premiados de duas formas:
1. **Clique Direto na Grade:** O primeiro clique seleciona o **1º Prêmio (🥇)**, o segundo o **2º Prêmio (🥈)**, o terceiro o **3º Prêmio (🥉)**, e assim por diante.
2. **Entrada Manual de Cota:** Campo para digitar qualquer número (com preenchimento de zeros automático). Suporta prêmios repetidos caso a mesma pessoa ganhe mais de uma colocação.

Para cada vencedor selecionado, a tela disponibiliza:
- Edição do nome de exibição para publicação oficial.
- Botão com link direto para o WhatsApp do contemplado com mensagem de congratulações pré-formatada.
- Botão de remoção individual com recálculo automático da ordem dos prêmios.

---

### 4.3. Gerador de Imagem Ultra HD para Stories/WhatsApp (Canvas 2D)
Para divulgar os ganhadores sem depender de capturas de tela amadoras, o sistema inclui um renderizador gráfico nativo via HTML5 Canvas:
- **Resolução Ultra HD (DPR = 3):** Gera a arte em altíssima densidade de pixels, sem pixelização ao postar em Stories do Instagram ou Status do WhatsApp.
- **Formatos e Cores Oficiais:**
  - 🔵 **Azul Marinho Oficial** (`#001D3D`)
  - ⚫ **Preto Luxo** (`#0A0A0A`)
  - 🟣 **Roxo Sorte** (`#2E1065`)
  - 🟢 **Verde Esmeralda** (`#022C22`)
  - 🔴 **Vinho Nobre** (`#450A0A`)
  - 🟤 **Dourado Nobre** (`#451A03`)
  - 🎨 **Seletor Livre (Color Picker)** para cores personalizadas.
- **Estrutura da Imagem Gerada:**
  - Topo com logotipo TopPix e título do concurso.
  - Cartões dourados individuais por colocação, cota e nome do ganhador.
  - Rodapé comemorativo oficial *"Parabéns aos ganhadores!"*.
- **Download com 1 Clique:** Baixa o arquivo `.png` com o nome oficial formatado (ex: `resultado-rifa-027.png`).

---

## 5. Tabela de Referência Rápida de Arquivos

| Componente / Módulo | Caminho do Arquivo | Função Principal |
| :--- | :--- | :--- |
| **Banner Hero & Vitrine** | [`components/Home.tsx`](./components/Home.tsx) | Apresentação do prêmio principal, status da rifa, valor e botão CTA |
| **Carrossel de Ganhadores** | [`components/Home.tsx`](./components/Home.tsx) | Slideshow automático com fotos reais e depoimentos de ganhadores |
| **Hero Institucional** | [`components/Hero.tsx`](./components/Hero.tsx) | Banner secundário com garantias e prova social |
| **Grade Pública de Cotas** | [`components/RaffleSelection.tsx`](./components/RaffleSelection.tsx) | Seleção interativa de números, legenda visual, cores e dock de checkout |
| **Grade Admin & Print 3x** | [`components/admin/RaffleGridView.tsx`](./components/admin/RaffleGridView.tsx) | Conferência de cotas, definição de ganhadores e gerador de imagem Ultra HD |
| **Modal de Checkout & PIX** | [`components/CheckoutModal.tsx`](./components/CheckoutModal.tsx) | Exibição de QR Code PIX, código Copia e Cola e confirmação de pagamento |
