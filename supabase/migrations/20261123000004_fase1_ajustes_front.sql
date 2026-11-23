-- Ajustes pedidos pela integração do app (Claude). Revisão: Codex.

-- 1. Toda pessoa aprovada (não só promotores) edita o próprio nome e telefone.
--    O trigger guard_profile_update continua bloqueando role, link, approved e email.
drop policy if exists profiles_promoter_update on public.profiles;

create policy profiles_self_update on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select public.current_role()) is not null)
with check (id = (select auth.uid()) and (select public.current_role()) is not null);

-- 2. Avisos chegam em tempo real na tela inicial (Supabase Realtime respeita o RLS de select).
alter publication supabase_realtime add table public.notifications;
