const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const express = require('express');

const eventId = '49b030b7-fd5e-41bb-ac4c-36f982ab41ed';
const roleId = '560a856b-233d-41af-975c-d43b656acd2b';
const sessionId = '4b3162cb-3d32-414e-bf11-8d358999a140';
let lifecycle = 'active';
let manualOpen = false;
let checkinOpen = false;
let submission;
let server;
let base;
let collegeReport;
let sharedPreRegistration;
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
      pre_reg_manual: true, pre_reg_open: manualOpen }],
    event_roles: () => sharedPreRegistration ?? (collegeReport ? [{ ...role, name: 'Student' }] : [role]),
    event_schedule: () => {
      session.checkin_opens_at = new Date(Date.now() + (checkinOpen ? -3600000 : 3600000)).toISOString();
      session.ends_at = new Date(Date.now() + 7200000).toISOString();
      session.walkins_open_at = session.ends_at;
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
      let matchedRow = true;
      let templateUpdate;
      const query = {
        select: (columns, options) => { countOnly = Boolean(options?.head); return query; },
        update: values => { templateUpdate = values; return query; },
        eq: (column, value) => {
          if (column === 'event_id') scopedReads.push({ table, value });
          if ((table === 'event_schedule' || table === 'event_roles') &&
            ((column === 'id' && value !== (table === 'event_roles' ? roleId : sessionId)) ||
            (column === 'event_id' && value !== eventId))) matchedRow = false;
          return query;
        },
        order: () => query, limit: () => query,
        maybeSingle: () => {
          if (!matchedRow) return Promise.resolve({ data: null });
          const row = values[table]()[0];
          if (templateUpdate) Object.assign(row, templateUpdate);
          return Promise.resolve({ data: row });
        },
        then: callback => Promise.resolve(countOnly ? { count: 1 } : { data: values[table]() }).then(callback),
      };
      return query;
    },
    rpc(name, payload) {
      submission = { name, payload };
      return Promise.resolve({ data: { checkin_id: 'receipt', created: true, display_name: 'Student' } });
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

test('one event pre-registration link serves all roles and survives editing a role template', async () => {
  const url = `https://forms.example.edu/forms/${eventId}?type=pre-registration`;
  sharedPreRegistration = [
    { id: roleId, name: 'Student', registration_url: url },
    { id: 'another-role', name: 'Alumni', registration_url: url },
  ];
  const headers = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };
  try {
    const response = await fetch(`${base}/${eventId}`, { headers });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.pre_registration_url, url);
    assert.deepEqual(data.roles.map(role => role.qr_url), [null, null]);

    process.env.ZAPROLL_WEBFORM_BASE_URL = 'https://forms.example.edu/forms';
    const saved = await fetch(`${base}/${eventId}/roles/${roleId}/pre-registration-template`, {
      method: 'POST', headers,
      body: JSON.stringify({ title: 'Student questions', questions: [{ id: 'student', title: 'College', description: '', questions: [] }] }),
    });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).data.url, url);
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
    assert.equal((await response.json()).data.url, `https://forms.example.edu/forms/${roleId}?type=pre-registration`);
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
