import { useState, type FormEvent } from 'react';
import { ColoMark, Eyebrow, Hand, Mono } from '@/components/atoms';
import { enviarMagicLink, entrarComGoogle } from '@/hooks/useAuth';

type Estado = 'parado' | 'enviando' | 'enviado' | 'erro';

/**
 * Tela de Login · só pra deslogados. Magic link via Supabase auth.
 * Sem senha — toda a sessão é gerada por link no email. Foco numa
 * decisão por tela: digitar email + clicar enviar.
 */
export function Login() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<Estado>('parado');
  const [erro, setErro] = useState<string | null>(null);
  const [googleEstado, setGoogleEstado] = useState<'parado' | 'redirecionando' | 'erro'>('parado');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setEstado('enviando');
    setErro(null);
    const r = await enviarMagicLink(email.trim());
    if (r.ok) {
      setEstado('enviado');
    } else {
      setEstado('erro');
      setErro(r.erro);
    }
  }

  async function onGoogle() {
    setGoogleEstado('redirecionando');
    setErro(null);
    const r = await entrarComGoogle();
    if (!r.ok) {
      setGoogleEstado('erro');
      setErro(r.erro);
    }
    // se ok, browser já navegou pro google · não volta pra cá
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        background: `radial-gradient(circle at 20% 0%, rgba(231,165,156,0.10), transparent 55%),
                     radial-gradient(circle at 80% 100%, rgba(162,153,203,0.10), transparent 55%),
                     var(--bg)`,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'var(--bg)',
          borderRadius: 'var(--r-xl)',
          padding: '48px clamp(28px, 5vw, 44px) 40px',
          boxShadow:
            '0 1px 2px 0 rgba(58,46,42,0.06), 0 18px 48px -8px rgba(231,165,156,0.18), 0 32px 80px -16px rgba(162,153,203,0.18)',
          animation: 'colo-fade-in 380ms ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ColoMark size={28} />
        </div>

        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 19,
            lineHeight: 1.4,
            color: 'var(--ink-2)',
            letterSpacing: '-0.005em',
            textAlign: 'center',
            margin: '0 auto 28px',
            maxWidth: 320,
          }}
        >
          a agenda que respira no seu ritmo, não no do plantão.
        </p>

        {estado === 'enviado' ? (
          <Confirmacao email={email} onReenviar={() => setEstado('parado')} />
        ) : (
          <>
            <button
              type="button"
              onClick={onGoogle}
              disabled={googleEstado === 'redirecionando'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '13px 18px',
                borderRadius: 999,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--ink)',
                font: '600 14px/1 var(--font-body)',
                cursor: googleEstado === 'redirecionando' ? 'wait' : 'pointer',
                marginBottom: 18,
              }}
            >
              <GoogleG />
              {googleEstado === 'redirecionando' ? 'abrindo google…' : 'entrar com Google'}
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '0 0 18px',
              }}
            >
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <Mono style={{ color: 'var(--ink-3)', fontSize: 11 }}>ou por email</Mono>
              <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

          <form onSubmit={onSubmit} noValidate>
            <label htmlFor="email-login" style={{ display: 'block', marginBottom: 8 }}>
              <Eyebrow>seu email</Eyebrow>
            </label>
            <input
              id="email-login"
              type="email"
              autoFocus
              required
              autoComplete="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (estado === 'erro') setEstado('parado');
              }}
              disabled={estado === 'enviando'}
              style={{
                width: '100%',
                padding: '14px 16px',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--line)',
                background: 'var(--bg-alt)',
                font: '500 16px/1.3 var(--font-body)',
                color: 'var(--ink)',
                outline: 'none',
              }}
            />

            {erro && (
              <p
                style={{
                  marginTop: 10,
                  font: '500 13px/1.4 var(--font-body)',
                  color: 'var(--coral-ink)',
                }}
              >
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={estado === 'enviando' || !email.trim()}
              style={{
                marginTop: 20,
                width: '100%',
                padding: '14px 22px',
                borderRadius: 999,
                border: 'none',
                background: 'var(--ink)',
                color: 'var(--bg)',
                font: '600 15px/1 var(--font-body)',
                cursor: estado === 'enviando' ? 'wait' : 'pointer',
                opacity: estado === 'enviando' || !email.trim() ? 0.5 : 1,
                transition: 'opacity 140ms ease',
              }}
            >
              {estado === 'enviando' ? 'enviando…' : 'enviar link mágico'}
            </button>

            <p
              style={{
                marginTop: 22,
                font: '400 13px/1.5 var(--font-body)',
                color: 'var(--ink-3)',
                textAlign: 'center',
              }}
            >
              sem senha · um link aparece no seu inbox em ~30s
            </p>
          </form>
          </>
        )}
      </div>

      <footer style={{ marginTop: 32, textAlign: 'center' }}>
        <Hand size={16} style={{ color: 'var(--ink-3)' }}>
          colo é colo · respira fundo
        </Hand>
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 14,
            justifyContent: 'center',
            font: '400 11px/1 var(--font-body)',
            color: 'var(--ink-3)',
            letterSpacing: '0.02em',
          }}
        >
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>
            privacidade
          </a>
          <span>·</span>
          <a href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>
            termos
          </a>
        </div>
      </footer>
    </div>
  );
}

/** "G" oficial do Google · cores brand (Material). */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#34A853" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#EA4335" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

interface ConfirmacaoProps {
  email: string;
  onReenviar: () => void;
}

function Confirmacao({ email, onReenviar }: ConfirmacaoProps) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
      <div
        style={{
          width: 56,
          height: 56,
          margin: '0 auto 18px',
          borderRadius: 999,
          background: 'var(--sage-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--sage-ink)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 24,
          letterSpacing: '-0.01em',
          margin: '0 0 10px',
        }}
      >
        olha seu inbox.
      </h2>
      <p style={{ font: '400 14px/1.5 var(--font-body)', color: 'var(--ink-2)', margin: '0 0 6px' }}>
        mandamos um link de acesso pra
      </p>
      <Mono style={{ display: 'block', color: 'var(--lavender-ink)', marginBottom: 18 }}>
        {email}
      </Mono>
      <p style={{ font: '400 13px/1.5 var(--font-body)', color: 'var(--ink-3)', margin: '0 0 20px' }}>
        pode demorar 1–2 min · às vezes cai no spam.
      </p>
      <button
        type="button"
        onClick={onReenviar}
        style={{
          font: '600 13px/1 var(--font-body)',
          padding: '10px 18px',
          borderRadius: 999,
          border: '1px solid var(--line)',
          background: 'transparent',
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        outro email
      </button>
    </div>
  );
}
