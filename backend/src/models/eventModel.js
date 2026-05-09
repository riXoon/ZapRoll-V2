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
      registrations(count)
    `)
    .eq('created_by', adminId)
    .order('event_date', { ascending: false });

  if (error) throw error;
  
  // Post-process to flatten stats and counts
  return data.map(event => ({
    ...event,
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
};

const getEventById = async (eventId, adminId) => {
  const { data, error } = await supabase
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

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  
  return {
    ...data,
    event_quotas: (data.event_quotas || []).map(q => ({
      ...q,
      used_capacity: q.registrations[0]?.count || 0
    })),
    stats: {
      total_registrations: data.registrations[0]?.count || 0,
      total_attended: 0, // Simplified for stability
      total_pending: data.registrations[0]?.count || 0
    }
  };
};

const createEvent = async (eventData, adminId, quotas = []) => {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert([{ ...eventData, created_by: adminId }])
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
  const { data: event, error: eventError } = await supabase
    .from('events')
    .update(eventData)
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

const deleteEvent = async (eventId, adminId) => {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
    .eq('created_by', adminId);

  if (error) throw error;
  return true;
};

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent
};
