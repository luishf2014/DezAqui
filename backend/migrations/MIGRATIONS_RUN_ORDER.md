# Ordem de execução (1 → 37)

Há **37** ficheiros `00X_*.sql` nesta pasta. Corra **um de cada vez**, por ordem numérica (001 … 037), colando o conteúdo no SQL Editor do Supabase.

**Requisito:** projeto com `auth.users` (Supabase). A `001` referencia `auth.users`.

| # | Ficheiro |
|---|----------|
| 1 | `001_init.sql` |
| 2 | `002_auth_profiles_trigger.sql` |
| 3 | `003_rls_profiles.sql` |
| 4 | `004_rls_contests.sql` |
| 5 | `005_rls_draws.sql` |
| 6 | `006_rls_payments.sql` |
| 7 | `007_rls_participations.sql` |
| 8 | `008_fix_rls_profiles_select.sql` |
| 9 | `009_allow_anon_view_active_contests.sql` |
| 10 | `010_create_notification_tables_and_rls.sql` |
| 11 | `011_create_site_pages_table_and_rls.sql` |
| 12 | `012_add_ticket_code_to_participations.sql` |
| 13 | `013_allow_admin_update_participations.sql` |
| 14 | `014_add_code_to_draws.sql` |
| 15 | `015_create_discounts_table.sql` |
| 16 | `016_auto_finish_contest_on_draw.sql` |
| 17 | `017_add_prize_percentages_to_contests.sql` |
| 18 | `018_create_rateio_snapshots_table.sql` |
| 19 | `019_create_draw_payouts_table.sql` |
| 20 | `020_add_contest_code_to_contests.sql` |
| 21 | `021_add_cpf_to_profiles.sql` |
| 22 | `022_add_numbers_count_to_draws.sql` |
| 23 | `023_remove_auto_finish_on_first_draw.sql` |
| 24 | `024_notify_on_contest_finished.sql` |
| 25 | `025_notify_on_draw_created.sql` |
| 26 | `026_allow_users_view_finished_contests.sql` |
| 27 | `027_fix_notification_triggers_include_default_users.sql` |
| 28 | `028_allow_users_view_ranking_active_contests.sql` |
| 29 | `029_add_official_contest_fields.sql` |
| 30 | `030_contest_official_refs_table.sql` |
| 31 | `031_payments_pix_intent_support.sql` |
| 32 | `032_add_awaiting_pix_to_participations.sql` |
| 33 | `033_rls_payments_via_intent.sql` |
| 34 | `034_contest_extra_prize.sql` |
| 35 | `035_add_birth_date_to_profiles.sql` |
| 36 | `036_site_pages_is_visible.sql` |
| 37 | `037_count_active_participations_public.sql` |

- **Removido:** ficheiros antigos 034/035 do fluxo Pix (placeholder + “reversão” de uma 034 nunca preenchida). O estado de `pix_payment_intents` fica **só** na `031`.

- `025_notify_on_draw_created.sql` inclui no início `DROP` idempotente (substitui o antigo script de drop separado).
