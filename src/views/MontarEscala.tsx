// Orquestrador do fluxo Montar · estado das etapas + gerar() · as peças moram em ./montar/.

import { useMemo, useState } from 'react';
import type {
  Bloco,
  EscalaImportada,
  HospitaisMap,
  Janela,
  Preferencias,
  PropostaHistorico,
} from '@/types';
import { MESES } from '@/lib/data';
import { LoadingFrases, Mono } from '@/components/atoms';
import { authHeader } from '@/lib/supabase';
import { PageHead } from './_PageHead';
import {
  FRASES_MONTAR,
  type Etapa,
  type Lente,
  type PropostaResultado,
} from './montar/tipos';
import { StepBar } from './montar/ui';
import { HistoricoPropostas } from './montar/HistoricoPropostas';
import { SetupCard } from './montar/SetupCard';
import { BloqueiosCard } from './montar/BloqueiosCard';
import { PreviewBlock } from './montar/PreviewBlock';
import { ExportarPanel } from './montar/ExportarPanel';

interface MontarEscalaProps {
  hospitais: HospitaisMap;
  preferencias: Preferencias;
  blocos: Bloco[];
  escalasImportadas: EscalaImportada[];
  propostasMontar: PropostaHistorico[];
  onCriarBloco: (b: Bloco) => void;
  onSalvarProposta: (p: PropostaHistorico) => void;
}

export function MontarEscala({
  hospitais,
  preferencias,
  blocos,
  escalasImportadas,
  propostasMontar,
  onCriarBloco,
  onSalvarProposta,
}: MontarEscalaProps) {
  const proximoMes = useMemo(() => {
    const hoje = new Date();
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [etapa, setEtapa] = useState<Etapa>('setup');
  const [mes, setMes] = useState<string>(proximoMes);
  const [hospitaisSel, setHospitaisSel] = useState<Set<string>>(
    () => new Set(Object.keys(hospitais)),
  );
  const [lente, setLente] = useState<Lente>('equilibrar');
  const [acelerarPercentual, setAcelerarPercentual] = useState<string>('');
  const [acelerarValor, setAcelerarValor] = useState<string>('');
  const [chefes, setChefes] = useState<Record<string, string>>({});

  const [resultado, setResultado] = useState<PropostaResultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const lista = Object.values(hospitais);
  const hospitaisHabilitados = lista.filter((h) => hospitaisSel.has(h.id));

  const mesNomeExtenso = useMemo(() => {
    const [a, m] = mes.split('-');
    const idx = parseInt(m ?? '1', 10) - 1;
    return `${MESES[idx] ?? ''} ${a}`;
  }, [mes]);

  const metaEfetiva = useMemo<number | null>(() => {
    if (lente !== 'acelerar') return null;
    const o = acelerarValor.trim() ? parseInt(acelerarValor, 10) : NaN;
    return isFinite(o) && o > 0 ? o : null;
  }, [lente, acelerarValor]);

  function toggleHospital(id: string) {
    setHospitaisSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function gerar() {
    if (hospitaisSel.size === 0) {
      setErro('escolha pelo menos um hospital');
      return;
    }
    if (lente === 'acelerar' && !acelerarPercentual.trim() && !acelerarValor.trim()) {
      setErro('acelerar precisa de motivo · preencha % ou R$');
      return;
    }
    setEtapa('gerando');
    setErro(null);
    try {
      const [anoStr, mesStr] = mes.split('-');
      const ano = parseInt(anoStr ?? '0', 10);
      const mesNum = parseInt(mesStr ?? '0', 10);
      const acelPct =
        lente === 'acelerar' && acelerarPercentual.trim()
          ? parseInt(acelerarPercentual, 10)
          : undefined;
      const acelVal =
        lente === 'acelerar' && acelerarValor.trim()
          ? parseInt(acelerarValor, 10)
          : undefined;

      const resp = await fetch('/api/montar-escala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({
          ano,
          mes: mesNum,
          lente,
          acelerarPercentual: acelPct,
          acelerarValor: acelVal,
          hospitais: hospitaisHabilitados,
          preferencias,
          escalasImportadas: escalasImportadas.filter((e) => hospitaisSel.has(e.hospitalId)),
          blocos,
        }),
      });

      if (!resp.ok) {
        let msg = `servidor não respondeu bem · ${resp.status}`;
        try {
          const j = (await resp.json()) as { erro?: string };
          if (j.erro) msg = j.erro;
        } catch {
          /* corpo não-json · mantém a genérica */
        }
        setErro(msg);
        setEtapa('setup');
        return;
      }

      const json = (await resp.json()) as PropostaResultado;
      const baseId = Date.now();
      const plantoesNormalizados = (json.plantoes ?? []).map((p, i) => ({
        ...p,
        id: p.id || `sug-${baseId}-${i}`,
      }));
      setResultado({
        ...json,
        plantoes: plantoesNormalizados,
      });
      // Persiste no histórico (auto-limita a 10 entradas no useUserState)
      onSalvarProposta({
        id: `prop-${baseId}`,
        geradoEm: new Date().toISOString(),
        mes,
        lente,
        acelerarPercentual: acelPct,
        acelerarValor: acelVal,
        hospitaisIds: Array.from(hospitaisSel),
        plantoes: plantoesNormalizados,
        justificativa: json.justificativa ?? '',
        valorEstimado: json.valorEstimado ?? 0,
        avisos: json.avisos ?? [],
      });
      setEtapa('preview');
    } catch (err) {
      setErro((err as Error).message);
      setEtapa('setup');
    }
  }

  function carregarProposta(p: PropostaHistorico) {
    setMes(p.mes);
    setLente(p.lente);
    setAcelerarPercentual(p.acelerarPercentual != null ? String(p.acelerarPercentual) : '');
    setAcelerarValor(p.acelerarValor != null ? String(p.acelerarValor) : '');
    setHospitaisSel(new Set(p.hospitaisIds));
    setResultado({
      plantoes: p.plantoes,
      justificativa: p.justificativa,
      valorEstimado: p.valorEstimado,
      avisos: p.avisos,
    });
    setEtapa('preview');
  }

  function regerar() {
    setResultado(null);
    setEtapa('setup');
  }

  function removerPlantao(id: string) {
    setResultado((r) => (r ? { ...r, plantoes: r.plantoes.filter((p) => p.id !== id) } : r));
  }

  function adicionarPlantao(data: string, hospitalId: string, janela: Janela) {
    setResultado((r) => {
      if (!r) return r;
      const id = `sug-${Date.now()}-${r.plantoes.length}`;
      return {
        ...r,
        plantoes: [...r.plantoes, { id, hospitalId, data, horaInicio: janela.inicio, duracao: janela.duracao }],
      };
    });
  }

  return (
    <>
      <PageHead
        eyebrow="montar"
        titulo={
          etapa === 'preview'
            ? `${mesNomeExtenso} · ${resultado?.plantoes.length ?? 0} plantões`
            : etapa === 'exportar'
              ? `exportar · ${mesNomeExtenso}`
              : 'proposta de escala.'
        }
        hand={
          etapa === 'preview'
            ? 'edita à vontade · clica num dia pra adicionar/remover'
            : etapa === 'exportar'
              ? 'um chefe por vez · escolha o formato'
              : 'configura, escolho o jeito de pensar, e proponho um mês todo'
        }
      />

      <StepBar etapa={etapa} />

      {etapa === 'setup' && propostasMontar.length > 0 && (
        <HistoricoPropostas
          propostas={propostasMontar}
          hospitais={hospitais}
          onCarregar={carregarProposta}
        />
      )}

      {etapa === 'setup' && (
        <SetupCard
          mes={mes}
          setMes={setMes}
          hospitais={lista}
          hospitaisSel={hospitaisSel}
          toggleHospital={toggleHospital}
          lente={lente}
          setLente={setLente}
          acelerarPercentual={acelerarPercentual}
          setAcelerarPercentual={setAcelerarPercentual}
          acelerarValor={acelerarValor}
          setAcelerarValor={setAcelerarValor}
          erro={erro}
          onAvancar={() => {
            if (hospitaisSel.size === 0) {
              setErro('escolha pelo menos um hospital');
              return;
            }
            if (lente === 'acelerar' && !acelerarPercentual.trim() && !acelerarValor.trim()) {
              setErro('acelerar precisa de motivo · preencha % ou R$');
              return;
            }
            setErro(null);
            setEtapa('bloqueios');
          }}
        />
      )}

      {etapa === 'bloqueios' && (
        <BloqueiosCard
          mes={mes}
          blocos={blocos}
          hospitais={hospitais}
          onCriarBloco={onCriarBloco}
          onVoltar={() => setEtapa('setup')}
          onAvancar={() => void gerar()}
        />
      )}

      {etapa === 'gerando' && (
        <div
          style={{
            padding: '40px 32px',
            background: 'var(--lavender-surface)',
            border: '1px dashed var(--lavender-ink)',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            alignItems: 'center',
            maxWidth: 720,
          }}
        >
          <LoadingFrases frases={FRASES_MONTAR} fontSize={16} />
          <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>
            isso pode levar até uns 30 segundos
          </Mono>
        </div>
      )}

      {etapa === 'preview' && resultado && (
        <PreviewBlock
          mes={mes}
          metaEfetiva={metaEfetiva}
          resultado={resultado}
          hospitais={hospitais}
          blocos={blocos}
          onRemoverPlantao={removerPlantao}
          onAdicionarPlantao={adicionarPlantao}
          onVoltar={() => setEtapa('bloqueios')}
          onAvancar={() => setEtapa('exportar')}
          onRegerar={regerar}
        />
      )}

      {etapa === 'exportar' && resultado && (
        <ExportarPanel
          mes={mes}
          plantoes={resultado.plantoes}
          hospitais={hospitais}
          hospitaisSel={hospitaisSel}
          preferencias={preferencias}
          chefes={chefes}
          setChefes={setChefes}
          onVoltar={() => setEtapa('preview')}
        />
      )}
    </>
  );
}
