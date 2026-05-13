# Walkthrough - Poster Participant QR Clearance

I have implemented the "Poster Participant Clearance" section in the Admin Portal. This feature allows administrators to manage the final clearance for poster presenters who do not require a standard evaluation.

## Changes Made

### Admin Portal
- **New Section**: Added "Poster Clearance" card in the **Post-Event** tab.
- **Session Control**: Integrated a toggle switch to enable/disable "Poster Clearance" scans.
- **QR Generation**: Added a button to generate a clearance-specific QR code.
- **State Sync**: Configured the UI to sync the clearance status with the database via the `poster-clearance` session type.

## How to Use

1.  Navigate to the **Admin Screen** and select the **Post-Event** tab.
2.  Scroll down to find the **Poster Clearance** section.
3.  Toggle **Accept Clearance Scans** to "OPEN" when ready.
4.  Ensure your **Evaluation Base URL** is configured in the "Web Integration" section.
5.  Tap **Generate Clearance QR** to show the QR code to participants.
6.  When scanned, participants will be directed to the clearance landing page (configured via your base URL).

## Verification Results

- ✅ **UI Integrity**: The new card matches the premium "glassmorphism" aesthetic of the existing dashboard.
- ✅ **Navigation**: The QR generation button correctly navigates to the QR preview screen with specialized metadata.
- ✅ **Sync Logic**: Status updates are sent to the backend using the standard session management endpoints.
