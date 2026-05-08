// =====================================================================
// financeiro_completo.jsx — versão expandida do dashboard financeiro
//   3 abas: panorama (mês), IR (anual), repasse (por hospital)
// =====================================================================

const FIN_ANO = {
  ano: 2025,
  bruto: 218400, liquido: 172500,
  inss: 8200, ir: 33700, sindicato: 1800, plano: 2200,
  porMes: [
    { m: 'jan', v: 16800 }, { m: 'fev', v: 18200 }, { m: 'mar', v: 19400 },
    { m: 'abr', v: 17600 }, { m: 'mai', v: 21200 }, { m: 'jun', v: 19800 },
    { m: 'jul', v: 22400 }, { m: 'ago', v: 18900 }, { m: 'set', v: 17200 },
    { m: 'out', v: 19600 }, { m: 'nov', v: 14800 }, { m: 'dez', v: 12500 },
  ],
  porFonte: [
    { id: 'HBDF', nome: 'HBDF', tipo: 'CLT',         v: 86400, pct: 39 },
    { id: 'HSL',  nome: 'HSL',  tipo: 'cooperativa', v: 64800, pct: 30 },
    { id: 'HRAN', nome: 'HRAN', tipo: 'PJ',          v: 42600, pct: 20 },
    { id: 'CON',  nome: 'consultas particulares', tipo: 'PJ', v: 24600, pct: 11 },
  ],
};

const REPASSES = [
  { hosp: 'HBDF', tipo: 'CLT · público',  ciclo: 'dia 5 do mês seguinte', proximo: '05 jun', valor: 7200, status: 'previsto' },
  { hosp: 'HSL',  tipo: 'cooperativa',    ciclo: '5 dias após fechamento', proximo: '08 jun', valor: 5400, status: 'previsto' },
  { hosp: 'HRAN', tipo: 'PJ · NF emitida', ciclo: 'até 10 dias da NF',     proximo: '12 jun', valor: 3550, status: 'aguardando NF' },
  { hosp: 'CON',  tipo: 'particular',     ciclo: 'no ato',                 proximo: 'vário', valor: 2050, status: 'recebido' },
];

function FinanceiroFullScreen({ mode, onBack }) {
  const [aba, setAba] = React.useState('panorama');
  return (
    <main data-screen-label="Financeiro · completo" style={{
      maxWidth: 1480, margin: '0 auto', padding: '24px 32px 96px',
      animation: 'colo-page-in 220ms cubic-bezier(.2,.7,.2,1)',
    }}>
      <RoleBanner mode={mode}/>

      <header style={{ marginBottom: 24 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 6, color: 'var(--sage-ink)' }}>financeiro · ano {FIN_ANO.ano}</Eyebrow>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(34px, 4vw, 44px)', color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>
          panorama anual.
        </h1>
        <p style={{ font: '400 16px/1.4 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0', maxWidth: 580 }}>
          <Hand color="var(--sage-ink)" size={18}>R$ 218.400 brutos em 2025</Hand> · 4 fontes · líquido depois de impostos: R$ 172.500.
        </p>
      </header>

      <nav style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 24 }}>
        {[
          { k: 'panorama', label: 'panorama' },
          { k: 'ir',       label: 'imposto de renda' },
          { k: 'repasse',  label: 'repasse' },
        ].map(o => (
          <button key={o.k} onClick={() => setAba(o.k)} style={{
            font: '600 13px/1 var(--font-body)', padding: '12px 18px',
            background: 'transparent', border: 'none',
            borderBottom: aba === o.k ? '2px solid var(--ink)' : '2px solid transparent',
            color: aba === o.k ? 'var(--ink)' : 'var(--ink-3)',
            cursor: 'pointer', marginBottom: -1,
          }}>{o.label}</button>
        ))}
      </nav>

      {aba === 'panorama' && <AbaPanorama/>}
      {aba === 'ir'       && <AbaIR/>}
      {aba === 'repasse'  && <AbaRepasse/>}
    </main>
  );
}

function AbaPanorama() {
  const max = Math.max(...FIN_ANO.porMes.map(m => m.v));
  const ehAlto = v => v > max * 0.85;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      <section style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 18 }}>bruto por mês · 2025</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6, alignItems: 'flex-end', height: 220, marginBottom: 8 }}>
          {FIN_ANO.porMes.map(m => {
            const pct = (m.v / max) * 100;
            return (
              <div key={m.m} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ font: '500 11px/1 var(--font-body)', color: 'var(--ink-3)' }}>{(m.v / 1000).toFixed(0)}k</div>
                <div style={{
                  width: '100%', height: `${pct}%`, minHeight: 8,
                  background: ehAlto(m.v) ? 'var(--sage-ink)' : 'var(--sand)',
                  borderRadius: 4,
                }}/>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 }}>
          {FIN_ANO.porMes.map(m => (
            <div key={m.m} style={{ font: '500 11px/1 var(--font-body)', color: 'var(--ink-3)', textAlign: 'center' }}>{m.m}</div>
          ))}
        </div>
        <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '20px 0 0' }}>
          Mês mais alto: <strong style={{ color: 'var(--ink)' }}>jul · R$ 22.4k</strong> · mês mais baixo: <strong style={{ color: 'var(--ink)' }}>dez · R$ 12.5k</strong>. Diferença reflete férias e plantões extras.
        </p>
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <article style={{ background: 'var(--sage-surface)', borderLeft: '3px solid var(--sage-ink)', borderRadius: 14, padding: 20 }}>
          <Eyebrow color="var(--sage-ink)">por fonte</Eyebrow>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FIN_ANO.porFonte.map(f => (
              <div key={f.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px/1.2 var(--font-body)', color: 'var(--ink)' }}>
                  <span>{f.nome} <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· {f.tipo}</span></span>
                  <span>R$ {(f.v/1000).toFixed(1)}k</span>
                </div>
                <div style={{ height: 5, background: 'var(--bg)', borderRadius: 999, marginTop: 6 }}>
                  <div style={{ width: `${f.pct}%`, height: '100%', background: 'var(--sage-ink)', borderRadius: 999 }}/>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
          <Eyebrow style={{ display: 'block', marginBottom: 10 }}>insight</Eyebrow>
          <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: 0 }}>
            HBDF concentra 39% da renda · se você trocar mais turnos noturnos no HSL (cooperativa, R$ maior por hora), pode bater R$ 240k em 2026 sem aumentar carga.
          </p>
        </article>
      </aside>
    </div>
  );
}

function AbaIR() {
  const totalImpostos = FIN_ANO.inss + FIN_ANO.ir + FIN_ANO.sindicato + FIN_ANO.plano;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      <section style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, padding: 28 }}>
        <Eyebrow style={{ display: 'block', marginBottom: 14 }}>declaração 2025 · simulação</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <BigStat label="rendimentos tributáveis" v={`R$ ${(FIN_ANO.bruto/1000).toFixed(1)}k`} sub="CLT + cooperativa + PJ"/>
          <BigStat label="imposto a recolher (estimado)" v={`R$ ${(FIN_ANO.ir/1000).toFixed(1)}k`} sub="alíquota efetiva 15.4%" tone="coral"/>
        </div>

        <Eyebrow style={{ display: 'block', marginBottom: 12 }}>retenções e contribuições</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          <FinRow label="INSS retido na fonte"      v={`R$ ${FIN_ANO.inss.toLocaleString('pt-BR')}`}    pct={3.8}/>
          <FinRow label="IR retido na fonte"        v={`R$ ${FIN_ANO.ir.toLocaleString('pt-BR')}`}      pct={15.4}/>
          <FinRow label="contribuição sindical"     v={`R$ ${FIN_ANO.sindicato.toLocaleString('pt-BR')}`} pct={0.8}/>
          <FinRow label="plano de saúde · Sulamérica" v={`R$ ${FIN_ANO.plano.toLocaleString('pt-BR')}`}  pct={1.0}/>
          <FinRow label="total descontado"          v={`R$ ${totalImpostos.toLocaleString('pt-BR')}`}    pct={21.0} bold/>
        </div>

        <Eyebrow style={{ display: 'block', marginBottom: 12 }}>deduções possíveis</Eyebrow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { k: 'plano',    l: 'plano de saúde',                  v: 'R$ 2.200', sel: true },
            { k: 'previd',   l: 'previdência privada (PGBL)',      v: 'R$ 0',    sel: false, hint: 'até 12% da renda · vale ativar' },
            { k: 'depend',   l: 'dependentes',                     v: 'R$ 2.275', sel: true },
            { k: 'educacao', l: 'educação · pós-graduação',        v: 'R$ 3.561', sel: true },
            { k: 'medico',   l: 'despesas médicas · sem limite',   v: 'R$ 4.800', sel: true },
            { k: 'pensao',   l: 'pensão alimentícia',              v: 'R$ 0',    sel: false },
          ].map(d => (
            <div key={d.k} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: 12, borderRadius: 10,
              background: d.sel ? 'var(--sage-surface)' : 'var(--bg-2)',
              border: d.sel ? '1px solid var(--sage-ink)' : '1px solid var(--line)',
            }}>
              <input type="checkbox" defaultChecked={d.sel} style={{ marginTop: 3 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ font: '500 13px/1.3 var(--font-body)', color: 'var(--ink)' }}>{d.l}</div>
                <div style={{ font: '500 12px/1.3 var(--font-body)', color: d.sel ? 'var(--sage-ink)' : 'var(--ink-3)', marginTop: 2 }}>{d.v}</div>
                {d.hint && <div style={{ font: '400 11px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 4, fontStyle: 'italic' }}>{d.hint}</div>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <article style={{ background: 'var(--sand-surface)', borderRadius: 14, padding: 20, borderLeft: '3px solid var(--sand-ink)' }}>
          <Eyebrow color="var(--sand-ink)">prazos</Eyebrow>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8, font: '400 13px/1.4 var(--font-body)', color: 'var(--ink-2)' }}>
            <div><strong style={{ color: 'var(--ink)' }}>15 mar 2026</strong> · DIRPF começa</div>
            <div><strong style={{ color: 'var(--ink)' }}>30 abr 2026</strong> · prazo final</div>
            <div><strong style={{ color: 'var(--ink)' }}>31 mai 2026</strong> · 1ª cota se parcelar</div>
          </div>
        </article>

        <article style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 14, padding: 20 }}>
          <Eyebrow style={{ display: 'block', marginBottom: 10 }}>preparar declaração</Eyebrow>
          <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 12px' }}>
            Geramos um <strong>relatório</strong> com todos os rendimentos por fonte, INSS, IR retido e despesas dedutíveis · você manda pra contadora ou colocar na DIRPF.
          </p>
          <button style={{ ...btnAprovar, width: '100%' }}>baixar relatório IR · PDF</button>
        </article>

        <article style={{ background: 'var(--lavender-surface)', borderLeft: '3px solid var(--lavender-ink)', borderRadius: 14, padding: 20 }}>
          <Eyebrow color="var(--lavender-ink)">sugestão</Eyebrow>
          <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '8px 0 0' }}>
            Você pode reduzir IR em até <strong style={{ color: 'var(--ink)' }}>R$ 7.200</strong> contribuindo pra PGBL (12% da renda). Vale conversar com a contadora.
          </p>
        </article>
      </aside>
    </div>
  );
}

function AbaRepasse() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Mini2 label="próximos 30 dias" v="R$ 18.2k" tone="sage"/>
        <Mini2 label="aguardando NF"   v="R$ 3.5k" tone="coral"/>
        <Mini2 label="recebido no mês" v="R$ 6.8k" tone="sand"/>
        <Mini2 label="atrasado"        v="R$ 0"   tone="sage"/>
      </div>

      <Eyebrow style={{ display: 'block', marginBottom: 12 }}>cronograma · próximo ciclo</Eyebrow>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
        {REPASSES.map((r, i) => {
          const tone = r.status === 'recebido' ? 'sage' : r.status === 'aguardando NF' ? 'coral' : 'sand';
          return (
            <div key={r.hosp} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 1fr 140px 160px 120px',
              gap: 16, padding: '16px 20px', alignItems: 'center',
              borderTop: i ? '1px solid var(--line)' : 'none',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>{r.hosp}</div>
              <div style={{ font: '400 13px/1.3 var(--font-body)', color: 'var(--ink-2)' }}>{r.tipo}</div>
              <div style={{ font: '400 12px/1.3 var(--font-body)', color: 'var(--ink-3)' }}>ciclo: {r.ciclo}</div>
              <div style={{ font: '500 13px/1 var(--font-body)', color: 'var(--ink-2)' }}>{r.proximo}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.01em' }}>R$ {(r.valor/1000).toFixed(1)}k</div>
              <span style={{
                font: '600 11px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.06em',
                padding: '6px 12px', borderRadius: 999,
                background: `var(--${tone}-surface)`, color: `var(--${tone}-ink)`,
                textAlign: 'center', justifySelf: 'flex-end',
              }}>{r.status}</span>
            </div>
          );
        })}
      </div>

      <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-3)', marginTop: 16, fontStyle: 'italic' }}>
        Quando a cooperativa fechar o mês, vou avisar você e atualizar o calendário automático.
      </p>
    </div>
  );
}

function BigStat({ label, v, sub, tone }) {
  return (
    <div style={{
      background: tone ? `var(--${tone}-surface)` : 'var(--sage-surface)',
      borderLeft: `3px solid var(--${tone || 'sage'}-ink)`,
      borderRadius: 12, padding: 18,
    }}>
      <Eyebrow color={`var(--${tone || 'sage'}-ink)`}>{label}</Eyebrow>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1, marginTop: 8 }}>{v}</div>
      <div style={{ font: '400 12px/1.4 var(--font-body)', color: 'var(--ink-3)', marginTop: 6 }}>{sub}</div>
    </div>
  );
}
function Mini2({ label, v, tone = 'sand' }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, borderTop: `3px solid var(--${tone}-ink)` }}>
      <div style={{ font: '600 10px/1 var(--font-body)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.01em', marginTop: 6 }}>{v}</div>
    </div>
  );
}
function FinRow({ label, v, pct, bold }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 100px',
      gap: 16, alignItems: 'center', padding: '8px 0',
      borderTop: bold ? '1px solid var(--ink)' : 'none',
      paddingTop: bold ? 14 : 8, marginTop: bold ? 8 : 0,
    }}>
      <div style={{ font: bold ? '600 14px/1.2 var(--font-body)' : '400 14px/1.2 var(--font-body)', color: 'var(--ink)' }}>{label}</div>
      <div style={{ font: '500 12px/1 var(--font-body)', color: 'var(--ink-3)', textAlign: 'right' }}>{pct}%</div>
      <div style={{ font: bold ? '600 14px/1 var(--font-body)' : '500 14px/1 var(--font-body)', color: 'var(--ink)', textAlign: 'right' }}>{v}</div>
    </div>
  );
}

const btnAprovar2 = {
  font: '600 13px/1 var(--font-body)', padding: '11px 22px',
  borderRadius: 999, border: 'none',
  background: 'var(--ink)', color: 'var(--bg)', cursor: 'pointer',
};
const btnAprovar3 = btnAprovar2;
window.btnAprovar = window.btnAprovar || btnAprovar2;

Object.assign(window, { FinanceiroFullScreen });
