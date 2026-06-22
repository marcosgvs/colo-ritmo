import type { CSSProperties } from 'react';
import { CATEGORIAS } from '../data';
import { Eyebrow } from '@/components/atoms/Eyebrow';

interface Props {
  valor: string;
  nomeSelecionadoId: string | null;
  onSelecionar: (nome: string) => void;
  onDigitar: (texto: string) => void;
}

function chipStyle(ativo: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 'var(--r-pill)',
    border: ativo ? '1px solid var(--ink)' : '1px solid var(--line-2)',
    background: ativo ? 'var(--ink)' : 'var(--bg)',
    color: ativo ? 'var(--bg)' : 'var(--ink-2)',
    font: '500 15px/1 var(--font-body)',
    cursor: 'pointer',
    transition: 'border-color 140ms ease, background 140ms ease, color 140ms ease',
  };
}

export function PrimeiroNome({ valor, nomeSelecionadoId, onSelecionar, onDigitar }: Props) {
  return (
    <section aria-labelledby="primeiro-nome-titulo" style={{ display: 'grid', gap: 16 }}>
      <Eyebrow style={{ display: 'block' }}>
        <span id="primeiro-nome-titulo">primeiro nome</span>
      </Eyebrow>

      {CATEGORIAS.map((cat) => (
        <div key={cat.titulo} style={{ display: 'grid', gap: 8 }}>
          <span style={{ font: '400 13px/1 var(--font-body)', color: 'var(--ink-3)' }}>{cat.titulo}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {cat.nomes.map((n) => {
              const ativo = nomeSelecionadoId === n.nome;
              return (
                <button
                  key={n.nome}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => onSelecionar(n.nome)}
                  style={chipStyle(ativo)}
                >
                  {n.nome}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <label style={{ display: 'block' }}>
        <span
          style={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          ou digite um nome
        </span>
        <input
          type="text"
          value={valor}
          onChange={(e) => onDigitar(e.target.value)}
          placeholder="ou digite um nome"
          autoComplete="off"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--ink)',
            font: '400 16px/1.4 var(--font-body)',
            outline: 'none',
          }}
        />
      </label>
    </section>
  );
}
