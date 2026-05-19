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
    // 1. Get all events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name');
    
    if (eventsError) throw eventsError;
    console.log("Events:", events);

    if (events.length === 0) {
      console.log("No events found.");
      return;
    }

    const eventId = events[0].id;

    // 2. Query sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .eq('event_id', eventId);
    
    if (sessionsError) {
      console.error("Error reading sessions:", sessionsError);
    } else {
      console.log("Sessions:", sessions);
    }

    // 3. Query post_event_settings table
    const { data: postEventSettings, error: postEventError } = await supabase
      .from('post_event_settings')
      .select('*')
      .eq('event_id', eventId);
    
    if (postEventError) {
      console.error("Error reading post_event_settings:", postEventError);
    } else {
      console.log("Post Event Settings:", postEventSettings);
    }
  } catch (error) {
    console.error("Exception:", error);
  }
}

run();
