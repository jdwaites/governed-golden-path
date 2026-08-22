import { z } from "zod";
import { trace } from "../graph/client.js";

export const shiftTrafficSchema = {
  service: z.string().describe("Service name, e.g. 'sock-app'"),
  blue_weight: z.number().min(0).max(100).describe("Percent traffic to blue (0-100)"),
  green_weight: z.number().min(0).max(100).describe("Percent traffic to green (0-100)"),
  confirm: z
    .boolean()
    .default(false)
    .describe("Must be explicitly true to execute. This is the one action tool here — everything else is read-only."),
};

/**
 * DEMO-STUBBED: does not call `helm upgrade` against a real cluster. This is
 * the one "action" tool in this server (build spec Phase 2 stretch goal),
 * gated behind an explicit confirm flag to match real-world agent-safety
 * practice — an agent must be re-invoked with confirm: true after seeing the
 * confirmation_required response, it can't fall through on the first call.
 * Wiring this to a real
 *   helm upgrade --install sock-app ./helm/sock-app \
 *     --set traffic.blue.weight=... --set traffic.green.weight=...
 * (the same command .github/workflows/deploy.yml already runs) is a
 * documented next step — see mcp-server/README.md — not a hidden gap.
 */
export async function shiftTraffic(input: {
  service: string;
  blue_weight: number;
  green_weight: number;
  confirm: boolean;
}) {
  if (input.blue_weight + input.green_weight !== 100) {
    const result = {
      error: `blue_weight + green_weight must total 100 (got ${input.blue_weight + input.green_weight}).`,
    };
    trace("shift_traffic", input, result);
    return result;
  }

  if (!input.confirm) {
    const result = {
      status: "confirmation_required" as const,
      message:
        `This would shift '${input.service}' traffic to blue=${input.blue_weight}% / green=${input.green_weight}%. ` +
        "Re-call this tool with confirm: true to proceed. Note: this tool is simulated in this demo — " +
        "no real Helm upgrade is executed even when confirmed.",
    };
    trace("shift_traffic", input, result);
    return result;
  }

  const result = {
    status: "simulated" as const,
    service: input.service,
    blue_weight: input.blue_weight,
    green_weight: input.green_weight,
    message:
      "SIMULATED — no real `helm upgrade` was executed. In a real deployment this would run the same " +
      "helm upgrade --install sock-app ./helm/sock-app --set traffic.blue.weight=... --set traffic.green.weight=... " +
      "command that .github/workflows/deploy.yml runs, behind the same policy-check.yml gate.",
  };
  trace("shift_traffic", input, result);
  return result;
}
