import { z } from "zod";
import {
  findServiceByName,
  getDeploymentsForService,
  getImageForDeployment,
  getCvesForImage,
  getPolicyDecisionForDeployment,
  getRuleForDecision,
  getApproverForDecision,
  trace,
} from "../graph/client.js";

export const queryServiceGraphSchema = {
  service: z.string().describe("Service name, e.g. 'sock-app'"),
};

export async function queryServiceGraph(input: { service: string }) {
  const service = findServiceByName(input.service);
  if (!service) {
    const result = { error: `No service named '${input.service}' found in the graph.` };
    trace("query_service_graph", input, result);
    return result;
  }

  const deployments = getDeploymentsForService(service.id).map((deployment) => {
    const image = getImageForDeployment(deployment.id);
    const cves = image ? getCvesForImage(image.id) : [];
    const decision = getPolicyDecisionForDeployment(deployment.id);
    const rule = decision ? getRuleForDecision(decision.id) : undefined;
    const approver = decision ? getApproverForDecision(decision.id) : undefined;
    return {
      deployment,
      image: image ?? null,
      cves,
      decision: decision ?? null,
      rule_fired: rule?.id ?? null,
      approver: approver?.name ?? null,
    };
  });

  const result = { service, deployments };
  trace("query_service_graph", input, result);
  return result;
}
