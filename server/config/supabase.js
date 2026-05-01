const { createClient } = require('@supabase/supabase-js');

let supabase = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  console.log('🗄️  Supabase: ✓ Connected');
} else {
  console.log('🗄️  Supabase: ✗ Not configured — using in-memory store (data lost on restart)');
  console.log('    → Get a free DB at https://supabase.com and add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY');
}

module.exports = { supabase };
