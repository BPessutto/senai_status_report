import { sb } from './supabase-client.js';

// Garante que existe uma sessão logada; se não houver, manda para o login.
// Retorna a sessão (com session.user.id / session.user.email) quando existe.
export async function requireSession() {
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
