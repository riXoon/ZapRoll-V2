# Planning and implementation with Expo

Read [Expo Mobile Developer](../../expo-mobile-developer/SKILL.md) and its relevant references. If the skills live in different locations, resolve the companion by its registered name or supplied path. Both skills can work in the same Codex session, using the feature plan or working summary as the shared record.

## Planning to implementation

- Specify the user goal, affected routes, entry and exit behavior, actors, and acceptance criteria.
- Describe the main and recovery states, product intent, and accessibility needs. Use the Expo skill's design guidance for the visual treatment.
- Capture API and persistence contracts, data ownership, session boundaries, and existing builds or stored data that must keep working.
- Identify device capabilities and platform assumptions early. Confirm Expo Go compatibility before promising preview coverage. Identify when a native development or release-like build is needed.
- Sequence implementable feature slices with checks for the affected platforms. Include rollout and recovery when shared contracts change.

## Implementation to planning

Record native or SDK constraints, platform differences, contract mismatches, and test evidence in the shared record. Resolve reversible implementation details within the plan. Revisit the design when new evidence changes a contract, supported platform, data behavior, or user-facing commitment. Continue independent work while material decisions are pending.

Match affected acceptance criteria to the checks performed. Include device, platform, build type, and remaining coverage gaps when relevant. Use the Expo migration playbook for SDK changes and installed-user data.
