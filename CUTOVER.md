# Cutover · v1 → v2

Documento de migração da v1 (`colo-pediatria/`) pra v2 (`colo-ritmo/`).
A v2 reaproveita o projeto Vercel `colo-pediatria` e o Supabase
`xlefxpcmruhuyexdvzru` — backend continua igual, só o front muda.

---

## 1 · Antes do `--prod` (pré-checklist)

- [ ] **Supabase · Redirect URLs.** Dashboard → Authentication → URL Configuration → Redirect URLs. Adicionar:
  - `https://colopediatria.com.br/**`
  - `https://colo-pediatria-*.vercel.app/**` (preview)
  - `http://localhost:5173/**` (dev)
- [ ] **Vercel · env vars.** Em produção e preview, garantir:
  - `ANTHROPIC_API_KEY` (já existe · usado em `/api/extrair-escala`)
  - `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT` (já existem · push)
  - `CRON_SECRET` (já existe · pg_cron auth)
  - `PREVIEW_SECRET` (já existe · HMAC dos preview links)
  - `SUPABASE_SERVICE_ROLE_KEY` (já existe · admin reads)
  - `SUPABASE_URL` (alias do Supabase URL · idêntico ao `VITE_SUPABASE_URL`)
  - `VITE_SUPABASE_URL` *(opcional, default hardcoded no client)*
  - `VITE_SUPABASE_ANON_KEY` *(opcional, default hardcoded no client)*
  ```bash
  npx vercel env add VITE_SUPABASE_URL production preview
  # cole: https://xlefxpcmruhuyexdvzru.supabase.co
  npx vercel env add VITE_SUPABASE_ANON_KEY production preview
  # cole: sb_publishable_lrEzOdS4RnrwsDmCUsXEuQ_ElUajQ3W
  ```
- [ ] **Schema do `user_profiles`.** Confirmar colunas usadas pelos endpoints:
  - `user_id uuid` · primary key
  - `nome text`
  - `ics_token uuid` · usado por `/api/ics/[token].ts`
  - `parceiro_user_id uuid` · usado por `/api/parceiro/agenda.ts`
  - `role text · medica/admin`, `tipo_usuario text · medica/parceiro`
  Se o schema da v1 difere, ajustar 2-3 linhas em `api/ics/[token].ts` e `api/parceiro/agenda.ts`.
- [ ] **Schema do `push_subscriptions`.** Confirmar colunas:
  - `user_id uuid`, `endpoint text PK`, `p256dh text`, `auth text`, `user_agent text`, `created_at timestamptz default now()`
- [ ] **Schema do `user_state`.** Confirmar:
  - `user_id uuid PK`, `state jsonb`, `updated_at timestamptz`
- [ ] **RLS habilitado** em `user_state` e `user_profiles` com policy "select/update por `auth.uid()`".
- [ ] **RPCs publicáveis** existem (V2-CREDENTIALS.md §3): `cron_lembretes_payload(secret, modo)`, `criar_share_token`, `get_share_by_token`, `revogar_share`, `atualizar_identidade`, `set_avatar_url`, `listar_snapshots`, `restaurar_snapshot`.

---

## 2 · Promote pra produção

```bash
cd /Volumes/Untitled/_Marcos/aiClaude/colo-ritmo
npm run test     # 83 testes — verde antes de promover
npm run build    # garante zero erro tsc/vite
npx vercel deploy --prod
```

A URL de prod fica `https://colo-pediatria.vercel.app` e o domínio
custom `https://colopediatria.com.br` aponta pra esse projeto via DNS
(registro.br A record `76.76.21.21` + CNAME `www` → `cname.vercel-dns.com.`).
Já está configurado · não precisa mexer no DNS.

---

## 3 · Verificações pós-prod

Manualmente, na ordem:

1. **Login Mariana.** `https://colopediatria.com.br/` → digita email →
   recebe magic link → clica → vê tela Semana com user_state real.
2. **Login Marcos.** Mesmo fluxo · em modo médica vai ver agenda dele
   (vazia provavelmente). Trocar pra `parceiro` no toggle e ver agenda
   da Mariana via `/api/parceiro/agenda`.
3. **Push.** Tela "usuário" → ativar push → permite no navegador →
   confirmar que apareceu em `push_subscriptions` (Supabase Table Editor).
4. **Cron.** No Supabase, rodar manualmente:
   ```sql
   select net.http_post(
     'https://colopediatria.com.br/api/cron/lembrete-plantao?modo=lead',
     '{}',
     jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
   );
   ```
   Resposta esperada: `{ tentadas, sucesso, falhas, expirados }`.
5. **ICS feed.** `https://colopediatria.com.br/api/ics/<token>.ics` →
   abre como text/calendar com VCALENDAR válido.
6. **Importar PDF.** Sync → escolhe HBDF → carrega um PDF de escala →
   Claude Vision devolve blocos → confirma → vê na Semana.
7. **Preview link.** Marcos gera link via `gerarPreviewLink('parceiro', 7d)`
   e Mariana clica → entra automaticamente como parceiro sem login real.

---

## 4 · pg_cron já aponta pra `/api/cron/lembrete-plantao`

V2-CREDENTIALS.md §3 confirma que o Supabase pg_cron já chama:

- `colo-lembrete-30min` · `*/30 * * * *` · modo `lead`
- `colo-lembrete-digest-6am` · `0 9 * * *` · modo `today`

**Como o domínio é o mesmo (`colopediatria.com.br`)**, depois do
`vercel deploy --prod` os crons passam automaticamente a falar com a
v2. Nada pra mexer no Supabase.

---

## 5 · Apagar a v1

Só **depois** de 24-48h da v2 em prod, sem regressões:

```bash
# 1. Backup pro caso de algo dar errado
mv /Volumes/Untitled/_Marcos/aiClaude/colo-pediatria \
   /Volumes/Untitled/_Marcos/aiClaude/_archive-colo-pediatria-v1
# 2. Confirmar que v2 segue funcionando por mais 24h
# 3. Remover backup
rm -rf /Volumes/Untitled/_Marcos/aiClaude/_archive-colo-pediatria-v1
```

A pasta `colo-ritmo/` fica como o repositório oficial. Se quiser
renomear pra `colo-pediatria` no filesystem, é safe — o projeto Vercel
e o domínio independem do nome do diretório local.

---

## 6 · Rollback

Se algo quebrar gravemente:

```bash
# pega o último deploy de prod estável (era v1)
npx vercel ls --prod
npx vercel promote <deployment-url-v1>
```

Os dados em Supabase ficam intactos · v2 só sobrescreve `user_state`
durante o uso normal.

---

## 7 · O que NÃO foi entregue na Sessão 4

Itens conscientemente deixados pra próxima iteração:

- **Solver de Montar Escala** — frame entregue, lógica de sugestões
  automáticas (preferences + regras de hospital + meta) fica pra
  iteração futura.
- **Tela Time** (admin · listar médicos da equipe) — depende de schema
  específico de relacionamento entre user_profiles que a v1 ainda não
  tem totalmente formalizado.
- **Audit log UI** — RPCs e trigger existem; falta tela admin pra
  listar.
- **Snapshots / shares UI** — RPCs publicáveis existem; falta wiring na
  tela "usuário".
- **Geo / mapa** — `lib/geo.ts` está pronto, mas a tela de Hospital com
  CEP + Nominatim só entra quando definir o shape de endereço por
  hospital.
- **Service worker offline** — só entrega push agora, sem cache de app
  shell.

Tudo isso entra no roadmap pós-v2-em-prod.
