import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { createBashTool, createLocalBashOperations } from "@mariozechner/pi-coding-agent";
import { createGuardController, displayMode } from "./src/guard.mjs";
import { createRuntimeSandboxAdapter } from "./src/runtime-sandbox.mjs";

export default async function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const sandbox = await createRuntimeSandboxAdapter();
  const guard = createGuardController({ cwd, sandbox });
  const localOps = createLocalBashOperations();

  function updateStatus(ctx: any) {
    ctx.ui.setStatus("pi-guard", guard.getStatus().text);
  }

  pi.on("session_start", async (_event, ctx) => {
    await guard.refresh();
    updateStatus(ctx);
  });

  pi.on("session_shutdown", async () => {
    await sandbox.reset();
  });

  const guardedOps = {
    async exec(command: string, execCwd: string, options: any) {
      const prepared = await guard.prepareBash(command);
      if (prepared.mode === "local") {
        return localOps.exec(command, execCwd, options);
      }
      return localOps.exec(prepared.command, execCwd, {
        ...options,
        env: { ...(options?.env ?? {}), ...(prepared.env ?? {}) },
      });
    },
  };

  const bashTool = createBashTool(cwd, { operations: guardedOps });
  pi.registerTool({
    ...bashTool,
    label: "bash (guarded)",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return bashTool.execute(toolCallId, params, signal, onUpdate, ctx);
    },
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!["read", "write", "edit", "bash"].includes(event.toolName)) return undefined;
    const decision = await guard.handleToolCall({
      toolName: event.toolName,
      input: event.input,
      hasUI: ctx.hasUI,
      requestApproval: async ({ title, body }) => ctx.hasUI ? ctx.ui.confirm(title, body) : false,
    });
    if (decision.status === "block") {
      if (ctx.hasUI) ctx.ui.notify(decision.reason, "warning");
      return { block: true, reason: decision.reason };
    }
    return undefined;
  });

  pi.registerCommand("guard", {
    description: "Show or manage Pi Guard status",
    handler: async (args, ctx) => {
      try {
        const command = String(args ?? "").trim();
        if (!command) {
          ctx.ui.notify(renderStatus(guard.getStatus()), "info");
          updateStatus(ctx);
          return;
        }

        if (command === "init") {
          const result = await guard.initializeConfig();
          ctx.ui.notify(result.created ? `Initialized ${result.path}` : `Guard config already exists at ${result.path}`, result.created ? "success" : "warning");
          updateStatus(ctx);
          return;
        }

        if (command === "readonly" || command === "workspace-write") {
          const status = await guard.setMode(command);
          ctx.ui.notify(`Guard mode set to ${status.mode}`, "success");
          updateStatus(ctx);
          return;
        }

        ctx.ui.notify("Usage: /guard [init|readonly|workspace-write]", "warning");
      } catch (error) {
        ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
      }
    },
  });
}

function renderStatus(status: any) {
  const lines = [
    `Status: ${status.kind}`,
    `Mode: ${displayMode(status.mode)}`,
    `Guard active: ${status.guardActive ? "yes" : "no"}`,
    `Sandbox active: ${status.sandboxActive ? "yes" : "no"}`,
    `Config: ${status.configPath}`,
    `Workspace: ${status.workspaceRoot}`,
    `Scope: ${status.scope}`,
    "User !cmd/!!cmd: not guarded",
  ];
  if (status.error) lines.push(`Error: ${status.error}`);
  return lines.join("\n");
}
