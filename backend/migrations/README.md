# Migrações do banco (Supabase / PostgreSQL)

Há **36** ficheiros, numerados de **`001_*.sql`** a **`036_*.sql`**. A ordem é **só a ordem do número** no nome (001 … 036).

- Lista completa: **`MIGRATIONS_RUN_ORDER.md`**
- **002** a seguir a **001:** primeiro `002_auth_profiles_trigger.sql`, depois `003_rls_profiles.sql` (a antiga RLS de profiles, agora no ficheiro 003).

Não deixe ficheiros SQL fora desta sequência (evita ficheiros duplicados com outro prefixo).

## Aplicação

1. Abrir o **SQL Editor** do Supabase.
2. Correr o conteúdo de `001_init.sql`, depois `002_…`, e assim sucessivamente até `036_…`.

Não modifique uma migração já aplicada em produção: crie uma nova (por exemplo `037_…`).
