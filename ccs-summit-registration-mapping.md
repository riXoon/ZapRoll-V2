# CCS Summit 2026 registration field mapping

> This documents the original multi-category draft. The current CCS Summit template is student-only and includes all ten session choices from the Google Form. See the [current public integration](ccs-summit-public-form-integration.md) and [student pre-registration migration](supabase/migrations/20261127150549_ccs_summit_student_pre_registration.sql).

Source: [CCS Summit 2026 – Participant Registration](https://docs.google.com/forms/d/e/1FAIpQLSd03MExuWii_Z8WwI266kMQaOvxpZ_6jBcyWYb9DXXSBK0XxA/viewform). The Google entry IDs identify the questions in the source form. Use the ZapRoll keys below as stable question IDs when building the target templates.

Participants open one summit link and choose a category inside the form. The page displays the corresponding ZapRoll template on the same screen. The web form collects name and verifies email, then submits to `POST /api/event-workspace/{eventId}/submissions/pre-registration` using the server-side integration key. Values listed under `metadata` are answers stored alongside the event registration.

## Field mapping

| Google Form field | Google entry ID | Source rule | ZapRoll target and validation |
| --- | --- | --- | --- |
| Full name | `656571604` | Required short text | `full_name`. Collect in the web form’s standard name field. Keep the surname, first name, middle name hint. |
| Email address | `1410800396` | Required, email format | `email`. Verify ownership in the web form before submitting. ZapRoll matches one email to one registration per event. |
| Active contact number | `1778131710` | Optional, with a Philippine mobile number hint | `metadata.contact_number`. Short text. Preserve the leading zero. Confirm whether to accept international numbers. |
| Year and section | `1980642591` | Required. The form asks non-students to enter N/A. | `metadata.year_and_section`. Short text, shown only for the Student role. |
| Student number | `1350671116` | Required for all categories in Google Forms | `metadata.student_number`. Short text. Keep the example format. Proposed rule requires it for students only. Confirm with the school before changing the source rule. |
| Participant category | `1252862551` | Required single choice with Other | `role_id` from the summit’s configured roles. Map all three student choices to **Student**. For Other, collect the Google Form’s free-text answer in `metadata.participant_category_other`. |
| College or academic unit | New ZapRoll question | Required for the Student role | `metadata.student_college`. Accept a college or academic unit as text and write it on pre-registration and first-time walk-in. For Google Form imports, use a school-confirmed college mapping where available. |
| Day 1 session | `865490821` | Required single choice | `metadata.day_1_session_id`. Choice between the two Day 1 auditorium sessions below. |
| Day 2 session | `510598601` | Required single choice with one option | `metadata.day_2_session_id`. Keep the explicit selection until the school confirms whether attendance on Day 2 is required. |
| Day 3 seminar | `504760361` | Optional single choice | `metadata.day_3_session_id`. Choice among the three seminars below. Omit when skipped. |
| Preferred seminar or activity concerns | `1666013991` | Optional paragraph | `metadata.activity_concerns`. Long text. |
| Special requirements or concerns | `1888985389` | Optional paragraph | `metadata.special_requirements`. Long text. Restrict access to authorized organizers who need it. Exclude it from general reports. |
| How the participant heard about the event | `1160240097` | Required single choice with Other | `metadata.referral_source` is one of `social_media`, `friends_classmates`, `faculty`, `student_organizations`, or `other`. Capture the Other text in `metadata.referral_source_other`. |
| Data privacy acknowledgment | `804034989` | Required checkbox question with agree and decline choices | Present one mutually exclusive response in the web form. Proposed keys are `metadata.privacy_acknowledgment` and `metadata.privacy_notice_version`. Confirm the approved wording, what to retain, and whether decline stops registration. The notice above the question is display text and has no answer key. |

## Role and session lookup

| Google category | ZapRoll role name | Template fields |
| --- | --- | --- |
| Information Technology Student | Student | Student fields |
| Information Systems Student | Student | Student fields |
| Computer Science Student | Student | Student fields |
| CCS Faculty Member | CCS Faculty Member | General fields |
| Alumni | Alumni | General fields |
| Other | Other | General fields and category description |

The Student role has one shared quota for all colleges and programs. The summit draft combines the three prior 83-slot student quotas into 249 shared pre-registration slots and combines their allocations at each configured venue. The form uses the college answer for reporting.

| Date (Manila) | Session choice | Time and venue |
| --- | --- | --- |
| Dec 2, 2026 | CCS Summit Opening morning | 8:30 AM–12:00 PM, Auditorium. Registration at LB Lobby from 7:30 AM. |
| Dec 2, 2026 | CCS Summit Opening afternoon | 1:00–5:15 PM, Auditorium |
| Dec 3, 2026 | Final presentations, recognition, announcements, and synthesis | 3:00–5:00 PM, Auditorium |
| Dec 4, 2026 | SYVSIS seminar on emerging information systems trends | Parallel workshop block 9:00–10:30 AM, New Academic Building, sixth floor. Room pending. |
| Dec 4, 2026 | JPCS and AWS CyberSecureU seminar and CTF | Parallel workshop block 9:00–10:30 AM, New Academic Building, sixth floor. Room pending. |
| Dec 4, 2026 | LESIT seminar on artificial intelligence | Parallel workshop block 9:00–10:30 AM, New Academic Building, sixth floor. Room pending. |

The technical requirements workbook gives the Day 3 block time and floor. It groups the workshops together and does not specify each workshop’s room or capacity. Configure the confirmed rooms as separate venues so the simultaneous sessions can be saved. [CCS Summit Technical Requirements.xlsx](<C:/Users/adm1n/Downloads/CCS Summit Technical Requirements.xlsx>)

Display these choices in the role templates. The web form server resolves each option to the configured session UUID and checks that it belongs to the summit and to the correct day. Store one UUID per day. The proposed first release records preferences. If the school promises seats, the registration transaction must allocate those seats before the form goes live.

## Setup and verification

1. Use the December 2–4 dates from the technical requirements workbook. Confirm Day 3 rooms and capacities, participant quotas, student field rules, priority eligibility, and privacy notice with the school. Confirm whether it already has Google Form responses to transfer.
2. In the CCS Summit draft, create the confirmed roles and sessions. Seed each role template through the admin template endpoint using the keys above as question IDs, omitting the `metadata.` prefix. The mobile builder generates IDs for new questions, so seed the mapped IDs first and review the templates under **Settings → Pre-Reg → Pre-Reg Form Builder**. The web form handles standard identity fields, category selection, and converting choice labels to configured UUIDs or values. [Admin template endpoint](backend/src/routes/eventWorkspaceRoutes.js#L254) and [template contract](multi-event-archive-plan.md#dynamic-pre-registration-forms)
3. Validate required answers, permitted values, Other text, and the privacy response on the web form server. The Student role requires `student_college` for pre-registration and first-time walk-in. A returning participant uses the college from the existing registration. Keep questions that apply only to pre-registration in the pre-registration template and validate them on the web form server. [Registration validation](supabase/migrations/20261122090647_manual_pre_registration.sql#L197) and [walk-in validation](supabase/migrations/20261122090647_manual_pre_registration.sql#L244)
4. Under **Settings → Pre-Reg → Participant Data**, export student counts by college. The report counts pre-registrations, walk-ins, total registrations, unique attendees, and session check-ins. It combines college spellings that differ only by case or spacing and groups missing answers under **Unspecified**. Confirm consistent college names with the school for any abbreviations. The separate day and session choice report is still pending.
5. If responses exist, use the school’s authorized export and match its columns to the field labels above. Reconcile duplicates, missing category mappings, and choices without a session match before importing. If there are no responses, switch the official link after the pilot.

## Generate the four role templates

Run the generator from the repo root with a local JSON config containing `privacyNotice`, `privacyNoticeVersion`, and `sessionIds`. The `sessionIds` object takes the actual summit session UUIDs under `day1Morning`, `day1Afternoon`, `day2Finale`, `day3Syvsis`, `day3CyberSecureU`, and `day3Lesit`.

```powershell
node backend/scripts/ccsSummitRegistrationTemplates.js ./summit-staging-config.json
```

The generator prints the four role templates and a `choiceValues` lookup for the web server. Match each `roleName` to its configured role UUID and send its `template` as the request body to the admin template endpoint. Confirm each configured session UUID belongs to the summit and matches the intended day before seeding.

The web server uses `choiceValues` to convert submitted choices to the stored values and supplies `privacy_notice_version` from the generated `privacyNoticeVersion`. A referral answer of Other maps to `referral_source: other` and an accompanying `referral_source_other` string. The privacy question is single choice. Use the school-approved handling for decline before calling the submission endpoint. The templates describe session choices as preferences.

## Saved summit draft

The event ID is `dd191aad-6220-4683-96e0-c82e051acb9c`. All four role templates and the six registration choices are saved. The shared public form uses the event ID in its URL and keeps the role IDs for loading conditional questions. Pre-registration is closed. The draft uses placeholder notice text and provisional workshop rooms, capacity allocations, and check-in and walk-in times. [Public form integration guide](ccs-summit-public-form-integration.md)

| Public form role | Form ID |
| --- | --- |
| Student | `7ebc334e-cbb8-4864-ae9a-df5547eca39c` |
| CCS Faculty Member | `62f94567-d4a6-475f-869f-9134f19ceebe` |
| Alumni | `ab16c8c5-622a-403a-b581-372837eefefa` |
| Other | `55a51d66-3860-4679-999f-967e6980ddc1` |

| Config key | Session ID |
| --- | --- |
| `day1Morning` | `bde8d1a2-b528-483b-9542-d15fabff3cd5` |
| `day1Afternoon` | `9754bb37-ac85-46ab-8261-3ce97e6c488f` |
| `day2Finale` | `042663dd-87a7-4adf-91a3-21e2b4752a37` |
| `day3Syvsis` | `c289789d-2cbf-47f9-9b03-b9594f6e9f74` |
| `day3CyberSecureU` | `a7a9c8fa-1f40-4ffa-baab-fffbe259d408` |
| `day3Lesit` | `c7a935ee-5282-4e0a-b28b-4b7b4cbf73ca` |

Preview the saved questions in **Settings → Pre-Reg → Pre-Reg Form Builder** by choosing a role. For public testing, the web-form developer can use these IDs to connect the existing ZapRoll API contract. Replace the placeholder notice, configure the test form link and server-side key, and run the submission test before opening public pre-registration.
