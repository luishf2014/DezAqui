-- Migração 036: coluna is_visible em site_pages
-- Páginas institucionais: visibilidade para visitantes (não-admin)
-- Se is_visible = false: não-admin é redirecionado ao abrir a URL; link some do rodapé (admin vê link com etiqueta);
-- administradores continuam a ver a página e editar.

ALTER TABLE public.site_pages
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.site_pages.is_visible IS 'Se false: não-admin não vê link no rodapé e é redirecionado na URL; admins veem link e página.';
