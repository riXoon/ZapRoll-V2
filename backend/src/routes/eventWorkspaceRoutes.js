const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const db = require('../config/supabase');
const auth = require('../middleware/authMiddleware');

const router = express.Router();
const eventFields = 'id,name,event_date,event_mode,lifecycle,timezone,registration_opens_at,pre_reg_deadline,pre_reg_manual,pre_reg_open,archived_at';
const roleFields = 'id,name,student_priority,registration_capacity,registration_url,required_fields';
const venueFields = 'id,name,capacity,role_caps';
const sessionFields = 'id,venue_id,title,starts_at,ends_at,checkin_opens_at,walkins_open_at,capacity,role_caps,attendance_url,feedback_url,reserved_students';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sessionForms = new Map([
  ['evaluation', { template: 'feedback_template', link: 'feedback_url' }],
  ['attendance', { template: 'attendance_template', link: 'attendance_url' }],
]);

function fail(statusCode, message) {
  throw Object.assign(new Error(message), { statusCode });
}

async function result(query) {
  const { data, error } = await query;
  if (error) {
    if (/^PT[45][0-9]{2}$/.test(error.code)) fail(Number(error.code.slice(2)), error.message);
    if (['22007', '22008', '22P02', '22003', '23502', '23514'].includes(error.code)) fail(400, 'Check the supplied fields and values.');
    if (error.code === '23505') fail(409, 'That name or identifier is already in use for this event.');
    throw error;
  }
  return data;
}

async function eventById(id) {
  const event = await result(db.from('events').select(eventFields).eq('id', id).maybeSingle());
  if (!event) fail(404, 'Event not found.');
  return event;
}

async function eventConfiguration(id, adminView = false) {
  const roleQuery = db.from('event_roles').select(adminView
    ? `${roleFields},registrations:event_participants(count)` : roleFields).eq('event_id', id);
  if (adminView) roleQuery.eq('registrations.source', 'pre-reg');
  const [roles, venues, sessions] = await Promise.all([
    result(roleQuery.order('name')),
    result(db.from('event_venues').select(venueFields).eq('event_id', id).order('name')),
    result(db.from('event_schedule').select(adminView ? `${sessionFields},checkins:event_checkins(count)` : sessionFields)
      .eq('event_id', id).order('starts_at')),
  ]);
  if (!adminView) return { roles, venues, sessions };
  const preRegistrationUrl = sharedPreRegistrationUrl(roles, id);
  return {
    venues,
    pre_registration_url: preRegistrationUrl,
    roles: roles.map(role => ({
      ...role,
      qr_url: preRegistrationUrl ? null : formQr(role.registration_url, { eventId: id, roleId: role.id }),
    })),
    sessions: sessions.map(session => ({
      ...session,
      attendance_qr_url: formQr(session.attendance_url, { eventId: id, sessionId: session.id }),
      feedback_qr_url: formQr(session.feedback_url, { eventId: id, sessionId: session.id }),
    })),
  };
}

function sharedPreRegistrationUrl(roles, eventId) {
  const links = new Set(roles.map(role => role.registration_url).filter(Boolean));
  if (links.size !== 1) return null;
  const [link] = links;
  if (!URL.canParse(link)) return null;
  const url = new URL(link);
  return url.protocol === 'https:' && url.pathname.replace(/\/$/, '').endsWith(`/${eventId}`)
    && url.searchParams.get('type') === 'pre-registration' && !url.searchParams.has('roleId') ? link : null;
}

function formQr(link, context) {
  if (!link) return null;
  const fragmentStart = link.indexOf('#');
  const fragment = fragmentStart === -1 ? '' : link.slice(fragmentStart);
  const base = fragmentStart === -1 ? link : link.slice(0, fragmentStart);
  const queryStart = base.indexOf('?');
  const path = queryStart === -1 ? base : base.slice(0, queryStart);
  const pairs = queryStart === -1 ? [] : base.slice(queryStart + 1).split('&').filter(Boolean);
  const preserved = pairs.filter(pair => !Object.hasOwn(context, new URLSearchParams(pair).keys().next().value));
  return `${path}?${[...preserved, new URLSearchParams(context).toString()].join('&')}${fragment}`;
}

function validateUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.toString();
  } catch {
    // Return a consistent message for invalid URLs or unsupported schemes.
  }
  fail(400, 'Enter a public HTTPS web form URL.');
}

function formUrl(formId, type) {
  const base = process.env.ZAPROLL_WEBFORM_BASE_URL?.trim();
  if (!base) return null;
  let url;
  try {
    url = new URL(base);
  } catch {
    fail(503, 'The webform base URL is invalid.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
    fail(503, 'The webform base URL must be an HTTPS URL without credentials, a query, or a fragment.');
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${formId}`;
  url.searchParams.set('type', type);
  return url.toString();
}

function confirmFormsIntegration(req) {
  const key = process.env.ZAPROLL_FORMS_API_KEY;
  if (!key) fail(503, 'The form integration is not configured.');
  const sent = Buffer.from(req.get('X-ZapRoll-Forms-Key') || '');
  const expected = Buffer.from(key);
  if (sent.length !== expected.length || !timingSafeEqual(sent, expected)) fail(401, 'Invalid form integration key.');
}

router.param('id', (req, res, next, id) => {
  if (!uuidPattern.test(id)) return next(Object.assign(new Error('Invalid event ID.'), { statusCode: 400 }));
  next();
});

router.get('/forms/:formId', async (req, res) => {
  const { formId } = req.params;
  const { type } = req.query;
  res.set('Cache-Control', 'no-store');
  if (!uuidPattern.test(formId)) fail(404, 'Form not found.');
  if (type === 'pre-registration') {
    const role = await result(db.from('event_roles').select('event_id,name,registration_url,registration_template,required_fields')
      .eq('id', formId).maybeSingle());
    if (!role?.registration_template || !role.registration_url) fail(404, 'Form not found.');
    const event = await eventById(role.event_id);
    if (!preRegistrationOpen(event)) fail(410, 'Pre-registration is closed.');
    res.json({ data: {
      id: formId, type, eventId: event.id, roleId: formId, eventName: event.name, roleName: role.name,
      title: role.registration_template.title, pages: role.registration_template.questions,
      requiredFields: role.required_fields,
    } });
    return;
  }
  const form = sessionForms.get(type);
  if (!form) fail(404, 'Form not found.');
  const attendanceWindow = type === 'attendance' ? ',checkin_opens_at,ends_at,walkins_open_at' : '';
  const session = await result(db.from('event_schedule').select(`event_id,title,${form.link},${form.template}${attendanceWindow}`)
    .eq('id', formId).maybeSingle());
  const template = session?.[form.template];
  if (!template || !session[form.link]) fail(404, 'Form not found.');
  const event = await eventById(session.event_id);
  if (event.lifecycle === 'archived') fail(410, 'This form is closed.');
  if (event.event_mode !== 'scheduled' || event.lifecycle !== 'active') fail(404, 'Form not found.');
  if (type === 'attendance') {
    const now = Date.now();
    if (!(now >= Date.parse(session.checkin_opens_at) && now < Date.parse(session.ends_at))) {
      fail(410, 'Session check-in is closed.');
    }
  }
  res.json({ data: {
    id: formId, type: 'evaluation', eventId: event.id, sessionId: formId,
    eventName: event.name, sessionTitle: session.title,
    title: template.title, pages: template.questions,
    ...(type === 'attendance' && { walkinsOpenAt: session.walkins_open_at }),
  } });
});

function preRegistrationOpen(event) {
  if (event.event_mode !== 'scheduled' || event.lifecycle === 'archived') return false;
  if (event.pre_reg_manual) return !!event.pre_reg_open;
  const now = Date.now();
  return event.lifecycle === 'active' && now >= Date.parse(event.registration_opens_at) &&
    now < Date.parse(event.pre_reg_deadline);
}

router.get('/:id/config', async (req, res) => {
  const event = await eventById(req.params.id);
  const preRegForm = req.query.form === 'pre-registration';
  res.set('Cache-Control', 'no-store');
  if (event.event_mode !== 'scheduled' || (event.lifecycle === 'draft' && !preRegForm)) fail(404, 'Event not found.');
  if (event.lifecycle === 'archived') fail(410, 'This event is closed.');
  const open = preRegistrationOpen(event);
  const publicEvent = { ...event, pre_reg_open: open };
  if (preRegForm) {
    const roles = open ? await result(db.from('event_roles').select(roleFields).eq('event_id', event.id).order('name')) : [];
    return res.json({ data: { event: publicEvent, roles } });
  }
  res.json({ data: { event: publicEvent, ...await eventConfiguration(event.id) } });
});

router.post('/:id/submissions/:action', async (req, res) => {
  confirmFormsIntegration(req);
  const { action, id } = req.params;
  if (!['pre-registration', 'attendance', 'feedback'].includes(action)) fail(404, 'Unknown submission type.');
  const { session_id: sessionId, email, role_id: roleId, full_name: fullName, metadata, answers } = req.body || {};
  if (typeof email !== 'string' || (action !== 'pre-registration' && !uuidPattern.test(sessionId))) {
    fail(400, 'Provide the verified email and a session ID when required.');
  }
  const withAttendanceAnswers = action === 'attendance' && answers !== undefined;
  const data = await result(db.rpc(withAttendanceAnswers ? 'submit_scheduled_attendance' : 'submit_scheduled_event', {
    p_event: id, p_session: sessionId || null,
    ...(!withAttendanceAnswers && { p_action: action }),
    p_data: { email, role_id: roleId, full_name: fullName, metadata, answers },
  }));
  const event = await eventById(id);
  const session = sessionId && await result(db.from('event_schedule')
    .select('id,title,starts_at,venue:event_venues(name)').eq('event_id', id).eq('id', sessionId).maybeSingle());
  res.set('Cache-Control', 'no-store');
  res.status(data.created ? 201 : 200).json({
    data: { ...data, event_name: event.name, timezone: event.timezone, session_title: session?.title,
      session_starts_at: session?.starts_at, venue_name: session?.venue?.name },
  });
});

router.use(auth, async (req, res, next) => {
  const profile = await result(db.from('admin_profiles').select('id').eq('id', req.user.id).maybeSingle());
  if (!profile) fail(403, 'An admin profile is required.');
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/', async (req, res) => {
  const events = await result(db.from('events').select(eventFields).order('event_date', { ascending: false }));
  res.json({ data: events });
});

router.post('/', async (req, res) => {
  const { id, name, event_date: date, timezone = 'Asia/Manila' } = req.body || {};
  if (!uuidPattern.test(id) || typeof name !== 'string' || !name.trim() || name.length > 120) {
    fail(400, 'Provide a request ID and an event name.');
  }
  const saved = await result(db.rpc('manage_scheduled_event', {
    p_event: id, p_admin: req.user.id, p_action: 'create',
    p_data: { name: name.trim(), event_date: date, timezone },
  }));
  res.status(201).json({ data: saved });
});

router.get('/:id', async (req, res) => {
  const event = await eventById(req.params.id);
  res.json({ data: { event, ...await eventConfiguration(event.id, true) } });
});

const questionTypes = new Set(['rating', 'text', 'choice', 'likert', 'privacy', 'signature', 'header']);

function readFormTemplate(body) {
  const { title, questions } = body || {};
  if (typeof title !== 'string' || !Array.isArray(questions) || !questions.length || questions.some(page =>
    typeof page?.id !== 'string' || typeof page.title !== 'string' || typeof page.description !== 'string' ||
    !Array.isArray(page.questions) || page.questions.some(question =>
      typeof question?.id !== 'string' || !questionTypes.has(question.type) || typeof question.label !== 'string' ||
      typeof question.required !== 'boolean' || !Array.isArray(question.statements)
    )
  )) fail(400, 'Enter a valid form template.');
  return { title, questions };
}

router.get('/:id/roles/:roleId/pre-registration-template', async (req, res) => {
  const { id, roleId } = req.params;
  if (!uuidPattern.test(roleId)) fail(400, 'Choose a role for this event.');
  const role = await result(db.from('event_roles').select('registration_template')
    .eq('event_id', id).eq('id', roleId).maybeSingle());
  if (!role) fail(404, 'Role not found for this event.');
  res.json({ data: role.registration_template });
});

router.post('/:id/roles/:roleId/pre-registration-template', async (req, res) => {
  const { id, roleId } = req.params;
  if (!uuidPattern.test(roleId)) fail(400, 'Choose a role for this event.');
  const update = { registration_template: readFormTemplate(req.body) };
  const roles = await result(db.from('event_roles').select('id,registration_url').eq('event_id', id));
  const sharedUrl = sharedPreRegistrationUrl(roles, id);
  const url = sharedUrl || formUrl(roleId, 'pre-registration');
  if (url) update.registration_url = url;
  const role = await result(db.from('event_roles').update(update)
    .eq('event_id', id).eq('id', roleId).select('registration_template').maybeSingle());
  if (!role) fail(404, 'Role not found for this event.');
  res.json({ data: { ...role.registration_template, formId: roleId, type: 'pre-registration', url, shared: !!sharedUrl } });
});

for (const [type, form] of sessionForms) {
  const route = router.route(`/:id/sessions/:sessionId/${type}-template`);
  route.get(async (req, res) => {
    const { id, sessionId } = req.params;
    if (!uuidPattern.test(sessionId)) fail(400, 'Choose a session for this event.');
    const session = await result(db.from('event_schedule').select(form.template)
      .eq('event_id', id).eq('id', sessionId).maybeSingle());
    if (!session) fail(404, 'Session not found for this event.');
    res.json({ data: session[form.template] });
  });
  route.post(async (req, res) => {
    const { id, sessionId } = req.params;
    if (!uuidPattern.test(sessionId)) fail(400, 'Choose a session for this event.');
    const url = formUrl(sessionId, type);
    const update = { [form.template]: readFormTemplate(req.body) };
    if (url) update[form.link] = url;
    const session = await result(db.from('event_schedule').update(update)
      .eq('event_id', id).eq('id', sessionId).select(form.template).maybeSingle());
    if (!session) fail(404, 'Session not found for this event.');
    res.json({ data: { ...session[form.template], formId: sessionId, type, url } });
  });
}

async function countRows(query) {
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

router.get('/:id/dashboard', async (req, res) => {
  const event = await eventById(req.params.id);
  if (event.event_mode !== 'scheduled') fail(409, 'Use the historical analytics for this event.');
  const id = event.id;
  const forEvent = table => db.from(table).select('id', { count: 'exact', head: true }).eq('event_id', id);
  const [roleRows, sessions, preRegistered, participants, attendance, feedback, recent] = await Promise.all([
    result(db.from('event_roles').select('id,name,participants:event_participants(count)').eq('event_id', id).order('name')),
    result(db.from('event_schedule').select('id,title,starts_at,capacity,venue:event_venues(name),checkins:event_checkins(count)')
      .eq('event_id', id).order('starts_at')),
    countRows(forEvent('event_participants').eq('source', 'pre-reg')),
    countRows(forEvent('event_participants')),
    countRows(forEvent('event_checkins')),
    countRows(forEvent('event_session_feedback')),
    result(db.from('event_checkins').select('id,checked_in_at,participant:event_participants(full_name,role_id)')
      .eq('event_id', id).order('checked_in_at', { ascending: false }).limit(10)),
  ]);
  const roles = roleRows.map(role => ({ id: role.id, name: role.name, count: role.participants?.[0]?.count ?? 0 }));
  const sessionCounts = sessions.map(session => ({
    id: session.id, title: session.title, venue: session.venue?.name,
    startsAt: session.starts_at, capacity: session.capacity, count: session.checkins?.[0]?.count ?? 0,
  }));
  const roleNames = new Map(roles.map(role => [role.id, role.name]));
  res.json({ data: {
    preRegistered, participants, attendance, feedback, roles, sessions: sessionCounts,
    recent: recent.map(row => ({
      id: row.id, checkedInAt: row.checked_in_at,
      name: row.participant?.full_name || 'Participant', role: roleNames.get(row.participant?.role_id) || 'Participant',
    })),
  } });
});

router.post('/:id/actions/:action', async (req, res) => {
  const { id, action } = req.params;
  if (!['archive', 'publish', 'settings', 'role', 'venue', 'session', 'feedback-link', 'pre-reg-status'].includes(action)) fail(404, 'Unknown event action.');
  const data = { ...req.body };
  if (action === 'settings' && (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120)) {
    fail(400, 'Enter an event name.');
  }
  if (action === 'role') data.registration_url = validateUrl(data.registration_url);
  if (action === 'session') {
    data.attendance_url = validateUrl(data.attendance_url);
    data.feedback_url = validateUrl(data.feedback_url);
  }
  if (action === 'feedback-link') {
    if (!uuidPattern.test(data.id)) fail(400, 'Choose a session for this event.');
    const saved = await result(db.from('event_schedule').update({ feedback_url: validateUrl(data.feedback_url) })
      .eq('event_id', id).eq('id', data.id).select('id,feedback_url').maybeSingle());
    if (!saved) fail(404, 'Session not found for this event.');
    return res.json({ data: saved });
  }
  const saved = await result(db.rpc('manage_scheduled_event', {
    p_event: id, p_admin: req.user.id, p_action: action, p_data: data,
  }));
  res.json({ data: saved });
});

async function readEventRows(table, columns, eventId) {
  const rows = [];
  let cursor;
  for (;;) {
    let query = db.from(table).select(columns).eq('event_id', eventId).order('id').limit(500);
    if (cursor) query = query.gt('id', cursor);
    const page = await result(query);
    rows.push(...page);
    if (page.length < 500) return rows;
    cursor = page.at(-1).id;
  }
}

router.get('/:id/participants', async (req, res) => {
  const event = await eventById(req.params.id);
  if (event.event_mode !== 'scheduled') fail(409, 'Use the historical reports for this event.');
  let query = db.from('event_participants').select('id,full_name,email,source,role_id')
    .eq('event_id', event.id).order('id').limit(51);
  if (req.query.after) {
    if (!uuidPattern.test(req.query.after)) fail(400, 'Invalid participant cursor.');
    query = query.gt('id', req.query.after);
  }
  const people = await result(query);
  res.json({ data: { people: people.slice(0, 50), next: people.length > 50 ? people[49].id : null } });
});

function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^\s*[=+@-]|^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function sendCsv(res, eventId, kind, columns, rows) {
  res.attachment(`zaproll-${eventId}-${kind}.csv`).type('text/csv')
    .send('\uFEFF' + [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n'));
}

async function studentCollegeRows(eventId) {
  const [roles, people] = await Promise.all([
    result(db.from('event_roles').select('id,name').eq('event_id', eventId)),
    readEventRows('event_participants', 'id,role_id,source,student_college:metadata->>student_college,checkins:event_checkins(count)', eventId),
  ]);
  const studentRole = roles.find(role => role.name.trim().toLowerCase() === 'student');
  if (!studentRole) return [];

  const colleges = new Map();
  for (const student of people.filter(person => person.role_id === studentRole.id)) {
    const college = student.student_college?.trim().replace(/\s+/g, ' ');
    const key = college ? college.toLowerCase() : null;
    const totals = colleges.get(key) || { college: college || 'Unspecified', preRegistered: 0, walkIns: 0, attended: 0, checkins: 0 };
    if (student.source === 'pre-reg') totals.preRegistered++;
    if (student.source === 'walk-in') totals.walkIns++;
    const checkins = student.checkins?.[0]?.count ?? 0;
    totals.attended += Number(checkins > 0);
    totals.checkins += checkins;
    colleges.set(key, totals);
  }
  return [...colleges.values()].sort((a, b) => a.college.localeCompare(b.college))
    .map(row => [row.college, row.preRegistered, row.walkIns, row.preRegistered + row.walkIns, row.attended, row.checkins]);
}

router.get('/:id/report/:kind', async (req, res) => {
  const event = await eventById(req.params.id);
  if (event.event_mode !== 'scheduled') fail(409, 'Use the historical reports for this event.');
  const { kind } = req.params;
  if (kind === 'student-colleges') {
    return sendCsv(res, event.id, kind,
      ['College', 'Pre-registered', 'Walk-ins', 'Total registrations', 'Unique attendees', 'Session check-ins'],
      await studentCollegeRows(event.id));
  }
  if (!['participants', 'attendance', 'feedback'].includes(kind)) fail(404, 'Report not found.');
  const filter = req.query.sessionId;
  const activity = kind === 'attendance'
    ? await readEventRows('event_checkins', 'id,participant_id,session_id,checked_in_at', event.id)
    : kind === 'feedback'
      ? await readEventRows('event_session_feedback', 'id,participant_id,session_id,submitted_at,answers', event.id)
      : [];
  const { roles, venues, sessions } = await eventConfiguration(event.id);
  if (filter && !sessions.some(session => session.id === filter)) fail(400, 'Choose a session for this event.');
  const people = await readEventRows('event_participants', 'id,full_name,email,role_id,source,created_at', event.id);
  const roleById = new Map(roles.map(role => [role.id, role.name]));
  const identity = person => [person.full_name, person.email, roleById.get(person.role_id), person.source];
  const columns = ['Name', 'Email', 'Role', 'Registration type'];
  let rows;
  if (kind === 'participants') {
    columns.push('Registered at (UTC)');
    rows = people.map(person => [...identity(person), person.created_at]);
  } else {
    const personById = new Map(people.map(person => [person.id, person]));
    const sessionById = new Map(sessions.map(session => [session.id, session]));
    const venueById = new Map(venues.map(venue => [venue.id, venue.name]));
    const day = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short', timeZone: event.timezone });
    columns.push('Event day', 'Session', 'Venue');
    columns.push(...(kind === 'attendance' ? ['Checked in at (UTC)'] : ['Submitted at (UTC)', 'Answers']));
    rows = activity.filter(row => !filter || row.session_id === filter).map(row => {
      const session = sessionById.get(row.session_id);
      return [...identity(personById.get(row.participant_id)), day.format(new Date(session.starts_at)),
        session.title, venueById.get(session.venue_id),
        ...(kind === 'attendance' ? [row.checked_in_at] : [row.submitted_at, JSON.stringify(row.answers)])];
    });
  }
  sendCsv(res, event.id, kind, columns, rows);
});

module.exports = router;
