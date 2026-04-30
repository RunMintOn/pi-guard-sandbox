import { readFile, writeFile } from "node:fs/promises";
import { statSync } from "node:fs";
import { getGuardConfigPath, initConfig, loadConfig, serializeConfig, writeConfig } from "./config.mjs";
import { buildSandboxRuntimeConfig } from "./sandbox-config.mjs";
import { evaluateToolCall } from "./tool-policy.mjs";
import { getWorkspaceRoot, normalizeSensitivePathPattern } from "./path-utils.mjs";

const DISPLAY_MODES = { readonly: "read-only" };

export function displayMode(mode) {
  return DISPLAY_MODES[mode] ?? mode ?? "(none)";
}

export function formatGuardStatus(status) {
  const scope = "scope: agent tools only";
  if (status.kind === "uninitialized") return `Guard: uninitialized · ${scope}`;
  if (status.kind === "invalid-config") return `Guard: invalid-config · ${scope}`;
  if (status.kind === "sandbox-unavailable") return `Guard: sandbox-unavailable (${displayMode(status.mode)}) · ${scope}`;
  return `Guard: ${displayMode(status.mode)} · ${scope}`;
}

function resolveSensitiveMaskPaths(patterns) {
  const result = [];
  for (const pattern of patterns) {
    const normalized = normalizeSensitivePathPattern(pattern);
    try {
      const s = statSync(normalized);
      result.push({ path: normalized, isDir: s.isDirectory() });
    } catch {
      // doesn't exist, skip
    }
  }
  return result;
}

export function createGuardController({ cwd, sandbox, fs = { readFile, writeFile } } = {}) {
  if (!cwd) throw new Error("cwd is required");
  let state = {
    kind: "uninitialized",
    mode: null,
    config: null,
    configPath: getGuardConfigPath(cwd),
    workspaceRoot: getWorkspaceRoot(cwd),
    error: null,
    sandboxActive: false,
  };

  async function syncSandbox(config) {
    if (!config) {
      state.sandboxActive = false;
      await sandbox?.reset?.();
      return;
    }
    const runtimeConfig = buildSandboxRuntimeConfig({ cwd, config });
    await sandbox?.apply?.(runtimeConfig);
    state.sandboxActive = true;
  }

  async function refresh() {
    const loaded = await loadConfig(cwd);
    state.configPath = loaded.path;

    if (loaded.kind === "missing") {
      state = { ...state, kind: "uninitialized", mode: null, config: null, error: null, sandboxActive: false };
      await sandbox?.reset?.();
      return getStatus();
    }

    if (loaded.kind === "invalid") {
      state = { ...state, kind: "invalid-config", mode: null, config: null, error: loaded.error, sandboxActive: false };
      await sandbox?.reset?.();
      return getStatus();
    }

    state = { ...state, kind: loaded.config.mode, mode: loaded.config.mode, config: loaded.config, error: null, sandboxActive: false };
    try {
      await syncSandbox(loaded.config);
      state.kind = loaded.config.mode;
    } catch (error) {
      state.kind = "sandbox-unavailable";
      state.error = error instanceof Error ? error.message : String(error);
      state.sandboxActive = false;
    }
    return getStatus();
  }

  function getStatus() {
    return {
      kind: state.kind,
      mode: state.mode,
      config: state.config,
      configPath: state.configPath,
      workspaceRoot: state.workspaceRoot,
      error: state.error,
      guardActive: Boolean(state.config),
      sandboxActive: state.sandboxActive,
      scope: "agent tools only",
      text: formatGuardStatus(state),
    };
  }

  async function initializeConfig() {
    const result = await initConfig(cwd);
    await refresh();
    return { ...result, status: getStatus() };
  }

  async function setMode(mode) {
    if (mode !== "readonly" && mode !== "workspace-write") {
      throw new Error(`Unsupported mode: ${mode}`);
    }
    if (!state.config) {
      throw new Error("Guard is not initialized.");
    }
    const next = { ...state.config, mode };
    await writeConfig(cwd, next);
    await refresh();
    return getStatus();
  }

  async function handleToolCall({ toolName, input, hasUI, requestApproval }) {
    return evaluateToolCall({
      cwd,
      config: state.config,
      statusKind: state.kind,
      toolName,
      input,
      hasUI,
      requestApproval,
    });
  }

  async function prepareBash(command) {
    if (!state.config) {
      return { mode: "local", command };
    }
    if (!state.sandboxActive) {
      throw new Error(state.error || "Guard bash sandbox is unavailable.");
    }
    const maskPaths = resolveSensitiveMaskPaths(state.config.sensitiveReadDeny);
    const wrapped = await sandbox.wrap(command, maskPaths);
    return {
      mode: "sandbox",
      command: wrapped,
      env: {
        HOME: "/tmp/pi-guard-home",
        TMPDIR: "/tmp",
        XDG_CACHE_HOME: "/tmp/.cache",
        npm_config_cache: "/tmp/.npm",
        PIP_CACHE_DIR: "/tmp/.pip-cache",
      },
    };
  }

  return {
    refresh,
    getStatus,
    initializeConfig,
    setMode,
    handleToolCall,
    prepareBash,
  };
}
