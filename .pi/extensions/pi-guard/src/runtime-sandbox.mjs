export async function createRuntimeSandboxAdapter() {
  const runtime = await import("@anthropic-ai/sandbox-runtime");
  const { SandboxManager } = runtime;
  let initialized = false;

  return {
    async apply(config) {
      const deps = SandboxManager.checkDependencies(config.ripgrep);
      if (deps.errors.length > 0) {
        throw new Error(`Sandbox dependencies missing: ${deps.errors.join(", ")}`);
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
