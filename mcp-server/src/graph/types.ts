export interface ServiceNode {
  type: "Service";
  id: string;
  name: string;
  repo: string;
  current_version: string;
  provenance: string;
}

export interface DeploymentNode {
  type: "Deployment";
  id: string;
  version: string;
  blue_or_green: "blue" | "green";
  traffic_weight: number;
  timestamp: string;
  note?: string;
  provenance: string;
}

export interface ImageNode {
  type: "Image";
  id: string;
  tag: string;
  // Nullable: an Image node ingested from policy-decision.json alone (see
  // graph/ingest-policy-decision.mjs) only has a tag — sha/sbom_ref come
  // from build.yml's separate digest-resolution artifact.
  sha: string | null;
  sbom_ref: string | null;
  note?: string;
  provenance: string;
}

export interface CveNode {
  type: "CVE";
  id: string;
  severity: string;
  cvss_score: number;
  note?: string;
  provenance: string;
}

export interface PolicyRuleNode {
  type: "PolicyRule";
  id: string;
  description: string;
  threshold: number | null;
  provenance: string;
}

/**
 * Field names here deliberately match policy-check.yml's emitted
 * policy-decision.json 1:1 (see policy/README.md) — this node is meant to be
 * produced by parsing that artifact directly (graph/ingest-policy-decision.mjs),
 * not hand-transformed into a different shape.
 */
export interface PolicyDecisionNode {
  type: "PolicyDecision";
  id: string;
  deployment_id: string;
  verdict: "pass" | "block";
  evaluated_at: string;
  rule_fired: string[];
  reason: string;
  cves: { critical: number; high: number };
  image: string;
  signature: { verified: boolean };
  provenance: string;
}

export interface ApproverNode {
  type: "Approver";
  id: string;
  name: string;
  note?: string;
  provenance: string;
}

export type GraphNode =
  | ServiceNode
  | DeploymentNode
  | ImageNode
  | CveNode
  | PolicyRuleNode
  | PolicyDecisionNode
  | ApproverNode;

export interface GraphEdge {
  type: "HAS_DEPLOYMENT" | "RUNS_IMAGE" | "HAS_VULNERABILITY" | "EVALUATED_BY" | "APPLIED_RULE" | "APPROVED_BY";
  from: string;
  to: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
