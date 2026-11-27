# Mobile UI and UX

## Design direction

- Start from the user's primary task, where they use the app, and the product's recognizable attributes. Audit existing screens, visual assets, and native interaction patterns. Preserve established conventions unless a redesign is requested.
- Sketch the primary journey with realistic content before styling. For open-ended design work, briefly compare two plausible directions through information hierarchy, type, content density, and interaction. Choose one based on the product and user context. Carry one recognizable idea across the experience, such as a distinctive type scale, a domain-specific content composition, or a purposeful illustration style.
- Make the first screen's focal point and next action obvious. Group information by meaning. Use lists, rows, or full-width sections where they fit the content. Reserve cards, gradients, badges, and decorative copy for cases where they convey structure, state, or brand.
- Turn repeated decisions into semantic tokens and component variants using the existing theme system. Set type, color, spacing, surfaces, and motion consistently. Use supplied artwork and brand assets when available. Use platform-native interaction for navigation, back gestures, sheets, text entry, and accessibility even when the visual treatment is bespoke.

## Behavior and verification

- Design loading, empty, error, disabled, offline, permission-denied, and success states as applicable. Give users a clear recovery action, preserve entered data after recoverable failures, and keep feedback close to the action.
- Account for safe areas, Android edge-to-edge layout, keyboard overlap, narrow phones, large text, long translations, and tablets where supported. Treat touch targets as platform-sized controls, with roughly 44 pt on iOS and 48 dp on Android as typical minimums.
- Provide accessible names, roles, states, logical focus order, and screen-reader feedback for meaningful async changes. Convey state with text or shape alongside color. Check contrast, text scaling, reduced motion, and any gesture-only actions for accessible alternatives.
- Review actual iOS and Android screens where available. Walk the main task from launch through its completion and a recovery case. Inspect small screens, enlarged text, supported themes, and relevant platform differences. Fix clipping, touch overlap, weak hierarchy, and inconsistent spacing before calling the design complete.

Sources: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines), [Android mobile design](https://developer.android.com/design/ui/mobile), [React Native accessibility](https://reactnative.dev/docs/accessibility).
