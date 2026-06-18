interface Props {
  nomeCompleto: string;
  apelido: string | null;
  copiado: boolean;
  onCopiar: () => void;
}

export function NomeMontado({ nomeCompleto, apelido, copiado, onCopiar }: Props) {
  const temNome = nomeCompleto.trim().length > 0;

  return (
    <section
      aria-label="Nome completo"
      className="rounded-2xl border border-line bg-white px-6 py-8 text-center"
    >
      <p aria-live="polite" className="font-serif text-2xl leading-snug text-ink sm:text-3xl">
        {temNome ? nomeCompleto : <span className="text-muted">Seu nome vai aparecer aqui</span>}
      </p>

      {apelido && <p className="mt-2 text-sm text-muted">Apelido: {apelido}</p>}

      <div className="mt-5">
        <button
          type="button"
          onClick={onCopiar}
          disabled={!temNome}
          className="rounded-full border border-line px-4 py-1.5 text-sm text-ink transition-colors hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </section>
  );
}
