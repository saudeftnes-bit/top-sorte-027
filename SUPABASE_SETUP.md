# Configuração do Supabase - Top Sorte 027

Este guia irá te ajudar a configurar o Supabase para o painel admin.

## Passo 1: Criar Conta e Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Clique em "Start your project"
3. Faça login com GitHub (ou crie uma conta)
4. Clique em "New Project"
5. Configure:
   - **Name**: `top-sorte-027`
   - **Database Password**: Escolha uma senha forte (guarde ela!)
   - **Region**: South America (São Paulo) - para melhor performance
   - **Pricing Plan**: Free
6. Clique em "Create new project"
7. Aguarde ~2 minutos até o projeto estar pronto

## Passo 2: Configurar o Banco de Dados

1. No painel do Supabase, clique em **"SQL Editor"** no menu lateral
2. Clique em **"New query"**
3. Cole o SQL abaixo e clique em **"Run"**:

```sql
-- Criar tabela de sorteios
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

-- Criar tabela de fotos de ganhadores
CREATE TABLE winner_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prize TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Criar tabela de reservas
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
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(raffle_id, number)
);

-- Inserir um sorteio de exemplo
INSERT INTO raffles (title, description, price_per_number, main_image_url, status)
VALUES (
  'MOTO 0KM OU R$ 15.000 NO PIX',
  'Concorra a uma moto 0km ou escolha R$ 15.000 em dinheiro!',
  13.00,
  'https://images.unsplash.com/photo-1558981403-c5f91cbba527?q=80&w=2070&auto=format&fit=crop',
  'active'
);
```

## Passo 3: Configurar Storage (para upload de imagens)

1. Clique em **"Storage"** no menu lateral
2. Clique em **"Create a new bucket"**
3. Configure:
   - **Name**: `raffle-images`
   - **Public bucket**: ✅ Marque como público
4. Clique em **"Create bucket"**

## Passo 4: Configurar Row Level Security (RLS)

1. Volte para **"SQL Editor"**
2. Crie uma nova query e cole:

```sql
-- Permitir leitura pública das tabelas
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura (qualquer um pode ler)
CREATE POLICY "Anyone can read raffles" ON raffles FOR SELECT USING (true);
CREATE POLICY "Anyone can read winner_photos" ON winner_photos FOR SELECT USING (true);
CREATE POLICY "Anyone can read reservations" ON reservations FOR SELECT USING (true);

-- Políticas de escrita (qualquer um pode escrever - ajuste depois se necessário)
CREATE POLICY "Anyone can insert raffles" ON raffles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raffles" ON raffles FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert winner_photos" ON winner_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete winner_photos" ON winner_photos FOR DELETE USING (true);
CREATE POLICY "Anyone can insert reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reservations" ON reservations FOR UPDATE USING (true);
```

3. Clique em **"Run"**

## Passo 5: Copiar Credenciais

1. Clique em **"Settings"** (ícone de engrenagem) no menu lateral
2. Clique em **"API"**
3. Você verá duas informações importantes:

   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGci...` (uma chave longa)

4. Abra o arquivo `.env.local` no seu projeto e adicione:

```env
VITE_SUPABASE_URL=sua-project-url-aqui
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_ADMIN_PASSWORD=sua-senha-admin-aqui
```

**Exemplo**:
```env
VITE_SUPABASE_URL=https://abcdefgh123456.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_ADMIN_PASSWORD=admin@2024
VITE_GEMINI_API_KEY=sua-chave-gemini
```

## Passo 6: Testar a Integração

1. Reinicie o servidor de desenvolvimento:
   ```bash
   # Pare o servidor (Ctrl+C)
   npm run dev
   ```

2. Acesse a aplicação: `http://localhost:3000`

3. Teste o painel admin:
   - Acesse: `http://localhost:3000/admin` 
   - Faça login com a senha que você definiu em `VITE_ADMIN_PASSWORD`
   - Você deve ver o dashboard com métricas zeradas

4. Teste criar uma reserva:
   - Volte para a página inicial
   - Clique em "ESCOLHER MEUS NÚMEROS"
   - Selecione alguns números
   - Clique em "RESERVAR AGORA"
   - Preencha os dados
   - Verifique no admin se a reserva apareceu

## Passo 7: Funcionalidades do Admin

### Dashboard
- Ver total arrecadado
- Números vendidos, pendentes e disponíveis
- Total de compradores

### Gerenciar Sorteio
- Editar título e descrição
- Alterar preço por número
- Trocar imagem principal
- Adicionar/remover fotos de ganhadores

### Pagamentos
- Ver todas as reservas
- Filtrar por status (pendente/pago)
- Confirmar pagamento
- Cancelar reserva

### Usuários
- Ver lista de compradores
- Ver números comprados por pessoa
- Ver valor total por comprador

## Troubleshooting

### Erro: "Supabase credentials not found"
- Verifique se o arquivo `.env.local` está na raiz do projeto
- Verifique se as variáveis estão com os nomes corretos (`VITE_` no início)
- Reinicie o servidor após adicionar as variáveis

### Erro ao criar reserva
- Verifique se as tabelas foram criadas corretamente
- Verifique as políticas RLS no Supabase
- Veja o console do navegador para mais detalhes do erro

### Admin não carrega sorteio
- Certifique-se de que há um sorteio com `status='active'` no banco
- Execute o INSERT do Passo 2 novamente se necessário

## Deploy no Vercel

1. Acesse o dashboard do Vercel
2. Vá em **Settings** > **Environment Variables**
3. Adicione as mesmas variáveis do `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD`
   - `VITE_GEMINI_API_KEY`
4. Faça um novo deploy

## Próximos Passos

- Adicione mais sorteios conforme necessário
- Customize as imagens no painel admin
- Configure backup do banco de dados
- Implemente autenticação mais robusta se necessário

---

**Pronto!** 🎉 Seu painel admin está configurado e funcionando!
