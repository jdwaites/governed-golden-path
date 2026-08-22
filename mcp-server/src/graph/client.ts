import { seedGraph } from "./seed.js";
import type {
  GraphNode,
  GraphEdge,
  ServiceNode,
  DeploymentNode,
  ImageNode,
  CveNode,
  PolicyRuleNode,
  PolicyDecisionNode,
  ApproverNode,
} from "./types.js";

function nodeById(id: string): GraphNode | undefined {
  return seedGraph.nodes.find((n) => n.id === id);
}

function nodesByType<T extends GraphNode["type"]>(type: T): Extract<GraphNode, { type: T }>[] {
  return seedGraph.nodes.filter((n): n is Extract<GraphNode, { type: T }> => n.type === type);
}

function edgesFrom(from: string, type?: GraphEdge["type"]): GraphEdge[] {
  return seedGraph.edges.filter((e) => e.from === from && (!type || e.type === type));
}

export function findServiceByName(name: string): ServiceNode | undefined {
  return nodesByType("Service").find((s) => s.name === name);
}

export function getDeploymentsForService(serviceId: string): DeploymentNode[] {
  return edgesFrom(serviceId, "HAS_DEPLOYMENT")
    .map((e) => nodeById(e.to))
    .filter((n): n is DeploymentNode => n?.type === "Deployment");
}

export function getDeploymentById(id: string): DeploymentNode | undefined {
  const n = nodeById(id);
  return n?.type === "Deployment" ? n : undefined;
}

export function getImageForDeployment(deploymentId: string): ImageNode | undefined {
  const node = edgesFrom(deploymentId, "RUNS_IMAGE").map((e) => nodeById(e.to))[0];
  return node?.type === "Image" ? node : undefined;
}

export function getCvesForImage(imageId: string): CveNode[] {
  return edgesFrom(imageId, "HAS_VULNERABILITY")
    .map((e) => nodeById(e.to))
    .filter((n): n is CveNode => n?.type === "CVE");
}

export function getPolicyDecisionForDeployment(deploymentId: string): PolicyDecisionNode | undefined {
  const node = edgesFrom(deploymentId, "EVALUATED_BY").map((e) => nodeById(e.to))[0];
  return node?.type === "PolicyDecision" ? node : undefined;
}

export function getRuleForDecision(decisionId: string): PolicyRuleNode | undefined {
  const node = edgesFrom(decisionId, "APPLIED_RULE").map((e) => nodeById(e.to))[0];
  return node?.type === "PolicyRule" ? node : undefined;
}

export function getApproverForDecision(decisionId: string): ApproverNode | undefined {
  const node = edgesFrom(decisionId, "APPROVED_BY").map((e) => nodeById(e.to))[0];
  return node?.type === "Approver" ? node : undefined;
}

/**
 * Logs the raw query name/params/result to stderr (stdout is reserved for
 * MCP protocol frames over the stdio transport) so the raw graph payload
 * behind every answer is inspectable before any synthesized summary —
 * build spec Phase 3 Technique 3 ("query trace visibility").
 */
export function trace(queryName: string, params: Record<string, unknown>, result: unknown): void {
  console.error(`[graph-query] ${queryName} ${JSON.stringify({ params, result })}`);
}
