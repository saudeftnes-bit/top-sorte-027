# 🚀 Configuração Completa do Supabase - Top Sorte 027

Guia passo a passo para configurar todo o banco de dados, storage e funcionalidades.

---

## Passo 1: Criar Conta no Supabase

1. **Acesse**: https://supabase.com
2. Clique em **"Start your project"** (botão verde no canto superior direito)
3. Faça login com:
   - **GitHub** (recomendado - mais rápido) ⭐
   - **Google**
   - Ou crie uma conta com email

---

## Passo 2: Criar Novo Projeto

Depois de fazer login, você será direcionado para o Dashboard:

1. Clique em **"New Project"** (ou "Novo Projeto")
2. Preencha os dados:
   - **Name**: `top-sorte-027`
   - **Database Password**: Escolha uma senha FORTE (guarde em local seguro!)
     - Exemplo: `TopSorte@2024!Secure`
   - **Region**: `South America (São Paulo)` - para melhor performance
   - **Pricing Plan**: **Free** (já vem selecionado)
3. Clique em **"Create new project"**
4. ⏳ **Aguarde ~2-3 minutos** (o Supabase vai criar seu banco)

> 💡 **Dica**: Enquanto aguarda, deixe a aba aberta e continue lendo os próximos passos.

---

## Passo 3: Criar Todas as Tabelas e Configurações (SQL COMPLETO)

Quando o projeto estiver pronto (você verá "Project is ready"):

1. No menu lateral esquerdo, clique em **"SQL Editor"** (ícone `</>`)
2. Clique em **"+ New query"**
3. **Cole ESTE SQL COMPLETO** abaixo (é grande, mas copie tudo de uma vez):

```sql
-- ==================== TABELAS PRINCIPAIS ====================

-- 1. Tabela de Sorteios
CREATE TABLE raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price_per_number DECIMAL(10,2) NOT NULL,
  main_image_url TEXT,
  status TEXT CHECK (status IN ('active', 'finished', 'scheduled')) DEFAULT 'active',
  draw_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Tabela de Fotos de Ganhadores
CREATE TABLE winner_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prize TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tabela de Reservas (com timer e upload)
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID REFERENCES raffles(id),
  number TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_email TEXT,
  status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  payment_amount DECIMAL(10,2),
  payment_proof_url TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(raffle_id, number)
);

-- ==================== ROW LEVEL SECURITY ====================

-- Habilitar RLS
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Políticas de LEITURA (todos podem ler)
CREATE POLICY "Anyone can read raffles" ON raffles FOR SELECT USING (true);
CREATE POLICY "Anyone can read winner_photos" ON winner_photos FOR SELECT USING (true);
CREATE POLICY "Anyone can read reservations" ON reservations FOR SELECT USING (true);

-- Políticas de ESCRITA
CREATE POLICY "Anyone can insert raffles" ON raffles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raffles" ON raffles FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert winner_photos" ON winner_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete winner_photos" ON winner_photos FOR DELETE USING (true);
CREATE POLICY "Anyone can insert reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reservations" ON reservations FOR UPDATE USING (true);

-- ==================== STORAGE (Upload de Comprovantes) ====================

-- Criar bucket para comprovantes de pagamento
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para imagens do sorteio
INSERT INTO storage.buckets (id, name, public) 
VALUES ('raffle-images', 'raffle-images', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao storage
CREATE POLICY "Anyone can upload payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can upload raffle images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'raffle-images');

CREATE POLICY "Anyone can view raffle images"
ON storage.objects FOR SELECT
USING (bucket_id = 'raffle-images');

-- ==================== FUNÇÕES E TRIGGERS (Timer de Expiração) ====================

-- Função para calcular tempo de expiração (30 minutos)
CREATE OR REPLACE FUNCTION set_reservation_expiration()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NOW() + INTERVAL '30 minutes';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para setar expiração automaticamente ao criar reserva
CREATE TRIGGER set_expiration_on_insert
BEFORE INSERT ON reservations
FOR EACH ROW
EXECUTE FUNCTION set_reservation_expiration();

-- Função para expirar reservas antigas (pode ser chamada via cron ou manualmente)
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'paid'
    AND (payment_proof_url IS NULL OR payment_proof_url = '')
    AND expires_at < NOW();
  
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- ==================== DADOS DE EXEMPLO ====================

-- Inserir um sorteio ativo
INSERT INTO raffles (title, description, price_per_number, main_image_url, status)
VALUES (
  'MOTO 0KM OU R$ 15.000 NO PIX',
  'Concorra a uma moto 0km ou escolha R$ 15.000 em dinheiro!',
  13.00,
  'https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop',
  'active'
);

-- Inserir fotos de ganhadores de exemplo
INSERT INTO winner_photos (name, prize, photo_url, display_order) VALUES
('João Silva', 'Moto CG 160 Fan', 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=600&auto=format&fit=crop', 0),
('Maria Santos', 'R$ 8.000 no PIX', 'https://images.unsplash.com/photo-1593642532400-2682810df593?q=80&w=600&auto=format&fit=crop', 1),
('Pedro Oliveira', 'iPhone 15 Pro', 'https://images.unsplash.com/photo-1605152276897-4f618f831968?q=80&w=600&auto=format&fit=crop', 2),
('Ana Costa', 'R$ 15.000 no PIX', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop', 3);

-- ==================== COMENTÁRIOS ====================

COMMENT ON COLUMN reservations.expires_at IS 'Reserva expira em 30 minutos se não enviar comprovante';
COMMENT ON COLUMN reservations.payment_proof_url IS 'URL do comprovante no Supabase Storage';
COMMENT ON FUNCTION expire_old_reservations() IS 'Cancela reservas expiradas. Execute periodicamente.';
```

4. Clique em **"Run"** (ou ⏯️) no canto inferior direito
5. ✅ Aguarde alguns segundos - deve aparecer: **"Success. No rows returned"** ou similar

> ⚠️ **Importante**: Se der erro, leia a mensagem. Geralmente é só executar de novo.

---

## Passo 4: Verificar se Tudo Foi Criado

### 4.1 Verificar Tabelas

1. No menu lateral, clique em **"Table Editor"**
2. Você deve ver 3 tabelas:
   - ✅ `raffles` (1 linha - o sorteio de exemplo)
   - ✅ `winner_photos` (4 linhas - ganhadores de exemplo)
   - ✅ `reservations` (vazio por enquanto)

### 4.2 Verificar Storage

1. No menu lateral, clique em **"Storage"**
2. Você deve ver 2 buckets:
   - ✅ `payment-proofs` (para comprovantes)
   - ✅ `raffle-images` (para imagens do sorteio)

---

## Passo 5: Copiar as Credenciais

Agora vamos pegar as informações para conectar seu app:

1. No menu lateral, clique em **"Settings"** (⚙️ - último ícone)
2. Clique em **"API"**
3. Você verá:

### 5.1 Project URL
```
Exemplo: https://abcdefghijklmnop.supabase.co
```
📋 Clique no ícone de **copiar** ao lado

### 5.2 Project API keys → anon public
```
Exemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```
📋 Clique no ícone de **copiar** ao lado (é uma chave BEM longa)

---

## Passo 6: Configurar o .env.local

1. Abra o arquivo `.env.local` no seu projeto
2. **Cole suas credenciais**:

```env
VITE_GEMINI_API_KEY=AIzaSyCMbpnBNtMZ0hotD1sK4LYTg0nNvhVlpvY
VITE_SUPABASE_URL=cole-sua-project-url-aqui
VITE_SUPABASE_ANON_KEY=cole-sua-anon-key-aqui
VITE_ADMIN_PASSWORD=admin123
```

**Exemplo REAL preenchido**:
```env
VITE_GEMINI_API_KEY=AIzaSyCMbpnBNtMZ0hotD1sK4LYTg0nNvhVlpvY
VITE_SUPABASE_URL=https://xyzabc123456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFiYzEyMzQ1NiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM3MzM0ODAwLCJleHAiOjIwNTI5MTA4MDB9...
VITE_ADMIN_PASSWORD=admin123
```

3. **Salve o arquivo** (Ctrl+S)

---

## Passo 7: Reiniciar e Testar

### 7.1 Reiniciar o Servidor

No terminal:
1. Pressione **Ctrl+C** para parar o servidor
2. Execute novamente: `npm run dev`
3. Aguarde aparecer: `Local: http://localhost:3000`

### 7.2 Testar o App

1. **Abra**: http://localhost:3000
2. Você deve ver a página inicial normalmente
3. Clique em **"ESCOLHER MEUS NÚMEROS"**
4. Todos os números devem estar **VERDES** (disponíveis) ✅

### 7.3 Testar Reserva

1. Selecione alguns números (ex: 07, 15, 22)
2. Clique em **"RESERVAR AGORA"**
3. Preencha:
   - Nome: Seu Nome
   - WhatsApp: (27) 99999-9999
   - Email: seu@email.com (opcional)
4. Clique em **"PROSSEGUIR PARA PAGAMENTO"**
5. ✅ Deve aparecer:
   - ⏰ Timer: **30:00** (countdown)
   - ✅ "Números Confirmados!"
   - 📤 Opção de upload de comprovante
   - 💳 Chave PIX

### 7.4 Testar Timer

1. Observe o timer diminuindo: `29:59... 29:58...`
2. Cores:
   - 🟠 Laranja (quando > 5 min)
   - 🔴 Vermelho (quando < 5 min)

### 7.5 Testar Upload

1. Clique em **"📤 Enviar Comprovante"**
2. Selecione uma imagem do seu computador
3. Veja o preview aparecer
4. Aguarde o upload (spinner)
5. ✅ Deve aparecer: **"✅ Enviado!"**

### 7.6 Verificar no Supabase

1. Volte para o Supabase
2. **Table Editor** → `reservations`
3. Você deve ver sua reserva:
   - ✅ `buyer_name`: Seu Nome
   - ✅ `number`: 07, 15, 22 (3 linhas)
   - ✅ `status`: paid
   - ✅ `expires_at`: Data/hora daqui a 30 min
   - ✅ `payment_proof_url`: URL da imagem (se fez upload)

4. **Storage** → `payment-proofs`
5. ✅ Deve aparecer sua imagem

---

## Passo 8: Testar o Painel Admin

1. Acesse: http://localhost:3000/admin
2. Digite a senha: `admin123` (ou a que você configurou)
3. Clique em **"ENTRAR"**
4. ✅ Deve aparecer o **Dashboard** com:
   - 💰 Total Arrecadado
   - 🎯 Números Vendidos
   - ⏳ Números Pendentes
   - ✨ Números Disponíveis
   - 👥 Total de Compradores

### 8.1 Testar Gerenciamento

1. Clique em **"Pagamentos"**
2. Veja sua reserva listada
3. Se enviou comprovante, clique em **"Ver Comprovante"**

---

## ✅ Checklist Final

- [ ] Conta no Supabase criada
- [ ] Projeto criado (aguardei 2-3 min)
- [ ] SQL completo executado
- [ ] 3 tabelas criadas (raffles, reservations, winner_photos)
- [ ] 2 buckets de storage criados
- [ ] Project URL copiada
- [ ] Anon Key copiada
- [ ] .env.local atualizado e salvo
- [ ] Servidor reiniciado (Ctrl+C + npm run dev)
- [ ] App abre normalmente
- [ ] Consegui fazer uma reserva
- [ ] Timer apareceu (30:00)
- [ ] Upload de comprovante funcionou
- [ ] Dados apareceram no Supabase
- [ ] Admin panel acessível (/admin)
- [ ] Dashboard mostra métricas

---

## 🆘 Problemas Comuns

### "Supabase credentials not found"
✅ **Solução**:
- Verifique se o `.env.local` está na RAIZ do projeto
- Verifique se as variáveis começam com `VITE_`
- **Reinicie o servidor** (Ctrl+C e `npm run dev`)

### "Error executing SQL"
✅ **Solução**:
- Copie TODO o SQL novamente
- Execute em partes se necessário:
  1. Primeiro: CREATE TABLE (3 tabelas)
  2. Depois: ALTER TABLE (RLS)
  3. Depois: Storage e Funções
  4. Por último: INSERT (dados exemplo)

### "No raffle found" no admin
✅ **Solução**:
- Verifique se o INSERT do raffle foi executado
- No SQL Editor: `SELECT * FROM raffles;`
- Deve mostrar 1 linha

### Timer não aparece
✅ **Solução**:
- Verifique se executou a parte de FUNÇÕES do SQL
- Verifique se o campo `expires_at` existe:
  - Table Editor → reservations → deve ter coluna `expires_at`

### Upload não funciona
✅ **Solução**:
- Storage → Verifique se bucket `payment-proofs` existe
- Storage → Bucket → Policies → Deve ter 2 políticas
- Se não tiver, execute a parte de STORAGE do SQL novamente

---

## 🚀 Deploy no Vercel

Quando tudo estiver funcionando localmente:

1. Acesse: https://vercel.com
2. Faça login com GitHub
3. Import seu repositório
4. Em **Environment Variables**, adicione:
   ```
   VITE_SUPABASE_URL=sua-url
   VITE_SUPABASE_ANON_KEY=sua-key
   VITE_ADMIN_PASSWORD=admin123
   VITE_GEMINI_API_KEY=sua-chave-gemini
   ```
5. Clique em **Deploy**
6. ✅ Pronto! Seu app está no ar!

---

## 📊 Funcionalidades Ativas

✅ **Timer de Expiração**: Reservas expiram em 30 min
✅ **Upload de Comprovante**: Direto no site
✅ **Admin Panel**: Gerenciar tudo
✅ **Confirmação Automática**: Números ficam roxos direto
✅ **Real-time**: Atualizações ao vivo
✅ **Analytics**: Métricas no dashboard

---

## 🔧 Manutenção

### Expirar Reservas Manualmente

No Supabase → SQL Editor:
```sql
SELECT expire_old_reservations();
```

### Ver Reservas Expirando em Breve

```sql
SELECT 
  buyer_name, 
  number,
  expires_at,
  EXTRACT(EPOCH FROM (expires_at - NOW()))/60 as minutes_left
FROM reservations 
WHERE status = 'paid' 
  AND payment_proof_url IS NULL 
ORDER BY expires_at ASC;
```

### Limpar Dados de Teste

```sql
DELETE FROM reservations;
```

---

🎉 **Tudo Pronto! Seu sistema está completo e funcionando!**
