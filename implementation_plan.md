# Implementation Plan - Poster Participant QR Clearance

This plan adds a dedicated QR code generation section for Poster Participants (Presenters) in the Admin Screen's Post-Event tab. Poster participants require a specialized "time-out" or clearance scan to be eligible for certificates, as they do not participate in the standard evaluation process.

## User Review Required

> [!IMPORTANT]
> This change introduces a new "Poster Clearance" session type. Ensure that the scanning app or web portal is configured to recognize the `session=poster_clearance` parameter.

## Proposed Changes

### Admin Screen

#### [MODIFY] [AdminScreen.tsx](file:///d:/ZapRoll/frontend/src/screens/AdminScreen.tsx)
- Add state variable `isPosterClearanceOpen` to manage the status of the clearance window.
- Add a new section in the `post-event` tab titled **"Poster Participant Clearance"**.
- This section will include:
    - A toggle to open/close the clearance window.
    - A "Generate Clearance QR" button that navigates to the `QRGenerator` screen.
- The QR code will be configured with:
    - `roleName`: "Poster Clearance"
    - `type`: "poster-clearance"
    - `url`: `${evaluationBaseUrl}?eventId=${eventId}&session=poster_clearance` (if base URL is set).

## Verification Plan

### Manual Verification
- Navigate to the **Admin Screen** -> **Post-Event** tab.
- Verify the new **Poster Participant Clearance** section is visible.
- Toggle the "Accept Clearance Scans" switch and verify UI updates.
- Click **Generate Clearance QR** and verify:
    - It navigates to the `QRGenerator` screen.
    - The QR code contains the correct data/URL.
    - The icon and colors match the theme (suggested: Emerald/Green for clearance).
