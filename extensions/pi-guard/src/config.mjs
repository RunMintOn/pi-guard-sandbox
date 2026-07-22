import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createDefaultConfig, GUARD_CONFIG_RELATIVE_PATH } from "./constants.mjs";

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function getGuardConfigPath(cwd) {
  return join(cwd, GUARD_CONFIG_RELATIVE_PATH);
}

export function serializeConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function validateConfig(input) {
  const errors = [];
  const value = input && typeof input === "object" ? input : null;
  if (!value) {
    return { ok: false, error: "Config must be a JSON object." };
  }

  if (value.mode !== "readonly" && value.mode !== "workspace-write") {
    errors.push('"mode" must be "readonly" or "workspace-write".');
  }
  if (value.network !== undefined && value.network !== "open" && value.network !== "blocked") {
    errors.push('"network" must be "open" or "blocked".');
  }
  if (!isStringArray(value.sensitiveReadDeny)) {
    errors.push('"sensitiveReadDeny" must be an array of strings.');
  }

  const protectedPaths = value.protectedPaths;
  if (!protectedPaths || typeof protectedPaths !== "object") {
    errors.push('"protectedPaths" must be an object.');
  } else {
    if (!isStringArray(protectedPaths.block)) {
      errors.push('"protectedPaths.block" must be an array of strings.');
    }
    if (!isStringArray(protectedPaths.approval)) {
      errors.push('"protectedPaths.approval" must be an array of strings.');
    }
  }

  const bashPolicy = value.bashPolicy;
  if (!bashPolicy || typeof bashPolicy !== "object") {
    errors.push('"bashPolicy" must be an object.');
  } else {
    if (!isStringArray(bashPolicy.directBlock)) {
      errors.push('"bashPolicy.directBlock" must be an array of strings.');
    }
    if (!isStringArray(bashPolicy.requireApproval)) {
      errors.push('"bashPolicy.requireApproval" must be an array of strings.');
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join(" ") };
  }

  return { ok: true, config: value };
}

export async function loadConfig(cwd) {
  const configPath = getGuardConfigPath(cwd);
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const validation = validateConfig(parsed);
    if (!validation.ok) {
      return { kind: "invalid", path: configPath, error: validation.error };
    }
    return { kind: "valid", path: configPath, config: validation.config };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return { kind: "missing", path: configPath };
    }
    if (error instanceof SyntaxError) {
      return { kind: "invalid", path: configPath, error: `Invalid JSON: ${error.message}` };
    }
    throw error;
  }
}

export async function writeConfig(cwd, config) {
  const configPath = getGuardConfigPath(cwd);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, serializeConfig(config), "utf8");
  return configPath;
}

export async function initConfig(cwd) {
  const existing = await loadConfig(cwd);
  if (existing.kind !== "missing") {
    return { created: false, reason: existing.kind === "invalid" ? "exists-invalid" : "exists", path: existing.path };
  }
  const config = createDefaultConfig();
  const path = await writeConfig(cwd, config);
  return { created: true, path, config };
}
