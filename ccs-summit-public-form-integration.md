# CCS Summit public pre-registration integration guide

CCS Summit pre-registration uses one student form. Students verify their email, enter their details, and select their academic program. ZapRoll assigns the internal Student category and counts registrations against the existing student quota.

## Load the public form

Use the existing `/forms/{eventId}?type=pre-registration` URL. The CCS Summit event ID is `dd191aad-6220-4683-96e0-c82e051acb9c`. Set the forms server’s ZapRoll API origin and configure the same `ZAPROLL_FORMS_API_KEY` on both servers. Send the key only in server-to-server requests using the `X-ZapRoll-Forms-Key` header.

1. Fetch `GET /api/event-workspace/{eventId}/config?form=pre-registration` on entry. Show the closed state if `data.event.pre_reg_open` is false or the API returns `410`.
2. For CCS Summit, `data.event.student_pre_registration_only` is true. Render the questions directly from `data.form.pages` and omit the participant category picker. Each page contains a title, description, and questions. Use each question’s `id` as its answer key and honor its `required`, `subtype`, `options`, and `hasOther` values. If `data.form` is null, show that registration is unavailable.
3. Collect full name with the surname, first name, and middle name hint, and verify the email address using the forms app’s existing flow. Render `student_program` as an academic program question. The Student role is assigned by ZapRoll.
4. Render all four Day 1, three Day 2, and three Day 3 choices. Store the chosen labels under `day_1_session_preference`, `day_2_session_preference`, and `day_3_session_preference`. The first two are required. Preferences can include activities without a scheduled check-in session.

## Submit from the forms server

Send `POST /api/event-workspace/{eventId}/submissions/pre-registration` with the verified `email`, `full_name`, and the answers in `metadata`. Omit `role_id` for CCS Summit. Validate required fields and allowed choices using the form configuration. Send text from the referral question’s Other option as `metadata.referral_source_other`. Keep the contact and student numbers as strings. Apply the school’s existing handling of a privacy decline.

A first submission returns `201`. A retry for an existing registration returns `200` and its existing registration ID. Show the API’s validation or capacity message for `400` or `409`. A `410` means registration closed after the page was opened.

## Session attendance and student numbers

Use one attendance QR per session. Its public URL is `/forms/{sessionId}?type=attendance`. On that page, fetch `GET /api/event-workspace/forms/{sessionId}?type=attendance` to get the event ID, session title, check-in state, and any optional attendance questions. A draft returns `404`. An archived event or a closed check-in window returns `410`.

Give the participant two paths on the same attendance page:

1. **Pre-registered student.** Ask for the student number used at pre-registration. Send it as a string so leading zeroes survive. The forms server calls `POST /api/event-workspace/{eventId}/submissions/attendance` with the same server-side key as pre-registration. Use the session ID from the form definition.

   ```json
   {
     "session_id": "bde8d1a2-b528-483b-9542-d15fabff3cd5",
     "student_number": "26-0042"
   }
   ```

   ZapRoll matches `metadata.student_number` on an existing **Student** pre-registration in this event. Matching ignores case and spaces and treats ordinary and typographic dashes alike. A student number identifies one participant per event. A successful response includes a check-in ID and timestamp. Show a generic confirmation and keep the matched participant’s name and email private.
2. **Verified email.** Send `session_id` and the verified `email`. An existing pre-registrant uses their saved role and details. For a first-time walk-in, also send `full_name`, `role_id`, and any metadata required by the role once the session allows walk-ins. A first-time Student walk-in supplies `student_college` and `student_number`. Use the verified-email path for faculty, alumni, and other participants. An unmatched student number can be resolved at the event desk or through the verified-email path.

Both paths record one check-in per participant per session and honor the session’s attendance setting and capacity. In ZapRoll, an admin can open or close each session under **Settings → Check-in → Attendance sessions**. A manual setting takes effect immediately on a published event. **Use schedule** restores the saved times. The session’s walk-in time still applies. A form left open in the browser must handle `410` from the submission endpoint when an admin turns attendance off.

A retry while the session is open returns HTTP `200` and the original check-in ID. The first successful check-in returns `201`. An unmatched number returns `404`, a capacity conflict returns `409`, and a closed window returns `410`. Send `answers` only if the form has additional attendance answers to save.

A student number identifies a registration, so use this flow at a staffed venue. Limit repeated attempts at the forms server, avoid logging raw identifiers, and direct failed matches to the event desk. Test a matching student number, a retry, an unmatched number, a closed session, and an existing pre-registrant using email. The student-number path requires the student-number attendance migration and the updated ZapRoll backend.
