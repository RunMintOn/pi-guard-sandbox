import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGuardController } from "../src/guard.mjs";

function tempWorkspace() {
  return mkdtempSync(join(tmpdir(), "pi-guard-"));
}

function createSandbox() {
  return {
    applied: [],
    wrapped: [],
    resets: 0,
    failMessage: null,
    async apply(config) {
      if (this.failMessage) throw new Error(this.failMessage);
      this.applied.push(config);
    },
    async wrap(command) {
      this.wrapped.push(command);
      return `wrapped:${command}`;
    },
    async reset() {
      this.resets += 1;
    },
  };
}

function writeProjectFile(cwd, relativePath, content) {
  mkdirSync(join(cwd, relativePath, ".."), { recursive: true });
  writeFileSync(join(cwd, relativePath), content, "utf8");
}

test("guard reports uninitialized when config is missing", async () => {
  const cwd = tempWorkspace();
  const sandbox = createSandbox();
  const guard = createGuardController({ cwd, sandbox });

  await guard.refresh();
  const status = guard.getStatus();

  assert.equal(status.kind, "uninitialized");
  assert.equal(status.guardActive, false);
  assert.equal(status.sandboxActive, false);
  assert.match(status.text, /Guard: uninitialized/);
});

test("guard init creates default config and activates workspace-write immediately", async () => {
  const cwd = tempWorkspace();
  const sandbox = createSandbox();
  const guard = createGuardController({ cwd, sandbox });

  const result = await guard.initializeConfig();
  const status = guard.getStatus();
  const saved = JSON.parse(readFileSync(join(cwd, ".pi", "pi-guard.json"), "utf8"));

  assert.equal(result.created, true);
  assert.equal(saved.mode, "workspace-write");
  assert.equal(status.kind, "workspace-write");
  assert.equal(status.guardActive, true);
  assert.equal(status.sandboxActive, true);
  assert.equal(sandbox.applied.length, 1);
});

test("invalid config becomes invalid-config and stays inactive", async () => {
  const cwd = tempWorkspace();
  const sandbox = createSandbox();
  const guard = createGuardController({ cwd, sandbox });
  writeProjectFile(cwd, ".pi/pi-guard.json", '{"mode":"broken"}\n');

  await guard.refresh();
  const status = guard.getStatus();

  assert.equal(status.kind, "invalid-config");
  assert.equal(status.guardActive, false);
  assert.equal(status.sandboxActive, false);
  assert.match(status.error, /mode/);
});

test("mode switching persists to config and updates status immediately", async () => {
  const cwd = tempWorkspace();
  const sandbox = createSandbox();
  const guard = createGuardController({ cwd, sandbox });

  await guard.initializeConfig();
  const status = await guard.setMode("readonly");
  const saved = JSON.parse(readFileSync(join(cwd, ".pi", "pi-guard.json"), "utf8"));

  assert.equal(status.kind, "readonly");
  assert.equal(status.mode, "readonly");
  assert.equal(saved.mode, "readonly");
  assert.equal(sandbox.applied.at(-1).filesystem.allowWrite.includes("/tmp"), true);
});

test("sandbox failure becomes sandbox-unavailable without losing validated config", async () => {
  const cwd = tempWorkspace();
  const sandbox = createSandbox();
  const guard = createGuardController({ cwd, sandbox });

  await guard.initializeConfig();
  sandbox.failMessage = "missing sandbox dependency";
  await guard.setMode("readonly");
  const status = guard.getStatus();

  assert.equal(status.kind, "sandbox-unavailable");
  assert.equal(status.guardActive, true);
  assert.equal(status.sandboxActive, false);
  assert.match(status.error, /missing sandbox dependency/);
});
