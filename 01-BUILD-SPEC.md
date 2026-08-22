# Build Spec

Base repo: fork/extend `maroon-alligator` (EKS blue/green/canary demo — Node.js app,
Helm, Terraform, Istio, GitHub Actions).

---

## Workstream Sequencing (Weekend Plan)

| Phase | Workstream | Priority | Est. Effort |
|---|---|---|---|
| 1 | SLSA provenance + SBOM + policy-as-code gate | Highest — closes named gap fastest, lowest risk | 3–5 hrs |
| 2 | MCP server exposing pipeline as agent tools | High — closes named gap, high demo value | 3–5 hrs |
| 3 | Minimal Knowledge Graph + grounding (techniques 1–3 only) | High — closes named gap | 3–5 hrs |
| 4 | Narrative layer (README, architecture doc, demo script) | Required, do last | 1–2 hrs |
| Stretch | Observability tie-in (Prometheus/Grafana) | Optional if time remains | — |
| Deferred | Live graph-mutation demo, on/off contrast demo, negative-space tests | Explicitly deferred — needs real test-case design | — |

Do Phase 1 and 2 first even if Phase 3 doesn't get fully finished — 1 and 2 alone
already answer most of the JD's stated themes.

---

## File Structure (additions to existing repo)

```
maroon-alligator/
├── app/                        # existing Node.js app — unchanged
├── helm/sock-app/               # existing — unchanged
├── iac/                         # existing Terraform — unchanged
├── scripts/                     # existing helper scripts
├── .github/workflows/
│   ├── build.yml                # existing — EXTEND with SLSA/SBOM steps
│   ├── deploy.yml                # existing — EXTEND with policy gate step
│   ├── terraform.yml             # existing — unchanged
│   └── policy-check.yml          # NEW — reusable policy evaluation workflow
├── policy/
│   ├── rules/
│   │   ├── max-critical-cves.rego       # NEW — Conftest/OPA policy
│   │   └── require-signed-image.rego    # NEW
│   └── README.md                 # NEW — explains the policy-as-code approach
├── mcp-server/
│   ├── src/
│   │   ├── index.ts              # NEW — MCP server entrypoint
│   │   ├── tools/
│   │   │   ├── queryDeploymentStatus.ts
│   │   │   ├── queryPolicyDecision.ts
│   │   │   ├── queryServiceGraph.ts
│   │   │   ├── shiftTraffic.ts           # optional action tool, gated/confirm-required
│   │   │   └── explainLastDeploy.ts
│   │   └── graph/
│   │       ├── client.ts          # graph DB connection (or JSON-graph loader)
│   │       └── seed.ts            # seed data — including the deliberately-fictitious facts
│   ├── package.json
│   └── README.md                 # NEW — MCP server usage + agent wiring instructions
├── graph/
│   ├── schema.md                  # NEW — node/edge definitions (see below)
│   └── seed-data.json             # NEW — actual seed nodes/edges
├── docs/
│   ├── architecture.png           # existing
│   ├── architecture-v2.md         # NEW — narrates the extended architecture
│   └── demo-script.md             # NEW — the actual walkthrough script for interview day
└── README.md                      # UPDATE — new top section framing the extended story
```

---

## Phase 1 — SLSA / SBOM / Policy-as-Code

**Goal:** every image built by `build.yml` is signed, has a provenance attestation, has
a generated SBOM, and cannot be deployed unless it passes policy checks.

Steps to add to `build.yml`:
1. After Docker build/push, generate SBOM with **Syft** → CycloneDX JSON, upload as
   workflow artifact and/or push alongside image in ECR.
2. Sign the image with **cosign** (keyless OIDC signing via GitHub Actions identity —
   consistent with the existing OIDC-to-AWS pattern already in the repo, good narrative
   continuity).
3. Generate SLSA provenance via `slsa-framework/slsa-github-generator` (or a documented
   simplified equivalent if the official generator is too heavy for a demo — note in
   README which you chose and why).

New `policy-check.yml` (called from `deploy.yml` before the Helm deploy step):
1. Pull the SBOM for the target image.
2. Run **Conftest** (OPA) against `policy/rules/*.rego`:
   - `max-critical-cves.rego` — block if critical CVE count exceeds threshold
   - `require-signed-image.rego` — block if cosign signature is missing/invalid
3. Write the policy decision (pass/block + reason + rule fired) to a structured JSON
   output — **this output is what feeds the knowledge graph in Phase 3**, so match the
   `PolicyDecision` node shape from the start.

**README.md addition:** one paragraph explicitly framed as "golden path" — i.e., this
isn't a one-off check, it's the paved road: any team forking this pattern inherits
signed builds, SBOMs, and policy gates for free.

---

## Phase 2 — MCP Server

**Goal:** expose pipeline/deployment state as tools an agent can call — this is the
"MCP as universal interface" proof point.

### Tool Definitions

```
query_deployment_status
  input: { service: string, version?: string }
  output: { service, active_deployment_id, blue_weight, green_weight, versions, last_updated }

query_policy_decision
  input: { deployment_id: string }
  output: { deployment_id, verdict: "pass"|"block", rule_fired, reason, cves: [...], approver? }
  # logs raw graph query + raw result before returning synthesized answer — this is the
  # "show your work" tool, most important for the grounding demo

query_service_graph
  input: { service: string }
  output: full local neighborhood — deployments, images, CVEs, policy decisions, approvers
  # used for open-ended "tell me about X" questions

explain_last_deploy
  input: { service: string }
  output: natural-language-ready structured summary combining the above, for the agent
  to narrate — but the underlying data must come from the tool call, not the model

shift_traffic  (STRETCH — only if time allows, and gate behind explicit confirmation)
  input: { service, blue_weight, green_weight }
  output: result of a real (or simulated) Helm upgrade
  # this is the one "action" tool vs. read-only query tools — flag clearly in demo
  # narrative that this is confirm-gated, matching real-world agent-safety practice
```

### System Prompt Constraint (critical — this is what makes grounding real, not cosmetic)

The agent's system prompt must state, explicitly:

> You have no built-in knowledge of this system's deployment history, policy decisions,
> or vulnerability state. For any question about current or historical deployment
> status, policy verdicts, or CVEs, you must call the appropriate tool before answering.
> If a tool call returns no data, say so directly — do not infer or guess.

This single constraint is what separates "agent with a nice UI" from "agent that
provably can't hallucinate this category of answer."

---

## Phase 3 — Minimal Knowledge Graph (Techniques 1–3 only, per plan)

### Graph Schema (`graph/schema.md`)

**Nodes:**
- `Service` — name, repo, current_version
- `Deployment` — id, version, blue_or_green, traffic_weight, timestamp
- `Image` — tag, sha, sbom_ref
- `CVE` — id, severity, cvss_score
- `PolicyRule` — id, description, threshold (e.g. `max_critical_cves: 3`)
- `PolicyDecision` — id, verdict, evaluated_at, reason
- `Approver` — name

**Edges:**
- `Service -[:HAS_DEPLOYMENT]-> Deployment`
- `Deployment -[:RUNS_IMAGE]-> Image`
- `Image -[:HAS_VULNERABILITY]-> CVE`
- `Deployment -[:EVALUATED_BY]-> PolicyDecision`
- `PolicyDecision -[:APPLIED_RULE]-> PolicyRule`
- `PolicyDecision -[:APPROVED_BY]-> Approver` (nullable)

### Implementation Note

Use **Neo4j** if you want the "real graph DB" credibility signal (free tier / local
Docker instance is fine for a demo). If time is tight, a JSON adjacency structure loaded
into memory with a thin query layer is an acceptable fallback — note in the README which
you used and that swapping in Neo4j is a documented next step, so it reads as a
deliberate scoping decision, not a shortcut you're hiding.

### Seed Data — Include Deliberately Fictitious Facts (Technique 2)

`graph/seed-data.json` must include 2–3 facts that cannot exist in any base model's
training data, e.g.:
- A policy rule with an invented, oddly specific threshold (`max_critical_cves: 3`
  tied to rule ID `POL-7734`)
- A fabricated CVE ID attached to a specific deployment, not a real CVE
- An approver name that only exists in this seed data

The demo question ("why was deployment X blocked, and who needs to approve it?") should
only be answerable by querying this exact seed data — that's your proof the answer is
graph-sourced, not model-recalled.

### Query Trace Visibility (Technique 3)

`queryPolicyDecision.ts` should log (to console, and ideally to a visible panel/log in
whatever UI wraps this) both the raw query issued and the raw node/edge payload
returned, before the agent's synthesized natural-language answer is shown. This is a
formatting/logging decision, not new engineering — don't skip it, it's the cheapest,
highest-credibility piece of the whole workstream.

---

## Phase 4 — Narrative Layer

- `docs/architecture-v2.md`: narrates the evolution — "started as a blue/green EKS
  reference pattern; extended into a governed, agent-operable platform with supply-chain
  integrity and grounded decision-making." This doc is the connective tissue between the
  three workstreams — write it as a story, not a feature list.
- `docs/demo-script.md`: the literal walkthrough for interview day — 5–7 steps, each
  with the command/question to run and the expected outcome, so the demo is rehearsable
  and doesn't rely on improvising under pressure.
- Update the main `README.md` with a new top section reframing the whole repo per the
  brief's one-line description, before the existing content.

---

## Stretch: Observability

If time remains — Prometheus + Grafana (or Datadog) around the canary rollout, giving
the agent a `query_deployment_health` tool that pulls error rate/latency for the active
traffic split. This ties observability, policy, and the graph together into one
coherent reasoning loop ("don't promote — error rate on green is elevated") rather than
three disconnected demos. Not required for interview readiness; do this only after
Phases 1–4 are solid.

---

## Deferred (Explicitly Not This Weekend)

Live graph-mutation demo, on/off grounding contrast, negative-space test — all good
techniques, all require real test-case design to land well live rather than falling
flat. Revisit after Phase 3 is stable and there's time to script them properly.
