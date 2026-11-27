# Legacy upgrades

## Baseline and compatibility

1. Identify the currently shipped version, source SDK and React Native versions, native project ownership, lockfile, available binaries, minimum OS versions, and target release constraints. Reproduce the old app when practicable and record known failures. Use an isolated branch or checkpoints and retain the baseline build or commit.
2. Inventory high-risk contracts, including application IDs, signing identity and secure storage access, persisted schemas and files, auth and sessions, routes and links, API payloads, permissions, notifications, and runtime channels. Capture representative data and critical journeys using sanitized fixtures or test accounts.
3. Pick a supported target from official releases. Map version constraints for Expo, React Native, React, Node, native dependencies, architecture changes, Android tooling, and Xcode or CocoaPods as applicable. Identify obsolete modules, config plugin changes, and any unavoidable increase in minimum OS versions. Keep feature changes and visual redesign out of upgrade slices unless specifically requested.

## Upgrade and preserve data

- For Expo, default to one SDK hop at a time. Follow each hop's release notes, align React and native dependencies with the target Expo SDK, run `npx expo install --fix` and `npx expo-doctor` where supported, and review the manifest and lockfile. For bare React Native, use the React Native Upgrade Helper and reconcile the native template changes with app-specific code. Use a larger jump only when an intermediate toolchain is genuinely unavailable or another concrete constraint warrants it. Record the resulting verification gap.
- Confirm native project ownership before regenerating anything. Regenerate disposable projects from durable config and plugins. Preserve manual iOS and Android changes and apply the necessary native diffs to maintained projects. Verify architecture support and rebuild binaries with the correct toolchain.
- Prefer forward-compatible API and storage changes while old and new clients coexist. Make migrations versioned, safe to retry, and transactional where supported. Use staged writes or a recoverable source copy for nontransactional migrations. Keep legacy values readable until conversion is verified. Preserve auth and secure storage keys, service identifiers, and app identity where needed for installed-user continuity. Test interrupted migrations and supported skip-version paths.
- At each meaningful checkpoint, run repo checks, boot supported platforms where possible, and exercise affected flows. Fix compatibility regressions before layering further changes. Keep checkpoints scoped so that code and build changes can be isolated and reversed.

## Prove the upgrade and plan recovery

- Test both clean installs and in-place upgrades over representative previously shipped builds using the same app identity and compatible signing. Seed user data and authenticated state first. Check preservation, relaunch, migration retry after interruption, and feature journeys such as links, notifications, background tasks, and offline sync when applicable. If intermediate builds never ship, test the direct upgrade from the old shipped binary to the final candidate. Expo Go can help with JS smoke tests while verification of installed-user continuity requires suitable app binaries.
- For EAS Update, verify channel and runtime compatibility with deployed binaries. Ship a new binary for native changes. Preview on the intended runtime, then use staged rollout when supported and watch crashes, startup, migration failures, and critical journey metrics against the baseline.
- Define how to halt rollout and recover before distribution. Recover using a compatible update or a corrective binary as appropriate. Treat binary, JavaScript, server, and data recovery separately. A previous binary or bundle may be unable to read already migrated data. Validate backward compatibility or prepare a forward fix before relying on rollback.
- Report the starting and target versions, checks that passed, device/build coverage, known baseline failures, and unverified contracts. Base any compatibility claim on those results.

Sources: [Expo SDK upgrades](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [React Native upgrades](https://reactnative.dev/docs/upgrading), [Expo runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [Expo update rollouts](https://docs.expo.dev/eas-update/rollouts/).
