# Colo Ritmo · Brief de redesign

> Este documento é o **handoff completo** para refazer o layout do Colo Ritmo no claude.ai/design.
> Lê de cima pra baixo: tokens sagrados → domínio → personas → telas → inconsistências.
> O que está aqui é **ground-truth**. O que NÃO está pode ser repensado.

---

## TL;DR — O essencial em 5 frases

1. Colo Ritmo é uma agenda de plantões pra **Mariana**, médica pediatra de Brasília que trabalha em até 4 hospitais. Marcos (marido + admin) vê a agenda dela em modo parceiro.
2. Tom: **calmo, não-clínico, não-corporativo, PT-BR**. Reconhece sobrecarga ("3 cadeias contínuas > 24h"), nunca repreende ("Violação de protocolo").
3. Identidade visual: cor creme (`#FFFAF3`), tinta marrom-quente (`#3A2E2A`), 8 famílias de cor pra hospitais, **Fraunces** (display) + **Nunito** (UI) + **Caveat** *só pro logo*.
4. Estrutura atual de dados: `Bloco` (tipo plantão/cedido/trocado/sono/bloqueio/deslocamento) × `Hospital` (com família de cor e turnos padrão) × `Recorrência`. Conflito = sobreposição. Cadeia = blocos contíguos > 24h.
5. **O redesign é livre na arquitetura visual** mas precisa preservar: design tokens, vocabulário, tipos de bloco, fluxo de auth, modos parceiro/médica/coordenador.

---

## 1. SAGRADO — não pode mudar

### 1.1 Cores (CSS verbatim do `colors_and_type.css`)

```css
/* Famílias da marca — primary + tag (variante mais saturada/sombria) + wash 18% */
--colo-blue:      #9BC2E7;  --colo-blue-tag:     #9ABDC6;  --colo-blue-50:     #EAF2F9;
--colo-pink:      #E79BC4;  --colo-pink-tag:     #B69BC9;  --colo-pink-50:     #FAEAF2;
--colo-sand:      #E8C79A;  --colo-sand-tag:     #C5AE99;  --colo-sand-50:     #FBF1E1;
--colo-sage:      #A4D498;  --colo-sage-tag:     #BEC99A;  --colo-sage-50:     #ECF6E7;
--colo-lavender:  #A299CB;  --colo-lavender-tag: #989BC7;  --colo-lavender-50: #ECEAF4;
--colo-coral:     #E7A59C;  --colo-coral-tag:    #CA9AB5;  --colo-coral-50:    #FBE9E5;
--colo-aqua:      #9AD8E1;  --colo-aqua-tag:     #C9C799;  --colo-aqua-50:     #E8F6F8;
--colo-olive:     #C5BE99;  --colo-olive-tag:    #99C9A5;  --colo-olive-50:    #F1EFE0;

/* Neutros — nunca branco/preto puro */
--bg:    #FFFAF3;   /* creme, fundo de tudo */
--bg-alt:#FAF3E8;
--ink:   #3A2E2A;   /* marrom-cinza quente, texto principal */
--ink-2: #6B5C56;   /* texto secundário */
--ink-3: #9A8A82;   /* placeholder, terciário */
--line:  rgba(58, 46, 42, 0.08);  /* bordas sussurradas */
--line-2:rgba(58, 46, 42, 0.14);

/* Estados semânticos — versões "dusty" das famílias */
--ok:   #7BB36A;  --ok-bg:   #ECF6E7;
--warn: #D9A85A;  --warn-bg: #FBF1E1;
--err:  #C77264;  --err-bg:  #FBE9E5;  /* cor de erro = coral, sempre */
--info: #6FA6CF;  --info-bg: #EAF2F9;
```

**Regras duras**:
- Brand padrão (sem tema) = **blue**.
- Cor de erro/conflito = **coral** (`--err`), nunca vermelho saturado.
- Cor de "ok/sono protegido" = **sage**.
- Cor de "troca" = **lavender**.
- Backgrounds tintados (`*-50`) sempre 18% sobre o creme — nunca sólidos.

### 1.2 Tipografia

| Família | Uso | Pesos |
|---|---|---|
| **Fraunces** (serif, opsz variable) | Display: h1, h2, h3, números grandes, títulos de tela | 400, 500, 600, 700 |
| **Nunito** (sans) | UI inteira: body, labels, botões, microcopy | 400, 500, 600, 700, 800 |
| **Caveat** (handwritten) | **APENAS** o "pediatria" do logo. Nunca em UI funcional. | 400, 600, 700 |

**Escala** (rem com base 16): 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 56 / 72.

**Pesos por papel**:
- h1 Fraunces 500, clamp(2rem, 4vw, 2.5rem), `text-wrap: balance`
- h2 Fraunces 500, 32px
- h3 Fraunces 600, 24px
- h4 **Nunito** 700, 18px (volta pra sans em h4)
- body Nunito 400, 16px, line-height 1.5
- lede Nunito 500, 20px, ink-2
- eyebrow Nunito 700, 12px, uppercase, tracking 0.04em, ink-3
- small Nunito 400, 14px, ink-2

### 1.3 Espaçamento, raio, sombra

```
--s-1: 4   --s-2: 8   --s-3: 12  --s-4: 16  --s-5: 24
--s-6: 32  --s-7: 48  --s-8: 64  --s-9: 96
```

Raio: 8 (sm) / 16 (md) / 20 (lg) / 28 (xl) / 999 (pill). Cards = lg. Botões = pill. Modais/drawer = xl.

Sombras **quentes** (rgba do ink, nunca cinza-preto):
- sm: 1px 2px + 2px 6px, opacity 0.06/0.04
- md: 2px 6px + 8px 24px, opacity 0.06/0.06
- lg: 8px 24px + 24px 48px, opacity 0.08/0.08
- focus: ring 3px da brand-50

### 1.4 Idioma & vocabulário

- **PT-BR sempre.** Nunca mistura inglês em UI.
- Datas: formato BR (`DD/MM`, `DD/MM/YYYY`, `Seg 4 mai`).
- Semana começa **segunda-feira**. `diaSemanaBR`: 0=Seg, 6=Dom.
- Microcopy reconhece, não repreende:
  - ✅ "3 cadeias contínuas maiores que 24h" / ❌ "Violação de protocolo"
  - ✅ "Sem plantões essa semana" / ❌ "Nenhum registro encontrado"
  - ✅ "Sair da conta?" / ❌ "Confirmar logout"
  - ✅ "Sem senha. A gente manda um link no seu email — clica e tá dentro" / ❌ "Autenticação passwordless"

### 1.5 Tom & moodboard

Calmo. Quente. Papel. Manuscrito do logo (Caveat) é o único toque "doméstico". Resto é tipográfico e tipograficamente confiante. **Não é um app de hospital.** É a agenda pessoal de uma médica que precisa de paz.

Inspirações que servem: papelarias japonesas, Notion calmo, Linear sem ser brutalist, agenda de papel artesanal.

---

## 2. DOMÍNIO — entidades e comportamentos

### 2.1 Hospital

```js
{
  id: 1,
  nome: "Hospital Santa Lúcia",
  abrev: "HSL",
  cor: "sand",         // família do design system
  endereco: "...",
  cep: "70390-145",
  lat: -15.81, lng: -47.92,
  turnos: [
    { nome: "Manhã",     horaInicio: 7,  duracao: 6 },
    { nome: "Tarde",     horaInicio: 13, duracao: 6 },
    { nome: "Noitinha",  horaInicio: 19, duracao: 5 },
    { nome: "Noite",     horaInicio: 19, duracao: 12 }
  ],
  regrasEscala: { ativo: false, /* ... */ }
}
```

**Hospitais reais da Mariana**:
- HSL — Hospital Santa Lúcia (família **sand**)
- HBDF — Hospital de Base do DF (família **blue** — também é a brand padrão)
- HDS — Hospital DF Star (família **coral**)
- HCB — Hospital da Criança de Brasília (família a escolher — provavelmente sage ou aqua)

### 2.2 Bloco — a entidade central

```js
{
  id: 42,
  tipo: "plantao" | "cedido" | "trocado" | "sono" | "bloqueio" | "deslocamento",
  hospitalId: 1,        // null pra sono/bloqueio
  data: "2026-05-04",   // ISO
  horaInicio: 7,        // decimal: 7.5 = 07:30
  duracao: 6,           // horas
  cedidoPara?: "Dra. Ana",
  trocadoCom?: "Dr. João",
  trocaInfo?: "HBDF · Sex 9 mai 19h (12h)",
  motivo?: "aniversário",
  viaTroca?: true,      // bloco recebido em troca
  fonte?: "pdf-import" | "ics" | "fazer-escala" | "manual",
  aceitouConflito?: true,
  auto?: true           // só pra deslocamento
}
```

### 2.3 Convenção visual de Bloco (CRÍTICO — não pode regredir)

| tipo | Visual | Conta na carga? |
|---|---|---|
| `plantao` | Fundo = `cor-50` (wash) · borda esquerda 4px = `cor` · texto = `cor-tag` | ✅ Sim |
| `plantao` com `viaTroca: true` | Mesmo do plantão + **marcador circular lavanda** no canto | ✅ Sim |
| `cedido` | Hachura diagonal sand · opacidade 0.7 · ícone "→" | ❌ **Não** |
| `trocado` (origem) | Hachura diagonal lavanda · ícone ↔ | ❌ Não |
| `sono` | Wash sage · sem borda colorida · label "Sono protegido" sutil | n/a |
| `bloqueio` | Wash neutro (cinza muito claro) · faixa diagonal cinza · label do motivo | n/a |
| `deslocamento` | Faixa fininha (~12px alta) entre blocos · cinza-azulado · ícone carro | ❌ Não |
| Em conflito | Outline coral 2px **pulsando** (animação `colo-pulse-conflict` 2.4s loop) | — |
| Conflito aceito | Outline coral 1px tracejado, sem pulsar | — |

### 2.4 Cadeia & Conflito — conceitos centrais

- **Cadeia**: sequência de blocos (incluindo deslocamentos) sem intervalo de descanso ≥ X horas. **Cadeia > 24h** dispara aviso (microcopy). Default de descanso saudável = 12h. Limite saudável de carga semanal = 60h (CFM).
- **Conflito**: dois blocos com sobreposição temporal (independente de hospital). Detectado live ao adicionar/editar. Tem 3 estados visuais: pulsante coral (pendente) · tracejado coral (aceito) · invisível (resolvido).

### 2.5 Pill de carga (HeaderCarga, sempre visível no topo)

Formato: `0h esta semana` / `42h esta semana` / `60h+ esta semana`. Cor dinâmica por nível:
- `< 40h` → wash sage + ink (saudável)
- `40-60h` → wash sand + ink (atenção)
- `> 60h` → wash coral + ink (alerta — passou do limite CFM)

Tooltip ao hover/focus: "Limite saudável: 60h (CFM)".

### 2.6 Recorrências

```js
{
  id: 1,
  tipo: "weekly" | "biweekly" | "monthly",
  diaSemana: 4,            // se weekly/biweekly
  diaDoMes: 15,            // se monthly
  hospitalId: 1,
  horaInicio: 19,
  duracao: 12,
  inicio: "2026-04-01",
  fim?: "2026-12-31",
  exceptions: ["2026-05-08"]  // ocorrências materializadas/excluídas
}
```

UI: criada via FAB com toggle "Repetir", expandida em runtime, **não persiste blocos materializados** (só a regra + exceções).

### 2.7 Deslocamentos automáticos

Calculados ao salvar blocos via Haversine + multiplicador de trânsito Brasília (rush 7-9h e 17-19h aumenta 50%, fim-de-semana reduz 25%). Modo "smart" tenta OSRM (rota real) com fallback Haversine. Casa = origem, definida no onboarding (CEP via ViaCEP, geocode via Nominatim).

### 2.8 Fazer escala (sandbox de simulação)

Solver gera 3 propostas de escala mensal a partir de regras por hospital + preferências (cadeia max, descanso min, qualidade requerida, dias livres preferidos). Usuária escolhe uma e adota — vira blocos reais. Variantes: **conservadora** / **balanceada** / **maximizadora**. Auto-bloqueia dias com eventos all-day do parceiro (vista casal).

### 2.9 Vista casal

Marcos cola URL do Google Calendar/iCloud do parceiro nas configurações. App fetcha via proxy server-side (`/api/parceiro/agenda?url=`), parseia como ICS, mostra como faixa fininha lavender em ListaDoDia + alimenta o solver de Fazer escala.

---

## 3. PERSONAS & MODOS

### 3.1 Mariana — médica (`tipo_usuario: "medica"`)

- Pediatra UTIP, ~38 anos, mãe.
- Não-técnica. Usa o app no celular durante plantão, no laptop em casa.
- **Quer**: ver a semana de relance, marcar/trocar plantões rápido, evitar conflitos, exportar pro Google Calendar.
- **Não quer**: explicação de "como funciona", microcopy clínico, formulários longos.
- **Fluxo completo**: vê tudo, FAB visível, todas as ações habilitadas.

### 3.2 Marcos — parceiro + admin (`tipo_usuario: "parceiro"`, `role: "admin"`)

- Dev/PM, marido da Mariana. Construiu o app.
- **Quer**: ver agenda dela pra coordenar logística da casa (filhos, viagens), entrar como admin pra debugar.
- **Não pode**: editar agenda dela como se fosse a própria. Ações destrutivas hidden no modo parceiro.
- **Banner lavender** no topo: "💜 Você está vendo a agenda do(a) seu/sua parceiro(a)".
- **FAB sumido** no modo parceiro.

### 3.3 Coordenador (futuro, `tipo_usuario: "coordenador"`)

- Coordenador de hospital, vê escala de várias médicas vinculadas.
- **Banner aqua** no topo.
- Read-only por padrão. Pode anotar (futuro).

### 3.4 Combinatória admin × tipo_usuario

`role` (admin/medico) e `tipo_usuario` (medica/parceiro/coordenador) são **ortogonais**. Marcos é admin+parceiro. Não confundir.

---

## 4. INVENTÁRIO DE TELAS

> Cada tela: nome · propósito em 1 frase · dados que mostra · ações principais. Screenshots da versão atual estão na pasta `inbox/` do repositório (e na página "Telas atuais" do Figma).

### Auth

| Tela | Propósito | Dados | Ações |
|---|---|---|---|
| **Login** | Magic link, sem senha | Logo, input email | Enviar link |

### Onboarding (5 passos hoje, meta 3)

1. **Identidade** — escolher tipo (medica/parceiro/coordenador) + nome
2. **Casa** — CEP + endereço + lat/lng (origem dos deslocamentos)
3. **Hospitais** — cadastrar 1+ hospital (parceiro/coord pulam)
4. **Simulação** — opcional, mostrar Fazer escala com dados fake
5. **Lembretes** — ativar push (opcional)

### Visualizações temporais (5 + 2 auxiliares)

| Tela | Propósito | Densidade |
|---|---|---|
| **Semana** (default desktop) | Grade 7 dias × 24h, ver carga e cadeias | Alta — bloco por bloco visível |
| **Mês** | Calendário tradicional 6×7, ver distribuição | Média — pontos coloridos por dia |
| **Ano** | 12 mini-meses, ver padrão anual | Baixa — heat map sutil |
| **Lista do dia** (default mobile) | Um dia por vez, lista cronológica | Alta + detalhe |
| **Radar 360°** | Anéis concêntricos = 7 dias × 24h | Visualização circular única, identidade da marca |
| **Histórico** | 4 semanas anteriores | Média |
| **Mapa** | Plano Piloto + 3 hospitais + casa | Baixa, ilustrativo |

### Detalhe & ações

| Tela | Propósito | Ações |
|---|---|---|
| **Drawer** | Detalhe de um Bloco (clicar abre) | Editar / Excluir (undo) / Ceder / Trocar / Reverter / Excluir ocorrência / Excluir série |
| **FAB modal** | Adicionar plantão / sono / bloqueio | Form + recorrência opcional + preview de conflito |
| **UndoToast** | Aviso de ação reversível por 5s | "Plantão excluído · Desfazer" |

### Configuração

| Tela | Propósito |
|---|---|
| **SettingsPanel** | Drawer com sidebar de 5 grupos (Conta · Agenda · Notificações · Compartilhamento · Dados) + busca em tempo real |
| **CommandBar** (Cmd+K) | 11 comandos navegáveis com setas + Enter |
| **HospitaisView** | CRUD de hospitais + casa, com auto-geocode |
| **ImportView** | Importar de PDF (Claude Vision) / JSON / ICS · Exportar pra ICS/JSON |
| **ConflitosView** | Lista todos os grupos de conflito, aceitar ou ir pro dia |

### Específicas

| Tela | Propósito |
|---|---|
| **FazerEscalaView** | Sandbox: gera 3 propostas mensais, compara, adota | 
| **FinanceiroView** | Total bruto/líquido por hospital · projeção 90d · comparação mês×mês |
| **AdminView** | (admin) Lista médicos, convidar via magic link, audit log, edit mode em agenda alheia |

---

## 5. INCONSISTÊNCIAS / PAIN POINTS ATUAIS

> Esta seção é onde **você** (Marcos) preenche o que tá ruim e quer redesenhar. Sugestões pra começar — corrige ou expande:

- [ ] **Hierarquia visual** do header está pesada — radar de carga compete com o nome do app. _(verificar no redesign)_
- [ ] **Tabs em 3 grupos** (Tempo / Mais ⌄ / ⚙) ficou confuso — Mariana não sabe onde tá Hospitais
- [ ] **Drawer** mistura ações reversíveis (editar) com destrutivas (excluir/ceder) na mesma fileira
- [ ] **FAB modal** pede dados demais de uma vez — quebrar em passos? ou inline na grade?
- [ ] **SettingsPanel** com sidebar de 5 grupos virou dump de tudo — repensar agrupamento
- [ ] **Onboarding** tem 5 passos, meta era 3 — quais merge?
- [ ] **Mobile** vs desktop: duas filosofias diferentes hoje (lista no mobile, grade no desktop) — unificar ou aceitar como duas experiências?
- [ ] **Densidade** da grade Semana — 32-60px/h via tweak, mas ninguém mexe — fixar em quanto?
- [ ] **Tipografia**: Fraunces no header é nostalgico, mas em h3 da Admin parece formal demais — repensar onde Fraunces vs Nunito
- [ ] **Identidade** entre Colo Ritmo e Colo Pediatria não está clara visualmente — qual cor é "do Ritmo" especificamente?

---

## 6. COMO USAR ESTE BRIEF NO CLAUDE.AI/DESIGN

### Workflow recomendado

1. **Sessão 1 — Tokens & componentes base**: cola este doc inteiro + screenshot do design system. Pede: *"Refaz os tokens visuais (cores, type, spacing) numa página clean. Mantém os hex verbatim. Só repensa hierarquia tipográfica e espaçamento."*

2. **Sessão 2 — Bloco** (componente central): pede uma tela só do componente Bloco com **todas as 8 variantes** (plantão / cedido / trocado / via-troca / sono / bloqueio / deslocamento / conflito). Esse é o átomo do app — se ele converge, o resto vem fácil.

3. **Sessão 3 — Semana**: a tela mais usada. Cola o Bloco já redesenhado + dados de exemplo (4-7 plantões reais). Pede pra refazer a grade.

4. **Sessões seguintes — uma tela por vez**: Drawer → FAB → Mês → Lista → Onboarding → Settings. Sempre com screenshot da versão atual + 1 frase do que tá ruim.

5. **Quando convergir**: peça gerar como **JSX puro React 18** (sem Tailwind, sem CSS-in-JS — só inline styles ou classes utility do `colors_and_type.css`), exportando via `Object.assign(window, {...})`. Cola direto no projeto, bumpa `?v=N`, deploya.

### Anti-padrões a evitar

- ❌ Pedir "redesign tudo" de cara — vai sair genérico.
- ❌ Aceitar primeiro draft sem iterar — claude.ai/design melhora muito na 2ª/3ª iteração.
- ❌ Trocar o vocabulário ("Plantão" → "Shift", "Casa" → "Home") — quebra a identidade.
- ❌ Branco puro ou preto puro em qualquer lugar — sempre `--bg` e `--ink`.
- ❌ Caveat fora do logo.

### O que aceitar mudar livremente

- ✅ Hierarquia de informação na grade Semana
- ✅ Como o Drawer organiza ações (talvez split em primárias/secundárias)
- ✅ Estrutura de navegação (3 tabs vs sidebar vs bottom nav mobile)
- ✅ Visual do FAB e seu modal
- ✅ Layout interno do SettingsPanel
- ✅ Visual do Radar 360° (manter conceito, repensar execução)
- ✅ Onboarding (estrutura, número de passos, ilustrações)

### O que **não** aceitar mudar sem conversa

- 🛑 Paleta das 8 famílias (hex específicos)
- 🛑 Mapeamento hospital → família de cor
- 🛑 Convenção visual de Bloco (wash + borda 4px, hachura cedido/trocado, etc)
- 🛑 PT-BR + datas BR + semana começa segunda
- 🛑 Conceito de "Cadeia > 24h" e "Conflito" (nomes e visuais)
- 🛑 Modo parceiro com banner lavender e FAB hidden
- 🛑 Magic link como único método de auth

---

## Apêndice A — Dados de exemplo realistas

```js
// Mariana, semana 4-10 maio 2026
const blocosExemplo = [
  { id: 1, tipo: 'plantao', hospitalId: 1 /*HSL*/, data: '2026-05-04', horaInicio: 7,  duracao: 6  },
  { id: 2, tipo: 'plantao', hospitalId: 4 /*HCB*/, data: '2026-05-04', horaInicio: 19, duracao: 12 },
  { id: 3, tipo: 'sono',                          data: '2026-05-05', horaInicio: 8,  duracao: 8  },
  { id: 4, tipo: 'plantao', hospitalId: 2 /*HBDF*/,data: '2026-05-06', horaInicio: 13, duracao: 6  },
  { id: 5, tipo: 'cedido',  hospitalId: 1 /*HSL*/, data: '2026-05-07', horaInicio: 7,  duracao: 6,
    cedidoPara: 'Dra. Ana', motivo: 'aniversário do filho' },
  { id: 6, tipo: 'plantao', hospitalId: 1 /*HSL*/, data: '2026-05-08', horaInicio: 19, duracao: 12, viaTroca: true,
    trocaCom: 'Dr. João (HBDF Sex 9 mai 19h)' },
  { id: 7, tipo: 'bloqueio',                       data: '2026-05-09', horaInicio: 0,  duracao: 24,
    motivo: 'aniversário Mariana' },
  { id: 8, tipo: 'plantao', hospitalId: 4 /*HCB*/, data: '2026-05-10', horaInicio: 7,  duracao: 12 },
];

// Carga da semana = 6+12+6+12+12 = 48h → pill sand "atenção"
// Conflito: nenhum (semana limpa)
// Cadeia: blocos do dia 4 (plantão HSL 7-13 + plantão HCB 19-7 do dia 5) com sono entre = ok
```

---

**Versão deste brief**: 1.0 · 07/05/2026 · após Etapa A do refactor (v26).
**Próxima atualização**: após capturas de screenshot autenticadas (seção 5 + Apêndice B com prints).
