const { readFileSync } = require('node:fs');

const title = 'CCS Summit 2026 – Participant Registration';
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const sessionOptions = {
  day_1_session_id: {
    day1Morning: 'CCS Summit Opening morning (8:30 AM–12:00 PM, Auditorium)',
    day1Afternoon: 'CCS Summit Opening afternoon (1:00–5:15 PM, Auditorium)',
  },
  day_2_session_id: {
    day2Finale: 'Final presentations, recognition and synthesis (3:00–5:00 PM, Auditorium)',
  },
  day_3_session_id: {
    day3Syvsis: 'SYVSIS – Emerging Information Systems Trends',
    day3CyberSecureU: 'JPCS and AWS – CyberSecureU seminar and CTF',
    day3Lesit: 'LESIT – Artificial Intelligence Seminar',
  },
};
const referralValues = {
  'Facebook or social media': 'social_media',
  'Friends or classmates': 'friends_classmates',
  'Faculty members': 'faculty',
  'Student organizations': 'student_organizations',
};
const privacyValues = { 'I agree': 'agree', 'I do not agree': 'decline' };

function question(id, type, label, required, settings = {}) {
  return { id, type, label, required, statements: [], ...settings };
}

function buildRoleTemplates({ sessionIds, privacyNotice, privacyNoticeVersion }) {
  if (typeof privacyNotice !== 'string' || !privacyNotice.trim() ||
      typeof privacyNoticeVersion !== 'string' || !privacyNoticeVersion.trim()) {
    throw new Error('Provide the school-approved privacy notice and its version.');
  }

  const usedSessions = new Set();
  const choiceValues = {
    referral_source: referralValues,
    privacy_acknowledgment: privacyValues,
  };
  for (const [field, choices] of Object.entries(sessionOptions)) {
    choiceValues[field] = Object.fromEntries(Object.entries(choices).map(([key, label]) => {
      const id = sessionIds?.[key];
      if (typeof id !== 'string' || !uuid.test(id) || usedSessions.has(id.toLowerCase())) {
        throw new Error(`Provide a distinct session UUID for ${key}.`);
      }
      usedSessions.add(id.toLowerCase());
      return [label, id.toLowerCase()];
    }));
  }

  const sharedQuestions = [
    question('day_1_session_id', 'choice', 'Day 1 session', true, { options: Object.keys(choiceValues.day_1_session_id) }),
    question('day_2_session_id', 'choice', 'Day 2 session', true, { options: Object.keys(choiceValues.day_2_session_id) }),
    question('day_3_session_id', 'choice', 'Day 3 seminar', false, { options: Object.keys(choiceValues.day_3_session_id) }),
    question('activity_concerns', 'text', 'Any concerns about the seminars or activities?', false, { subtype: 'long' }),
    question('special_requirements', 'text', 'Any special requirements the organizers should know about?', false, { subtype: 'long' }),
    question('referral_source', 'choice', 'How did you hear about the summit?', true, {
      options: Object.keys(referralValues), hasOther: true,
    }),
  ];

  const roles = ['Student', 'CCS Faculty Member', 'Alumni', 'Other'].map(roleName => {
    const categoryQuestions = roleName === 'Student' ? [
      question('student_college', 'text', 'College or academic unit', true, { subtype: 'short' }),
      question('year_and_section', 'text', 'Year and section (e.g. SBIT-1A)', true, { subtype: 'short' }),
      question('student_number', 'text', 'Student number (e.g. 26-XXXX)', true, { subtype: 'short' }),
    ] : [];
    if (roleName === 'Other') {
      categoryQuestions.push(question('participant_category_other', 'text', 'Describe your participant category', true, {
        subtype: 'short',
      }));
    }
    return {
      roleName,
      template: {
        title,
        questions: [{
          id: 'ccs_summit_pre_registration',
          title,
          description: 'Choose your session preferences and review the privacy notice before submitting.',
          questions: [
            question('contact_number', 'text', 'Active contact number (e.g. 09XXXXXXXXX)', false, { subtype: 'short' }),
            ...categoryQuestions,
            ...sharedQuestions,
            question('privacy_notice', 'header', privacyNotice.trim(), false),
            question('privacy_acknowledgment', 'choice', 'Do you agree to the processing described in the privacy notice?', true, {
              options: Object.keys(privacyValues),
            }),
          ],
        }],
      },
    };
  });

  return { privacyNoticeVersion: privacyNoticeVersion.trim(), choiceValues, roles };
}

if (require.main === module) {
  try {
    const configPath = process.argv[2];
    if (!configPath) throw new Error('Usage: node backend/scripts/ccsSummitRegistrationTemplates.js <config.json>');
    const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
    process.stdout.write(JSON.stringify(buildRoleTemplates(config), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { buildRoleTemplates };
