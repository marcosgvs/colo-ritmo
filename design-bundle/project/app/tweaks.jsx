// =====================================================================
// tweaks.jsx — Painel de tweaks (modo, densidade, estado, plataforma)
// =====================================================================

function ColoTweaks() {
  const [t, setTweak] = useTweaks(window.TWEAK_DEFAULTS);

  return (
    <TweaksPanel title="Tweaks" defaultPosition={{ right: 24, bottom: 96 }}>
      <TweakSection title="modo">
        <TweakRadio
          label="papel da pessoa"
          value={t.mode}
          onChange={v => setTweak('mode', v)}
          options={[
            { label: 'médica', value: 'medica' },
            { label: 'parceiro', value: 'parceiro' },
            { label: 'admin', value: 'admin' },
          ]}
        />
      </TweakSection>

      <TweakSection title="navegar">
        <TweakSelect
          label="tela"
          value={t.tela || 'agenda'}
          onChange={v => setTweak('tela', v)}
          options={[
            { label: 'agenda · semana',          value: 'agenda' },
            { label: '+ adicionar (universal)',   value: 'agendar' },
            { label: 'inbox · chegadas',          value: 'inbox' },
            { label: 'hospital · detalhe',        value: 'hospital-detalhe' },
            { label: 'mês',                      value: 'mes' },
            { label: 'lista',                    value: 'lista' },
            { label: 'montar escala',            value: 'montar' },
            { label: 'trocas',                   value: 'trocas' },
            { label: 'time',                     value: 'time' },
            { label: 'detalhe',                  value: 'detalhe' },
            { label: 'hospitais · CRUD',         value: 'hospitais' },
            { label: 'sincronizar · importar',   value: 'sync' },
            { label: 'conflitos · resolver',     value: 'conflitos' },
            { label: 'financeiro · mensal',      value: 'financeiro' },
            { label: 'onboarding',               value: 'onboarding' },
            { label: 'login (magic link)',       value: 'login' },
            { label: 'empty · sem conflitos',    value: 'conflitos-vazio' },
            { label: 'conflito · resolver (full)', value: 'conflito-resolver' },
            { label: 'plantão · detalhe (full)',  value: 'detalhe-full' },
            { label: 'erro · sem conexão',        value: 'erro' },
            { label: 'loading · skeleton',        value: 'skeleton' },
            { label: 'coordenadora · painel',     value: 'coordenadora' },
            { label: 'financeiro · ano + IR',     value: 'financeiro-full' },
          ]}
        />
      </TweakSection>

      <TweakSection title="dados">
        <TweakSelect
          label="estado da semana / dados"
          value={t.estado}
          onChange={v => setTweak('estado', v)}
          options={[
            { label: 'cheia (48h, troca, cedido)', value: 'cheia' },
            { label: 'limpa (32h, calma)', value: 'limpa' },
            { label: 'com conflito', value: 'conflito' },
            { label: '60h+ · alerta CFM', value: 'limite' },
            { label: 'vazio (primeira semana)', value: 'vazio' },
          ]}
        />
        <TweakSelect
          label="estado do import (sync)"
          value={t.syncState || 'idle'}
          onChange={v => setTweak('syncState', v)}
          options={[
            { label: 'idle · aguardando arquivo', value: 'idle' },
            { label: 'lendo · IA processando',    value: 'lendo' },
            { label: 'lido · revisar blocos',     value: 'lido' },
            { label: 'erro · ambiguidades',       value: 'erro' },
          ]}
        />
        <TweakSelect
          label="dados · financeiro"
          value={t.dadosFin || 'cheio'}
          onChange={v => setTweak('dadosFin', v)}
          options={[
            { label: 'mês cheio · 4 hospitais',   value: 'cheio' },
            { label: 'só 1 hospital ativo',       value: 'um-hospital' },
            { label: 'sem plantões no mês',       value: 'sem-plantoes' },
          ]}
        />
      </TweakSection>

      <TweakSection title="grade">
        <TweakSlider
          label="densidade · px por hora"
          value={t.density}
          onChange={v => setTweak('density', v)}
          min={32} max={64} step={4}
        />
      </TweakSection>

      <TweakSection title="tipografia">
        <TweakSelect
          label="estilo de destaque (recados, próximo plantão)"
          value={t.handVariant || 'italic'}
          onChange={v => {
            setTweak('handVariant', v);
          }}
          options={[
            { label: 'Fraunces italic (recomendado)', value: 'italic' },
            { label: 'Nunito italic (sóbrio)', value: 'sans-italic' },
            { label: 'Texto normal em lavender', value: 'plain' },
            { label: 'Manuscrito (Caveat / Patrick Hand)', value: 'handwritten' },
          ]}
        />
        <TweakSelect
          label="fonte manuscrita (se ativa acima)"
          value={t.handFont || 'Caveat'}
          onChange={v => {
            setTweak('handFont', v);
            document.documentElement.style.setProperty(
              '--font-handwritten',
              `'${v}', 'Segoe Script', cursive`
            );
          }}
          options={[
            { label: 'Caveat', value: 'Caveat' },
            { label: 'Shadows Into Light Two', value: 'Shadows Into Light Two' },
            { label: 'Homemade Apple', value: 'Homemade Apple' },
            { label: 'Patrick Hand', value: 'Patrick Hand' },
          ]}
        />
      </TweakSection>

      <TweakSection title="visualizar">
        <TweakToggle
          label="mostrar mobile"
          value={t.showMobile}
          onChange={v => setTweak('showMobile', v)}
        />
        <TweakToggle
          label="mostrar desktop"
          value={t.showDesktop}
          onChange={v => setTweak('showDesktop', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

Object.assign(window, { ColoTweaks });
