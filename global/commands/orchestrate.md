# /orchestrate

Use the orchestrator agent to decompose an epic plan into feature plan docs.

1. Read `docs/features/$ARGUMENTS/PLAN.md` (must be an epic plan, status Ready)
2. Create a feature folder and plan stub for each sub-feature
3. Show the dependency order
4. Present execution mode options (sequential / parallel / manual)
5. Wait for your choice before anything runs

$ARGUMENTS
