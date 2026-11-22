const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE URL or KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  try {
    console.log("Testing calling RPC 'exec_sql'...");
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1 AS test;' });
    if (error) {
      console.log("exec_sql RPC failed or does not exist:", error.message);
    } else {
      console.log("exec_sql RPC exists! Result:", data);
    }
  } catch (error) {
    console.error("Exception:", error);
  }
}

run();
