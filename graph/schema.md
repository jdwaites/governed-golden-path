# Knowledge Graph Schema

This is the minimal graph the MCP server (`mcp-server/`) queries so that agent
answers about deployment status, policy verdicts, and CVEs are grounded in
actual recorded facts instead of model recall. It implements techniques 1-3
from `01-BUILD-SPEC.md` Phase 3: a real (if small) graph, deliberately
fictitious seed facts that cannot exist in any base model's training data, and
full query-trace visibility on the policy-decision path.

## Implementation note: JSON, not Neo4j

The seed data lives in `graph/seed-data.json` as a flat `nodes[]` / `edges[]`
adjacency structure, loaded into memory by `mcp-server/src/graph/client.ts`
with a thin query layer on top — not a real graph database. This is the
documented fallback the build spec allows when time is tight: it proves the
*grounding pattern* (the agent must call a tool that queries real recorded
data; it cannot answer from base knowledge) without the operational overhead
of standing up Neo4j for a weekend demo. Swapping `client.ts`'s query
functions for real Cypher queries against a Neo4j instance is a drop-in
replacement — the node/edge shapes below are already written as if they were
graph database records, specifically so that swap doesn't require a schema
redesign later.

## Ingesting a real policy decision

`graph/ingest-policy-decision.mjs` parses an actual `policy-decision.json`
artifact (the same one `policy-check.yml` uploads — see `policy/README.md`)
and upserts it into `graph/seed-data.json` as a `PolicyDecision` node plus
its `Deployment`/`Image` nodes and edges, with no field renaming in between:

```bash
node graph/ingest-policy-decision.mjs path/to/policy-decision.json
```

It's idempotent (re-running with the same artifact updates the existing
nodes rather than duplicating them) and won't clobber a richer `Image` node
that already has `sha`/`sbom_ref` populated from elsewhere. This is the
actual mechanism behind `dep-1.4-32585068408` below — not a manual edit.

## Nodes

| Node | Fields | Notes |
|---|---|---|
| `Service` | `id, name, repo, current_version` | One per app (`sock-app`) |
| `Deployment` | `id, version, blue_or_green, traffic_weight, timestamp` | One per blue/green rollout event |
| `Image` | `tag, sha, sbom_ref` | `sbom_ref` points at the cosign-attached SBOM (see Phase 1) |
| `CVE` | `id, severity, cvss_score` | Individual vulnerability record |
| `PolicyRule` | `id, description, threshold` | Mirrors `policy/rules/*.rego` |
| `PolicyDecision` | `id, deployment_id, verdict, evaluated_at, rule_fired, reason, cves, image, signature` | Field-for-field identical to the JSON `policy-check.yml` emits — see `policy/README.md` and `graph/ingest-policy-decision.mjs`, which parses that artifact directly into this node with no renaming |
| `Approver` | `name` | Only populated when a decision has a human override path |

## Edges

```
Service       -[:HAS_DEPLOYMENT]->   Deployment
Deployment    -[:RUNS_IMAGE]->       Image
Image         -[:HAS_VULNERABILITY]-> CVE
Deployment    -[:EVALUATED_BY]->     PolicyDecision
PolicyDecision -[:APPLIED_RULE]->    PolicyRule
PolicyDecision -[:APPROVED_BY]->     Approver   (nullable — only present when approver is not null)
```

## Seed data provenance

`graph/seed-data.json` mixes two kinds of records, and each node says which it is via its `provenance` field:

- **`"real-pipeline-run"`** — `dep-1.4-32585068408` and everything reachable
  from it are the actual output of the Phase 1 pipeline run on
  `feature/phase1-supply-chain-policy-gate` (build run `32584509901`, deploy
  run `32585068408`): a real signed image, a real Grype scan (5 critical / 49
  high CVEs against the real SBOM), and the real `block` verdict it produced.
  The `PolicyDecision` node for it was produced by running
  `node graph/ingest-policy-decision.mjs <path-to-policy-decision.json>`
  against the actual artifact `policy-check.yml` uploaded for that run — not
  hand-typed into this file. Individual CVE identities from that real scan
  aren't enumerated here (the pipeline's own Grype/SBOM output is the
  authoritative source for those) — only the aggregate counts the real
  `PolicyDecision` recorded. The Image node's `sha`/`sbom_ref` came from a
  separate manual step (that artifact isn't part of `policy-decision.json`);
  wiring a `build.yml` digest-output ingestion path is the natural next
  extension of the same script, not a different mechanism.
- **`"fictitious-demo-fixture"`** — `dep-002-fictional-demo` and everything
  reachable from it are constructed specifically so that a question like *"why
  was deployment dep-002-fictional-demo blocked, and who needs to approve
  it?"* can only be answered by querying this graph. `CVE-2031-13337` is not a
  real CVE (2031 hasn't happened yet), and `Priya Okonkwo-Lindqvist` is not a
  real person — an answer citing either of those exact facts is proof the
  agent queried the tool rather than guessing.

`PolicyRule` node `POL-7734` (max 3 critical CVEs) is shared by both — it's
the same real rule from `policy/rules/max-critical-cves.rego`, deliberately
specific (not a round number) so a decision citing it is unambiguously
traceable back to that exact rule file.
