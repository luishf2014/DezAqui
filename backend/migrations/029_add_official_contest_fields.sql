-- MODIFIQUEI AQUI - Campos informativos do concurso oficial (Mega-Sena/Loto etc.)
ALTER TABLE public.contests
  ADD COLUMN IF NOT EXISTS official_contest_name TEXT,
  ADD COLUMN IF NOT EXISTS official_contest_code TEXT,
  ADD COLUMN IF NOT EXISTS official_contest_numbers TEXT,
  ADD COLUMN IF NOT EXISTS official_contest_date TEXT;
