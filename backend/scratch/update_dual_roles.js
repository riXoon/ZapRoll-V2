const supabase = require('../src/config/supabase');

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

const run = async () => {
  try {
    // 1. Fetch the Student Quota to get its correct ID
    const { data: quotas, error: qError } = await supabase
      .from('event_quotas')
      .select('id, name')
      .eq('name', 'Student');
    if (qError) throw qError;

    if (!quotas || quotas.length === 0) {
      throw new Error('Student Quota not found in database.');
    }
    const studentQuotaId = quotas[0].id;
    console.log(`Found Student Quota ID: ${studentQuotaId}`);

    // 2. Fetch all registrations
    const { data: regs, error: rError } = await supabase
      .from('registrations')
      .select('*');
    if (rError) throw rError;

    // 3. Filter for dual-role students who currently have a null quota_id
    const dualRoleToUpdate = regs.filter(r => {
      const isStudent = r.metadata?.category === 'student' || r.quota_id === studentQuotaId;
      if (!isStudent) return false;

      const isPoster = hasRole(r.metadata?.studentRole, 'Poster Presenter');
      const isColParticipant = hasRole(r.metadata?.studentRole, 'Colloquium Participant');
      const isDual = isPoster && isColParticipant;

      return isDual && !r.quota_id;
    });

    console.log(`Found ${dualRoleToUpdate.length} dual-role registrations with no quota_id.`);

    if (dualRoleToUpdate.length === 0) {
      console.log('No registrations require updates.');
      return;
    }

    // 4. Update the registrations in Supabase
    const idsToUpdate = dualRoleToUpdate.map(r => r.id);
    console.log('IDs to update:', idsToUpdate);
    console.log('Names to update:', dualRoleToUpdate.map(r => r.full_name));

    const { data: updated, error: uError } = await supabase
      .from('registrations')
      .update({ quota_id: studentQuotaId })
      .in('id', idsToUpdate)
      .select('id, full_name, quota_id');

    if (uError) throw uError;

    console.log(`Successfully updated ${updated.length} registrations!`);
    console.log(updated);

  } catch (err) {
    console.error('Error running update script:', err);
  }
};

run();
