# 🚀 Guia de Replicação: Banners de Propaganda e Grade de Números

Este guia contém **toda a lógica, estrutura de banco de dados, regras de negócio e código-fonte pronto (React + Tailwind)** para você copiar e implementar exatamente a mesma ideia em qualquer outro aplicativo.

---

## 📑 Índice
1. [Modelagem do Banco de Dados (Schema SQL)](#1-modelagem-do-banco-de-dados-schema-sql)
2. [Lógica de Funcionamento e Regras de Negócio](#2-lógica-de-funcionamento-e-regras-de-negócio)
3. [Módulo 1: Banners de Propaganda (Código Pronto)](#3-módulo-1-banners-de-propaganda-código-pronto)
   - 3.1. Banner Principal de Alta Conversão (Hero Rifa)
   - 3.2. Carrossel Cinematográfico de Ganhadores (Ken Burns + Glassmorphism)
   - 3.3. Banner Dinâmico de Novidades (Frases Rotativas)
4. [Módulo 2: Grade de Números Interativa (Código Pronto)](#4-módulo-2-grade-de-números-interativa-código-pronto)
   - 4.1. Lógica dos 4 Estados das Cotas
   - 4.2. Componente da Grade em 5 Colunas
   - 4.3. Dock Flutuante de Checkout com Timer
5. [Módulo 3: Gerador de Print para Instagram e WhatsApp (Canvas Ultra HD)](#5-módulo-3-gerador-de-print-para-instagram-e-whatsapp-canvas-ultra-hd)
6. [Passo a Passo de Instalação no Novo App](#6-passo-a-passo-de-instalação-no-novo-app)

---

## 1. Modelagem do Banco de Dados (Schema SQL)

Se o seu novo app usar Supabase, PostgreSQL ou MySQL, essa é a estrutura essencial:

```sql
-- 1. TABELA DE RIFAS / SORTEIOS
CREATE TABLE raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10),                          -- Ex: "027"
  title VARCHAR(255) NOT NULL,               -- Ex: "iPhone 15 Pro Max"
  description TEXT,
  price_per_number NUMERIC(10,2) NOT NULL,   -- Ex: 13.00
  total_numbers INT NOT NULL DEFAULT 100,    -- 100 (00-99) ou 1000 (000-999)
  max_numbers_per_participant INT DEFAULT 10,
  selection_mode VARCHAR(20) DEFAULT 'loteria', -- 'loteria' ou 'jogo_bicho'
  raffle_type VARCHAR(20) DEFAULT 'padrao',     -- 'padrao' ou 'brinde'
  status VARCHAR(20) DEFAULT 'active',          -- 'active', 'scheduled', 'paused', 'finished'
  main_image_url TEXT NOT NULL,
  draw_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE RESERVAS / COTAS COMPRADAS
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  number VARCHAR(10) NOT NULL,               -- Ex: "07", "42"
  name VARCHAR(255) NOT NULL,                -- Nome do comprador ou sessionId provisório
  phone VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' (amarelo) ou 'paid' (roxo)
  session_id VARCHAR(100),                   -- UUID da aba do cliente
  expires_at TIMESTAMPTZ,                    -- Data/Hora de expiração da reserva provisória
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(raffle_id, number)                  -- Impede 2 compras do mesmo número!
);

-- 3. TABELA DE GANHADORES (PROVA SOCIAL)
CREATE TABLE winner_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,                -- Ex: "Carlos Silva"
  prize VARCHAR(255) NOT NULL,               -- Ex: "R$ 5.000,00 no PIX"
  photo_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2. Lógica de Funcionamento e Regras de Negócio

### A. Fluxo da Grade de Números:
1. **Livre (Verde):** A cota não existe na tabela `reservations` ou seu `expires_at` já passou.
2. **Selecionada pelo Usuário (Dourada):** O usuário clicou na tela; é guardado no estado local `selectedNumbers: string[]`.
3. **Pendente / Reserva (Amarelo/Âmbar):** Existe na tabela com `status = 'pending'`, mas o `session_id` pertence a outra pessoa. O botão fica travado para quem está de fora.
4. **Paga (Roxo):** `status = 'paid'`. O número é travado permanentemente e mostra o primeiro nome do comprador.

### B. Proteção contra Concorrência (Race Condition):
Quando o usuário clica para ir ao pagamento, o sistema envia para o backend:
- `raffle_id` + `numbers` + `session_id` + `expires_at` (ex: +15 minutos).
- Se outro usuário tentar pagar os mesmos números simultaneamente, o banco aciona a restrição `UNIQUE(raffle_id, number)` e rejeita a segunda tentativa.

---

## 3. Módulo 1: Banners de Propaganda (Código Pronto)

Copie estes 3 componentes para o seu novo app:

### 3.1. Banner Hero da Rifa Ativa (`HeroRaffleBanner.tsx`)

```tsx
import React from 'react';

interface HeroBannerProps {
  raffle: {
    title: string;
    code?: string;
    price: number;
    imageUrl: string;
    status: 'active' | 'scheduled' | 'finished';
    isFree?: boolean;
  };
  onParticipate: () => void;
}

export const HeroRaffleBanner: React.FC<HeroBannerProps> = ({ raffle, onParticipate }) => {
  return (
    <div className="relative overflow-hidden bg-black rounded-[2rem] shadow-[0_15px_40px_-10px_rgba(0,0,0,0.9)] border border-white/10 flex flex-col max-w-xl mx-auto">
      {/* IMAGEM SEM OVERLAY (MÁXIMA NITIDEZ) */}
      <div className="relative w-full overflow-hidden group">
        <img
          src={raffle.imageUrl}
          alt={raffle.title}
          className="w-full h-auto max-h-[70vh] object-contain block transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Badge Status (Top-Left) */}
        <div className={`absolute top-3 left-3 z-20 font-black text-[10px] px-3 py-1.5 rounded-full uppercase tracking-widest shadow-lg ${
          raffle.status === 'active' ? 'bg-[#00E676] text-[#001D4A]' : 'bg-yellow-400 text-slate-900'
        }`}>
          {raffle.status === 'active' ? '🟢 NOVA RIFA' : '⏳ EM BREVE'}
        </div>

        {/* Badge Edição (Top-Right) */}
        {raffle.code && (
          <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-md border border-white/20 text-white font-black text-[10px] px-3 py-1.5 rounded-full tracking-widest">
            EDIÇÃO #{raffle.code}
          </div>
        )}
      </div>

      {/* PAINEL INFERIOR DE CONVERSÃO */}
      <div className="bg-black px-4 pt-3 pb-5 space-y-3">
        {raffle.isFree ? (
          <div className="flex items-center justify-center gap-3 bg-emerald-950/60 border border-emerald-500/30 rounded-2xl px-4 py-3 text-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-lg font-black uppercase tracking-wider">100% Grátis</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E676] animate-pulse shadow-[0_0_8px_#00E676]" />
            <span className="text-white/90 text-sm font-bold">
              Apenas <strong className="text-[#00E676] text-xl font-black">R$ {raffle.price.toFixed(2).replace('.', ',')}</strong> / cota
            </span>
          </div>
        )}

        {/* BOTÃO PULSANTE (CTA) */}
        <div className="relative">
          {raffle.status === 'active' && (
            <div className="absolute inset-0 bg-[#00E676] rounded-2xl animate-ping opacity-25" />
          )}
          <button
            onClick={onParticipate}
            className="w-full relative font-black py-4 rounded-2xl flex items-center justify-center gap-2 text-base uppercase tracking-wider transition-all active:scale-95 border-b-4 bg-gradient-to-r from-[#00E676] to-[#00C853] text-[#001D4A] border-[#008c3a] shadow-[0_6px_24px_rgba(0,230,118,0.35)]"
          >
            <span>🚀</span>
            <span>PARTICIPAR AGORA!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### 3.2. Carrossel Cinematográfico de Ganhadores (`WinnersSlideshow.tsx`)

```tsx
import React, { useState, useEffect } from 'react';

export interface Winner {
  id: string;
  name: string;
  prize: string;
  photoUrl: string;
}

export const WinnersSlideshow: React.FC<{ winners: Winner[] }> = ({ winners }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (winners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent(prev => (prev + 1) % winners.length);
    }, 5000); // 5 segundos por slide
    return () => clearInterval(interval);
  }, [winners.length]);

  if (!winners.length) return null;

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] bg-[#020617] h-[450px] sm:h-[550px] border border-white/5 max-w-xl mx-auto">
      {/* Barra de Progresso Superior */}
      <div className="absolute top-0 left-0 right-0 h-1.5 z-40 bg-black/20">
        <div key={current} className="h-full bg-gradient-to-r from-[#00E676] to-[#00C853] animate-pulse w-full" />
      </div>

      {/* Slides com Ken Burns Effect */}
      {winners.map((winner, index) => (
        <div
          key={winner.id}
          className={`absolute inset-0 transition-opacity duration-1000 ${index === current ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
        >
          <img
            src={winner.photoUrl}
            alt={winner.name}
            className="w-full h-full object-cover brightness-[0.8] contrast-[1.1] transform scale-105 transition-transform duration-5000 ease-out"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-[#020617]/40" />

          {/* Card Flutuante Glassmorphism */}
          <div className="absolute bottom-6 left-6 right-6 z-30">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 p-5 rounded-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#00E676] text-[10px] font-black uppercase tracking-widest">Premiação Confirmada</p>
                  <h4 className="text-2xl font-black text-white">{winner.name}</h4>
                </div>
                <div className="bg-[#00E676] text-black h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xl">
                  🏆
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                <span className="text-white/60 text-xs font-bold uppercase">Ganhou:</span>
                <span className="text-white font-black italic">{winner.prize}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

### 3.3. Banner Dinâmico de Novidades (`ComingSoonBanner.tsx`)

```tsx
import React, { useState, useEffect } from 'react';

const PHRASES = [
  "Sincronizando prêmios...",
  "Prepara sua sorte!",
  "O próximo ganhador é você?",
  "Carregando sonhos...",
  "PIX DA SORTE EM BREVE"
];

export const ComingSoonBanner: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % PHRASES.length), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-[#004B8D] to-[#010B1A] rounded-[2.5rem] p-8 text-center min-h-[220px] flex flex-col items-center justify-center border border-white/10 max-w-xl mx-auto">
      <h2 className="text-lg font-black uppercase tracking-[0.2em] text-[#00E676] mb-3">
        NOVIDADES CHEGANDO...
      </h2>
      <p key={index} className="text-2xl font-black text-white uppercase transition-all duration-300">
        {PHRASES[index]}
      </p>
      <div className="w-48 h-1.5 bg-black/40 rounded-full mt-6 overflow-hidden border border-white/5">
        <div className="h-full bg-[#00E676] w-full animate-pulse" />
      </div>
    </div>
  );
};
```

---

## 4. Módulo 2: Grade de Números Interativa (Código Pronto)

Aqui está o componente completo da grade em 5 colunas, com os 4 estados visuais e a barra de checkout:

```tsx
import React from 'react';

export type ReservationStatus = 'pending' | 'paid';

export interface ReservationItem {
  name: string;
  status: ReservationStatus;
}

export type ReservationsMap = Record<string, ReservationItem>;

interface NumberGridProps {
  totalNumbers?: number;               // Ex: 100 ou 1000
  pricePerNumber: number;              // Ex: 13.00
  selectedNumbers: string[];
  reservations: ReservationsMap;
  currentSessionId: string;
  onToggleNumber: (num: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  timeRemaining?: number;              // Segundos restantes da reserva (ex: 900 = 15m)
}

export const NumberGrid: React.FC<NumberGridProps> = ({
  totalNumbers = 100,
  pricePerNumber,
  selectedNumbers,
  reservations,
  currentSessionId,
  onToggleNumber,
  onCheckout,
  onClear,
  timeRemaining
}) => {
  // 1. Gera lista com zeros à esquerda: "00", "01" ... "99"
  const padLength = totalNumbers > 1000 ? 4 : totalNumbers > 100 ? 3 : 2;
  const numbers = Array.from({ length: totalNumbers }, (_, i) => i.toString().padStart(padLength, '0'));

  const totalAmount = (selectedNumbers.length * pricePerNumber).toFixed(2).replace('.', ',');

  return (
    <div className={`p-3 max-w-xl mx-auto w-full ${selectedNumbers.length > 0 ? 'pb-36' : 'pb-6'}`}>
      <div className="bg-gradient-to-b from-[#021811] via-[#032319] to-[#010D09] border border-emerald-500/30 rounded-3xl p-4 shadow-2xl text-white">
        
        {/* LEGENDA DAS COTAS */}
        <div className="flex items-center justify-between text-[11px] font-bold px-3 py-2 rounded-xl bg-black/40 border border-emerald-500/20 mb-4 text-slate-300">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#0A4D39] border border-emerald-400/50" /> Livre
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-500" /> Reserva
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-700" /> Pago
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-400" /> Seu
          </span>
        </div>

        {/* GRADE EM 5 COLUNAS */}
        <div className="grid grid-cols-5 gap-2">
          {numbers.map((num) => {
            const reservation = reservations[num];
            const isSelected = selectedNumbers.includes(num);
            const isOtherPending = reservation?.status === 'pending' && reservation.name !== currentSessionId;
            const isPaid = reservation?.status === 'paid';

            // ESTADO 1: ESCOLHIDO PELO USUÁRIO (DOURADO)
            if (isSelected) {
              return (
                <button
                  key={num}
                  onClick={() => onToggleNumber(num)}
                  className="aspect-square rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 text-black font-black text-base flex flex-col items-center justify-center border-2 border-white shadow-[0_0_15px_rgba(255,215,0,0.6)] active:scale-90 transition-all"
                >
                  <span className="text-[8px] font-extrabold">✔ SEU</span>
                  <span>{num}</span>
                </button>
              );
            }

            // ESTADO 2: RESERVADO POR OUTRA PESSOA (ÂMBAR)
            if (isOtherPending) {
              return (
                <button
                  key={num}
                  disabled
                  className="aspect-square rounded-xl bg-amber-950/60 text-amber-300 font-bold text-xs flex flex-col items-center justify-center border border-amber-500/30 opacity-70 cursor-not-allowed"
                >
                  <span className="font-black text-sm">{num}</span>
                  <span className="text-[7px]">RESERVA</span>
                </button>
              );
            }

            // ESTADO 3: PAGO / VENDIDO (ROXO)
            if (isPaid) {
              const firstName = reservation?.name?.split(' ')[0] || '';
              return (
                <button
                  key={num}
                  disabled
                  className="aspect-square rounded-xl bg-gradient-to-b from-purple-800 to-purple-950 text-white font-black text-xs flex flex-col items-center justify-center border border-purple-500/60 opacity-90 cursor-not-allowed"
                >
                  <span>{num}</span>
                  <span className="text-[7px] text-purple-300 uppercase">PAGO</span>
                  {firstName && <span className="text-[8px] truncate px-1 text-purple-200">{firstName}</span>}
                </button>
              );
            }

            // ESTADO 4: LIVRE / DISPONÍVEL (VERDE ESMERALDA)
            return (
              <button
                key={num}
                onClick={() => onToggleNumber(num)}
                className="aspect-square rounded-xl bg-gradient-to-b from-[#0A4D39] to-[#042B1F] hover:brightness-125 text-emerald-100 font-black text-base flex items-center justify-center border border-emerald-500/30 active:scale-95 transition-all shadow-sm"
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>

      {/* DOCK INFERIOR FIXO (DESLIZA AO SELECIONAR NÚMEROS) */}
      {selectedNumbers.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-[#03301F] to-[#021811] border-t-2 border-yellow-400/80 p-4 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
          <div className="max-w-xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {selectedNumbers.sort().map(n => (
                  <span key={n} className="bg-yellow-400 text-black font-black text-xs px-2 py-0.5 rounded">
                    #{n}
                  </span>
                ))}
              </div>
              <button onClick={onClear} className="text-red-400 text-xs font-bold underline">
                Limpar
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white/60 uppercase font-bold">Total a pagar:</p>
                <p className="text-2xl font-black text-yellow-400">R$ {totalAmount}</p>
              </div>

              {timeRemaining && (
                <div className="text-xs text-amber-300 font-bold bg-black/40 px-3 py-1.5 rounded-lg border border-amber-400/30">
                  ⏱️ {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
                </div>
              )}

              <button
                onClick={onCheckout}
                className="bg-gradient-to-r from-[#00E676] to-[#00C853] text-[#001D4A] font-black px-6 py-3 rounded-xl shadow-lg active:scale-95 transition-all"
              >
                PAGAR VIA PIX ➔
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 5. Módulo 3: Gerador de Print para Instagram e WhatsApp (Canvas Ultra HD)

Função JavaScript pura em **HTML5 Canvas 2D nativo** com resolução triplicada (`scale(3, 3)`) que gera a imagem dos ganhadores perfeita para Stories sem distorção:

```ts
export function generateWinnerPrint(options: {
  raffleCode: string;
  themeColor: string;       // Ex: '#001D3D' ou '#022C22'
  winners: Array<{ position: string; number: string; name: string }>;
}): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const width = 450;
  const height = 300 + options.winners.length * 110;
  const DPR = 3; // Densidade 3x para ultra definição no Instagram

  canvas.width = width * DPR;
  canvas.height = height * DPR;
  ctx.scale(DPR, DPR);

  // 1. Fundo Gradiente
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, options.themeColor);
  bgGrad.addColorStop(1, '#050505');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Cabeçalho
  ctx.fillStyle = '#00E676';
  ctx.font = '900 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RESULTADO OFICIAL', width / 2, 50);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 24px sans-serif';
  ctx.fillText(`CONCURSO #${options.raffleCode}`, width / 2, 85);

  // 3. Desenhar os Cards dos Ganhadores
  let currentY = 120;
  options.winners.forEach((w) => {
    // Card do Ganhador
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(30, currentY, width - 60, 90, 16);
    ctx.fill();
    ctx.stroke();

    // Posição (Ex: 🥇 1º Prêmio)
    ctx.fillStyle = '#FFD700';
    ctx.font = '800 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(w.position, 50, currentY + 30);

    // Cota (Ex: #07)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 28px monospace';
    ctx.fillText(`#${w.number}`, 50, currentY + 68);

    // Nome do Ganhador
    ctx.fillStyle = '#00E676';
    ctx.font = '700 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(w.name.toUpperCase(), width - 50, currentY + 55);

    currentY += 110;
  });

  // 4. Rodapé
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '600 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PARABÉNS AOS GANHADORES! • COMPRA 100% SEGURA', width / 2, height - 30);

  // Retorna DataURL para download direto
  return canvas.toDataURL('image/png');
}
```

---

## 6. Passo a Passo de Instalação no Novo App

1. **Copie as 3 Tabelas SQL** do Item 1 para o seu banco (Supabase, Postgres, Firebase, etc.).
2. **Adicione os Componentes:**
   - Cole os arquivos `.tsx` na pasta de componentes do seu novo projeto.
3. **Instale o Tailwind CSS** (já configurado por padrão em Next.js / Vite).
4. **Pronto!** Você terá a mesma experiência visual, com reserva de cotas à prova de falhas, visual esmeralda luxo e banners com alta taxa de conversão.
