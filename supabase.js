import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

// window.ENV comes from env.js (git-ignored; written by scripts/write-env.mjs on Vercel).
// Without it nothing can load — say so on the page instead of leaving it blank.
const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV ?? {};
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  const content = document.getElementById('login'); // the only part shown before signing in
  if (content) {
    document.body.dataset.auth = 'out';
    content.innerHTML = `<div style="max-width:560px;margin:80px auto;padding:0 24px;font-family:Inter,sans-serif;color:#3a2c1f;line-height:1.7;">
      <h1 style="font-size:20px;margin-bottom:8px;">The app can't reach the database</h1>
      <p>The Supabase settings (<code>env.js</code>) are missing. On Vercel, add <code>VITE_SUPABASE_URL</code> and
      <code>VITE_SUPABASE_ANON_KEY</code> under Settings → Environment Variables, then redeploy. Locally, copy
      <code>env.example.js</code> to <code>env.js</code> and fill it in.</p></div>`;
  }
  throw new Error('Supabase settings missing: env.js not loaded');
}
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
