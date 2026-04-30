# Add runtime mode switching backed by `.pi/pi-guard.json`

Status: needs-triage

## What to build

Add runtime mode switching for Pi Guard using the project-local `.pi/pi-guard.json` as the source of truth. Users should be able to switch between `readonly` and `workspace-write` during a TUI session, with the new mode taking effect immediately for subsequent agent tool calls and being reflected in the UI.

## Acceptance criteria

- [ ] `/guard readonly` updates `.pi/pi-guard.json`, updates in-memory Guard state immediately, and shows the new mode in the UI.
- [ ] `/guard workspace-write` updates `.pi/pi-guard.json`, updates in-memory Guard state immediately, and shows the new mode in the UI.
- [ ] New configs created by `/guard init` default to `workspace-write`.
- [ ] Mode switching does not require restarting Pi or running `/reload`.
- [ ] The displayed Guard status remains explicit when switching modes and still states that scope is limited to agent tools only.

## Blocked by

- `01-bootstrap-pi-guard-config-status-and-init-flow.md`
