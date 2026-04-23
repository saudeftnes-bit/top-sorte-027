-- ============================================================
-- TOP SORTE 027 - SETUP COMPLETO DO BANCO DE DADOS
-- Cole TODO este conteúdo no SQL Editor do Supabase e execute
-- ============================================================

-- ==================== 1. TABELAS PRINCIPAIS ====================

CREATE TABLE IF NOT EXISTS raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  price_per_number DECIMAL(10,2) NOT NULL,
  main_image_url TEXT,
  status TEXT CHECK (status IN ('active', 'finished', 'scheduled')) DEFAULT 'active',
  draw_date TIMESTAMP,
  total_numbers INTEGER DEFAULT 10000,
  selection_mode TEXT DEFAULT 'loteria' CHECK (selection_mode IN ('loteria', 'jogo_bicho')),
  selection_timeout INTEGER DEFAULT 5,
  payment_timeout INTEGER DEFAULT 15,
  code TEXT,
  instagram_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS winner_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prize TEXT NOT NULL,
  photo_url TEXT,
  media_type TEXT DEFAULT 'photo' CHECK (media_type IN ('photo', 'youtube', 'instagram')),
  video_url TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT,
  buyer_email TEXT,
  status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  payment_amount DECIMAL(10,2),
  payment_proof_url TEXT,
  expires_at TIMESTAMP,
  pix_txid TEXT,
  pix_copypaste TEXT,
  pix_qrcode TEXT,
  -- Colunas integração EFI/PIX
  efi_txid VARCHAR(35),
  efi_status VARCHAR(20),
  efi_pix_copia_cola TEXT,
  efi_qr_code_url TEXT,
  payment_method VARCHAR(20) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(raffle_id, number)
);

CREATE INDEX IF NOT EXISTS idx_reservations_efi_txid ON reservations(efi_txid);

-- Tabela de transações EFI/PIX
CREATE TABLE IF NOT EXISTS efi_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txid VARCHAR(35) UNIQUE NOT NULL,
  raffle_id UUID REFERENCES raffles(id) ON DELETE CASCADE,
  reservation_ids UUID[] NOT NULL DEFAULT '{}',
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL,
  pix_copia_cola TEXT,
  qr_code_url TEXT,
  buyer_name VARCHAR(255),
  buyer_email VARCHAR(255),
  buyer_phone VARCHAR(20),
  buyer_cpf VARCHAR(14),
  webhook_events JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_efi_txid ON efi_transactions(txid);
CREATE INDEX IF NOT EXISTS idx_efi_raffle ON efi_transactions(raffle_id);
CREATE INDEX IF NOT EXISTS idx_efi_status ON efi_transactions(status);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ==================== 2. ROW LEVEL SECURITY ====================

ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas raffles
CREATE POLICY "Anyone can read raffles" ON raffles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert raffles" ON raffles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update raffles" ON raffles FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete raffles" ON raffles FOR DELETE USING (true);

-- Políticas winner_photos
CREATE POLICY "Anyone can read winner_photos" ON winner_photos FOR SELECT USING (true);
CREATE POLICY "Anyone can insert winner_photos" ON winner_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update winner_photos" ON winner_photos FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete winner_photos" ON winner_photos FOR DELETE USING (true);

-- Políticas reservations
CREATE POLICY "Anyone can read reservations" ON reservations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update reservations" ON reservations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete reservations" ON reservations FOR DELETE USING (true);

-- Políticas system_settings
CREATE POLICY "Anyone can read system_settings" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can manage system_settings" ON system_settings FOR ALL USING (true);

-- ==================== 3. STORAGE (Upload de Imagens) ====================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('raffle-images', 'raffle-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('winner-photos', 'winner-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Anyone can upload payment proofs"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT USING (bucket_id = 'payment-proofs');

CREATE POLICY "Anyone can upload raffle images"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'raffle-images');

CREATE POLICY "Anyone can view raffle images"
ON storage.objects FOR SELECT USING (bucket_id = 'raffle-images');

CREATE POLICY "Anyone can upload winner photos"
ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'winner-photos');

CREATE POLICY "Anyone can view winner photos"
ON storage.objects FOR SELECT USING (bucket_id = 'winner-photos');

CREATE POLICY "Anyone can delete winner photos"
ON storage.objects FOR DELETE USING (bucket_id = 'winner-photos');

CREATE POLICY "Anyone can delete raffle images"
ON storage.objects FOR DELETE USING (bucket_id = 'raffle-images');

-- ==================== 4. FUNÇÕES E TRIGGERS ====================

-- Função para expirar/deletar reservas pending
CREATE OR REPLACE FUNCTION delete_expired_reservations()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  GET DIAGNOSTICS count = ROW_COUNT;
  RAISE NOTICE 'Deletadas % reservas expiradas', count;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Função consolidada de limpeza
CREATE OR REPLACE FUNCTION expire_old_reservations()
RETURNS TABLE(expired_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM reservations
  WHERE status = 'pending'
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  GET DIAGNOSTICS count = ROW_COUNT;
  UPDATE reservations
  SET status = 'cancelled'
  WHERE status = 'paid'
    AND (payment_proof_url IS NULL OR payment_proof_url = '')
    AND expires_at < NOW()
    AND expires_at IS NOT NULL;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Função para resetar números de uma rifa
CREATE OR REPLACE FUNCTION reset_raffle_numbers(raffle_id_param UUID)
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  DELETE FROM reservations WHERE raffle_id = raffle_id_param;
  GET DIAGNOSTICS count = ROW_COUNT;
  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- ==================== 5. REALTIME ====================

ALTER publication supabase_realtime ADD TABLE reservations;

-- ==================== 6. CONFIGURAÇÕES INICIAIS DO SISTEMA ====================

INSERT INTO system_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  ('maintenance_message', 'Sistema em manutenção. Volte em breve!'),
  ('last_edition_number', '0000')
ON CONFLICT (key) DO NOTHING;

-- ==================== 7. COMENTÁRIOS ====================

COMMENT ON COLUMN reservations.expires_at IS 'Reserva expira se não pagar no tempo configurado';
COMMENT ON COLUMN raffles.total_numbers IS 'Quantidade total de números disponíveis no sorteio';
COMMENT ON COLUMN raffles.selection_mode IS 'loteria = números 0001-9999, jogo_bicho = 25 animais';
COMMENT ON COLUMN raffles.selection_timeout IS 'Minutos que o número fica bloqueado durante escolha';
COMMENT ON COLUMN raffles.payment_timeout IS 'Minutos para expiração do PIX';
COMMENT ON TABLE system_settings IS 'Configurações globais do sistema';

-- ==================== CONCLUÍDO! ====================
-- Execute SELECT * FROM raffles; para verificar se está tudo OK
