-- Adicionar campos Efi na tabela reservations
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS efi_txid VARCHAR(35),
ADD COLUMN IF NOT EXISTS efi_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS efi_pix_copia_cola TEXT,
ADD COLUMN IF NOT EXISTS efi_qr_code_url TEXT,
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'manual';

-- Criar índice para busca rápida por txid
CREATE INDEX IF NOT EXISTS idx_reservations_efi_txid ON reservations(efi_txid);

-- Criar tabela de transações Efi
CREATE TABLE IF NOT EXISTS efi_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_efi_txid ON efi_transactions(txid);
CREATE INDEX IF NOT EXISTS idx_efi_raffle ON efi_transactions(raffle_id);
CREATE INDEX IF NOT EXISTS idx_efi_status ON efi_transactions(status);

-- RLS (Row Level Security) para efi_transactions
ALTER TABLE efi_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir leitura, inserção e atualização para efi_transactions
DROP POLICY IF EXISTS "Permitir leitura de transações Efi" ON efi_transactions;
CREATE POLICY "Permitir leitura de transações Efi" ON efi_transactions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir inserção de transações Efi" ON efi_transactions;
CREATE POLICY "Permitir inserção de transações Efi" ON efi_transactions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização de transações Efi" ON efi_transactions;
CREATE POLICY "Permitir atualização de transações Efi" ON efi_transactions FOR UPDATE USING (true);

-- Comentários para documentação
COMMENT ON COLUMN reservations.efi_txid IS 'ID da transação Efi (Transaction ID)';
COMMENT ON COLUMN reservations.efi_status IS 'Status retornado pela API Efi (ATIVA, CONCLUIDA, etc)';
COMMENT ON COLUMN reservations.efi_pix_copia_cola IS 'Código PIX Copia e Cola gerado pela Efi';
COMMENT ON COLUMN reservations.efi_qr_code_url IS 'URL da imagem QR Code em base64';
COMMENT ON COLUMN reservations.payment_method IS 'Método de pagamento: efi ou manual';

COMMENT ON TABLE efi_transactions IS 'Histórico de transações PIX via Efi';

-- Função para atualizar status da transação e registrar evento de webhook
CREATE OR REPLACE FUNCTION update_efi_transaction_status(
  p_txid VARCHAR, 
  p_status VARCHAR, 
  p_paid_at TEXT, 
  p_event JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE efi_transactions
  SET 
    status = p_status,
    paid_at = CASE WHEN p_paid_at IS NOT NULL AND p_paid_at != '' THEN p_paid_at::timestamp ELSE paid_at END,
    webhook_events = COALESCE(webhook_events, '[]'::jsonb) || jsonb_build_array(p_event),
    updated_at = NOW()
  WHERE txid = p_txid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
