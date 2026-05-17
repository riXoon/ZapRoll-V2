const supabase = require('../src/config/supabase');

const run = async () => {
  try {
    const { data: whitelist, error } = await supabase
      .from('v_certificate_eligibility')
      .select('*')
      .eq('is_eligible', true);

    if (error) throw error;

    console.log(`Checking ${whitelist.length} records...`);
    console.log('First 5 records:');
    console.log(JSON.stringify(whitelist.slice(0, 5), null, 2));

    let stats = {
      nullNames: 0,
      nullEmails: 0,
      nullExternalIds: 0,
      nullAMTimes: 0,
      nullPMTimes: 0,
      invalidAMDates: 0,
      invalidPMDates: 0,
    };

    for (const item of whitelist) {
      if (!item.full_name) stats.nullNames++;
      if (!item.email) stats.nullEmails++;
      if (!item.external_id) stats.nullExternalIds++;
      
      if (!item.am_eval_submitted_at) {
        stats.nullAMTimes++;
      } else {
        const d = new Date(item.am_eval_submitted_at);
        if (isNaN(d.getTime())) stats.invalidAMDates++;
      }

      if (!item.pm_eval_submitted_at) {
        stats.nullPMTimes++;
      } else {
        const d = new Date(item.pm_eval_submitted_at);
        if (isNaN(d.getTime())) stats.invalidPMDates++;
      }
    }

    console.log('Detailed stats:', stats);
  } catch (err) {
    console.error(err);
  }
};

run();
