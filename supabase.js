import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
