const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

const eventId = '49b030b7-fd5e-41bb-ac4c-36f982ab41ed';
const roleId = '560a856b-233d-41af-975c-d43b656acd2b';
const alumniRoleId = '35f8565c-cb9c-4dd9-8146-5f43210c76af';
const sessionId = '4b3162cb-3d32-414e-bf11-8d358999a140';
let lifecycle = 'active';
let manualOpen = false;
let checkinOpen = false;
let attendanceOverride = null;
let attendanceOverrideColumnPresent = true;
let submission;
let server;
let base;
let collegeReport;
let sharedPreRegistration;
let studentPreRegistrationOnly = false;
let studentPreRegistrationColumnPresent = true;
const scopedReads = [];

before(async () => {
  process.env.ZAPROLL_FORMS_API_KEY = 'local-test-key';
  const config = require.resolve('../src/config/supabase');
  const auth = require.resolve('../src/middleware/authMiddleware');
  const role = { id: roleId, event_id: eventId, name: 'Students', required_fields: ['course'],
    registration_url: 'https://forms.example/register?original=a%20b&eventId=old#part/1' };
  const session = {
    id: sessionId, event_id: eventId, title: 'Seminar', attendance_url: 'https://forms.example/checkin',
    venue: { name: 'Hall' }, starts_at: '2026-12-01T02:00:00Z',
  };
  const values = {
    events: () => [{ id: eventId, event_mode: 'scheduled', lifecycle, name: 'Sample', timezone: 'Asia/Manila',
      pre_reg_manual: true, pre_reg_open: manualOpen, student_pre_registration_only: studentPreRegistrationOnly }],
    event_roles: () => sharedPreRegistration ?? (collegeReport ? [{ ...role, name: 'Student' }] : [role]),
    event_schedule: () => {
      session.checkin_opens_at = new Date(Date.now() + (checkinOpen ? -3600000 : 3600000)).toISOString();
      session.ends_at = new Date(Date.now() + 7200000).toISOString();
      session.walkins_open_at = session.ends_at;
      session.attendance_open_override = attendanceOverride;
      return [session];
    },
    event_venues: () => [],
    admin_profiles: () => [{ id: 'admin' }],
    event_checkins: () => [{ id: 'receipt', checked_in_at: session.starts_at, participant: { full_name: 'Student', role_id: roleId } }],
    event_participants: () => collegeReport ?? [],
    event_session_feedback: () => [],
  };
  require.cache[config] = { exports: {
    from(table) {
      let countOnly = false;
      let selectError;
      let matchedRow = true;
      let rowId;
      let templateUpdate;
      const query = {
        select: (columns, options) => {
          countOnly = Boolean(options?.head);
          if (!attendanceOverrideColumnPresent && table === 'event_schedule' && columns.includes('attendance_open_override')) {
            selectError = { code: '42703', message: 'column event_schedule.attendance_open_override does not exist' };
          }
          if (!studentPreRegistrationColumnPresent && table === 'events' && columns.includes('student_pre_registration_only')) {
            selectError = { code: '42703', message: 'column events.student_pre_registration_only does not exist' };
          }
          return query;
        },
        update: values => { templateUpdate = values; return query; },
        eq: (column, value) => {
          if (column === 'event_id') scopedReads.push({ table, value });
          if (column === 'id') rowId = value;
          if (['events', 'event_schedule', 'event_roles'].includes(table) &&
            column === 'event_id' && value !== eventId) matchedRow = false;
          return query;
        },
        order: () => query, limit: () => query,
        maybeSingle: () => {
          if (selectError) return Promise.resolve({ error: selectError });
          if (!matchedRow) return Promise.resolve({ data: null });
          const rows = values[table]();
          const row = rowId ? rows.find(value => value.id === rowId) : rows[0];
          if (row && templateUpdate) Object.assign(row, templateUpdate);
          return Promise.resolve({ data: row });
        },
        then: callback => Promise.resolve(selectError ? { error: selectError }
          : countOnly ? { count: 1 } : { data: values[table]() }).then(callback),
      };
      return query;
    },
    rpc(name, payload) {
      submission = { name, payload };
      if (name === 'set_scheduled_attendance_override') {
        attendanceOverride = payload.p_open;
        return Promise.resolve({ data: { id: payload.p_session, attendance_open_override: attendanceOverride } });
      }
      return Promise.resolve({ data: { checkin_id: 'receipt', created: true,
        ...(name !== 'submit_scheduled_student_attendance' && { display_name: 'Student' }) } });
    },
  } };
  require.cache[auth] = { exports: (req, res, next) => {
    if (!req.get('Authorization')) return res.sendStatus(401);
    req.user = { id: 'admin' };
    next();
  } };
  const app = express();
  app.use(express.json());
  app.use('/workspace', require('../src/routes/eventWorkspaceRoutes'));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  base = `http://127.0.0.1:${server.address().port}/workspace`;
});

after(async () => {
  delete process.env.ZAPROLL_FORMS_API_KEY;
  if (server) await new Promise(resolve => server.close(resolve));
});

test('public config hides drafts and closes archived links', async () => {
  for (const [state, expected] of [['draft', 404], ['archived', 410], ['active', 200]]) {
    lifecycle = state;
    const response = await fetch(`${base}/${eventId}/config`);
    assert.equal(response.status, expected);
  }
});

test('admin QR replaces event context and preserves the original query and fragment', async () => {
  assert.equal((await fetch(`${base}/${eventId}`)).status, 401);
  const response = await fetch(`${base}/${eventId}`, { headers: { Authorization: 'Bearer test' } });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.roles[0].qr_url,
    `https://forms.example/register?original=a%20b&eventId=${eventId}&roleId=${roleId}#part/1`);
});

test('a Setup venue resize sends the venue and acknowledged sessions to one database transaction', async () => {
  const path = `${base}/${eventId}/actions/venue`;
  const body = {
    id: 'd1772f09-24fc-4ec0-b455-626caac656ca', name: 'Seminar Room', capacity: 100, role_caps: { [roleId]: 100 },
    expected_venue: { name: 'Seminar Room', capacity: 500, role_caps: { [roleId]: 249 } },
    affected_sessions: { [sessionId]: { capacity: 500, role_caps: { [roleId]: 249 } } },
  };
  const request = { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } };
  assert.equal((await fetch(path, request)).status, 401);
  request.headers.Authorization = 'Bearer test';
  assert.equal((await fetch(path, request)).status, 200);
  assert.deepEqual(submission, { name: 'resize_student_event_venue', payload: { p_event: eventId, p_admin: 'admin', p_data: body } });
});

test('the existing event pre-registration link survives edits to multiple categories', async () => {
  const url = `https://forms.example.edu/forms/${eventId}?type=pre-registration`;
  const alumniLink = `https://legacy.example.edu/forms/${alumniRoleId}?type=pre-registration`;
  sharedPreRegistration = [
    { id: roleId, name: 'Student', registration_url: null },
    { id: alumniRoleId, name: 'Alumni', registration_url: alumniLink },
  ];
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  try {
    const legacy = await fetch(`${base}/${eventId}`, { headers });
    assert.equal((await legacy.json()).data.pre_registration_url, alumniLink.replace(alumniRoleId, eventId));

    sharedPreRegistration[0].registration_url = url;
    const response = await fetch(`${base}/${eventId}`, { headers });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.pre_registration_url, url);
    assert.deepEqual(data.roles.map(role => role.qr_url), [null, null]);

    process.env.ZAPROLL_WEBFORM_BASE_URL = 'https://new.example.edu/forms';
    for (const role of sharedPreRegistration) {
      const title = `${role.name} questions`;
      const saved = await fetch(`${base}/${eventId}/roles/${role.id}/pre-registration-template`, {
        method: 'POST', headers,
        body: JSON.stringify({ title, questions: [{ id: 'about', title: 'About you', description: '', questions: [] }] }),
      });
      assert.equal(saved.status, 200);
      assert.equal((await saved.json()).data.url, url);
      assert.equal(role.registration_template.title, title);
    }
    assert.deepEqual(sharedPreRegistration.map(role => role.registration_url), [url, url]);
  } finally {
    sharedPreRegistration = undefined;
    delete process.env.ZAPROLL_WEBFORM_BASE_URL;
  }
});

test('draft pre-registration form reads the switch without exposing the session setup', async () => {
  lifecycle = 'draft';
  try {
    for (const open of [false, true, false]) {
      manualOpen = open;
      const response = await fetch(`${base}/${eventId}/config?form=pre-registration`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const { data } = await response.json();
      assert.equal(data.event.pre_reg_open, open);
      assert.equal(data.roles.length, open ? 1 : 0);
      assert.equal(data.sessions, undefined);
    }
  } finally {
    lifecycle = 'active';
  }
});

test('student-only pre-registration serves and submits one form without a role selection', async () => {
  const link = `https://forms.example.edu/forms/${eventId}?type=pre-registration`;
  const questions = [{ id: 'student-details', questions: [] }];
  const registration_template = { title: 'Student registration', questions };
  sharedPreRegistration = [
    { id: alumniRoleId, event_id: eventId, name: 'Alumni', registration_url: link, registration_template },
    { id: roleId, event_id: eventId, name: 'Student', registration_url: link, registration_template },
  ];
  studentPreRegistrationOnly = true;
  manualOpen = true;
  const configUrl = `${base}/${eventId}/config?form=pre-registration`;
  const submitUrl = `${base}/${eventId}/submissions/pre-registration`;
  const submit = fields => fetch(submitUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ZapRoll-Forms-Key': 'local-test-key' },
    body: JSON.stringify({ email: 'student@example.com', full_name: 'Test Student', ...fields }),
  });
  try {
    const { data } = await (await fetch(configUrl)).json();
    assert.equal(data.event.student_pre_registration_only, true);
    assert.deepEqual(data.roles.map(role => role.id), [roleId]);
    assert.deepEqual(data.form.pages, questions);
    assert.equal(data.form.roleId, roleId);
    assert.equal((await fetch(`${base}/forms/${alumniRoleId}?type=pre-registration`)).status, 404);

    assert.equal((await submit({})).status, 201);
    assert.equal(submission.payload.p_data.role_id, roleId);
    assert.equal((await submit({ role_id: alumniRoleId })).status, 400);

    manualOpen = false;
    assert.equal((await submit({})).status, 410);
    const closed = await (await fetch(configUrl)).json();
    assert.deepEqual(closed.data.roles, []);
    assert.equal(closed.data.form, undefined);
  } finally {
    studentPreRegistrationOnly = false;
    sharedPreRegistration = undefined;
    manualOpen = false;
  }
});

test('attendance is server-to-server and returns confirmation details', async () => {
  const url = `${base}/${eventId}/submissions/attendance`;
  const body = JSON.stringify({ session_id: sessionId, email: 'verified@example.com' });
  const headers = { 'Content-Type': 'application/json' };
  assert.equal((await fetch(url, { method: 'POST', body, headers })).status, 401);
  const response = await fetch(url, { method: 'POST', body, headers: { ...headers, 'X-ZapRoll-Forms-Key': 'local-test-key' } });
  assert.equal(response.status, 201);
  assert.equal(submission.name, 'submit_scheduled_event');
  assert.equal(submission.payload.p_session, sessionId);
  const { data } = await response.json();
  assert.equal(data.checkin_id, 'receipt');
  assert.equal(data.venue_name, 'Hall');
  assert.equal(data.display_name, 'Student');
  const withAnswers = await fetch(url, { method: 'POST', headers: { ...headers, 'X-ZapRoll-Forms-Key': 'local-test-key' },
    body: JSON.stringify({ session_id: sessionId, email: 'verified@example.com', answers: { confirmation: 'yes' } }) });
  assert.equal(withAnswers.status, 201);
  assert.equal(submission.name, 'submit_scheduled_attendance');
  assert.deepEqual(submission.payload.p_data.answers, { confirmation: 'yes' });
});

test('pre-registered student check-in calls the student-number RPC without forwarding an email', async () => {
  const url = `${base}/${eventId}/submissions/attendance`;
  const payload = { session_id: sessionId, student_number: '26-0042' };
  const headers = { 'Content-Type': 'application/json', 'X-ZapRoll-Forms-Key': 'local-test-key' };
  assert.equal((await fetch(url, { method: 'POST', body: JSON.stringify(payload) })).status, 401);
  const send = body => fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  assert.equal((await send({ ...payload, email: 'verified@example.org' })).status, 400);
  assert.equal((await send({ ...payload, student_number: 42 })).status, 400);
  const response = await send(payload);
  assert.equal(response.status, 201);
  assert.deepEqual(submission, {
    name: 'submit_scheduled_student_attendance',
    payload: { p_event: eventId, p_session: sessionId, p_data: { student_number: '26-0042' } },
  });
  const { data } = await response.json();
  assert.equal(data.checkin_id, 'receipt');
  assert.equal(data.display_name, undefined);
  assert.equal(data.email, undefined);
});

test('evaluation templates require an admin and are saved for the specified event and session', async () => {
  const path = `/sessions/${sessionId}/evaluation-template`;
  const url = `${base}/${eventId}${path}`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  const template = { title: 'Evaluation', questions: [{ id: 'page', title: 'Feedback', description: '',
    questions: [{ id: 'rating', type: 'rating', label: 'Rate the session', required: true, statements: [] }] }] };
  const save = { method: 'POST', headers, body: JSON.stringify(template) };
  assert.equal((await fetch(`${base}/${roleId}${path}`, save)).status, 404);
  assert.equal((await fetch(url, { ...save, body: '{}' })).status, 400);
  assert.equal((await fetch(url, save)).status, 200);
  const reloaded = await fetch(url, { headers });
  assert.deepEqual((await reloaded.json()).data, template);
});

test('saved evaluations have a stable participant URL and published forms can be fetched by type and ID', async () => {
  process.env.ZAPROLL_WEBFORM_BASE_URL = 'https://forms.example.edu/forms/';
  const url = `${base}/${eventId}/sessions/${sessionId}/evaluation-template`;
  const publicUrl = `${base}/forms/${sessionId}?type=evaluation`;
  const pages = [{ id: 'page', title: 'Feedback', description: '', questions: [] }];
  try {
    lifecycle = 'draft';
    const saved = await fetch(url, {
      method: 'POST', headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Evaluation', questions: pages }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).data.url, `https://forms.example.edu/forms/${sessionId}?type=evaluation`);
    assert.equal((await fetch(publicUrl)).status, 404);
    lifecycle = 'active';
    const response = await fetch(publicUrl);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await response.json()).data, {
      id: sessionId, type: 'evaluation', eventId, sessionId, eventName: 'Sample',
      sessionTitle: 'Seminar', title: 'Evaluation', pages,
    });
    assert.equal((await fetch(publicUrl.replace('evaluation', 'attendance'))).status, 404);
    lifecycle = 'archived';
    assert.equal((await fetch(publicUrl)).status, 410);
  } finally {
    lifecycle = 'active';
    delete process.env.ZAPROLL_WEBFORM_BASE_URL;
  }
});

test('dashboard reads registration, attendance, feedback and schedule data for the selected event', async () => {
  const from = scopedReads.length;
  const response = await fetch(`${base}/${eventId}/dashboard`, { headers: { Authorization: 'Bearer test' } });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.attendance, 1);
  assert.equal(data.recent[0].name, 'Student');
  assert.equal(data.sessions[0].venue, 'Hall');
  const reads = scopedReads.slice(from);
  assert.deepEqual(new Set(reads.map(read => read.table)), new Set([
    'event_roles', 'event_schedule', 'event_participants', 'event_checkins', 'event_session_feedback',
  ]));
  assert.ok(reads.every(read => read.value === eventId));
});

test('the event list and dashboard load before student pre-registration is migrated', async () => {
  studentPreRegistrationColumnPresent = false;
  try {
    const options = { headers: { Authorization: 'Bearer test' } };
    const list = await fetch(base, options);
    assert.equal(list.status, 200);
    assert.equal((await list.json()).data[0].id, eventId);

    const dashboard = await fetch(`${base}/${eventId}/dashboard`, options);
    assert.equal(dashboard.status, 200);
    assert.equal((await dashboard.json()).data.attendance, 1);
  } finally {
    studentPreRegistrationColumnPresent = true;
  }
});

test('student college report requires sign-in and distinguishes people from check-ins', async () => {
  collegeReport = [
    { role_id: roleId, source: 'pre-reg', student_college: 'College of Computing', checkins: [{ count: 3 }] },
    { role_id: roleId, source: 'walk-in', student_college: ' college  of computing ', checkins: [{ count: 1 }] },
    { role_id: roleId, source: 'pre-reg', student_college: 'College of Education', checkins: [{ count: 0 }] },
    { role_id: roleId, source: 'pre-reg', student_college: null, checkins: [{ count: 0 }] },
    { role_id: 'another-role', source: 'pre-reg', student_college: 'College of Computing', checkins: [{ count: 2 }] },
  ];
  try {
    const path = `${base}/${eventId}/report/student-colleges`;
    assert.equal((await fetch(path)).status, 401);
    const from = scopedReads.length;
    const response = await fetch(path, { headers: { Authorization: 'Bearer test' } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/csv/);
    assert.deepEqual((await response.text()).split('\r\n'), [
      '"College","Pre-registered","Walk-ins","Total registrations","Unique attendees","Session check-ins"',
      '"College of Computing","1","1","2","2","4"',
      '"College of Education","1","0","1","0","0"',
      '"Unspecified","1","0","1","0","0"',
    ]);
    assert.deepEqual(scopedReads.slice(from), [
      { table: 'event_roles', value: eventId },
      { table: 'event_participants', value: eventId },
    ]);
  } finally {
    collegeReport = undefined;
  }
});

test('pre-registration templates belong to the selected role and honor the registration switch', async () => {
  process.env.ZAPROLL_WEBFORM_BASE_URL = 'https://forms.example.edu/forms';
  const path = `/roles/${roleId}/pre-registration-template`;
  const adminUrl = `${base}/${eventId}${path}`;
  const publicUrl = `${base}/forms/${roleId}?type=pre-registration`;
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  const template = { title: 'Student registration', questions: [{ id: 'page', title: 'About you', description: '',
    questions: [{ id: 'course', type: 'text', label: 'Course', required: true, statements: [] }] }] };
  const save = { method: 'POST', headers, body: JSON.stringify(template) };
  try {
    lifecycle = 'draft';
    assert.equal((await fetch(adminUrl)).status, 401);
    assert.equal((await fetch(`${base}/${sessionId}${path}`, save)).status, 404);
    const response = await fetch(adminUrl, save);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.url, `https://forms.example.edu/forms/${eventId}?type=pre-registration`);
    assert.deepEqual((await (await fetch(adminUrl, { headers })).json()).data, template);

    assert.equal((await fetch(publicUrl)).status, 410);
    manualOpen = true;
    const published = await fetch(publicUrl);
    assert.equal(published.status, 200);
    assert.deepEqual((await published.json()).data, {
      id: roleId, type: 'pre-registration', eventId, roleId, eventName: 'Sample', roleName: 'Students',
      title: template.title, pages: template.questions, requiredFields: ['course'],
    });
    lifecycle = 'archived';
    assert.equal((await fetch(publicUrl)).status, 410);
  } finally {
    lifecycle = 'active';
    manualOpen = false;
    delete process.env.ZAPROLL_WEBFORM_BASE_URL;
  }
});

test('attendance has its own session template and URL, available during check-in', async () => {
  process.env.ZAPROLL_WEBFORM_BASE_URL = 'https://forms.example.edu/forms';
  const path = `/sessions/${sessionId}/attendance-template`;
  const adminUrl = `${base}/${eventId}${path}`;
  const publicUrl = `${base}/forms/${sessionId}?type=attendance`;
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  const template = { title: 'Attendance', questions: [{ id: 'page', title: 'Check in', description: '', questions: [] }] };
  const save = { method: 'POST', headers, body: JSON.stringify(template) };
  try {
    assert.equal((await fetch(adminUrl)).status, 401);
    assert.equal((await fetch(`${base}/${roleId}${path}`, save)).status, 404);
    const response = await fetch(adminUrl, save);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.url, `https://forms.example.edu/forms/${sessionId}?type=attendance`);
    assert.deepEqual((await (await fetch(adminUrl, { headers })).json()).data, template);
    assert.equal((await fetch(publicUrl)).status, 410);
    checkinOpen = true;
    lifecycle = 'draft';
    assert.equal((await fetch(publicUrl)).status, 404);
    lifecycle = 'active';
    const published = await fetch(publicUrl);
    assert.equal(published.status, 200);
    const { data } = await published.json();
    assert.equal(data.sessionId, sessionId);
    assert.equal(data.type, 'attendance');
    assert.equal(data.eventId, eventId);
    assert.deepEqual(data.pages, template.questions);
    const evaluation = await fetch(publicUrl.replace('attendance', 'evaluation'));
    assert.equal((await evaluation.json()).data.title, 'Evaluation');
  } finally {
    lifecycle = 'active';
    checkinOpen = false;
    delete process.env.ZAPROLL_WEBFORM_BASE_URL;
  }
});

test('the session attendance switch requires admin access and controls the public form', async () => {
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  const url = `${base}/${eventId}/actions/attendance-status`;
  const publicUrl = `${base}/forms/${sessionId}?type=attendance`;
  const setAttendance = open => fetch(url, { method: 'POST', headers, body: JSON.stringify({ id: sessionId, open }) });
  try {
    await fetch(`${base}/${eventId}/sessions/${sessionId}/attendance-template`, {
      method: 'POST', headers, body: JSON.stringify({ title: 'Attendance', questions: [{ id: 'page', title: 'Check in', description: '', questions: [] }] }),
    });
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await setAttendance('false')).status, 400);
    checkinOpen = false;
    assert.equal((await fetch(publicUrl)).status, 410);
    const opened = await setAttendance(true);
    assert.equal(opened.status, 200);
    assert.deepEqual((await opened.json()).data, { id: sessionId, attendance_open_override: true });
    assert.deepEqual(submission.payload, { p_event: eventId, p_session: sessionId, p_open: true });
    assert.equal((await fetch(publicUrl)).status, 200);
    lifecycle = 'draft';
    assert.equal((await fetch(publicUrl)).status, 404);
    lifecycle = 'active';
    checkinOpen = true;
    assert.equal((await setAttendance(false)).status, 200);
    assert.equal((await fetch(publicUrl)).status, 410);
    assert.equal((await setAttendance(null)).status, 200);
    assert.equal((await fetch(publicUrl)).status, 200);
    attendanceOverrideColumnPresent = false;
    assert.equal((await fetch(`${base}/${eventId}`, { headers })).status, 200);
    assert.equal((await fetch(publicUrl)).status, 200);
  } finally {
    attendanceOverrideColumnPresent = true;
    attendanceOverride = null;
    checkinOpen = false;
    lifecycle = 'active';
  }
});
