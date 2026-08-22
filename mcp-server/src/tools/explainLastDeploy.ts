import { z } from "zod";
import {
  findServiceByName,
  getDeploymentsForService,
  getPolicyDecisionForDeployment,
  getRuleForDecision,
  getApproverForDecision,
  getImageForDeployment,
  getCvesForImage,
  trace,
} from "../graph/client.js";

export const explainLastDeploySchema = {
  service: z.string().describe("Service name, e.g. 'sock-app'"),
};

/**
 * Combines the other read-only queries into one narration-ready structure
 * for "what happened with the last deploy" questions. The `summary` string
 * is built entirely from the fields above it, from this tool call — the
 * calling agent should narrate this, not add facts of its own.
 */
export async function explainLastDeploy(input: { service: string }) {
  const service = findServiceByName(input.service);
  if (!service) {
    const result = { error: `No service named '${input.service}' found in the graph.` };
    trace("explain_last_deploy", input, result);
    return result;
  }

  const deployments = getDeploymentsForService(service.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const last = deployments[0];
  if (!last) {
    const result = { error: `Service '${service.name}' has no recorded deployments.` };
    trace("explain_last_deploy", input, result);
    return result;
  }

  const decision = getPolicyDecisionForDeployment(last.id);
  const rule = decision ? getRuleForDecision(decision.id) : undefined;
  const approver = decision ? getApproverForDecision(decision.id) : undefined;
  const image = getImageForDeployment(last.id);
  const cves = image ? getCvesForImage(image.id) : [];

  let summary: string;
  if (!decision) {
    summary = `Deployment ${last.id} (version ${last.version}) has no recorded policy decision.`;
  } else if (decision.verdict === "block") {
    summary =
      `Deployment ${last.id} (version ${last.version}) was BLOCKED: ${decision.reason}` +
      (approver
        ? ` Pending approval from ${approver.name} to override.`
        : " No approver recorded — no override has been requested.");
  } else {
    summary = `Deployment ${last.id} (version ${last.version}) PASSED policy and is live at ${last.traffic_weight}% traffic.`;
  }

  const result = {
    service: service.name,
    deployment: last,
    image: image ?? null,
    cves,
    policy_decision: decision ?? null,
    rule_fired: rule?.id ?? null,
    approver: approver?.name ?? null,
    summary,
  };

  trace("explain_last_deploy", input, result);
  return result;
}
