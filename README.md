# Colo Ritmo · v2

App da Mariana pra organizar plantões. Frontend em Vite + React 18 +
TypeScript, backend em Vercel Functions + Supabase.

> A v1 vive em `colo-pediatria/` e vai ser apagada após v2 estabilizar
> em prod. **Não importar código de v1.** Backend Supabase fica intacto.

## Como rodar

```bash
npm install
npm run dev      # vite em http://localhost:5173
npm run build    # tsc -b && vite build
npm run preview  # serve dist/
npm run test     # vitest · 83 testes
npx vercel deploy           # preview
npx vercel deploy --prod    # produção (ver CUTOVER.md)
```

## Estrutura

```
colo-ritmo/
├── design-bundle/        intocada · referência canônica
├── public/
│   ├── colo-ritmo-mark.svg
│   ├── service-worker.js  push notifications
│   └── assets/logos/      8 famílias de cor
├── api/                  Vercel functions (TS)
│   ├── _shared/          cookies, env, supabaseAdmin
│   ├── preview.ts        HMAC preview cookie
│   ├── extrair-escala.ts Claude Vision (PDF → blocos)
│   ├── ics/[token].ts    feed iCal por user
│   ├── parceiro/agenda.ts vista casal
│   ├── push/             vapid-public, subscribe, unsubscribe
│   └── cron/lembrete-plantao.ts  pg_cron callback
├── src/
│   ├── main.tsx · App.tsx
│   ├── tokens/colors_and_type.css   verbatim do bundle
│   ├── styles/global.css            reset + keyframes
│   ├── lib/
│   │   ├── data.ts        re-exporta tudo abaixo + sample data
│   │   ├── dates.ts       toISO/fromISO/fmtDate/...
│   │   ├── cadeias.ts     calcCadeias
│   │   ├── conflitos.ts   detectarConflitos + cargaSemanal
│   │   ├── remuneracao.ts cálculo bruto/líquido por hospital
│   │   ├── ics.ts         parsearICS + gerarICS
│   │   ├── geo.ts         haversine + ViaCEP + Nominatim
│   │   ├── hmac.ts        HMAC-SHA-256 + preview links
│   │   ├── supabase.ts    cliente client-side
│   │   └── push.ts        registrar SW + assinar push
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useUserState.ts  load + debounced save + realtime
│   │   ├── usePush.ts
│   │   └── usePreviewMode.ts
│   ├── types/index.ts
│   ├── components/
│   │   ├── atoms/         Bloco · Pill · Hand · Eyebrow · Mono · RoleBanner · ColoMark
│   │   ├── shell/         Header · FAB · CargaBadge · NavIcon
│   │   ├── week/          WeekGrid · DayColumn · BlocoComContinuidade · NowLine
│   │   ├── rail/          Rail · Card
│   │   ├── drawer/        BlockDrawer (overlay lateral)
│   │   ├── empty/         EmptyState
│   │   └── notif/         NotifSino + drawer
│   └── views/
│       ├── Login.tsx
│       ├── Onboarding.tsx
│       ├── Shell.tsx       Header+main+FAB+Drawer envolve as views
│       ├── Semana.tsx      tela principal
│       ├── Mes.tsx
│       ├── ListaDoDia.tsx
│       ├── Conflitos.tsx
│       ├── Financeiro.tsx
│       ├── Sync.tsx        importar PDF/ICS, exportar
│       ├── Hospitais.tsx   CRUD
│       ├── Trocas.tsx      fluxo 4 passos
│       ├── MontarEscala.tsx sandbox · solver futuro
│       ├── Detalhe.tsx     full page do plantão
│       ├── Usuario.tsx     perfil + push toggle + sair
│       └── Inbox.tsx       admin · pendências
├── tsconfig.{json,app,api,node}.json
├── vercel.json
└── CUTOVER.md              checklist v1→v2
```

## Convenções

- **TypeScript estrito** · `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`.
- **PT-BR sempre** · UI em sentence case minúsculo. Sentence case = "adicionar plantão", não "Adicionar Plantão".
- **Tokens CSS verbatim do bundle** · `--bg`, `--ink`, `--lavender-ink`, etc.
- **Sem Tailwind, sem CSS-in-JS.** Tokens + inline styles + CSS modules opcional.
- **Libs runtime: React, ReactDOM, Supabase, web-push.** DevDeps: Vite, TS, Vitest, @vercel/node, @types/*.
- **Modo coordenador removido v2** · só `medica`, `parceiro`, `admin`.

## Decisões registradas

- Cores e fontes são lei do bundle (`design-bundle/project/Colo Ritmo · Handoff Dev.html`).
- ColoMark é o wordmark v2, sem o "pediatria" Caveat.
- Bg sempre `#FFFAF3` (cream), ink sempre `#3A2E2A` (warm brown). Nunca branco/preto puro.
- Hospitais default: HSL=sand, HBDF=blue, HDS=coral, HCB=aqua.
- Erro = coral (`#C77264`), nunca vermelho saturado.
- Anim entra/sai 180-240ms · sem bounce · sem spring.
- Modo parceiro = lavender banner + FAB hidden. Modo admin = coral banner + audit log inline.

## Sessões

| # | Entregue |
|---|---|
| 1 · bootstrap | Vite+TS+React 18, tokens, atoms+shell+week+rail, Semana com sample data, preview verde. |
| 2 · dados | Supabase auth (magic link), persistência debounced, realtime channel, helpers `data.ts` (8 módulos), 74 testes Vitest. |
| 3 · backends | 8 endpoints `/api/*` em TS · preview HMAC · ICS feed · push (subscribe/unsubscribe/vapid/cron) · Claude Vision · vista casal · service worker. |
| 4 · telas + cutover | 13 views · Drawer + Detalhe · Onboarding · CRUD hospitais · Sync · Trocas · Inbox · Usuario · empty states · `CUTOVER.md`. |

## Tests

```
npm run test
# 7 test files · 83 tests (dates 28 · cadeias 8 · conflitos 9 · remuneração 8 · ics 12 · geo 9 · hmac 9)
```

## Cutover pra prod

Ver [CUTOVER.md](./CUTOVER.md) — pré-checklist (Supabase redirect URLs,
env vars), promote, verificações e rollback.

## Traps que pegamos no caminho

Pra futuro — coisas que custaram redeploy e horas de debug:

### 1. Imports relativos sem `.js` quebram em ESM Node

`package.json` tem `"type": "module"`, então as Vercel functions rodam
como ESM puro em Node 22. ESM Node **exige** extensão `.js` em imports
relativos, mesmo quando o source é `.ts`:

```ts
// ❌ ERR_MODULE_NOT_FOUND em runtime
import { envObrigatorio } from './_shared/env';

// ✅
import { envObrigatorio } from './_shared/env.js';
```

Vale pra `api/**` e pra `src/lib/*` (que o api importa). Vite no client
aceita ambas porque usa bundler resolution; só o runtime Node é
estrito. Se for adicionar arquivo novo em `api/`, lembra do `.js`.

### 2. `flowType: 'pkce'` vs `'implicit'`

Magic links gerados via **admin API** (`/auth/v1/admin/generate_link`)
e por `signInWithOtp` default mandam tokens no **hash** da URL
(`#access_token=...`). Esse é o flow **implicit**. PKCE espera `?code=`
no query.

Se o cliente Supabase está em PKCE, o detectSessionInUrl **ignora** o
hash e o user fica preso na tela de Login. Em [src/lib/supabase.ts](src/lib/supabase.ts)
mantemos `flowType: 'implicit'` por isso.

### 3. SPA fallback engolindo `/api/*`

O rewrite default `/(.*) → /index.html` captura tudo, inclusive
`/api/ics/*.ics`. Em [vercel.json](vercel.json) usamos negative
lookahead pra excluir `api/` e `assets/`:

```json
{ "source": "/((?!api/|assets/).*)", "destination": "/index.html" }
```

### 4. Vercel Hobby plan não aceita cron < 1×/dia

`*/30 * * * *` rejeita o deploy. Mantemos os crons no Supabase pg_cron
(que já chama `/api/cron/lembrete-plantao` via HTTP).

### 5. Vercel `engines.node`

Padrão era `24.x`. `@vercel/node@5.x` requer 22. Pinning em
[package.json](package.json) `engines.node: "22.x"`.

### 6. Sensitive env vars não vêm em `vercel env pull`

Variáveis marcadas Sensitive (service_role, vapid_private) sempre vêm
como `""` no `.env.local`. Pra usar localmente, rode dentro de função
Vercel ou inclua manualmente. Design proposital — não é bug.
