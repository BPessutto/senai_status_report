import { sb } from './supabase-client.js';

// Verdadeiro quando a URL atual carrega o marcador de recovery do Supabase
// (hash no fluxo implícito, query no PKCE). O client processa esse marcador
// sozinho (detectSessionInUrl) e cria uma sessão comum a partir dele — sem
// essa checagem, qualquer página que receba o link de recuperação trataria
// essa sessão como login normal. Checagem síncrona de URL, não depende de
// timeout nem de esperar evento nenhum.
export function urlIndicaRecovery() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  return hash.get('type') === 'recovery' || query.get('type') === 'recovery';
}

// Garante que existe uma sessão logada; se não houver, manda para o login.
// Retorna a sessão (com session.user.id / session.user.email) quando existe.
export async function requireSession() {
  // Sessão de recovery nunca é tratada como login normal, mesmo que o link
  // de recuperação tenha caído nesta página em vez de redefinir-senha.html.
  if (urlIndicaRecovery()) {
    window.location.href = 'redefinir-senha.html' + window.location.search + window.location.hash;
    return null;
  }
  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

export async function logout() {
  await sb.auth.signOut();
  window.location.href = 'login.html';
}
