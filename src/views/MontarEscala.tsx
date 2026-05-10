import { Hand } from '@/components/atoms';
import { PageHead } from './_PageHead';

/**
 * Stub temporário · o Montar antigo (solver determinístico + 3 lentes +
 * propostas + padrões observados + exportação PDF/CSV/mensagem) foi
 * removido. Vamos refazer do zero como um Montar AI que consome
 * regras_contratuais + preferências + padrões dos chefes (das escalas
 * importadas) + lentes via prompt, e gera proposta.
 *
 * Enquanto isso, a sincronização das escalas oficiais via PDF continua
 * funcionando · é por ali que o histórico vai se acumulando pra alimentar
 * o futuro Montar.
 */
export function MontarEscala() {
  return (
    <>
      <PageHead
        eyebrow="montar"
        titulo="em construção."
        hand="tô refazendo daqui · volto logo"
      />
      <div
        style={{
          background: 'var(--bg-alt)',
          border: '1px dashed var(--line-2)',
          borderRadius: 'var(--r-md)',
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            font: '500 16px/1.6 var(--font-body)',
            color: 'var(--ink-2)',
            margin: 0,
            maxWidth: 520,
            marginInline: 'auto',
          }}
        >
          o montar tá sendo refeito do zero pra usar as escalas que você
          importa do chefe + suas regras contratuais + suas preferências.
          enquanto isso, continua importando os PDFs por sincronizar — é o
          que vai virar memória do novo montar.
        </p>
        <Hand color="var(--ink-3)" size={15} style={{ display: 'block', marginTop: 18 }}>
          sem prazo certo · te aviso aqui assim que estiver pronto
        </Hand>
      </div>
    </>
  );
}
