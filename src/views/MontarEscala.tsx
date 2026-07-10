// Orquestrador do fluxo Montar · estado das etapas + gerar() · as peças moram em ./montar/.

import { useMemo, useRef, useState } from 'react';
import type {
  Bloco,
  EscalaImportada,
  HospitaisMap,
  Janela,
  PlantaoSugerido,
  Preferencias,
  PropostaHistorico,
} from '@/types';
import { MESES } from '@/lib/data';
import { calcRemuneracaoMes } from '@/lib/remuneracao';
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
  // Proposta do histórico correspondente ao resultado em edição · edições
  // no preview re-salvam nela (senão o histórico fica com versão stale).
  const [propostaAtual, setPropostaAtual] = useState<PropostaHistorico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const lista = Object.values(hospitais);
  const hospitaisHabilitados = lista.filter((h) => hospitaisSel.has(h.id));

  // onSalvarProposta (App) prepende sempre · re-salvar o mesmo id na edição
  // cria versões duplicadas, então o histórico mostra só a mais recente.
  const propostasUnicas = useMemo(() => {
    const vistos = new Set<string>();
    return propostasMontar.filter((p) => {
      if (vistos.has(p.id)) return false;
      vistos.add(p.id);
      return true;
    });
  }, [propostasMontar]);

  const mesNomeExtenso = useMemo(() => {
    const [a, m] = mes.split('-');
    const idx = parseInt(m ?? '1', 10) - 1;
    return `${MESES[idx] ?? ''} ${a}`;
  }, [mes]);

  const metaEfetiva = useMemo<string | null>(() => {
    if (lente !== 'acelerar') return null;
    const valor = acelerarValor.trim() ? parseInt(acelerarValor, 10) : NaN;
    if (isFinite(valor) && valor > 0) return `R$ ${valor.toLocaleString('pt-BR')}`;
    const pct = acelerarPercentual.trim() ? parseInt(acelerarPercentual, 10) : NaN;
    if (!isFinite(pct) || pct <= 0) return null;
    // só % preenchido · com baseline do histórico dá pra mostrar o alvo em plantões
    const [aStr, mStr] = mes.split('-');
    const a = parseInt(aStr ?? '0', 10);
    const m = parseInt(mStr ?? '0', 10);
    const dIni = new Date(Date.UTC(a, m - 1 - 6, 1));
    const iniJanela = `${dIni.getUTCFullYear()}-${String(dIni.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const iniAlvo = `${mes}-01`;
    const hist = blocos.filter((b) => b.tipo === 'plantao' && b.data >= iniJanela && b.data < iniAlvo);
    const mesesAmostra = new Set(hist.map((b) => b.data.slice(0, 7))).size;
    if (mesesAmostra >= 3) {
      const alvo = Math.round((hist.length / mesesAmostra) * (1 + pct / 100));
      return `~${alvo} plantões (+${pct}%)`;
    }
    return `+${pct}%`;
  }, [lente, acelerarValor, acelerarPercentual, mes, blocos]);

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
    const controller = new AbortController();
    abortRef.current = controller;
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
        signal: controller.signal,
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
      const proposta: PropostaHistorico = {
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
      };
      onSalvarProposta(proposta);
      setPropostaAtual(proposta);
      setEtapa('preview');
    } catch (err) {
      if ((err as Error).name === 'AbortError') return; // cancelado pelo usuário
      setErro((err as Error).message);
      setEtapa('setup');
    } finally {
      abortRef.current = null;
    }
  }

  function cancelarGeracao() {
    abortRef.current?.abort();
    setEtapa('setup');
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
    setPropostaAtual(p);
    setEtapa('preview');
  }

  function regerar() {
    setResultado(null);
    setPropostaAtual(null);
    setEtapa('setup');
  }

  // Edição no preview muda o resultado E re-salva a proposta do histórico
  // (mesmo caminho do gerar) · senão a versão persistida fica stale.
  function aplicarEdicao(mut: (plantoes: PlantaoSugerido[]) => PlantaoSugerido[]) {
    if (!resultado) return;
    const plantoes = mut(resultado.plantoes);
    const blocosPlantao = plantoes.map((p) => ({
      id: p.id,
      tipo: 'plantao' as const,
      hospitalId: p.hospitalId,
      data: p.data,
      horaInicio: p.horaInicio,
      duracao: p.duracao,
    }));
    const valorEstimado = calcRemuneracaoMes(blocosPlantao, hospitais, mes).total.bruto;
    setResultado({ ...resultado, plantoes, valorEstimado });
    if (propostaAtual) {
      const atualizada = { ...propostaAtual, plantoes, valorEstimado };
      setPropostaAtual(atualizada);
      onSalvarProposta(atualizada);
    }
  }

  function removerPlantao(id: string) {
    aplicarEdicao((ps) => ps.filter((p) => p.id !== id));
  }

  function adicionarPlantao(data: string, hospitalId: string, janela: Janela) {
    aplicarEdicao((ps) => [
      ...ps,
      {
        id: `sug-${Date.now()}-${ps.length}`,
        hospitalId,
        data,
        horaInicio: janela.inicio,
        duracao: janela.duracao,
      },
    ]);
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

      {etapa === 'setup' && propostasUnicas.length > 0 && (
        <HistoricoPropostas
          propostas={propostasUnicas}
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
          <button
            type="button"
            onClick={cancelarGeracao}
            style={{
              font: '500 12px/1 var(--font-body)',
              padding: '10px 16px',
              borderRadius: 999,
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              marginTop: 4,
            }}
          >
            cancelar
          </button>
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
