// Cliente único do Supabase, reaproveitado por todas as páginas.
// Depende de js/supabase-config.js e do script UMD do supabase-js
// (carregados antes deste módulo em cada página HTML).
if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  throw new Error('Configuração do Supabase ausente. Confira js/supabase-config.js e a tag <script> do supabase-js.');
}

export const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
