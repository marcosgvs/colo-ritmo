-- =====================================================================
-- v21 · triggers + helper pra auto-popular notificações
--
-- Estratégia minimalista:
--   - função `notificar()` SECURITY DEFINER · qualquer trigger ou RPC
--     pode chamar pra criar uma linha em notificacoes
--   - trigger em `audit_log` · mapeia algumas ações conhecidas pra avisos
--     no sino do owner
--
-- Não tem trigger em user_state porque os updates lá são frequentes (cada
-- save debounced no client). A v22 pode adicionar trigger condicional
-- "ultrapassou 60h pela primeira vez" se virar prioridade.
-- =====================================================================

-- 1) helper genérico
create or replace function public.notificar(
  p_user_id uuid,
  p_tipo text,
  p_titulo text,
  p_detalhe text default '',
  p_payload jsonb default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_tipo not in ('troca','conflito','sugestao','aprovacao','limite') then
    raise exception 'tipo inválido: %', p_tipo;
  end if;
  insert into public.notificacoes (user_id, tipo, titulo, detalhe, payload_json)
  values (p_user_id, p_tipo, p_titulo, coalesce(p_detalhe,''), p_payload)
  returning id into v_id;
  return v_id;
end$$;

revoke all on function public.notificar(uuid, text, text, text, jsonb) from public;
-- nem authenticated · só service_role e definer interno

-- 2) trigger em audit_log
create or replace function public.notif_from_audit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- mapeia algumas ações pra notificação no sino do user dono da ação
  case new.acao
    when 'invite' then
      perform public.notificar(
        new.user_id, 'aprovacao',
        'novo convite enviado',
        coalesce(new.payload->>'email',''),
        new.payload
      );
    when 'role_change' then
      perform public.notificar(
        new.user_id, 'aprovacao',
        'permissão atualizada',
        coalesce(new.payload->>'novo_role',''),
        new.payload
      );
    when 'admin_set_state' then
      perform public.notificar(
        new.user_id, 'troca',
        'admin tocou na sua agenda',
        'Marcos editou via modo admin · audit log tem o diff',
        new.payload
      );
    when 'share_create' then
      perform public.notificar(
        new.user_id, 'aprovacao',
        'link compartilhado criado',
        coalesce(new.payload->>'mes',''),
        new.payload
      );
    else
      -- sem notificação pra outras ações
      null;
  end case;
  return new;
end$$;

drop trigger if exists trg_notif_from_audit on public.audit_log;
create trigger trg_notif_from_audit
  after insert on public.audit_log
  for each row
  execute function public.notif_from_audit();

-- 3) helper de teste · simula um audit insert
-- exemplo:
--   select public.notificar(
--     'user-uuid'::uuid,
--     'sugestao',
--     'plantão sex 8 mai',
--     'cabe na sua agenda',
--     '{"link":"montar"}'::jsonb
--   );
