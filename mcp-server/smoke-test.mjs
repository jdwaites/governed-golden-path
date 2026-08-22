// Drives the built server through a real MCP client/server stdio handshake —
// lists tools, then calls each one against the seed graph. Run with
// `npm run smoke-test` after any change to src/. Not a replacement for wiring
// this into a real agent, just a fast way to check the tools actually work
// end-to-end without one.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/index.js"],
});

const client = new Client({ name: "smoke-test", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
console.log("=== TOOLS ===");
console.log(tools.tools.map((t) => t.name).join(", "));

async function call(name, args) {
  console.log(`\n=== ${name}(${JSON.stringify(args)}) ===`);
  const res = await client.callTool({ name, arguments: args });
  console.log(res.content[0].text);
}

await call("query_deployment_status", { service: "sock-app" });
await call("query_policy_decision", { deployment_id: "dep-1.4-32585068408" });
await call("query_policy_decision", { deployment_id: "dep-002-fictional-demo" });
await call("query_service_graph", { service: "sock-app" });
await call("explain_last_deploy", { service: "sock-app" });
await call("shift_traffic", { service: "sock-app", blue_weight: 50, green_weight: 50 });
await call("shift_traffic", { service: "sock-app", blue_weight: 50, green_weight: 50, confirm: true });
await call("query_deployment_status", { service: "nonexistent-service" });

await client.close();
process.exit(0);
