# Architecture and rollout

- Identify the source of truth and the component that enforces each critical rule. Reuse existing boundaries where they fit. Compare consequential options on complexity, compatibility, operating cost, and reversibility. Record the rationale and trade-offs.
- Specify contract inputs, outputs, errors, permissions, invariants, and compatibility. For cross-system writes, define consistency and failure behavior. Cover idempotency and offline conflict resolution where relevant, including what the user sees while work is pending or fails.
- Identify trust boundaries and sensitive data. Enforce authorization at the appropriate server or data boundary. Apply least privilege and define necessary collection, retention, and redaction. Load relevant project backend or database skills when working in those areas.
- Account for independently deployed clients and existing records. Prefer additive changes during coexistence. As appropriate, sequence expansion, resumable backfill, verification, cutover, and eventual removal. Verify that recovery still works with data written by the new version.
- Set launch and recovery criteria for higher-risk changes. Use appropriate staging, flags, and observability. Track meaningful signals such as completion rates, errors, latency, or migration failures using the project's existing systems.
- Verify critical invariants at the layer that owns them. Include old-client, existing-data, and interrupted-operation cases as applicable. Report evidence, coverage gaps, and their impact.
