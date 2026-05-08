-- =====================================================================
-- v19 · notificações in-app · Colo Ritmo v2
--
-- Sino + drawer no header consomem dessa tabela. Push notifications
-- (web push via VAPID) cuida do envio externo; essa tabela é a fila
-- de avisos que vivem dentro da app pra cada user.
--
-- Convenção:
--   - tipo limita o vocabulário (5 valores)
--   - lida default false · marcarLida atualiza pra true
--   - payload_json livre pra contexto extra (link interno, ids)
--   - índice composto pra rápido "minhas não-lidas mais recentes"
-- =====================================================================

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('troca', 'conflito', 'sugestao', 'aprovacao', 'limite')),
  titulo text not null,
  detalhe text not null default '',
  lida boolean not null default false,
  payload_json jsonb,
  criada_em timestamptz not null default now()
);

create index if not exists notificacoes_user_lidas_idx
  on public.notificacoes (user_id, lida, criada_em desc);

create index if not exists notificacoes_user_recentes_idx
  on public.notificacoes (user_id, criada_em desc);

-- =====================================================================
-- RLS · só vê e marca as próprias. Insert pelo service_role (server).
-- =====================================================================

alter table public.notificacoes enable row level security;

drop policy if exists "notificacoes_select_proprias" on public.notificacoes;
create policy "notificacoes_select_proprias"
  on public.notificacoes for select
  using (auth.uid() = user_id);

drop policy if exists "notificacoes_update_proprias" on public.notificacoes;
create policy "notificacoes_update_proprias"
  on public.notificacoes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Insert e delete só via service_role (não há policy de insert pra anon
-- ou authenticated). Isso garante que a UI nunca cria notificacao
-- diretamente · sempre passa por endpoint server-side ou trigger.

-- =====================================================================
-- Realtime · habilita publicação só dessa tabela na sub do client.
-- Se v18 já tem `supabase_realtime` configurado, isso é noop.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
exception when undefined_object then
  -- publication não existe ainda · pula
  null;
end$$;

-- =====================================================================
-- Helper RPC · `marcar_todas_lidas()`. Tornar callable pelo client.
-- =====================================================================

create or replace function public.marcar_todas_notificacoes_lidas()
returns int
language sql
security definer
set search_path = public
as $$
  update public.notificacoes
  set lida = true
  where user_id = auth.uid() and lida = false;
  select count(*)::int from public.notificacoes
  where user_id = auth.uid() and lida = true;
$$;

revoke all on function public.marcar_todas_notificacoes_lidas() from public;
grant execute on function public.marcar_todas_notificacoes_lidas() to authenticated;

-- =====================================================================
-- Pra testar manualmente:
--
-- insert into public.notificacoes (user_id, tipo, titulo, detalhe, payload_json)
-- values (
--   '847a180d-02b2-457b-9fb1-fb132b6852e9',  -- claude
--   'sugestao',
--   'plantão sugerido sex 8 mai',
--   'HBDF UTI · 7-19h · cabe na sua agenda',
--   '{"link": "agenda", "blocoId": "xxx"}'::jsonb
-- );
--
-- O client com realtime ON deve ver chegar no sino em <1s.
-- =====================================================================
