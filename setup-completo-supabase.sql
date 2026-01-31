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
