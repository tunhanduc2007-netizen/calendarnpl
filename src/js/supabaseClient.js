// ==============================================================================
// SUPABASE CLIENT INITIALIZATION FOR MY PNL
// ==============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pkjudunvgziaumnpbrbz.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5Ozxo5EvjFtnqrGzGLecHg_iUL5LiRK';

export const supabase = createClient(supabaseUrl, supabaseKey);
