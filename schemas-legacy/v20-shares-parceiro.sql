-- =====================================================================
-- v20 · adições pra v2 ·
--   - parceiro_user_id em user_profiles (vista casal /api/parceiro)
--   - RPC criar_share_token (publicar agenda do mês por X dias)
--   - RPC revogar_share (excluir token)
-- =====================================================================

-- 1) parceiro_user_id em user_profiles
alter table public.user_profiles
  add column if not exists parceiro_user_id uuid references auth.users(id);

-- 2) RPC criar_share_token
create or replace function public.criar_share_token(
  p_mes text,
  p_label text,
  p_dias integer default 30
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token uuid;
begin
  insert into public.share_tokens (user_id, mes, label, expires_at)
  values (auth.uid(), p_mes, coalesce(p_label, p_mes), now() + make_interval(days => p_dias))
  returning token into v_token;
  return v_token;
end$$;

revoke all on function public.criar_share_token(text, text, integer) from public;
grant execute on function public.criar_share_token(text, text, integer) to authenticated;

-- 3) RPC revogar_share
create or replace function public.revogar_share(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.share_tokens
  where token = p_token and user_id = auth.uid()
  returning 1 into v_count;
  return v_count is not null;
end$$;

revoke all on function public.revogar_share(uuid) from public;
grant execute on function public.revogar_share(uuid) to authenticated;

-- 4) RPC listar_meus_shares
create or replace function public.listar_meus_shares()
returns table (token uuid, mes text, label text, expires_at timestamptz, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select token, mes, label, expires_at, created_at
  from public.share_tokens
  where user_id = auth.uid()
  order by created_at desc;
$$;

revoke all on function public.listar_meus_shares() from public;
grant execute on function public.listar_meus_shares() to authenticated;
