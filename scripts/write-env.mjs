// Vercel build step: writes env.js (git-ignored) from the project's environment variables, so the deployed
// site knows which Supabase project to use. Set both in Vercel → Project → Settings → Environment Variables:
//   VITE_SUPABASE_URL       https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY  the project's anon (public) key
import { writeFileSync } from 'node:fs';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — add them in Vercel → Settings → Environment Variables, then redeploy.');
  process.exit(1);
}
writeFileSync('env.js', `window.ENV = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2)};\n`);
console.log('env.js written for', new URL(url).host);
