-- MODIFIQUEI AQUI - Tabela para múltiplas referências de concurso oficial por bolão (informativas)
CREATE TABLE IF NOT EXISTS public.contest_official_refs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  official_contest_name TEXT NOT NULL,
  official_contest_code TEXT NOT NULL,
  official_contest_numbers TEXT,
  official_contest_date TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contest_official_refs_contest_id ON public.contest_official_refs(contest_id);

-- RLS: admins podem gerenciar; todos podem ler refs de concursos que podem ver
ALTER TABLE public.contest_official_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage contest_official_refs"
  ON public.contest_official_refs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Anyone can view contest_official_refs"
  ON public.contest_official_refs FOR SELECT
  USING (true);
