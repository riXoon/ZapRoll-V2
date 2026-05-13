const supabase = require('../config/supabase');

/**
 * Model for interacting with the events table in Supabase.
 * All functions ensure that the admin can only access their own events.
 */

const getAllEvents = async (adminId) => {
  // Fetch events with their quotas and stats
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        event_quotas(*, registrations(count)),
        registrations(count),
        attendance(*, registrations!participant_id(quota_id, reg_type)),
        sessions(*)
      `)
      .eq('created_by', adminId)
      .order('event_date', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.code === '42P01') {
        // Attendance table might not exist yet, fallback to fetching without it
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('events')
          .select(`
            *,
            event_quotas(*, registrations(count)),
            registrations(count)
          `)
          .eq('created_by', adminId)
          .order('event_date', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        return fallbackData.map(event => ({
          ...event,
          student_am_count: 0,
          student_pm_count: 0,
          employee_reg_count: 0,
          event_quotas: (event.event_quotas || []).map(q => ({
            ...q,
            used_capacity: q.registrations[0]?.count || 0
          })),
          stats: {
            total_registrations: event.registrations[0]?.count || 0,
            total_attended: 0,
            total_pending: event.registrations[0]?.count || 0
          }
        }));
      }
      throw error;
    }
  
  // Post-process to flatten stats and counts
  return data.map(event => {
    const amCount = (event.attendance || []).filter(a => a.am_scanned_at).length;
    const pmCount = (event.attendance || []).filter(a => a.pm_scanned_at).length;
    const empCount = (event.attendance || []).filter(a => a.employee_scanned_at).length;
    
    // Breakdown by registration type
    const preRegTurnout = (event.attendance || []).filter(a => a.registrations?.reg_type === 'pre-reg').length;
    const walkinTurnout = (event.attendance || []).filter(a => a.registrations?.reg_type === 'walk-in').length;
    
    const uniqueAttendeeIds = new Set((event.attendance || []).map(a => a.participant_id));

    return {
      ...event,
      student_am_count: amCount,
      student_pm_count: pmCount,
      employee_reg_count: empCount,
      event_quotas: (event.event_quotas || []).map(q => {
        // Calculate how many UNIQUE people in THIS role have attended ANY session
        const roleAttendees = (event.attendance || []).filter(a => {
          return a.registrations?.quota_id === q.id;
        });
        
        const uniqueRoleAttendees = new Set(roleAttendees.map(a => a.participant_id)).size;

        return {
          ...q,
          used_capacity: q.registrations[0]?.count || 0,
          attended_count: uniqueRoleAttendees
        };
      }),
      stats: {
        total_registrations: event.registrations[0]?.count || 0,
        total_attended: uniqueAttendeeIds.size, 
        pre_reg_turnout: preRegTurnout,
        walkin_turnout: walkinTurnout,
        total_pending: Math.max(0, (event.registrations[0]?.count || 0) - uniqueAttendeeIds.size)
      }
    };
  });
};

const getEventById = async (eventId, adminId) => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      event_quotas(*, registrations(count)),
      registrations(count),
      sessions(*),
      attendance(*, registrations!participant_id(quota_id, reg_type))
    `)
    .eq('id', eventId)
    .eq('created_by', adminId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    if (error.code === 'PGRST204' || error.code === '42P01') {
      // Fallback for missing attendance table
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('events')
        .select(`
          *,
          event_quotas(*, registrations(count)),
          registrations(count),
          sessions(*)
        `)
        .eq('id', eventId)
        .eq('created_by', adminId)
        .single();
      
      if (fallbackError) throw fallbackError;
      return {
        ...fallbackData,
        student_am_count: 0,
        student_pm_count: 0,
        employee_reg_count: 0,
        event_quotas: (fallbackData.event_quotas || []).map(q => ({
          ...q,
          used_capacity: q.registrations[0]?.count || 0
        })),
        stats: {
          total_registrations: fallbackData.registrations[0]?.count || 0,
          total_attended: 0,
          total_pending: fallbackData.registrations[0]?.count || 0
        }
      };
    }
    throw error;
  }
  
  const amCount = (data.attendance || []).filter(a => a.am_scanned_at).length;
  const pmCount = (data.attendance || []).filter(a => a.pm_scanned_at).length;
  const empCount = (data.attendance || []).filter(a => a.employee_scanned_at).length;

  const preRegTurnout = (data.attendance || []).filter(a => a.registrations?.reg_type === 'pre-reg').length;
  const walkinTurnout = (data.attendance || []).filter(a => a.registrations?.reg_type === 'walk-in').length;

  return {
    ...data,
    student_am_count: amCount,
    student_pm_count: pmCount,
    employee_reg_count: empCount,
    event_quotas: (data.event_quotas || []).map(q => ({
      ...q,
      used_capacity: q.registrations[0]?.count || 0
    })),
    stats: {
      total_registrations: data.registrations[0]?.count || 0,
      total_attended: preRegTurnout + walkinTurnout, 
      pre_reg_turnout: preRegTurnout,
      walkin_turnout: walkinTurnout,
      total_pending: Math.max(0, (data.registrations[0]?.count || 0) - (preRegTurnout + walkinTurnout))
    }
  };
};

const createEvent = async (eventData, adminId, quotas = []) => {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert([{ 
      name: eventData.name,
      venue: eventData.venue,
      event_date: eventData.event_date,
      total_capacity: eventData.total_capacity,
      pre_reg_open: eventData.pre_reg_open !== undefined ? eventData.pre_reg_open : true,
      pre_reg_deadline: eventData.pre_reg_deadline,
      is_locked: eventData.is_locked !== undefined ? eventData.is_locked : false,
      created_by: adminId 
    }])
    .select()
    .single();

  if (eventError) throw eventError;

  if (quotas.length > 0) {
    const quotaData = quotas.map(q => ({
      name: q.name,
      capacity: q.capacity,
      registration_url: q.registration_url,
      event_id: event.id
    }));
    
    const { error: quotaError } = await supabase
      .from('event_quotas')
      .insert(quotaData);
      
    if (quotaError) throw quotaError;
  }

  return getEventById(event.id, adminId);
};

const updateEvent = async (eventId, eventData, adminId, quotas = []) => {
  // 1. Update the event basic info
    const updateData = {};
    if (eventData.name !== undefined) updateData.name = eventData.name;
    if (eventData.venue !== undefined) updateData.venue = eventData.venue;
    if (eventData.event_date !== undefined) updateData.event_date = eventData.event_date;
    if (eventData.total_capacity !== undefined) updateData.total_capacity = eventData.total_capacity;
    if (eventData.pre_reg_open !== undefined) updateData.pre_reg_open = eventData.pre_reg_open;
    if (eventData.pre_reg_deadline !== undefined) updateData.pre_reg_deadline = eventData.pre_reg_deadline;
    if (eventData.is_locked !== undefined) updateData.is_locked = eventData.is_locked;
    if (eventData.evaluation_base_url !== undefined) updateData.evaluation_base_url = eventData.evaluation_base_url;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .update(updateData)
    .eq('id', eventId)
    .eq('created_by', adminId)
    .select()
    .single();

  if (eventError) throw eventError;

  if (quotas.length > 0) {
    // 1. Identify which quotas to keep/update (Only real UUIDs)
    const currentQuotaIds = quotas
      .filter(q => q.id && q.id.length > 20)
      .map(q => q.id);

    // 2. Delete quotas that were removed from the UI
    const deleteQuery = supabase
      .from('event_quotas')
      .delete()
      .eq('event_id', eventId);
    
    if (currentQuotaIds.length > 0) {
      await deleteQuery.not('id', 'in', currentQuotaIds);
    } else {
      await deleteQuery; 
    }

    // 3. Upsert the current list
    const quotaData = quotas.map(q => {
      const data = {
        name: q.name,
        capacity: q.capacity,
        registration_url: q.registration_url,
        event_id: eventId
      };
      if (q.id && q.id.length > 20) data.id = q.id;
      return data;
    });
    
    const { error: upsertError } = await supabase
      .from('event_quotas')
      .upsert(quotaData, { onConflict: 'id' });
      
    if (upsertError) throw upsertError;
  }

  return getEventById(eventId, adminId);
};

const updateRegistrationSettings = async (eventId, adminId, settings) => {
  // 1. Fetch existing sessions to avoid overwriting with NULL
  const { data: existing, error: fetchError } = await supabase
    .from('sessions')
    .select('*')
    .eq('event_id', eventId);
    
  if (fetchError) throw fetchError;

  const sessionMap = {};
  (existing || []).forEach(s => sessionMap[s.session_type] = s);

  const sessionTypes = [
    { type: 'am-reg', link: 'student_am_link', open: 'student_am_open', name: 'Student AM Session' },
    { type: 'pm-reg', link: 'student_pm_link', open: 'student_pm_open', name: 'Student PM Session' },
    { type: 'employee-reg', link: 'employee_reg_link', open: 'employee_reg_open', name: 'Employee Registration' },
    { type: 'walkin-student', link: 'walkin_student_link', open: 'walkin_student_open', name: 'Walk-in Student' },
    { type: 'walkin-employee', link: 'walkin_employee_link', open: 'walkin_employee_open', name: 'Walk-in Employee' },
    { type: 'walkin-guest', link: 'guest_reg_link', open: 'guest_reg_open', name: 'Guest Registration' },
  ];

  const sessionData = sessionTypes.map(s => {
    const current = sessionMap[s.type] || {};
    return {
      event_id: eventId,
      session_type: s.type,
      name: s.name,
      // Only update if the field was actually provided in the request (is not undefined)
      registration_link: settings[s.link] !== undefined ? settings[s.link] : (current.registration_link || ''),
      is_open: settings[s.open] !== undefined ? settings[s.open] : (current.is_open || false)
    };
  });

  const { data, error } = await supabase
    .from('sessions')
    .upsert(sessionData, { onConflict: 'event_id,session_type' })
    .select();

  if (error) throw error;
  return data;
};

const updateSessionStatus = async (eventId, sessionType, isOpen) => {
  const { data, error } = await supabase
    .from('sessions')
    .upsert({ 
      event_id: eventId, 
      session_type: sessionType, 
      is_open: isOpen,
      // Default name if it's new
      name: sessionType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }, { 
      onConflict: 'event_id,session_type' 
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

const deleteEvent = async (eventId, adminId) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('created_by', adminId);

  if (error) throw error;
  return true;
};

const recordAttendance = async (eventId, participantId, sessionType, force = false) => {
  let updateField = '';
  if (sessionType === 'am-reg' || sessionType === 'walkin-student' || sessionType === 'walkin-guest') updateField = 'am_scanned_at';
  else if (sessionType === 'pm-reg') updateField = 'pm_scanned_at';
  else if (sessionType === 'employee-reg' || sessionType === 'walkin-employee') updateField = 'employee_scanned_at';
  else throw new Error('Invalid session type');

  if (!force) {

  // Check if session is open
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('is_open')
    .eq('event_id', eventId)
    .eq('session_type', sessionType)
    .single();
  
  if (sessionError) {
    if (sessionError.code === 'PGRST116') throw new Error('Session not found');
    throw sessionError;
  }

    if (!session.is_open) {
      throw new Error('This session is currently closed for registration');
    }
  }

  // Record attendance using UPSERT
  const { data, error } = await supabase
    .from('attendance')
    .upsert({ 
      event_id: eventId, 
      participant_id: participantId, 
      registration_id: participantId, // This is required and non-nullable
      [updateField]: new Date().toISOString()
    }, { 
      onConflict: 'event_id,participant_id' 
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
};
const findAndAttend = async (eventId, searchCriteria, sessionType, force = false) => {
  const { externalId, fullName } = searchCriteria;
  
  // 1. Find the registration
  let query = supabase
    .from('registrations')
    .select('id, full_name, external_id')
    .eq('event_id', eventId);
    
  if (externalId) {
    query = query.eq('external_id', externalId);
  } else if (fullName) {
    query = query.ilike('full_name', `%${fullName}%`);
  } else {
    throw new Error('No search criteria provided');
  }

  const { data: registrations, error: findError } = await query;
  
  if (findError) throw findError;
  if (!registrations || registrations.length === 0) {
    throw new Error('Participant not found in pre-registrations');
  }

  // If multiple found and searching by name, we might need to be more specific
  // but for now we'll take the first one.
  const registration = registrations[0];

  // 2. Record attendance
  await recordAttendance(eventId, registration.id, sessionType, force);
  
  return registration;
};

const registerWalkin = async (eventId, adminId, walkinData) => {
  const { fullName, email, quotaId, sessionType, externalId, metadata } = walkinData;

  // 1. Create or Update the registration record (Upsert)
  const insertData = {
    event_id: eventId,
    full_name: fullName,
    email: email,
    quota_id: quotaId,
    external_id: externalId,
    metadata: metadata || {},
    reg_type: 'walk-in',
    status: 'registered'
  };

  const { data: registration, error: regError } = await supabase
    .from('registrations')
    .upsert(insertData, { 
      onConflict: externalId ? 'event_id,external_id' : 'id' 
    })
    .select()
    .single();

  if (regError) throw regError;

  // 2. Immediately record attendance with force=true for manual entry
  try {
    await recordAttendance(eventId, registration.id, sessionType, true);
    return registration;
  } catch (error) {
    // If attendance recording fails (e.g. session closed), 
    // we still have the registration but we should warn the user
    console.error('Walk-in registered but attendance record failed:', error);
    return registration;
  }
};

const getEvaluationTemplate = async (eventId) => {
  const { data, error } = await supabase
    .from('evaluation_templates')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const saveEvaluationTemplate = async (eventId, templateData) => {
  const { title, questions, is_active } = templateData;
  
  const { data, error } = await supabase
    .from('evaluation_templates')
    .upsert({
      event_id: eventId,
      title: title || 'Evaluation Form',
      questions: questions,
      is_active: is_active !== undefined ? is_active : true
    }, {
      onConflict: 'event_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

const saveEvaluationResponse = async (eventId, responseData) => {
  const { registration_id, session_id, responses } = responseData;
  
  // 1. Get the template_id for this event
  const { data: template, error: tError } = await supabase
    .from('evaluation_templates')
    .select('id')
    .eq('event_id', eventId)
    .single();

  if (tError) throw new Error('Evaluation template not found for this event');

  // 2. Insert the response
  const { data, error } = await supabase
    .from('evaluation_responses')
    .insert({
      template_id: template.id,
      registration_id: registration_id,
      session_id: session_id,
      responses: responses
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  recordAttendance,
  registerWalkin,
  findAndAttend,
  updateRegistrationSettings,
  updateSessionStatus,
  getEvaluationTemplate,
  saveEvaluationTemplate,
  saveEvaluationResponse
};
