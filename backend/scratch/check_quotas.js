const supabase = require('../src/config/supabase');

const run = async () => {
  try {
    const { data: regs, error } = await supabase
      .from('registrations')
      .select('*, quota:event_quotas(name)');
    if (error) throw error;

    const unionRegs = regs.filter(r => r.metadata?.category === 'student' || r.quota?.name === 'Student');
    const fourthYearRegs = unionRegs.filter(r => r.metadata?.yearLevel === '4th Year');

    const hasRole = (studentRole, targetRole) => {
      if (!studentRole) return false;
      const normalizedTarget = targetRole.toLowerCase().trim();
      const checkSingle = (roleStr) => {
        const s = roleStr.toLowerCase().trim();
        if (s === normalizedTarget) return true;
        if (normalizedTarget.includes('poster') && s.includes('poster')) return true;
        if (normalizedTarget.includes('presenter') && s.includes('presenter') && !s.includes('poster') && !normalizedTarget.includes('poster')) return true;
        if (normalizedTarget.includes('participant') && s.includes('participant')) return true;
        return false;
      };
      if (Array.isArray(studentRole)) {
        return studentRole.some(r => checkSingle(String(r)));
      }
      return checkSingle(String(studentRole));
    };

    console.log('--- 4th Year Colloquium Participants ---');
    const colParticipants = fourthYearRegs.filter(s => hasRole(s.metadata?.studentRole, 'Colloquium Participant'));
    console.log(`Total 4th Year Colloquium Participants in Union: ${colParticipants.length}`);

    const withQuota = colParticipants.filter(s => s.quota?.name === 'Student');
    const withoutQuota = colParticipants.filter(s => !s.quota);

    console.log(`With 'Student' Quota: ${withQuota.length}`);
    console.log(`Without Quota (No Quota): ${withoutQuota.length}`);

    console.log('\nSample of Without Quota Colloquium Participants:');
    console.log(JSON.stringify(withoutQuota.slice(0, 5).map(s => ({
      id: s.id,
      full_name: s.full_name,
      metadata: s.metadata,
      reg_type: s.reg_type,
      quota_id: s.quota_id
    })), null, 2));

  } catch (err) {
    console.error(err);
  }
};

run();
