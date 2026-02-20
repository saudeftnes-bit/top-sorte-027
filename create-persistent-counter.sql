-- ==================== TABELA DE CONFIGURAÇÕES DE SISTEMA ====================

-- 1. Criar a tabela system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
DROP POLICY IF EXISTS "Anyone can read system_settings" ON system_settings;
CREATE POLICY "Anyone can read system_settings" ON system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update system_settings" ON system_settings;
CREATE POLICY "Admins can update system_settings" ON system_settings FOR ALL USING (true);

-- 4. Inicializar o contador de edições
-- Busca o maior código atual das rifas e salva como ponto de partida
DO $$
DECLARE
    last_code TEXT;
BEGIN
    SELECT code INTO last_code FROM raffles WHERE code IS NOT NULL ORDER BY code DESC LIMIT 1;
    
    INSERT INTO system_settings (key, value)
    VALUES ('last_edition_number', COALESCE(last_code, '0000'))
    ON CONFLICT (key) DO NOTHING;
END $$;

COMMENT ON TABLE system_settings IS 'Tabela para configurações globais do sistema, como contadores persistentes.';
