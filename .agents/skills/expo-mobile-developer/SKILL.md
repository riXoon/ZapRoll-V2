---
name: expo-mobile-developer
description: Design, build, debug, test, and release iOS and Android apps with React Native and Expo. Use for Expo Go compatibility, native development builds, distinctive mobile UI/UX, or upgrades of legacy Expo and React Native apps that must preserve existing behavior and data.
---

# Expo Mobile Developer

Inspect the app's package manifest, lockfile, Expo config, routing, native directories, build profiles, and existing design system before choosing an approach. Identify supported platforms, installed SDK, build targets, and user-visible contracts relevant to the task. Keep the existing package manager, navigation, and state architecture unless the task or a verified incompatibility requires a change.

- Read [development and release](references/development.md) for implementation, device debugging, performance, integrations, testing, and distribution.
- Read [mobile UI and UX](references/design.md) for new screens, redesigns, accessibility, and visual review.
- Read [legacy upgrades](references/upgrades.md) before changing Expo SDK, React Native, native build tooling, or persisted-data formats in an existing app.

For feature planning or changes that affect shared data, APIs, or rollout, use [Systems Analyst and Architect](../systems-analyst-architect/SKILL.md) and its [mobile handoff](../systems-analyst-architect/references/mobile-handoff.md). Build to the agreed acceptance criteria and contracts. Feed native build constraints, platform findings, and verification evidence back into the shared plan. For scoped mobile fixes, bring in the planning workflow if a material decision surfaces.

Verify SDK-specific guidance against official documentation and release notes for the actual source, intermediate, and target versions. Use Expo Go for compatible device previews. Check the SDK, platform, and native APIs bundled in Expo Go before promising support. Use a development build when a feature needs custom native code, configuration applied at build time, or capabilities missing from Expo Go. Verify affected production behavior on app binaries when available.

Work through the app's normal entry points and report what ran, on which platform and build type, and which checks remain unverified. Use explicit device and build coverage when assessing release readiness.
