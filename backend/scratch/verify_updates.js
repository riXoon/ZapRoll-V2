const supabase = require('../src/config/supabase');

const run = async () => {
  try {
    const { data: quotas, error: qError } = await supabase
      .from('event_quotas')
      .select('id, name')
      .eq('name', 'Student');
    if (qError) throw qError;
    const studentQuotaId = quotas[0].id;

    const { data: regs, error: rError } = await supabase
      .from('registrations')
      .select('*, quota:event_quotas(name)');
    if (rError) throw rError;

    const studentQuotaRegs = regs.filter(r => r.quota?.name === 'Student');
    console.log(`New total registrations strictly in 'Student' quota: ${studentQuotaRegs.length}`);

    // Let's count registrations per quota now
    const quotaCounts = {};
    for (const r of regs) {
      const qName = r.quota?.name || 'No Quota';
      quotaCounts[qName] = (quotaCounts[qName] || 0) + 1;
    }
    console.log('\n--- Registrations Count per Quota Now ---');
    console.log(quotaCounts);

  } catch (err) {
    console.error(err);
  }
};

run();
