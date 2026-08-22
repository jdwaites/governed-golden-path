#!/usr/bin/env node
// Reads a real policy-decision.json artifact — the exact JSON policy-check.yml
// writes and uploads (see policy/README.md) — and upserts it into
// graph/seed-data.json as a PolicyDecision node plus its Deployment/Image
// nodes and edges, with no field renaming or shape transformation in
// between. This replaces hand-writing that node: `node graph/ingest-policy-decision.mjs
// path/to/policy-decision.json` is how a real pipeline run's outcome gets
// into the graph the MCP server serves.
//
// Idempotent: re-running with the same artifact updates the existing nodes
// in place rather than duplicating them.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = join(__dirname, "seed-data.json");

// Maps the rule slug policy-check.yml's rule_fired[] entries use (matching
// rego filenames) to the PolicyRule node id (matching rule ids in
// policy/rules/*.rego). Extend this when a new rule file is added.
const RULE_SLUG_TO_ID = {
  "max-critical-cves": "POL-7734",
  "require-signed-image": "POL-SIG-01",
};

const artifactPath = process.argv[2];
if (!artifactPath) {
  console.error("Usage: node graph/ingest-policy-decision.mjs <path-to-policy-decision.json>");
  process.exit(1);
}

const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));

function upsertNode(node) {
  const i = seed.nodes.findIndex((n) => n.id === node.id);
  if (i === -1) seed.nodes.push(node);
  else seed.nodes[i] = node;
}

function upsertEdge(edge) {
  const exists = seed.edges.some((e) => e.type === edge.type && e.from === edge.from && e.to === edge.to);
  if (!exists) seed.edges.push(edge);
}

const deploymentId = `dep-${artifact.deployment_id}`;
const imageTag = artifact.image.includes(":") ? artifact.image.slice(artifact.image.lastIndexOf(":") + 1) : artifact.image;
const existingImage = seed.nodes.find((n) => n.type === "Image" && n.tag === imageTag);
const imageId = existingImage?.id ?? `img-${imageTag}`;

// Deployment: blue_or_green is always "blue" here because deploy.yml's
// policy-check job is deliberately scoped to the blue_version image (see the
// comment on that job in deploy.yml) — this script doesn't guess at that,
// it's a documented convention of this pipeline, not inferred from the
// artifact. traffic_weight is 0 on a block verdict (the deploy never ran);
// a pass verdict's actual weight comes from deploy.yml's own inputs, not
// this artifact, so it's left at 0 with that limitation noted rather than
// guessed.
upsertNode({
  type: "Deployment",
  id: deploymentId,
  version: imageTag,
  blue_or_green: "blue",
  traffic_weight: 0,
  timestamp: artifact.evaluated_at,
  note:
    artifact.verdict === "block"
      ? "traffic_weight is 0 because the policy gate blocked this deployment before Helm ran"
      : "traffic_weight defaults to 0 here — the real value lives in deploy.yml's inputs, not in policy-decision.json",
  provenance: "real-pipeline-run",
});

// Image: only populate what's derivable from policy-decision.json itself
// (the tag, embedded in the `image` field). sha/sbom_ref aren't part of that
// artifact's schema — they come from build.yml's own digest-resolution step,
// a separate real artifact this script doesn't have. Don't overwrite a
// richer existing Image node (e.g. one a build.yml ingestion step populated)
// if one already exists for this tag.
if (!existingImage) {
  upsertNode({
    type: "Image",
    id: imageId,
    tag: imageTag,
    sha: null,
    sbom_ref: null,
    note: "sha/sbom_ref not available from policy-decision.json alone — populate from build.yml's digest-resolution output",
    provenance: "real-pipeline-run",
  });
}

upsertNode({
  type: "PolicyDecision",
  id: artifact.id,
  deployment_id: artifact.deployment_id,
  verdict: artifact.verdict,
  evaluated_at: artifact.evaluated_at,
  rule_fired: artifact.rule_fired,
  reason: artifact.reason,
  cves: artifact.cves,
  image: artifact.image,
  signature: artifact.signature,
  provenance: "real-pipeline-run",
});

upsertEdge({ type: "HAS_DEPLOYMENT", from: "svc-sock-app", to: deploymentId });
upsertEdge({ type: "RUNS_IMAGE", from: deploymentId, to: imageId });
upsertEdge({ type: "EVALUATED_BY", from: deploymentId, to: artifact.id });

for (const slug of artifact.rule_fired ?? []) {
  const ruleId = RULE_SLUG_TO_ID[slug];
  if (!ruleId) {
    console.warn(`Warning: no PolicyRule mapping for rule slug '${slug}' — add it to RULE_SLUG_TO_ID.`);
    continue;
  }
  upsertEdge({ type: "APPLIED_RULE", from: artifact.id, to: ruleId });
}

if (artifact.approver) {
  const approverId = `approver-${String(artifact.approver).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  upsertNode({ type: "Approver", id: approverId, name: artifact.approver, provenance: "real-pipeline-run" });
  upsertEdge({ type: "APPROVED_BY", from: artifact.id, to: approverId });
}

writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
console.log(`Ingested ${artifact.id} (deployment ${deploymentId}, verdict ${artifact.verdict}) into ${SEED_PATH}`);
