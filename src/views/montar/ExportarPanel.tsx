// Etapa 5 do Montar · exportar a proposta por hospital (texto, whatsapp, email, pdf, excel).

import { useMemo, useState } from 'react';
import type { BlocoPlantao, HospitaisMap, PlantaoSugerido, Preferencias } from '@/types';
import { MESES } from '@/lib/data';
// import estático de propósito: whatsapp precisa de window.open síncrono no
// clique (await antes bloqueia popup no Safari/iOS) · xlsx/pdf continuam lazy
// dentro do módulo.
import { baixarExcelMontar, baixarPDFMontar, montarMensagem } from '@/lib/exportarMontar';
import { Mono } from '@/components/atoms';
import { Card, Field, btnSecundario, inputBase } from './ui';

interface ExportarPanelProps {
  mes: string;
  plantoes: PlantaoSugerido[];
  hospitais: HospitaisMap;
  hospitaisSel: Set<string>;
  preferencias: Preferencias;
  chefes: Record<string, string>;
  setChefes: (c: Record<string, string>) => void;
  onVoltar: () => void;
}

export function ExportarPanel({
  mes,
  plantoes,
  hospitais,
  hospitaisSel,
  preferencias,
  chefes,
  setChefes,
  onVoltar,
}: ExportarPanelProps) {
  const porHospital = useMemo(() => {
    const m = new Map<string, PlantaoSugerido[]>();
    for (const p of plantoes) {
      const arr = m.get(p.hospitalId) ?? [];
      arr.push(p);
      m.set(p.hospitalId, arr);
    }
    return m;
  }, [plantoes]);

  const [anoStr, mesStr] = mes.split('-');
  const ano = parseInt(anoStr ?? '0', 10);
  const mesNum = parseInt(mesStr ?? '0', 10);

  // União: hospitais do setup + hospitais que ganharam plantão na edição
  // (senão plantão adicionado fora do setup some de todos os exports).
  const hospitaisExport = useMemo(() => {
    const ids = Array.from(hospitaisSel);
    const vistos = new Set(ids);
    for (const p of plantoes) {
      if (!vistos.has(p.hospitalId)) {
        vistos.add(p.hospitalId);
        ids.push(p.hospitalId);
      }
    }
    return ids;
  }, [hospitaisSel, plantoes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
      {hospitaisExport.map((hid) => {
        const hospital = hospitais[hid];
        if (!hospital) return null;
        const plantoesH = porHospital.get(hid) ?? [];
        return (
          <ExportarHospitalCard
            key={hid}
            hospital={hospital}
            plantoes={plantoesH}
            ano={ano}
            mes={mesNum}
            preferencias={preferencias}
            chefe={chefes[hid] ?? ''}
            setChefe={(v) => setChefes({ ...chefes, [hid]: v })}
          />
        );
      })}

      <button type="button" onClick={onVoltar} style={{ ...btnSecundario, alignSelf: 'flex-start' }}>
        voltar pra editar
      </button>
    </div>
  );
}

interface ExportarHospitalCardProps {
  hospital: HospitaisMap[string];
  plantoes: PlantaoSugerido[];
  ano: number;
  mes: number;
  preferencias: Preferencias;
  chefe: string;
  setChefe: (v: string) => void;
}

function ExportarHospitalCard({ hospital, plantoes, ano, mes, preferencias, chefe, setChefe }: ExportarHospitalCardProps) {
  const [statusTexto, setStatusTexto] = useState<'idle' | 'copiado' | 'erro'>('idle');
  const [exportando, setExportando] = useState<'pdf' | 'xlsx' | null>(null);

  const blocosPlantao: BlocoPlantao[] = plantoes.map((p) => ({
    id: p.id,
    tipo: 'plantao',
    hospitalId: p.hospitalId,
    data: p.data,
    horaInicio: p.horaInicio,
    duracao: p.duracao,
  }));

  function montarTexto(): string {
    return montarMensagem({
      hospital,
      plantoes: blocosPlantao,
      ano,
      mes,
      preferencias,
      chefe: chefe.trim() || undefined,
    });
  }

  async function copiarTexto() {
    const texto = montarTexto();
    try {
      await navigator.clipboard.writeText(texto);
      setStatusTexto('copiado');
    } catch {
      setStatusTexto('erro');
    }
    setTimeout(() => setStatusTexto('idle'), 2000);
  }

  function enviarWhatsApp() {
    // síncrono no gesto do clique · await aqui faria o Safari bloquear o popup
    const texto = montarTexto();
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function enviarEmail() {
    const texto = montarTexto();
    const nomeMes = MESES[mes - 1] ?? '';
    const subject = `Proposta de escala · ${hospital.abrev} · ${nomeMes} ${ano}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(texto)}`;
    window.location.href = url;
  }

  async function baixarPdf() {
    setExportando('pdf');
    try {
      await baixarPDFMontar({
        hospital,
        plantoes: blocosPlantao,
        ano,
        mes,
        preferencias,
        chefe: chefe.trim() || undefined,
      });
    } finally {
      setExportando(null);
    }
  }

  async function baixarExcel() {
    setExportando('xlsx');
    try {
      await baixarExcelMontar({
        hospital,
        plantoes: blocosPlantao,
        ano,
        mes,
        preferencias,
        chefe: chefe.trim() || undefined,
      });
    } finally {
      setExportando(null);
    }
  }

  if (plantoes.length === 0) {
    return (
      <Card titulo={`${hospital.abrev ?? '?'} · ${hospital.nome}`} eyebrow="sem plantões">
        <Mono style={{ color: 'var(--ink-3)' }}>nenhum plantão proposto pra esse hospital · pule</Mono>
      </Card>
    );
  }

  return (
    <Card
      titulo={`${hospital.abrev ?? '?'} · ${hospital.nome}`}
      eyebrow={`${plantoes.length} plantões`}
    >
      <Field label="nome do chefe (opcional)">
        <input
          type="text"
          value={chefe}
          onChange={(e) => setChefe(e.target.value)}
          placeholder="ex: Paulo · Dra. Carla · etc"
          style={inputBase}
        />
      </Field>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
        <button type="button" onClick={enviarWhatsApp} style={btnExport(false, 'sage')}>
          enviar por whatsapp
        </button>
        <button type="button" onClick={enviarEmail} style={btnExport(false, 'sage')}>
          enviar por email
        </button>
        <button type="button" onClick={copiarTexto} style={btnExport(statusTexto === 'copiado')}>
          {statusTexto === 'copiado'
            ? 'texto copiado!'
            : statusTexto === 'erro'
              ? 'não deu · tenta de novo'
              : 'copiar texto'}
        </button>
        <button type="button" onClick={baixarPdf} disabled={exportando !== null} style={btnExport(false)}>
          {exportando === 'pdf' ? 'gerando…' : 'baixar pdf'}
        </button>
        <button type="button" onClick={baixarExcel} disabled={exportando !== null} style={btnExport(false)}>
          {exportando === 'xlsx' ? 'gerando…' : 'baixar excel'}
        </button>
      </div>
      <Mono style={{ display: 'block', marginTop: 8, color: 'var(--ink-3)', fontSize: 11 }}>
        whatsapp e email enviam o texto · pra anexar o pdf, baixa e anexa manualmente
      </Mono>
    </Card>
  );
}

function btnExport(success: boolean, variant: 'ink' | 'sage' = 'ink'): React.CSSProperties {
  const bg = success
    ? 'var(--sage-ink)'
    : variant === 'sage'
    ? 'var(--sage-ink)'
    : 'var(--ink)';
  return {
    font: '600 13px/1 var(--font-body)',
    padding: '11px 18px',
    borderRadius: 999,
    border: 'none',
    background: bg,
    color: 'var(--bg)',
    cursor: 'pointer',
  };
}
