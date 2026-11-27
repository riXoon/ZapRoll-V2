# CCS Summit attendance form integration guide

**CCS Summit uses central student check-in.** Use the event QR in **Settings → Check-in → Central student check-in**. The backend serves the student-number page, resolves the current day's selected session, and records the check-in. See the [Summit integration guide](ccs-summit-public-form-integration.md#session-attendance-and-student-numbers).

The session-link instructions below apply to other scheduled events that use custom attendance forms.

Build one web form at `/forms/{sessionId}?type=attendance` and use a separate QR for each session. The UUID in the path is the ZapRoll session ID. Load the session title and saved questions from the ZapRoll API on each visit so admins can update the form and schedule from ZapRoll. The forms server sends check-ins to ZapRoll, which applies attendance hours, capacity, and duplicate handling.

## Connect the forms server

| Setting | Value |
| --- | --- |
| `ZAPROLL_API_BASE_URL` | ZapRoll backend origin in the forms server’s environment. Use `http://localhost:3000` when both servers run on the same machine. A hosted forms server needs a reachable HTTPS backend. |
| `ZAPROLL_FORMS_API_KEY` | The same integration secret in both servers’ private environments. Send it from the forms server in `X-ZapRoll-Forms-Key` on submission requests. The public GETs need no key. |
| `ZAPROLL_WEBFORM_BASE_URL` | Set on the ZapRoll backend to the HTTPS forms base, for example `https://synergy-zaproll.vercel.app/forms`. ZapRoll uses it to generate the session URL when an admin saves the attendance template. |

Check `GET /api/health` from the forms server. The ZapRoll API reads Supabase and keeps database credentials in the ZapRoll backend. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)

## Load the questions for a scanned QR

Call `GET /api/event-workspace/forms/{sessionId}?type=attendance` using the path UUID. ZapRoll returns `Cache-Control: no-store`. Fetch fresh on every visit and disable static generation or fetch caching for this page. ZapRoll-generated QR links may also include `eventId` and `sessionId` query parameters. Use the form response for the authoritative event and session IDs and verify the returned `sessionId` matches the path.

Run these from the forms server in PowerShell using your test session UUID and configured ZapRoll origin. The second request loads the event’s schedule and roles.

```powershell
$workspaceApi = "$($env:ZAPROLL_API_BASE_URL.TrimEnd('/'))/api/event-workspace"
$sessionId = '<published test session UUID>'
$form = (Invoke-RestMethod "$workspaceApi/forms/${sessionId}?type=attendance").data
$config = (Invoke-RestMethod "$workspaceApi/$($form.eventId)/config").data
$form.pages
$config.sessions
```

Example `200` response for a session with one extra question. The question and walk-in time are illustrative.

```json
{
  "data": {
    "id": "bde8d1a2-b528-483b-9542-d15fabff3cd5",
    "type": "attendance",
    "eventId": "dd191aad-6220-4683-96e0-c82e051acb9c",
    "sessionId": "bde8d1a2-b528-483b-9542-d15fabff3cd5",
    "eventName": "CCS Summit 2026",
    "sessionTitle": "CCS Summit Opening Morning Session",
    "title": "Session attendance",
    "pages": [
      {
        "id": "page_checkin",
        "title": "Check in",
        "description": "",
        "questions": [
          {
            "id": "section",
            "type": "text",
            "label": "Class section",
            "required": false,
            "subtype": "short",
            "statements": []
          }
        ]
      }
    ],
    "walkinsOpenAt": "2026-12-02T00:15:00Z"
  }
}
```

Render `sessionTitle`, the template `title`, then each page’s `title`, `description`, and `questions` in order. Use the question `id` as the answer key. Render `header` as display text. Use `subtype` for text, `options` and `hasOther` for choice, and `statements` and `likertScaleType` for Likert. The builder also supports `rating`, `privacy`, and `signature`. Reuse the forms app’s renderer for the saved question types. A page with an empty `questions` array can still collect check-in identity. Validate required answers and choice values on the forms server against the saved template. ZapRoll checks that `answers` is an object and saves it on the first successful check-in. [Template builder](frontend/src/screens/EvaluationFormScreen.tsx#L42) · [Attendance answers migration](supabase/migrations/20261122152521_session_attendance_templates.sql)

| GET result | Web page behavior |
| --- | --- |
| `200` | Render the saved form. This status indicates check-in is open at the time of the read. |
| `404` | Show that the attendance form is unavailable. Check the session UUID, publication state, saved template, and saved attendance URL. |
| `410` | Show that session check-in is closed. Offer a refresh for participants who arrived early. |
| `5xx` or network failure | Show a temporary error and let the participant retry loading. |

## Load a session list or show schedule details

Call `GET /api/event-workspace/{eventId}/config` if you need an event-wide session list, venue and time details, or role choices for walk-ins. Use the `eventId` from the form response for the scanned session, or a known event UUID for an event-wide page. Use the URL without a `form` query parameter to get the full configuration.

| Response field | How to use it |
| --- | --- |
| `data.sessions` | Ordered by `starts_at`. Use `id` for keys and links, `title` for display, and `attendance_url` for a configured link. Find the scanned session by matching `id` to `data.sessionId` from the form response. |
| `data.venues` | Match `session.venue_id` to `venue.id` to display `venue.name`. |
| `data.event.timezone` | Format `starts_at` and `ends_at` with this time zone. Use it when grouping sessions by day. |
| `data.roles` | Use `id`, `name`, and `required_fields` for walk-in role choices and metadata. The general configuration returns the event’s roles. |

The session list includes closed and unconfigured sessions. A saved `attendance_url` means there is a link. Use the per-session form GET to decide whether the public page can accept check-ins. The public config returns `404` for a draft and `410` for an archived event. [Public configuration and form routes](backend/src/routes/eventWorkspaceRoutes.js#L162)

## Submit attendance from the forms server

Send `POST /api/event-workspace/{eventId}/submissions/attendance` with `Content-Type: application/json` and `X-ZapRoll-Forms-Key`. Use the event and session IDs from the published form definition. Keep the verified email in the forms app’s server-side verification session. When the browser submits the page, validate its answers and use the verified address from that session.

**Pre-registered student.** Send the student number as a string to preserve leading zeros. ZapRoll matches it to a Student pre-registration for this event, ignoring case and spaces and normalizing dashes. This path takes `student_number` by itself as identity. Use a generic confirmation and direct unmatched students to the event desk or verified-email flow.

```json
{
  "session_id": "bde8d1a2-b528-483b-9542-d15fabff3cd5",
  "student_number": "26-0042",
  "answers": { "section": "SBIT-1A" }
}
```

**Verified email.** Send `session_id` and `email` for an existing registrant. ZapRoll uses their saved role and details. For a first-time walk-in, also collect `full_name`, a `role_id` from the same event, and role-required `metadata`. A summit Student walk-in supplies `student_college` and `student_number` inside `metadata`. Display `walkinsOpenAt` when relevant and allow existing pre-registrants to use verified email during the regular check-in window.

```json
{
  "session_id": "bde8d1a2-b528-483b-9542-d15fabff3cd5",
  "email": "verified-test@example.org"
}
```

Either path can include an `answers` object keyed by question ID. Omit it when there are no answers to save. Show success for `201` and `200` using `data.checkin_id` and `data.checked_in_at` if the page needs a receipt. A `200` reuses the existing check-in and its original answers. Keep student numbers out of URLs and request logs, and limit repeated attempts at the forms server for the staffed student-number check-in flow.

| POST result | Web page behavior |
| --- | --- |
| `400` | Ask the participant to correct the invalid or missing fields. |
| `404` | For an unmatched student number, show the event desk or verified-email option. A session missing from the specified event also returns `404`. |
| `409` | Show the applicable reason from `message`, such as walk-ins opening later or role capacity being full. |
| `410` | Show that check-in is closed. Handle this even if the page loaded successfully earlier. |
| `401` or `503` | Show a temporary error and check the integration key and backend configuration. |

ZapRoll evaluates admission when it processes the submission. In **Settings → Check-in → Attendance sessions**, the admin switch can force a published session open or closed. **Use schedule** restores the window from `checkin_opens_at` through, but excluding, `ends_at`. Opening attendance manually still leaves the separate walk-in time and capacity rules in effect. [Attendance rules and override](supabase/migrations/20261127131148_session_attendance_switch.sql)

## Set up a test session

1. Use a test ZapRoll backend with the attendance-template, student-number, and attendance-switch migrations applied. Create a scheduled test event with a session and the roles you want to test. Save its template under **Settings → Check-in → Attendance Form Builder** and confirm its generated attendance URL. Publish the test event and open attendance for the session.
2. Scan the QR on a phone. Confirm the event, session, and question text match ZapRoll. Edit a question label in ZapRoll and refresh the same URL to verify the update. If you built a session list, verify a newly added session appears on refresh and is grouped by the event’s time zone.
3. Submit with a test Student pre-registration number. Retry and verify `201` followed by `200` with the same check-in ID and one attendance record. Try an unmatched number, verified email for an existing registrant, and a first-time walk-in before and after `walkinsOpenAt`.
4. Close attendance while a participant page is open. Verify a fresh load and a stale submission both show the closed state. Restore **Use schedule** and verify the session follows its saved times.

The summit’s event UUID and session UUIDs are in the [CCS Summit registration field mapping](ccs-summit-registration-mapping.md#saved-summit-draft). ZapRoll stores the schedule and template in `event_schedule`, venue names in `event_venues`, and check-ins and their answers in `event_checkins`. [Scheduled event schema](supabase/migrations/20261122064540_multi_event_workspace.sql) · [Attendance template schema](supabase/migrations/20261122152521_session_attendance_templates.sql)
