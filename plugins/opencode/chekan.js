import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const HOOK = fileURLToPath(new URL("../../hooks/chekan_hook.py", import.meta.url));

export const Chekan = async ({ client, directory }) => {
  const parents = new Map();
  const context = new Map();

  const parentOf = async (id) => {
    if (!parents.has(id)) {
      try {
        const r = await client.session.get({ path: { id } });
        const info = r?.data ?? r;
        parents.set(id, { parentID: info?.parentID || "", agent_type: info?.agent || "" });
      } catch {
        return {};
      }
    }
    return parents.get(id);
  };

  const call = async (payload) => {
    const input = JSON.stringify({ directory, ...payload, ...(await parentOf(payload.sessionID)) });
    const r = spawnSync("python3", [HOOK, "--agent", "opencode"], { input, encoding: "utf8", timeout: 30000 });
    try {
      return JSON.parse(r.stdout || "{}");
    } catch {
      return {};
    }
  };

  return {
    "tool.execute.before": async (input, output) => {
      const out = await call({ hook: "tool.execute.before", tool: input.tool, sessionID: input.sessionID, args: output.args });
      if (out.decision === "deny") throw new Error(out.reason);
    },
    "experimental.chat.system.transform": async (input, output) => {
      if (!context.has(input.sessionID)) {
        context.set(input.sessionID, (await call({ hook: "system", sessionID: input.sessionID })).context || "");
      }
      if (context.get(input.sessionID)) output.system.push(context.get(input.sessionID));
    },
  };
};
