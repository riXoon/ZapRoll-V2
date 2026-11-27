# ZapRoll Event Archive and Multi-Event Plan

**Draft for Quezon City University turnover review · 22 November 2026**

Keep Synergy as a read-only event in ZapRoll, with its existing event ID and historical records. Give school admins an event picker, a **New event** workflow, and an archive they can browse and export. Use a separate, school-controlled database backup for disaster recovery.

The first implementation phase prioritizes preserving Synergy and delivering the new event workflows. Keep the existing admin sign-in and account creation flow for this phase. Make event scoping and archive write protection part of the feature, since both clients share the same data.

## What the current code does

- `POST /events` updates the first existing event when one already exists. The edit path can also delete omitted quotas. Reusing either behavior for **New event** could change the historical record, including the quota attached to a registration. [Event controller](backend/src/controllers/eventController.js) · [Event model](backend/src/models/eventModel.js) · [Schema](supabase/schema.sql)
- Events have one date and venue. The attendance migration consolidates scans into one participant row per event with fixed columns for AM, PM, and employee attendance. Poster clearance and evaluation behavior add further Synergy-specific rules. [Attendance migration](supabase/migrations/20260510092830_refactor_attendance_schema.sql) · [Poster clearance migration](supabase/migrations/20260517002500_poster_clearance_columns.sql)
- Some app screens select the first event or share a cache key across events. QR generation includes a hard-coded Synergy ID in one fallback. Some evaluation endpoints are public. The historical access rules must cover mobile, API, public forms, and any external scanner or registration page. [Home screen](frontend/src/screens/HomeScreen.tsx) · [QR generator](frontend/src/screens/QRGeneratorScreen.tsx) · [API routes](backend/src/routes/eventRoutes.js)
- The repo includes a migration that grants broad access to authenticated accounts, and the API creates a server-side Supabase client with a service key. Confirm the deployed policies and enforce school/event permissions in the API and at any direct database access paths. [Shared admin policies](supabase/migrations/20260517164520_share_admin_data.sql) · [Supabase server client](backend/src/config/supabase.js)

## Admin workflow

1. **Events** shows active events and drafts, with a separate archived view. The event name stays visible while the admin views registrations, generates QR codes, and exports reports.
2. **New event** creates a new draft with a unique ID and empty participant data. The admin enters the event name, timezone, dates, venues, and sessions, then enables the required workflows. Saving a draft leaves the previous event available. The recommended workflow allows planning the next event while the current one is still running.
3. **Publish event** validates the schedule, capacities, and registration settings, then enables configured public links and attendance workflows. Multiple events can accept registrations and check-ins at the same time. The server resolves each QR to its event and session. Changing the selected event in the app cannot change the destination of an existing link.
4. **Close and archive** shows the event name, open registration or evaluation windows, and record totals. The server closes writes and records who archived it and when. Archived links show a clear closed message. Authorized staff can still open reports and export Synergy. The first release treats the archive as read-only. If school policy requires historical corrections, define a separately authorized, audited workflow.

## Event configuration and data

| Area | Proposed design |
| --- | --- |
| Schedule and venue capacity | One event with one or more dated days, multiple reusable venues, and sessions scheduled at a venue on a day. Allow simultaneous sessions at different venues. The admin sets each venue's capacity and eligible participant categories, such as students, faculty, employees, and guests, with editable capacity for each role. A session inherits the venue settings and can set lower limits or redistribute role allocations within the venue limit. For example, a 330-place session can allocate 300 to students, 20 to faculty, and 10 to guests. Block overlapping sessions in the same venue unless physical subdivisions are configured as separate venues. |
| Pre-registration | One registration per participant for the whole event, typically opening one or two days before the first event day. Admins configure the actual opening and closing times, participant fields, categories, and quotas. Pre-registration establishes priority eligibility for the event. Attendance is recorded separately on each event day. |
| Attendance | One check-in record per registered participant and session, submitted through the separate attendance web form. A session identifies the event, day, venue, and time. Participants reuse their event registration across eligible sessions. Staff visually confirm the resulting email at the venue. The mobile app is for the admin. Enforce uniqueness and same-event relationships in Postgres. |
| Walk-ins and reserved places | Each session has its own walk-in opening time. Every venue's sessions retain protected places for pre-registered students after walk-ins open. The admin enters an editable fixed count per session within the student allocation. The proposed default keeps those places protected until the session closes. Walk-ins can take only remaining unreserved places. A first-time walk-in gets one event registration and a separate session check-in in one transaction. Reuse their registration on later days without changing their original registration category to pre-registered. |
| Feedback and existing rules | Admins can attach optional feedback forms to selected venue sessions, commonly presentations or seminars. Competition sessions or other activities can run without a form. Feedback submissions link to the correct event and session, and skipping feedback leaves the check-in recorded. Preserve Synergy's existing evaluations, clearance, certificate rules, and reports. |
| Reporting | Filter attendance by event, day, venue, and session. Count unique people and session check-ins separately so a participant attending two sessions does not inflate event turnout. Keep Synergy's historical exports and eligibility results reconcilable. |
| Authorization | The current admin can view and export all participant records for Synergy and future events. Maintain those permissions through a school-admin role during turnover. Venue staff visually confirm emails and need no app account or participant roster. Validate IDs and permissions on each request. Scope local caches by school or account and event, and replace first-event defaults with explicit selection. Index the event and session filters used for reports and permission checks. |

The recommended design keeps current and archived events in the same school-managed Postgres database. Moving Synergy to another database would require a second reporting and permissions path and could break historical links. Revisit physical separation only if the school requires a distinct retention or access boundary.

Admins can increase or decrease venue limits, session limits, role allocations, and protected counts for active events. Show current check-ins before saving. Reject changes that would put existing check-ins above a new limit, exceed the venue cap, or leave fewer student places than the number of protected seats still owed. Preview which future sessions inherit a venue-level change. Apply capacity edits and admissions transactionally so a concurrent check-in uses a consistent set of limits. Keep an audit record of who changed the limits and when.

## Separate web forms and QR links

- **Confirmed integration.** ZapRoll and the external web forms developed by the co-developer already use one database. The forms can load configuration and send submissions to the backend, as they did for Synergy. Agree on event and session identifiers, published configuration fields, submission validation, and closed or archived responses before either client switches to the new contract. Inventory any direct database writes and cover them with the same archive and event-scoping rules.
- **ZapRoll configures the event.** The admin sets categories, form fields, venues, windows, and the external URLs for pre-registration, attendance, and optional feedback. The separate web forms load the published public configuration from the backend. The backend validates submissions against the current schedule, eligibility, and capacity and stores the authoritative records. Authenticate integrations where needed and keep internal settings, participant lists, and credentials out of public responses.
- **Keep the current QR workflow.** Today AdminScreen can add a quota ID to a supplied registration URL and supply a session-specific evaluation URL or build one from a saved base URL. QRGenerator encodes the resulting URL. Keep the admin-entered destination and preview the final link before generating the QR. Append only the event, session, or category context that the external form needs, preserving existing query parameters and link fragments. Treat these identifiers as context and validate them on the server. Archived or closed links show the appropriate state even if a printed QR is still in circulation. [Admin screen](frontend/src/screens/AdminScreen.tsx) · [QR generator](frontend/src/screens/QRGeneratorScreen.tsx)
- **Proposed participant identifier.** Accept any valid email address. Recommend the QCU naming format `lastname.firstname.middlename@gmail.com` as a form hint. Match the participant's verified email to one registration per event. A private, short-lived link or code sent to that email proves access, and the same verified browser session can be reused across venues where practical. The email and its naming format cannot establish the participant's role. Use the event's role eligibility rules separately. An internal registration ID links records.
- **Door workflow using Nodemailer.** After the backend saves an accepted check-in, use the existing Nodemailer setup to send the participant's display name, event, session, day, venue, timestamp, and a short reference. Show the receipt status on the web page while delivery is pending. Staff check the participant's confirmation email at the door. Delivery retries and repeat submissions reuse the same check-in. If an email is delayed or disputed, the admin can look up the reference and resend it. A visual email check leaves no staff verification record and cannot prove a forwarded receipt belongs to the person presenting it.

## Draft QCU retention and handover

QCU's published notice refers to the National Archives of the Philippines Act of 2007 and says it retains information as necessary. It lists `dataprivacy@qcu.edu.ph` as its Data Privacy Officer contact. The National Privacy Commission's implementing rules tie retention to purpose and call for secure disposal. These sources do not specify a retention period for ZapRoll's event records. [QCU Data Privacy Notice](https://qcu.edu.ph/data-privacy-notice/) · [NPC implementing rules, section 19](https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/)

Ask QCU to confirm the applicable records schedule and approve the privacy notice on each public form, access to archives and exports, retention for form-provider copies and backups, and eventual disposal or anonymization. Keep this section in draft and leave automatic deletion out until QCU confirms the schedule. Include the public forms and confirmation sender in the school handover.

## Backup, migration, and rollout

1. **Inventory the live data and integrations.** Confirm the deployed schema and policies against the repo. Identify Synergy's canonical event ID, participants, quotas, attendance and clearance records, evaluation templates and responses, certificates, reporting views, and public consumers. Confirm whether any files or form responses live in Supabase Storage or an external system. Capture baseline counts, representative exports, and certificate eligibility totals without copying participant data into the repo.
2. **Take and prove a backup.** ZapRoll uses Supabase Free, so take a dated manual database backup before production changes. The project owner runs the Supabase CLI dump for roles, schema, and data through a PostgreSQL connection from the Dashboard's **Connect** dialog. Store the encrypted recovery copy under school control outside the repo. Verify the restore in an isolated environment with restricted access and outbound integrations disabled. Back up Storage objects separately if used. Record the restore point, retention, coverage, and recovery owner. An admin report export can support handover and reconciliation. Full recovery uses the database backup. [Supabase Free backups](https://supabase.com/kb/faqs/platform/free-plan-backups) · [Supabase CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
3. **Protect Synergy and add the new model in staging.** Rehearse against the restored database before changing production. Add lifecycle status and audit fields, event days and venues, session IDs, and session-level attendance while keeping the legacy records. Keep Synergy's original ID. Backfill its existing date, venue, and identifiable session scans only where the mapping is proven, with original timestamps and registration links. Keep its historical read/export path if a rule has no exact new equivalent. Make backfill resumable. Stop before production cutover if counts, scan fields, evaluations, or eligibility do not reconcile.
4. **Deliver event creation, selection, and archiving.** Introduce a create contract that always inserts a fresh draft and supports safe retry. Prevent edits through the old create endpoint and guard older mobile and public clients against writes to Synergy at cutover. Enforce archive state in server-side transactions and database write paths, including background deadline jobs. Archive and a concurrent scan must resolve consistently. Replace hard deletion with archiving in the school admin workflow.
5. **Deliver the next event's schedule and pilot.** Configure three days with multiple venues per day and overlapping sessions across venues. Connect event-wide pre-registration and session-specific check-in, QR generation, feedback, and reporting. Configure priority and walk-in windows and test the transition with sample participants on Android Expo Go and the actual public registration and scanner consumers. Pilot with school staff before opening live registration.
6. **Cut over and hand over.** Briefly freeze Synergy writes after final reconciliation, confirm a current recoverable backup, and archive Synergy. Give the school ownership of the repo, deployed services, backup access, and admin accounts, plus a walkthrough for creating, running, archiving, and exporting an event. Agree on who handles support, retention, recovery, and credentials. If the pilot fails, pause new-event publishing and keep archive access available. Recover into an isolated project first and reconcile any new registrations before considering a production restore.

## Acceptance criteria

- Synergy remains accessible with the original event ID. Historical registration, attendance, evaluation, and eligibility totals reconcile with the baseline, and representative PDF/Excel exports match.
- Creating and retrying a new draft produces one new event with empty participant data and leaves Synergy's records intact.
- An admin can publish a three-day event with two or more venues per day, run simultaneous sessions in different venues, and see each check-in in the correct report. The same participant can attend multiple eligible sessions, with one check-in per session after retries.
- A student who pre-registers once can check in across all three days. Before a session's walk-in opening, an unregistered attendee is ineligible. After opening, walk-ins can fill only unreserved capacity. Test the last walk-in place under concurrent submissions and verify that an eligible pre-registered student can still take a protected place.
- An admin can change a live session's role allocations and fixed protected count. Test an increase, a decrease with room remaining, and a decrease below existing check-ins while another attendee submits the form.
- A participant can use an email address outside the recommended format and still receive the Nodemailer confirmation. An email delivery failure leaves the check-in counted once and allows the admin to resend it.
- An admin-entered QR URL reaches the correct external form with existing query parameters preserved. The form uses the published configuration for that event or session. Repeated attendance submissions or email retries produce one check-in, and the confirmation shows the correct venue and session.
- A seminar can offer feedback after check-in while a competition runs without a form. Skipping feedback leaves attendance intact, and submitted feedback appears under the correct session.
- Two live events can accept registrations and check-ins simultaneously. The current admin can view and export each event's participant records independently, including Synergy.
- A scan, old link, or stale client cannot write to archived Synergy or attach a participant from another event. An authorized admin can still view and export Synergy. Public users and venue staff cannot browse participant records or download exports.
- A school admin can complete a create-to-archive dry run from the handover guide. The school technical owner can locate and restore the backup in an isolated environment.

## Backup status

On 22 November 2026 at 14:16 Singapore time, ZapRoll's production database was exported over a verified TLS connection. The local encrypted copy contains the database schema and data plus PostgreSQL role definitions without passwords. Decryption and full archive decoding passed. The encryption key is protected by the current Windows account. An isolated restore, record reconciliation, any separate Storage backup, and transfer to school-controlled recovery storage remain pending. Production schema and records were left intact.

## Details to confirm before implementation

The team confirmed that ZapRoll and the web-form co-developer will coordinate the shared backend contract and rollout. The existing admin-account creation and sign-in flow is sufficient for this phase. Improvements to that flow are deferred, and the QCU retention and formal handover decisions remain in draft.

Set the next event's dates and choose which sessions need feedback as part of event setup.

## Web-form integration contract

The new backend paths are under `/api/event-workspace`. Existing Synergy form routes keep their legacy contract until an admin archives Synergy.

| Use | Contract |
| --- | --- |
| Load configuration | `GET /api/event-workspace/{eventId}/config` returns the published event, roles, venues, and sessions. Drafts return 404 and archived events return 410. Public config contains no participant records. |
| Pre-registration | `POST /api/event-workspace/{eventId}/submissions/pre-registration` accepts `email`, `full_name`, `role_id`, and a `metadata` object holding required form fields. |
| Attendance | `POST /api/event-workspace/{eventId}/submissions/attendance` accepts `email` and `session_id`. For first-time walk-ins, include `full_name`, `role_id`, and any required fields in `metadata`. Returns the stable check-in ID, timestamp, display name, event, venue, and session details for the Nodemailer receipt. |
| Feedback | `POST /api/event-workspace/{eventId}/submissions/feedback` accepts `email`, `session_id`, and an `answers` object. The session needs a feedback URL and the participant needs a check-in. |

#### Dynamic evaluation forms

Set `ZAPROLL_WEBFORM_BASE_URL` on the ZapRoll backend to the web app's form collection URL, for example `https://forms.example.edu/forms`. The web app needs a route for `/forms/{formId}`. Saving an evaluation template stores its questions and the generated feedback link together. When the setting is enabled, saving updates that session's feedback link to `{baseUrl}/{sessionId}?type=evaluation`. The session UUID is the form ID, so subsequent edits use the same URL. Without the setting, saving the template preserves the session's existing feedback link.

The web server reads the type and ID from the participant URL and requests `GET /api/event-workspace/forms/{formId}?type=evaluation` from ZapRoll. The response's `data` contains `id`, `type`, `eventId`, `sessionId`, `eventName`, `sessionTitle`, `title`, and `pages`. Render pages and questions in order and use each question's ID as its answer key. The endpoint returns 404 for a missing form, a draft event, or an unsupported type, and 410 for an archived event. It returns the latest saved template for an active event with a feedback link.

Send feedback through the existing submissions endpoint from the web server with the verified participant email and the IDs from the template response. Keep `X-ZapRoll-Forms-Key` on the web server. The template read endpoint requires no key and returns only the form definition and its event and session context.

#### Dynamic pre-registration forms

In Config → Pre-Reg → Pre-Reg Form Builder, tap **Design Pre-Registration Form** and choose a participant role. Save stores the template and, when the webform base URL is configured, updates the role's link to `{baseUrl}/{roleId}?type=pre-registration`. This uses the role UUID as the stable form ID. Reopen the same role to edit its template.

The web app uses `GET /api/event-workspace/forms/{formId}?type=pre-registration`. The response includes `type`, `eventId`, `roleId`, `eventName`, `roleName`, `title`, `pages`, and `requiredFields`. A closed registration window returns HTTP 410, including for an archived event. Manual opening can make a draft event's pre-registration form available.

Collect the standard participant name and verified email separately, validate form answers on the web server, and use question IDs as metadata keys. Honor any additional role-level `requiredFields` when building the metadata. Send `email`, `full_name`, `role_id`, and `metadata` to `POST /api/event-workspace/{eventId}/submissions/pre-registration` using the existing server-side forms key. The submission API continues to enforce its registration window, role quota, and duplicate rules.

#### Dynamic attendance forms

In Config → Registration → Attendance Form Builder, tap **Design Attendance Form** and select a session. Sessions can be saved in Setup with a blank attendance link. Saving the template generates `{baseUrl}/{sessionId}?type=attendance` when the webform base URL is configured and updates that session's attendance link. Attendance and feedback have separate templates even when their URLs use the same session ID.

The web app loads the definition from `GET /api/event-workspace/forms/{formId}?type=attendance`. It returns the same event and session context and `pages` as evaluation, plus `walkinsOpenAt`. The event must be published. Requests outside the check-in window or for an archived event return HTTP 410.

Submit with the existing server-side forms key to `POST /api/event-workspace/{eventId}/submissions/attendance`. Pass the verified `email`, `session_id`, and an `answers` object keyed by question ID. For walk-ins, also pass `full_name`, `role_id`, and any required role metadata. Validate answers on the web server. ZapRoll saves answers with the check-in and preserves the original answers if the same check-in is retried.

The form server verifies email ownership before calling the submission endpoints. Configure `ZAPROLL_FORMS_API_KEY` as a server-side secret on both backends and send it in `X-ZapRoll-Forms-Key`. Participant browsers call the form server. Use the stable check-in ID to deduplicate Nodemailer confirmations. Keep email delivery and resend handling with the form's existing Nodemailer workflow. A failed email delivery leaves attendance saved and can retry independently.

Use the generated QR payload's `eventId` and, when present, `roleId` or `sessionId` to load the relevant configuration. The endpoints validate those IDs and use the registration's stored role at check-in. Show a clear closed message on HTTP 410 and the returned reason on HTTP 409, including reserved-only or full sessions.

## Implementation checkpoint

- The **Events** tab lists and selects events. **New Event** collects a name and date and opens the existing Event Settings screen on **Pre-Reg**. **Home**, **Config**, and **Analytics** follow the selected event. Pre-Reg holds registration setup and participant records, Registration holds venues and session settings, and Post-Event holds feedback setup and reports. The selection is remembered per admin and Supabase project. The existing Synergy screens remain available for its participant, evaluation, and clearance reports.
- The additive migration preserves existing event IDs and tables. New session and participant records have their own tables. Archive guards cover the known legacy and new write paths. The migration was verified against a synthetic PostgreSQL fixture informed by the schema in the encrypted production backup. The archive itself remains unmodified.
- Local checks exercised required form fields, retry-safe registration and check-in, priority windows, reserved places, capacity decreases, optional feedback, and read-only archives. Two simultaneous submissions for one remaining place created exactly one participant and check-in. Mock HTTP tests exercised the public configuration, QR query preservation, and authenticated form submissions.
- Before production publication, coordinate the new form contract and Nodemailer receipt deduplication with the co-developer. Rehearse the actual Synergy restore and compare historical records and reports. Apply the additive migration before deploying the new backend and app, and confirm the old web forms still work before enabling a new event. Then test the new web forms and Android app together. No production migration or archive action was run.

### Manual pre-registration for scheduled events

In Pre-Reg → Execution Rules, the switch saves immediately for the selected event. Opening requires a saved role with positive capacity and a form link. It works during draft setup. Once switched, the admin controls opening and closing manually. Existing scheduled events continue following their saved registration window until the first manual change.

The external pre-registration form should fetch `GET /api/event-workspace/:id/config?form=pre-registration` on entry. Read `data.event.pre_reg_open`. When false, show “Pre-registration is closed at the moment.” When true, render the returned roles. Handle HTTP 410 from submissions with the same closed message, including when someone opened the form before the admin closed it. An archived event also returns HTTP 410 on configuration. Attendance and feedback keep their existing publication and session rules.

Apply the manual pre-registration migration before releasing the backend and mobile changes.
