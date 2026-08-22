#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { queryDeploymentStatus, queryDeploymentStatusSchema } from "./tools/queryDeploymentStatus.js";
import { queryPolicyDecision, queryPolicyDecisionSchema } from "./tools/queryPolicyDecision.js";
import { queryServiceGraph, queryServiceGraphSchema } from "./tools/queryServiceGraph.js";
import { explainLastDeploy, explainLastDeploySchema } from "./tools/explainLastDeploy.js";
import { shiftTraffic, shiftTrafficSchema } from "./tools/shiftTraffic.js";

const server = new McpServer({
  name: "governed-golden-path",
  version: "0.1.0",
});

function asToolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

server.tool(
  "query_deployment_status",
  "Get current blue/green deployment status for a service: active deployment, traffic weights, and versions. Read-only, grounded in the graph — call this instead of guessing at deployment state.",
  queryDeploymentStatusSchema,
  async (input) => asToolResult(await queryDeploymentStatus(input)),
);

server.tool(
  "query_policy_decision",
  "Get the policy decision (pass/block, rule fired, CVEs, approver) recorded for a specific deployment id. This is the 'show your work' tool for 'why was X blocked' questions — it logs and returns the raw graph payload behind the verdict.",
  queryPolicyDecisionSchema,
  async (input) => asToolResult(await queryPolicyDecision(input)),
);

server.tool(
  "query_service_graph",
  "Get the full local graph neighborhood for a service: all deployments, images, CVEs, policy decisions, and approvers. Use for open-ended 'tell me about X' questions.",
  queryServiceGraphSchema,
  async (input) => asToolResult(await queryServiceGraph(input)),
);

server.tool(
  "explain_last_deploy",
  "Get a structured, narration-ready summary of a service's most recent deployment and its policy outcome.",
  explainLastDeploySchema,
  async (input) => asToolResult(await explainLastDeploy(input)),
);

server.tool(
  "shift_traffic",
  "SIMULATED blue/green traffic shift (no real Helm upgrade runs in this demo). The only action tool here — requires confirm: true, and even then only simulates the result.",
  shiftTrafficSchema,
  async (input) => asToolResult(await shiftTraffic(input)),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("governed-golden-path MCP server running on stdio");
