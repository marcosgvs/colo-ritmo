import { useCallback, useMemo, useState } from 'react';
import type { Bloco, Hospital } from '@/types';
import {
  apagarCalendario,
  criarEvento,
  eventoDoBloco,
  garantirCalendarioDedicado,
  temAcessoCalendar,
} from '@/lib/gcal';
import { entrarComGoogle } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import type { GcalConfig } from '@/hooks/useUserState';

export type GcalStatus =
  | 'desconectado'
  | 'conectado'
  | 'sincronizando'
  | 'conectando'
  | 'erro';

export interface GcalSyncAPI {
  status: GcalStatus;
  erro: string | null;
  config: GcalConfig | null;
  pendentes: number;
  sincronizados: number;
  conectar: () => Promise<void>;
  sincronizar: () => Promise<void>;
  desconectar: (apagarCalendarioRemoto?: boolean) => Promise<void>;
}

interface ParamsHook {
  blocos: Bloco[];
  hospitais: Record<string, Hospital>;
  config: GcalConfig | undefined;
  onConfig: (c: GcalConfig | undefined) => void;
}

async function pegarTokenGoogle(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.provider_token ?? null;
}

export function useGcalSync({ blocos, hospitais, config, onConfig }: ParamsHook): GcalSyncAPI {
  const [trabalhando, setTrabalhando] = useState<'conectando' | 'sincronizando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const plantoes = useMemo(() => blocos.filter((b) => b.tipo === 'plantao'), [blocos]);
  const pendentes = useMemo(() => {
    if (!config) return plantoes.length;
    return plantoes.filter((p) => !config.mapping[String(p.id)]).length;
  }, [plantoes, config]);
  const sincronizados = useMemo(() => {
    if (!config) return 0;
    return Object.keys(config.mapping).length;
  }, [config]);

  const conectar = useCallback(async () => {
    setErro(null);
    setTrabalhando('conectando');
    try {
      const token = await pegarTokenGoogle();
      if (!token) {
        // Sem provider_token na sessão (login antigo) · dispara OAuth de novo.
        const r = await entrarComGoogle();
        if (!r.ok) setErro(r.erro);
        // Browser vai redirecionar · component vai desmontar antes do finally.
        return;
      }
      const tem = await temAcessoCalendar(token);
      if (!tem) {
        const r = await entrarComGoogle();
        if (!r.ok) setErro(r.erro);
        return;
      }
      const r = await garantirCalendarioDedicado(token);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      onConfig({
        calendarId: r.valor.calendarId,
        mapping: config?.mapping ?? {},
        lastSyncedAt: config?.lastSyncedAt,
      });
    } finally {
      setTrabalhando(null);
    }
  }, [config, onConfig]);

  const sincronizar = useCallback(async () => {
    if (!config) {
      setErro('conecta primeiro');
      return;
    }
    setErro(null);
    setTrabalhando('sincronizando');
    try {
      const token = await pegarTokenGoogle();
      if (!token) {
        setErro('sessão do google expirou · clica em conectar de novo');
        return;
      }
      const mappingNovo = { ...config.mapping };
      for (const plantao of plantoes) {
        const chave = String(plantao.id);
        if (mappingNovo[chave]) continue;
        const hospital = hospitais[plantao.hospitalId];
        const body = eventoDoBloco(plantao, hospital);
        if (!body) continue;
        const r = await criarEvento(token, config.calendarId, body);
        if (!r.ok) {
          setErro(r.erro);
          if (r.reautorizar) break;
          continue;
        }
        mappingNovo[chave] = { eventId: r.valor.id, etag: r.valor.etag };
      }
      onConfig({
        calendarId: config.calendarId,
        mapping: mappingNovo,
        lastSyncedAt: new Date().toISOString(),
      });
    } finally {
      setTrabalhando(null);
    }
  }, [config, plantoes, hospitais, onConfig]);

  const desconectar = useCallback(
    async (apagarRemoto?: boolean) => {
      setErro(null);
      if (apagarRemoto && config) {
        const token = await pegarTokenGoogle();
        if (token) await apagarCalendario(token, config.calendarId);
      }
      onConfig(undefined);
    },
    [config, onConfig],
  );

  let status: GcalStatus;
  if (trabalhando === 'conectando') status = 'conectando';
  else if (trabalhando === 'sincronizando') status = 'sincronizando';
  else if (erro) status = 'erro';
  else if (config) status = 'conectado';
  else status = 'desconectado';

  return {
    status,
    erro,
    config: config ?? null,
    pendentes,
    sincronizados,
    conectar,
    sincronizar,
    desconectar,
  };
}
