# CCS Summit public pre-registration integration guide

Build one public CCS Summit registration page with **Participant category** as a field inside the form. The participant chooses a role, verifies their email, and submits from the same page. The forms server sends the registration to ZapRoll. School admins manage the questions, role quotas, registration window, and reports in ZapRoll.

## Connect the test environments

| Setting | Where | Value |
| --- | --- | --- |
| ZapRoll API origin | Forms server configuration, for example `ZAPROLL_API_BASE_URL` | `http://localhost:3000` if both servers run on the same machine. On the same LAN, use the ZapRoll developer’s reachable LAN address and port `3000`. |
| `ZAPROLL_FORMS_API_KEY` | Both servers’ private environment variables | The same test secret on both servers. Exchange it through a secure channel. Restart the local backend after editing its environment. |
| Shared form URL | ZapRoll admin app under **Config → Pre-Reg → Pre-Registration Link** | Use one event-level URL shaped like `/forms/{eventId}?type=pre-registration`. The path parameter on the public page is the event UUID. |

Check `GET /api/health` **from the machine running the forms server**. For this test, run the forms server alongside ZapRoll or on a machine that can reach it. A Vercel preview’s `localhost` refers to its own environment. Keep the integration key in server-side code and send it only to ZapRoll in `X-ZapRoll-Forms-Key`.

The summit draft has four sets of conditional questions and one shared URL. Registration is closed and the privacy notice is placeholder copy. For a successful submission test, coordinate a **private test event** with the ZapRoll admin, configure its shared test URL, and open the event’s switch under **Config → Pre-Reg → Execution Rules**. Use that test event’s IDs. A draft supports manual pre-registration, so the admin can test without publishing the event. Use the summit draft for reviewing the actual questions and replace its notice with school-approved wording before opening it.

## Load the public form

1. On `/forms/{eventId}?type=pre-registration`, call `GET /api/event-workspace/{eventId}/config?form=pre-registration`. On `200`, check `data.event.pre_reg_open`. If false, show “Pre-registration is closed.” If true, populate the required **Participant category** field from `data.roles`, using each role’s `id` and `name`. Use fresh configuration for every visit. A `410` also means registration is closed.
2. When the participant selects a category, call `GET /api/event-workspace/forms/{roleId}?type=pre-registration` and render `data.pages` inside the same form. Keep the event URL and use the selected role UUID only for template reads and submissions. If the participant changes category, preserve identity fields and discard answers specific to the previous category. Each page contains `title`, `description`, and `questions`. Render the question’s `label`, `type`, `required`, and any `subtype`, `options`, or `hasOther` settings. A `header` is display text. Use `question.id` as the answer key and check `data.requiredFields` before submitting. Both GET routes are public.
3. Verify that the returned `data.eventId` and `data.roleId` match the selected event and role. A template GET returns `404` if the role template or saved role URL is missing, and `410` when a configured form is closed. Collect full name and email separately from the template questions. Verify email ownership with the forms app’s existing email verification flow and use the verified address from the server-side session.

The single **Student** role covers all colleges and programs. Require `student_college` for Students. Use the school’s consistent college names where available so reports can group the answers. Capture `participant_category_other` only when the role is **Other**.

## Submit from the forms server

Use:

```http
POST /api/event-workspace/{eventId}/submissions/pre-registration
Content-Type: application/json
X-ZapRoll-Forms-Key: <server-side test secret>
```

Validate the template’s required fields and allowed choices on the forms server, including conditional Other fields and the school’s approved handling of a privacy decline. Send the saved notice version from server configuration. Resolve session choices against the approved sessions for that event and day. Store UUID values under the `day_*_session_id` keys and omit unanswered optional fields. Session selections indicate attendance preferences.

Example payload for the **CCS Summit draft**. Substitute the IDs and verified email of your private test event for a real test.

```json
{
  "email": "verified-test@example.org",
  "full_name": "Test, Ana Maria",
  "role_id": "7ebc334e-cbb8-4864-ae9a-df5547eca39c",
  "metadata": {
    "student_college": "College of Computer Studies",
    "year_and_section": "SBIT-1A",
    "student_number": "26-0000",
    "day_1_session_id": "bde8d1a2-b528-483b-9542-d15fabff3cd5",
    "day_2_session_id": "042663dd-87a7-4adf-91a3-21e2b4752a37",
    "referral_source": "social_media",
    "privacy_acknowledgment": "agree",
    "privacy_notice_version": "<approved notice version>"
  }
}
```

Other referral values are `friends_classmates`, `faculty`, `student_organizations`, and `other`. If the participant chooses `other`, add `referral_source_other`. Use `agree` or `decline` for the acknowledgment and apply the approved decline policy before submitting. Keep contact and student numbers as strings.

| HTTP status | Forms behavior |
| --- | --- |
| `201` | Show confirmation. ZapRoll returns `data.registration_id` and `data.created: true`. |
| `200` | Show an existing-registration confirmation using the returned registration ID. A retry reuses the original saved record. |
| `400` | Show validation feedback and let the participant correct their answers. |
| `409` | Show the returned reason, such as a full role quota. |
| `410` | Show “Pre-registration is closed.” This also applies to a form left open before the admin closed the switch. |
| `401` or `503` | Show a temporary service error and check the server-to-server key and backend configuration. |

## CCS Summit IDs

The summit page uses event ID `dd191aad-6220-4683-96e0-c82e051acb9c` and the shared URL below.

```text
https://synergy-zaproll.vercel.app/forms/dd191aad-6220-4683-96e0-c82e051acb9c?type=pre-registration
```

| Role | Form and role ID |
| --- | --- |
| Student | `7ebc334e-cbb8-4864-ae9a-df5547eca39c` |
| CCS Faculty Member | `62f94567-d4a6-475f-869f-9134f19ceebe` |
| Alumni | `ab16c8c5-622a-403a-b581-372837eefefa` |
| Other | `55a51d66-3860-4679-999f-967e6980ddc1` |

| Answer key | Display choice | Stored session UUID |
| --- | --- | --- |
| `day_1_session_id` | CCS Summit Opening morning | `bde8d1a2-b528-483b-9542-d15fabff3cd5` |
| `day_1_session_id` | CCS Summit Opening afternoon | `9754bb37-ac85-46ab-8261-3ce97e6c488f` |
| `day_2_session_id` | Final presentations, recognition and synthesis | `042663dd-87a7-4adf-91a3-21e2b4752a37` |
| `day_3_session_id` | SYVSIS | `c289789d-2cbf-47f9-9b03-b9594f6e9f74` |
| `day_3_session_id` | CyberSecureU | `a7a9c8fa-1f40-4ffa-baab-fffbe259d408` |
| `day_3_session_id` | LESIT | `c7a935ee-5282-4e0a-b28b-4b7b4cbf73ca` |

## Test before generating the official QR

1. Open the private test event from a phone browser. Confirm **Participant category** appears inside the form. Select Student, then Faculty, then Other. Verify that student fields appear only for Student, Other asks for a description, and the URL stays the same throughout.
2. Submit a Student registration, then retry using the same verified email. Confirm `201` followed by `200`, one registration ID, one participant record, and the expected college in the ZapRoll export.
3. Close pre-registration in ZapRoll while a form is open. Verify that a fresh page shows the closed state and that the stale form’s submission returns `410`.
4. Scan the shared QR from **Config → Pre-Reg → Pre-Registration Link**. Check that it opens the summit form and shows the category field before distribution.
