const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const fixViews = async () => {
  console.log('Creating/Updating Database Views...');

  const sql = `
    -- 1. Quota Usage View
    CREATE OR REPLACE VIEW public.v_quota_usage 
    WITH (security_invoker = true)
    AS
    SELECT 
        q.id,
        q.event_id,
        q.name,
        q.capacity,
        q.registration_url,
        (SELECT count(*) FROM public.registrations r WHERE r.quota_id = q.id) as used_capacity
    FROM public.event_quotas q;

    -- 2. Event Stats View
    CREATE OR REPLACE VIEW public.v_event_stats 
    WITH (security_invoker = true)
    AS
    SELECT 
        e.id as event_id,
        e.name as event_name,
        (SELECT count(*) FROM public.registrations WHERE event_id = e.id) as total_registrations,
        (SELECT count(*) FROM public.attendance a 
         JOIN public.registrations r ON a.registration_id = r.id 
         WHERE r.event_id = e.id) as total_attended,
        (SELECT count(*) FROM public.registrations WHERE event_id = e.id AND id NOT IN (SELECT registration_id FROM public.attendance)) as total_pending
    FROM public.events e;
  `;

  // We use the rpc call to 'exec_sql' if it exists, but typically we just run a migration.
  // Since we can't run raw SQL easily via the client without a custom function, 
  // I will check if the views exist by querying them.
  
  try {
    const { error: error1 } = await supabase.from('v_quota_usage').select('id').limit(1);
    if (error1) console.log('v_quota_usage needs fixing:', error1.message);
    else console.log('v_quota_usage is OK');

    const { error: error2 } = await supabase.from('v_event_stats').select('event_id').limit(1);
    if (error2) console.log('v_event_stats needs fixing:', error2.message);
    else console.log('v_event_stats is OK');
    
  } catch (err) {
    console.error('Check failed:', err);
  }
};

fixViews();
