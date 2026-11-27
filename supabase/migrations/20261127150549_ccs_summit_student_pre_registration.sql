alter table public.events
  add column student_pre_registration_only boolean not null default false;

-- The Student role remains the internal quota and reporting category.
-- Keep existing participant, attendance, and role records.
update public.events
set student_pre_registration_only = true
where id = 'dd191aad-6220-4683-96e0-c82e051acb9c'
  and event_mode = 'scheduled';

-- Full name and verified email are collected by the standard registration flow.
-- Store the Google Form's selections as preferences. Some choices have no
-- matching check-in session, and selecting a preference does not book a seat.
update public.event_roles
set registration_template = $template$
{
  "title": "CCS Summit 2026 – Student Pre-registration",
  "questions": [{
    "id": "ccs_summit_pre_registration",
    "title": "CCS Summit 2026 – Student Pre-registration",
    "description": "Enter your student details, choose your session preferences, and review the data privacy notice.",
    "questions": [
      {"id":"contact_number","type":"text","label":"Active contact number (09XXXXXXXXX)","subtype":"short","required":false,"statements":[]},
      {"id":"year_and_section","type":"text","label":"Year and section (e.g. SBIT-1A, SFIT-1A, BAIT-1A)","subtype":"short","required":true,"statements":[]},
      {"id":"student_number","type":"text","label":"Student number (e.g. 26-XXXX)","subtype":"short","required":true,"statements":[]},
      {"id":"student_program","type":"choice","label":"Student program","required":true,"statements":[],"options":[
        "Information Technology","Information Systems","Computer Science"
      ]},
      {"id":"student_college","type":"text","label":"College or academic unit","subtype":"short","required":true,"statements":[]},
      {"id":"day_1_session_preference","type":"choice","label":"Day 1 – CCS Summit opening, industry talk, design thinking, and competitions","required":true,"statements":[],"options":[
        "CCS Summit Opening Morning Session (8:30 AM–12 NN, Auditorium)",
        "CCS Summit Opening Afternoon Session (1:00–5:15 PM, Auditorium)",
        "CCS Summit Quiz Bee (10:15 AM–5:00 PM, Gymnasium)",
        "CCS Summit Technical Competition (10:15 AM–5:00 PM, Computer Laboratory)"
      ]},
      {"id":"day_2_session_preference","type":"choice","label":"Day 2 – Innovate: Hackathon, innovation challenge, e-sports, and awarding / recognition ceremony","required":true,"statements":[],"options":[
        "CCS Summit Hackathon / Innovation Challenge (8:00 AM–3:00 PM, Computer Laboratory)",
        "CCS Summit Final Presentation, Day 1 & 2 Recognition and Announcements, and Day 2 Synthesis (3:00–5:00 PM, Auditorium)",
        "CCS Summit Esport (8:00–10:30 AM, Student Resource Center, New Academic Bldg Lobby)"
      ]},
      {"id":"day_3_session_preference","type":"choice","label":"Day 3 – Transform: Organization-led seminars","required":false,"statements":[],"options":[
        "SYVSIS – Seminar focusing on Emerging Trends in Information Systems",
        "JPCS CyberSecureU 2026: Break. Defend. Secure.",
        "LESIT – Seminar focusing on Artificial Intelligence (AI)"
      ]},
      {"id":"activity_concerns","type":"text","label":"Do you have any preferred seminar or activity concerns that you would like to communicate to the organizers?","subtype":"long","required":false,"statements":[]},
      {"id":"special_requirements","type":"text","label":"Do you have any special requirements or concerns that the organizers should know about?","subtype":"long","required":false,"statements":[]},
      {"id":"referral_source","type":"choice","label":"How did you hear about the CCS Summit 2026?","required":true,"statements":[],"hasOther":true,"options":[
        "Facebook / Social Media","Friends / Classmates","Faculty Members","Student Organizations"
      ]},
      {"id":"privacy_notice","type":"header","label":"By submitting this form, you acknowledge that your personal information will be collected and processed for CCS Summit 2026 registration, attendance monitoring, event coordination, and other legitimate event-related purposes, subject to the applicable data privacy requirements under Republic Act No. 10173 or the Data Privacy Act of 2012.","required":false,"statements":[]},
      {"id":"privacy_acknowledgment","type":"choice","label":"Acknowledgment of Data Privacy Compliance","required":true,"statements":[],"options":[
        "I have read and understood the data privacy notice and agree to the collection and processing of my personal information for the stated purposes.",
        "I do not agree to the collection and processing of my personal information."
      ]}
    ]
  }]
}
$template$::jsonb
where event_id = 'dd191aad-6220-4683-96e0-c82e051acb9c'
  and id = '7ebc334e-cbb8-4864-ae9a-df5547eca39c';
