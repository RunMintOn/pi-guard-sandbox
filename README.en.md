# Pi Guard

[中文](README.md)

> Two rounds of real-world testing — **all passed**. Routine bash, file I/O, and git operations feel seamless. Out-of-bounds writes, dangerous commands, and sensitive reads are blocked on contact.

**Pi Guard** gives your Agent an OS-level **write-boundary shield**. No regex guesswork. No approval fatigue. It knows when to stay out of your way and when to step in front of the bullet.

- 🧠 **Smart**: full freedom inside the workspace, dead stop at the boundary
- 🪶 **Transparent**: won't interrupt your flow — only blocks what actually crosses the line
- 🛡️ **Hardened**: bash runs in a real sandbox, not string-matching theater
- 🎯 **Focused**: two modes — `read-only` and `workspace-write` — pick one and stop overthinking

---

## 1. Installation

### System dependencies

| Tool | Purpose | Install |
|------|---------|---------|
| `bwrap` | Linux process sandbox | `sudo apt install bubblewrap` |
| `socat` | Sandbox network proxy | `sudo apt install socat` |
| `rg` | File scanning | `sudo apt install ripgrep` |

### Install the extension

#### From npm

```bash
pi install npm:pi-guard-sandbox      # global — all projects
pi install -l npm:pi-guard-sandbox   # project-local only
```

After installation, enter your project and run `/guard i` to initialize.

#### From this repo

If you've cloned this repository, the extension is already at `.pi/extensions/pi-guard/`:

```bash
cd .pi/extensions/pi-guard && npm install
```

Start Pi, then run `/guard i`.

> For a global install from this repo: copy `.pi/extensions/pi-guard/` to `~/.pi/agent/extensions/pi-guard/` and run `npm install` there.

---

## 2. What Guard leaves in your project

Know what you're getting into.

| Item | Description |
|------|-------------|
| `.pi/pi-guard.json` | Created on `init` — all Guard configuration |
| footer status line | Persistent mode indicator at the bottom of Pi |
| sandboxed bash | All Agent bash commands run in a sandbox, not directly on the host |
| `vendor/` directory | ~1.8 MB — sandbox runtime (forked from `@anthropic-ai/sandbox-runtime`) |
| `.pi/extensions/pi-guard/` | The extension code itself |

> Delete `.pi/pi-guard.json` and run `/reload` to disable Guard.

---

## 3. Quick start

Start Pi in your project directory:

```
/guard i        → initialize — creates config
/guard r        → switch to read-only mode
/guard w        → switch to workspace-write (default)
```

Guard takes effect immediately after initialization. The footer shows the current mode.

---

## 4. Command reference

| Command | Shortcut | Purpose |
|---------|----------|---------|
| `/guard` | — | Show status and configuration |
| `/guard init` | `/guard i` | Create `.pi/pi-guard.json` and enable Guard |
| `/guard read-only` | `/guard r` | Switch to read-only |
| `/guard workspace-write` | `/guard w` | Switch to workspace-write |

---

## 5. Mode comparison

| | read-only | workspace-write |
|---|---|---|
| Read inside workspace | ✅ | ✅ |
| Read outside workspace | ✅ (sensitive paths excluded) | ✅ (sensitive paths excluded) |
| Write inside workspace | ❌ | ✅ |
| Write outside workspace | ❌ | ❌ (requires approval) |
| Bash commands | ✅ (no persistent writes) | ✅ (workspace + /tmp writable) |
| Bash writes outside workspace | ❌ | ❌ |
| Dangerous commands | blocked + approval | blocked + approval |

### Sensitive paths (unreadable)

`~/.ssh`  `~/.aws`  `~/.gnupg`  `~/.git-credentials`
`~/.npmrc`  `~/.pypirc`  `~/.netrc`  `~/.env`  `~/.env.*`

### What Guard does NOT protect

**User-typed `!cmd` / `!!cmd` are not guarded.** Guard only covers Agent-initiated tool calls.

---

## 6. Troubleshooting

| Status | Cause | Action |
|--------|-------|--------|
| `Guard: uninitialized` | Not yet initialized | Run `/guard i` |
| `Guard: invalid-config` | JSON syntax error | Fix `.pi/pi-guard.json`, then `/reload` |
| `Guard: sandbox-unavailable` | Missing system deps or npm install skipped | Follow Section 1 — check `bwrap`, `socat`, `rg` |

---

## 7. Configuration: `.pi/pi-guard.json`

`/guard init` generates this file. You can edit it by hand (requires `/reload` to take effect).

### Full example

```json
{
  "mode": "workspace-write",

  "sensitiveReadDeny": [
    "~/.ssh",
    "~/.aws",
    "~/.npmrc"
  ],

  "protectedPaths": {
    "block": [
      ".git",
      "node_modules"
    ],
    "approval": [
      ".env",
      ".env.*",
      ".pi/pi-guard.json"
    ]
  },

  "bashPolicy": {
    "directBlock": [
      "sudo",
      "su",
      "dd"
    ],
    "requireApproval": [
      "rm-rf",
      "git-reset-hard",
      "git-clean-fd"
    ]
  }
}
```

### Field reference

| Field | Description |
|-------|-------------|
| `mode` | `"readonly"` or `"workspace-write"`. Switch with `/guard r` / `/guard w` |
| `sensitiveReadDeny` | Paths blocked from all Agent reads. Supports `~` and globs |
| `protectedPaths.block` | Paths where `write` / `edit` are rejected outright |
| `protectedPaths.approval` | Paths where `write` / `edit` trigger an approval prompt |
| `bashPolicy.directBlock` | Bash commands rejected immediately |
| `bashPolicy.requireApproval` | Bash commands requiring approval |

### Adding your own sensitive paths

```json
"sensitiveReadDeny": [
  "~/.ssh",
  "~/.aws",
  "~/my-project/secrets.yml"
]
```

### Adding custom dangerous commands

```json
"bashPolicy": {
  "directBlock": [
    "sudo",
    "docker-host-root-bind"
  ],
  "requireApproval": [
    "rm-rf",
    "bash-c"
  ]
}
```

> Entries in `bashPolicy` are **policy IDs**, not raw regex. See the default config generated by `init` for the full list.
