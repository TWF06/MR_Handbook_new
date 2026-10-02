import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

function safeMcpPlugin() {
  const plugin = mcpPlugin();
  return {
    ...plugin,
    configResolved(config: any) {
      try {
        (plugin as any).configResolved?.(config);
      } catch (err: any) {
        console.warn("[MCP Plugin] Bypassed Windows path resolution issue:", err?.message || err);
      }
    },
  };
}

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [safeMcpPlugin()],
  },
});
