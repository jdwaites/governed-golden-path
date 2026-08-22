import { z } from "zod";
import { findServiceByName, getDeploymentsForService, trace } from "../graph/client.js";

export const queryDeploymentStatusSchema = {
  service: z.string().describe("Service name, e.g. 'sock-app'"),
  version: z.string().optional().describe("Optional specific version to filter to, e.g. '1.4'"),
};

export async function queryDeploymentStatus(input: { service: string; version?: string }) {
  const service = findServiceByName(input.service);
  if (!service) {
    const result = { error: `No service named '${input.service}' found in the graph.` };
    trace("query_deployment_status", input, result);
    return result;
  }

  let deployments = getDeploymentsForService(service.id);
  if (input.version) {
    deployments = deployments.filter((d) => d.version === input.version);
  }

  const byRecency = [...deployments].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const blue = deployments.filter((d) => d.blue_or_green === "blue").sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const green = deployments.filter((d) => d.blue_or_green === "green").sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const mostRecent = byRecency[0];

  const result = {
    service: service.name,
    active_deployment_id: mostRecent?.id ?? null,
    blue_weight: blue?.traffic_weight ?? 0,
    green_weight: green?.traffic_weight ?? 0,
    versions: deployments.map((d) => ({
      id: d.id,
      version: d.version,
      blue_or_green: d.blue_or_green,
      traffic_weight: d.traffic_weight,
    })),
    last_updated: mostRecent?.timestamp ?? null,
  };

  trace("query_deployment_status", input, result);
  return result;
}
