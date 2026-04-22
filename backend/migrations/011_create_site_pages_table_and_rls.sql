-- ============================================
-- Migração 011: Tabela site_pages (CMS de páginas institucionais)
-- ============================================
-- Requer: 003 (função is_admin) para políticas de escrita.
-- A migração 036 adiciona is_visible; o frontend pode usar colunas anteriores sem 036.
-- ============================================

CREATE TABLE IF NOT EXISTS public.site_pages (
  key TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content_html TEXT,
  content_md TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.site_pages IS 'Conteúdo HTML das páginas institucionais (editado por admin). Coluna is_visible na migração 036.';

-- Leitura pública: necessário para o rodapé listar key/is_visible com anon; conteúdo fica a cargo da app
ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_pages public read" ON public.site_pages;
CREATE POLICY "site_pages public read"
  ON public.site_pages
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "site_pages admin write" ON public.site_pages;
CREATE POLICY "site_pages admin write"
  ON public.site_pages
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- anon não escreve (apenas leitura acima; INSERT/UPDATE cobertos por restrição — sem política de escrita para anon)
