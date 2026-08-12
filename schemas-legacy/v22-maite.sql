-- v22 · área da maitê — lista de desejos com radar de preço
--
-- Por que tabelas próprias (e não user_state): a lista é compartilhada
-- entre Marcos e Mariana — user_state é por usuário e o modo espelho é
-- read-only. Aqui os dois editam, o cron atualiza preços sem risco de
-- clobber no blob, e o Realtime propaga entre os celulares.
--
-- Aplicar via Management API (mesmo fluxo dos schemas anteriores).

-- ── tabelas ──────────────────────────────────────────────────────────

create table if not exists public.maite_listas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  criada_por uuid not null,
  criada_em  timestamptz not null default now()
);

create table if not exists public.maite_membros (
  lista_id uuid not null references public.maite_listas(id) on delete cascade,
  user_id  uuid not null,
  primary key (lista_id, user_id)
);

create table if not exists public.maite_itens (
  id             uuid primary key default gen_random_uuid(),
  lista_id       uuid not null references public.maite_listas(id) on delete cascade,
  nome           text not null,
  categoria      text,
  imagem_url     text,
  url            text,
  loja           text,
  preco_alvo     numeric,
  preco_tabela   numeric,
  preco_atual    numeric,
  preco_atual_em timestamptz,
  -- pesquisando · esperando_bf · comprar_agora · comprado · presente
  status         text not null default 'pesquisando',
  obs            text,
  monitorar      boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.maite_precos (
  id          bigint generated always as identity primary key,
  item_id     uuid not null references public.maite_itens(id) on delete cascade,
  preco       numeric not null,
  loja        text,
  fonte       text,
  coletado_em timestamptz not null default now()
);

create index if not exists maite_itens_lista_idx on public.maite_itens(lista_id);
create index if not exists maite_precos_item_idx on public.maite_precos(item_id, coletado_em desc);

-- ── atualizado_em automático ─────────────────────────────────────────

create or replace function public.maite_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists maite_itens_touch on public.maite_itens;
create trigger maite_itens_touch
  before update on public.maite_itens
  for each row execute function public.maite_touch();

-- ── RLS · acesso só pra quem é membro da lista ───────────────────────

alter table public.maite_listas enable row level security;
alter table public.maite_membros enable row level security;
alter table public.maite_itens enable row level security;
alter table public.maite_precos enable row level security;

drop policy if exists maite_listas_select on public.maite_listas;
create policy maite_listas_select on public.maite_listas
  for select using (
    exists (
      select 1 from public.maite_membros m
      where m.lista_id = maite_listas.id and m.user_id = auth.uid()
    )
  );

drop policy if exists maite_membros_select on public.maite_membros;
create policy maite_membros_select on public.maite_membros
  for select using (user_id = auth.uid());

drop policy if exists maite_itens_membros on public.maite_itens;
create policy maite_itens_membros on public.maite_itens
  for all using (
    exists (
      select 1 from public.maite_membros m
      where m.lista_id = maite_itens.lista_id and m.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.maite_membros m
      where m.lista_id = maite_itens.lista_id and m.user_id = auth.uid()
    )
  );

drop policy if exists maite_precos_select on public.maite_precos;
create policy maite_precos_select on public.maite_precos
  for select using (
    exists (
      select 1 from public.maite_itens i
      join public.maite_membros m on m.lista_id = i.lista_id
      where i.id = maite_precos.item_id and m.user_id = auth.uid()
    )
  );

-- membro pode registrar preço manualmente (botão "atualizar" na view)
drop policy if exists maite_precos_insert on public.maite_precos;
create policy maite_precos_insert on public.maite_precos
  for insert with check (
    exists (
      select 1 from public.maite_itens i
      join public.maite_membros m on m.lista_id = i.lista_id
      where i.id = maite_precos.item_id and m.user_id = auth.uid()
    )
  );

-- ── realtime · itens propagam entre os celulares ─────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'maite_itens'
  ) then
    alter publication supabase_realtime add table public.maite_itens;
  end if;
end $$;

-- ── seed · lista do casal + os 7 itens do benchmark de 11/08/2026 ────
-- (docs/enxoval-maite-benchmark.md é a fonte dos valores)

do $$
declare
  v_marcos  uuid := '911a0e2b-4eec-4634-9ede-469805cc4a0e';
  v_mariana uuid := '70c443bc-1657-4528-ad62-c1ae9352cb66';
  v_lista   uuid;
  v_item    uuid;
begin
  select id into v_lista from public.maite_listas where nome = 'enxoval da maitê' limit 1;
  if v_lista is not null then
    return; -- seed já aplicado
  end if;

  insert into public.maite_listas (nome, criada_por)
    values ('enxoval da maitê', v_marcos) returning id into v_lista;

  insert into public.maite_membros (lista_id, user_id)
    values (v_lista, v_marcos), (v_lista, v_mariana);

  -- 1 · travel system (esperar BF · categoria clássica, 20–40% reais)
  insert into public.maite_itens (lista_id, nome, categoria, url, loja, preco_alvo, preco_tabela, preco_atual, preco_atual_em, status, obs)
    values (v_lista, 'Travel System Maxi-Cosi Leona² Trio (Twillic Truffle)', 'passeio',
      'https://www.amazon.com.br/dp/B0G1ZCSW76', 'amazon', 3500, 4199, 3779, now(), 'esperando_bf',
      'preço atual é o "de rua" padrão · na BF pode ir a R$ 3.2–3.5 mil · Buscapé já registrou R$ 3.695')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 3779, 'amazon', 'benchmark 11/08/2026');

  -- 2 · berço kaike (venda exclusiva da marca · sem comparação possível)
  insert into public.maite_itens (lista_id, nome, categoria, url, loja, preco_tabela, preco_atual, preco_atual_em, status, obs)
    values (v_lista, 'Berço-cama Kaike Avelã (Tulipa Baby)', 'quarto',
      'https://www.tulipababy.com.br/berco/berco-cama-kaike-avela', 'tulipa baby', 2799, 2519, now(), 'pesquisando',
      'pix sai R$ 2.267 · só na loja da marca · colchão é 120×60 (fora do padrão americano — lençóis idem)')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 2519, 'tulipa baby', 'benchmark 11/08/2026');

  -- 3 · berço co-bed (menor preço do mercado + janela de uso curta)
  insert into public.maite_itens (lista_id, nome, categoria, url, loja, preco_tabela, preco_atual, preco_atual_em, status, obs)
    values (v_lista, 'Berço Co-Bed Safety 1st Palace Grey (3 em 1)', 'quarto',
      'https://www.amazon.com.br/dp/B0F5X6LWJ9', 'amazon', 1299, 1039, now(), 'comprar_agora',
      '20% abaixo da tabela · uso 0–9 kg, esperar novembro é perder meses de uso')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 1039, 'amazon', 'benchmark 11/08/2026');

  -- 4 · cadeira nesta (lançamento tabelado · só entra em uso aos 6 meses)
  insert into public.maite_itens (lista_id, nome, categoria, url, loja, preco_alvo, preco_tabela, preco_atual, preco_atual_em, status, obs)
    values (v_lista, 'Cadeira de refeição Maxi-Cosi Nesta (Natural Wood)', 'alimentação',
      'https://www.amazon.com.br/dp/B0FFTH178B', 'amazon', 1800, 2299, 2069, now(), 'esperando_bf',
      'lançamento com preço travado em todas as lojas · zero pressa: só entra em uso aos 6 meses')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 2069, 'amazon', 'benchmark 11/08/2026');

  -- 5 · babá eletrônica (piso do mercado, já é preço de BF)
  insert into public.maite_itens (lista_id, nome, categoria, url, loja, preco_tabela, preco_atual, preco_atual_em, status, obs)
    values (v_lista, 'Babá eletrônica Motorola PIP1000 Wi-Fi', 'eletrônicos',
      'https://www.amazon.com.br/dp/B0DDZ6LTKY', 'amazon', 849.90, 479, now(), 'comprar_agora',
      '44% abaixo da tabela (R$ 790–849 no resto do varejo) · dificilmente novembro melhora')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 479, 'amazon', 'benchmark 11/08/2026');

  -- 6 · lixeira buba (abaixo de todo o histórico)
  insert into public.maite_itens (lista_id, nome, categoria, url, loja, preco_tabela, preco_atual, preco_atual_em, status, obs)
    values (v_lista, 'Lixeira anti-odor Buba 16983', 'higiene',
      'https://www.amazon.com.br/dp/B0C5GP554J', 'amazon', 239, 134.98, now(), 'comprar_agora',
      '35–55% mais barata que em qualquer outra loja (R$ 215–307)')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 134.98, 'amazon', 'benchmark 11/08/2026');

  -- 7 · banheira pé alto (ainda escolhendo modelo)
  insert into public.maite_itens (lista_id, nome, categoria, loja, preco_tabela, preco_atual, preco_atual_em, status, monitorar, obs)
    values (v_lista, 'Banheira com pé alto (top 3: Burigotto Millenia+ · Galzerano Classic · Safety 1st Smile)', 'banho',
      'amazon', 487, 399.90, now(), 'pesquisando', false,
      'Millenia+ R$ 399 na Amazon é a mais alta (~100 cm) com mangueira · conferir se o anúncio inclui o suporte')
    returning id into v_item;
  insert into public.maite_precos (item_id, preco, loja, fonte) values (v_item, 399.90, 'amazon', 'benchmark 11/08/2026');
end $$;

-- ── pg_cron · radar de preços 2x ao dia (9h e 18h BRT) ───────────────
-- Vercel Hobby não aceita cron próprio <1x/dia · mesmo padrão do v16.

do $$
begin
  perform cron.unschedule('colo-maite-radar');
exception when others then
  null;
end $$;

select cron.schedule(
  'colo-maite-radar',
  '0 12,21 * * *',
  $cron$
  select net.http_post(
    -- radar vive dentro de /api/maite (função única · limite de 12 do Hobby)
    url := 'https://colopediatria.com.br/api/maite?acao=radar',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select value from public.app_settings where key = 'cron_secret'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000);
  $cron$
);
