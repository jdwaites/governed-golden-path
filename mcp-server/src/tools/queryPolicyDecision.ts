import { z } from "zod";
import {
  getDeploymentById,
  getPolicyDecisionForDeployment,
  getRuleForDecision,
  getApproverForDecision,
  getImageForDeployment,
  getCvesForImage,
  trace,
} from "../graph/client.js";

export const queryPolicyDecisionSchema = {
  deployment_id: z.string().describe("Deployment id, e.g. 'dep-1.4-32585068408'"),
};

/**
 * The "show your work" tool — most important for the grounding demo. Logs
 * (and returns) the raw graph payload before any synthesized answer, so a
 * caller can point at exactly which recorded facts produced the verdict,
 * rule, and approver below rather than trusting a bare assertion.
 */
export async function queryPolicyDecision(input: { deployment_id: string }) {
  const deployment = getDeploymentById(input.deployment_id);
  if (!deployment) {
    const result = { error: `No deployment '${input.deployment_id}' found in the graph.` };
    trace("query_policy_decision", input, result);
    return result;
  }

  const decision = getPolicyDecisionForDeployment(deployment.id);
  if (!decision) {
    const result = { error: `Deployment '${deployment.id}' has no recorded PolicyDecision.` };
    trace("query_policy_decision", input, result);
    return result;
  }

  const rule = getRuleForDecision(decision.id);
  const approver = getApproverForDecision(decision.id);
  const image = getImageForDeployment(deployment.id);
  const cves = image ? getCvesForImage(image.id) : [];

  const rawGraphPayload = { deployment, decision, rule: rule ?? null, approver: approver ?? null, image: image ?? null, cves };

  const result = {
    deployment_id: deployment.id,
    verdict: decision.verdict,
    rule_fired: rule?.id ?? null,
    reason: decision.reason,
    cves_summary: decision.cves_summary,
    cves,
    approver: approver?.name ?? null,
    // Raw evidence, included in the tool result itself (not just logged) so
    // whatever surfaces this response can show it before the synthesized
    // fields above.
    _raw_graph_payload: rawGraphPayload,
  };

  trace("query_policy_decision", input, rawGraphPayload);
  return result;
}
