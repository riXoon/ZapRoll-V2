# Feature analysis

1. Identify the actor, trigger, desired outcome, and smallest useful scope. Record what is confirmed, what is assumed, and the questions that could change the plan.
2. Trace the routes, modules, and data involved today. Capture the rules and existing journeys that need to keep working. Cite repo paths and tests where they help the implementer verify current behavior.
3. Describe the main path, actor permissions, and material failure and recovery paths. For stateful work specify valid transitions, who can cause them, and what happens on retries, duplicates, or concurrent changes. Base quality targets on observed baselines or label them as proposed.
4. Write observable acceptance criteria with reproducible setup and outcomes. Include negative cases when they matter. Map each criterion to an appropriate test, manual check, or production signal.
5. Break work into small, demonstrable slices with dependencies and verification. Use a focused feasibility spike when an unknown could reverse a decision. State the question and what evidence would resolve it.

For a small feature, deliver a short brief with the outcome, scope, criteria, affected paths, and implementation sequence.
