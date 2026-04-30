function getDependencyError(checkResult) {
  if (checkResult === true) return null;
  if (checkResult === false) return "Sandbox runtime dependencies are unavailable.";
  if (checkResult && typeof checkResult === "object") {
    const errors = Array.isArray(checkResult.errors) ? checkResult.errors.filter(Boolean) : [];
    if (errors.length > 0) {
      return `Sandbox dependencies missing: ${errors.join(", ")}`;
    }
    const warnings = Array.isArray(checkResult.warnings) ? checkResult.warnings.filter(Boolean) : [];
    if (warnings.length > 0) return null;
  }
  return null;
}

export async function createRuntimeSandboxAdapter(runtimeOverride) {
  const runtime = runtimeOverride ?? await import("@anthropic-ai/sandbox-runtime");
  const { SandboxManager } = runtime;
  let initialized = false;

  return {
    async apply(config) {
      const dependencyError = getDependencyError(SandboxManager.checkDependencies(config.ripgrep));
      if (dependencyError) {
        throw new Error(dependencyError);
      }
      if (!initialized) {
        await SandboxManager.initialize(config);
        initialized = true;
      } else {
        SandboxManager.updateConfig(config);
      }
    },
    async wrap(command) {
      return SandboxManager.wrapWithSandbox(command, undefined, undefined);
    },
    async reset() {
      if (!initialized) return;
      await SandboxManager.reset();
      initialized = false;
    },
  };
}
