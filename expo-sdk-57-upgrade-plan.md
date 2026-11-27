# ZapRoll Expo SDK 57 Upgrade Plan

**Approved for implementation · 22 November 2026**

ZapRoll can be migrated from Expo SDK 52 to SDK 57. The stable SDK 57 track currently points to `expo@57.0.33`, with React Native 0.86.3 and React 19.2.3 in Expo's SDK 57 compatibility map. Pin that Expo patch for the first candidate, recheck the stable tag when implementation starts, and commit the resolved npm lockfile. Release readiness depends on passing the Android and iOS checks below. [Expo npm versions](https://www.npmjs.com/package/expo?activeTab=versions) · [SDK 57 release notes](https://expo.dev/changelog/sdk-57) · [Expo dependency map](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json)

## User review required

- **Device coverage.** SDK 57 requires iOS 16.4+ and Android 7+. Confirm whether any event devices still require iOS 15.1–16.3 before scheduling the upgrade. Check actual deployed OS coverage against the generated build settings. [Expo platform requirements](https://docs.expo.dev/versions/latest/#support-for-android-and-ios-versions)
- **Release path.** Confirm which Android and iOS builds users currently have, how they were distributed, and who can access their signing credentials and a physical iPhone. Use the actual distributed binary for upgrade testing when available. If there has been no distributed build, use a same-signed SDK 52 reference build and record that distinction.
- **Test environment.** The checked-in preview and production profiles reference the same Supabase and API endpoints. Use a staging backend and test accounts for write flows, or agree on an isolated test event and accounts if staging is unavailable. Confirm whether the repo's web script is used for distribution so web coverage can match its role. [EAS profiles](frontend/eas.json)

## Current baseline

- The installed packages and working npm lockfile resolve Expo **52.0.49**, React Native **0.76.9**, and React **18.3.1**. The lockfile already has local edits. Reconcile those with the intended baseline before recording the first migration commit. [Package manifest](frontend/package.json) · [npm lockfile](frontend/package-lock.json)
- The app uses React Navigation 6 with an auth-gated native stack and bottom tabs, plus NativeWind 4 with Tailwind CSS 3. Expo config already opts into the New Architecture. The repo tracks neither native project, and neither native directory is present locally. Verify generated native project ownership against the last distributed build. [App entry](frontend/App.tsx) · [Expo config](frontend/app.json) · [Metro config](frontend/metro.config.js)
- TypeScript passed with `tsc --noEmit`, and all 10 existing Jest export tests passed with `npm test -- --runInBand`. These checks used the installed SDK 52 dependencies on Windows. Android and iOS runtime behavior, device permissions, and installed-user continuity remain unverified.
- The registered navigator does not expose a `Scanner` route even though Ticket links to it. Capture reachable behavior on SDK 52 and track any existing scanner issue separately from the SDK upgrade. Test generated QR links through their existing consumers. [App entry](frontend/App.tsx) · [Ticket screen](frontend/src/screens/TicketScreen.tsx)

## Dependency and compatibility changes

Expo's SDK 57 map provides starting versions for native packages. Reconcile `npx expo install --fix` with the published package on the selected patch and record the final resolved versions. For other packages, use the smallest compatible stable update and check peers, imports, and runtime behavior.

| Area | Proposed alignment and migration |
| --- | --- |
| Core and tooling | Expo 57.0.33, React Native 0.86.3, React 19.2.3, and SDK-matched `babel-preset-expo` and `jest-expo`. Align React types, TypeScript, Jest, Testing Library, and any renderer peer as a set. Pin supported Node/npm across local builds and EAS. SDK 57 requires Node 22.13.x or later. [SDK version reference](https://docs.expo.dev/versions/v57.0.0/#each-expo-sdk-version-depends-on-a-react-native-version) |
| Navigation | Move `@react-navigation/native`, `native-stack`, and `bottom-tabs` together from v6 to v7, paired with Screens ~4.26.0, Safe Area Context ~5.7.0, and Gesture Handler ~2.32.0. Verify whether the direct `@react-navigation/core` entry is needed. Preserve the route structure and check v7 changes around nested navigation, back behavior, and route params. [React Navigation v7 migration](https://reactnavigation.org/docs/upgrading-from-6.x/) · [React Native Screens support](https://github.com/software-mansion/react-native-screens) |
| Styling and motion | Use NativeWind 4.2.7 or a verified compatible stable 4.x patch with Tailwind 3. NativeWind 4.2.7 includes CSS Interop 0.2.7. Check the direct 0.1.x declaration and resolve to one compatible copy. Pair Reanimated 4.5.1 with Worklets 0.10.1 and validate Babel, Metro, class names, and layout animations. [NativeWind installation](https://www.nativewind.dev/docs/getting-started/installation) · [Expo dependency map](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json) |
| Files, sharing, and QR | Align Expo FileSystem, MediaLibrary, Print, and Sharing. Use the supported `/legacy` imports for the existing file and media calls where needed because several top-level SDK 57 methods throw at runtime. Update Jest mocks alongside imports. Align SVG 15.15.4 and ViewShot 5.1.0, then verify the QR renderer, saved images, album behavior, and file sharing on devices. Confirm the MediaLibrary plugin and generated permissions. [FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem.md) · [MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/) |
| Remaining UI and Expo modules | SDK-align Asset, Blur, Constants, Font, StatusBar, and the DateTimePicker native package (9.1.0 in the map). Verify the date/time modal wrapper and config plugin together, plus peer compatibility and rendering for Lucide icons and `react-native-qrcode-svg`. Add SDK-matched `expo-dev-client` for the existing development-client profile. [Expo dependency map](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json) · [Development builds](https://docs.expo.dev/develop/development-builds/introduction/) |
| Auth, storage, and API | Move AsyncStorage from 1.23.1 to Expo's 2.2.0 and test existing keys, cached analytics/whitelists, and persisted Supabase sessions. Keep `supabase-js` 2.105.4 as the initial resolved version. Check the five direct Supabase subpackage entries against actual imports and the resolved dependency graph before changing them. Preserve service configuration and API payloads. [Supabase client](frontend/src/lib/supabase.ts) · [API URL selection](frontend/src/config/api.ts) · [Supabase React Native Auth guide](https://supabase.com/docs/guides/auth/quickstarts/react-native) |

The compatibility imports keep the existing export and photo-saving behavior within the migration. Move to the modern file or media APIs during this upgrade only if device checks show the legacy paths cannot meet the existing behavior.

## Implementation sequence

Use one independently reviewable SDK checkpoint at a time. A direct 52-to-57 jump uses fewer intermediate installs but makes failures across React, navigation, native files, and tooling harder to isolate. Expo recommends incremental upgrades. [Expo upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)

| Checkpoint | Work and exit evidence |
| --- | --- |
| SDK 52 baseline | Use an isolated branch after review. Record the intended lockfile, known issues, last distributed build IDs and signing route, supported devices, and representative test accounts and data. Capture startup, screenshots, QR payloads, and export samples. [SDK 52 release notes](https://expo.dev/changelog/2024-11-12-sdk-52) |
| 52 → 53 | Move to React Native 0.79 and React 19. Check Metro package exports and CommonJS resolution with NativeWind and the Supabase client. Align React types and the test stack. Confirm app launch and auth navigation. [SDK 53 release notes](https://expo.dev/changelog/sdk-53) |
| 53 → 54 | Move to React Native 0.81 and React 19.1. Address Android edge-to-edge and the FileSystem entry-point change. Migrate Navigation 6 to 7 and align Screens. Adopt Reanimated 4 and Worklets with a compatible NativeWind 4 release for this hop. Check system insets, headers, tabs, keyboard and back behavior, and file exports. [SDK 54 release notes](https://expo.dev/changelog/sdk-54) |
| 54 → 55 | Move to React Native 0.83 and React 19.2. Remove the obsolete `newArchEnabled` setting. Confirm native dependency and plugin builds with the mandatory New Architecture, and check modal blur, splash, and icon rendering. [SDK 55 release notes](https://expo.dev/changelog/sdk-55) |
| 55 → 56 | Move to React Native 0.85. Confirm iOS 16.4 deployment and an appropriate Xcode image. Address the MediaLibrary entry-point change and verify QR capture, album permissions, and saving. Use this checkpoint for compatibility verification given the documented Hermes memory regression affecting Reanimated/Worklets on SDK 56. [SDK 56 release notes](https://expo.dev/changelog/sdk-56) |
| 56 → 57 | Pin the selected stable Expo 57 patch, apply the final alignment, and generate fresh native projects from verified config and plugins. Build Android and iOS candidates. Use an SDK 57-compatible EAS image. If the iOS build uses Xcode 27/iOS 27 SDK, enable Expo's SDK 57 UIKit scene support and verify cold launch and foreground resume. [SDK 57 release notes](https://expo.dev/changelog/sdk-57) · [EAS build images](https://docs.expo.dev/build-reference/infrastructure/) |

At each checkpoint, run `npx expo install --fix`, review the manifest and lockfile changes, verify a clean `npm ci` and `npx expo install --check`, then run Expo Doctor, TypeScript, Jest, and Android/iOS bundle checks. Smoke-test native changes in a supported build. Record any intermediate platform gap caused by unavailable tooling and require full native evidence on the SDK 57 candidate.

## Release acceptance criteria

Run the candidate on a physical Android phone and iPhone, with emulator or simulator coverage for additional OS versions where available. Use development builds for diagnosis and release-like signed builds for acceptance. Record device, OS, build profile, and result for each check.

- **Startup, navigation, and styling.** Clean install, cold launch, foreground resume, login and logout, and traversal of Home, Config, and Analytics succeed. Nested links carry the correct route parameters. Android back, iOS swipe back, status bars, keyboard, date/time picker, safe areas, blur, and animations match the baseline behavior.
- **Installed-user continuity.** Install SDK 57 directly over the distributed SDK 52 build with the same app identity and compatible signing, without uninstalling or clearing data. Confirm a valid signed-in session survives, refresh and sign-out work, cached data remains readable, and offline startup and reconnection behave as before. Check a clean install and an expired-session case separately.
- **Event workflows and backend compatibility.** Use test data to run event setup, registration and walk-in windows, participant/whitelist access, evaluations, and analytics. Compare outputs and existing errors against SDK 52. Check local API routing in development, HTTPS in the release-like binary, and old/new clients against the same API during coexistence.
- **QR and reports.** Decode representative generated registration, walk-in, evaluation, and poster-clearance codes and compare URLs and parameters. Save and reopen a QR image from the expected gallery album. Exercise media permission denial and subsequent recovery. Generate and open real PDF and Excel-format exports, check representative rows and filenames, and verify Android directory picker acceptance/cancellation and iOS sharing.
- **Build and launch.** Require passing automated checks, resolved Expo Doctor findings or documented baseline exceptions, and no newly observed blockers in the journeys above. Record cold-launch behavior and compare repeated analytics navigation and large exports with the baseline for crashes or material slowdown.

## Distribution and recovery

Keep the Android package, iOS bundle identifier, signing lineage, EAS project identity, storage keys, and data contracts consistent. Advance release build numbers as required by the confirmed distribution route. Use the existing EAS profiles for internal verification, followed by the existing release channel's pilot or staged distribution where available. The repo shows no EAS Update runtime configuration. Deliver the SDK change as a new binary. [Expo config](frontend/app.json) · [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/)

Pause distribution for a new startup crash, unexpected logout or data loss, or regression in an event, QR, or export workflow. Keep the previous build reference and its source available for diagnosis. If a faulty build has reached users, verify recovery with a corrected binary and incremented build number through the same distribution channel. Validate any proposed recovery against data written by the SDK 57 candidate before relying on it.

## Android Expo Go preview

From the repository root, with the computer and phone on the same Wi-Fi network, start Metro and scan its QR code with the SDK 57 version of Expo Go.

```powershell
cd frontend
npm.cmd start -- --clear
```

Development uses the local API by default. To use the hosted API already configured in `frontend/.env`, set `$env:EXPO_PUBLIC_USE_PROD_IN_DEV = 'true'` before starting Metro. The hosted health endpoint returned HTTP 200 and reported its database online. Use test accounts and a test event when exercising workflows that write data.

Check sign-in, tab and event navigation, both date pickers, QR generation, and real PDF and Excel exports on the phone. On Android Expo Go, **Save PNG to Files** opens Android's folder picker. The signed app's gallery path is covered by the release acceptance criteria. [Expo SDK 57 MediaLibrary](https://docs.expo.dev/versions/v57.0.0/sdk/media-library/)

## Implementation status

- The upgrade is on `expo-sdk-57-upgrade`. SDKs 53, 54, 55, and 56 were installed and bundled for Android and iOS before SDK 57. SDK 56's Hermes regression was resolved by moving to SDK 57. The pre-existing SDK 52 lockfile edits were copied to `frontend/.expo/baseline-sdk52-package-lock.json` before regenerating the lockfile.
- SDK 57.0.33 passed a clean npm install, Expo dependency validation, all 21 Expo Doctor checks, TypeScript, all 10 existing Jest cases, and Android and iOS production-mode bundle exports on Windows. The app's own splash configuration now uses the Expo config plugin. Inspect the actual splash on a release binary. [Expo splash screen](https://docs.expo.dev/versions/v57.0.0/sdk/splash-screen/)
- Metro returned HTTP 200 for both the Android Expo Go manifest, which reported SDK 57.0.0, and the Android development bundle requested from that manifest.
- Physical-device smoke tests, native signed builds, and the in-place upgrade test for existing sessions and caches remain open. The upgrade did not require database or backend changes.
