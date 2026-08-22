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
  sha: string;
  sbom_ref: string;
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

export interface PolicyDecisionNode {
  type: "PolicyDecision";
  id: string;
  verdict: "pass" | "block";
  evaluated_at: string;
  reason: string;
  cves_summary: { critical: number; high: number };
  signature_verified: boolean;
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
