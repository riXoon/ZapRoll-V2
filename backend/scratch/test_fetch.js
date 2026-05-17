const supabase = require('../src/config/supabase');

const run = async () => {
  try {
    console.log('Fetching events to find an active event ID...');
    const { data: events, error: eventError } = await supabase.from('events').select('id, name');
    if (eventError) throw eventError;

    if (!events || events.length === 0) {
      console.log('No events found in database.');
      return;
    }

    const eventId = events[0].id;
    console.log(`Using Event: ${events[0].name} (${eventId})`);

    console.log('\nFetching certificate whitelist from v_certificate_eligibility...');
    const { data: whitelist, error: whitelistError } = await supabase
      .from('v_certificate_eligibility')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_eligible', true);

    if (whitelistError) throw whitelistError;

    console.log(`\nFound ${whitelist.length} eligible participants.`);
    if (whitelist.length > 0) {
      console.log('\nSample records:');
      console.log(JSON.stringify(whitelist.slice(0, 3), null, 2));
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
};

run();
