# Enforce file-tool boundaries for `read`, `write`, and `edit`

Status: needs-triage

## What to build

Implement Pi Guard policy enforcement for the built-in `read`, `write`, and `edit` tools. This slice should enforce the v0.1 file boundary model: permissive external reads with a minimal sensitive deny list, strict readonly behavior, workspace-local writes by default in `workspace-write`, and one-shot approval for explicit external writes.

## Acceptance criteria

- [ ] In `readonly`, `write` and `edit` are rejected without approval.
- [ ] In `workspace-write`, `write` and `edit` succeed for workspace-local paths.
- [ ] In `workspace-write`, workspace-external `write` and `edit` require allow-once approval per concrete target path.
- [ ] External reads are allowed by default, but reads to configured sensitive paths are denied.
- [ ] Protected paths are enforced for `write` and `edit` according to `.pi/pi-guard.json`.
- [ ] Editing or writing `.pi/pi-guard.json` through `write` or `edit` requires approval.
- [ ] Approval-required operations are denied when no UI is available.

## Blocked by

- `01-bootstrap-pi-guard-config-status-and-init-flow.md`
- `02-add-runtime-mode-switching-backed-by-pi-guard-config.md`
