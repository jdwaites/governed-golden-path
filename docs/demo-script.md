# Demo Script

A rehearsable walkthrough, not an improvised tour. Each step names the exact
command or question to run and the outcome to expect. See
`docs/architecture-v2.md` for the narrative behind why each piece exists.

Assumes: AWS infra is up (`iac/`), GitHub secrets `AWS_ROLE_ARN` /
`ECR_REGISTRY` are set, and you have a terminal plus a Claude Code session
open in this repo.

---

## Step 1 — Show a signed, attested build

Trigger `build.yml` (Actions tab, or `gh workflow run build.yml --ref <branch>`).
When it finishes, open the run summary — it prints the digest and the
verification commands directly.

**Say:** "Every image this pipeline builds carries its own SBOM, signature,
and provenance — not a claim, let's check it."

**Run** (paste the digest from the build summary):
```bash
cosign verify --certificate-identity-regexp "^https://github.com/jdwaites/governed-golden-path/" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  <registry>/octopus-eks-demo-app@<digest>
```
**Expect:** signature verified, Rekor transparency log entry, correct repo/workflow/commit identity printed.

---

## Step 2 — Show the policy gate actually blocking a deploy

Trigger `deploy.yml` with the version tag from Step 1.

**Say:** "Watch what happens when the pipeline hits a real vulnerable image —
this isn't a rubber stamp."

**Expect:** the `policy-check` job runs Grype against the real SBOM,
Conftest evaluates `policy/rules/*.rego`, and (on this app's current base
image) it blocks: `POL-7734: image has 5 critical CVEs, exceeds max allowed
(3)`. The `deploy` job never runs — `needs: policy-check` means GitHub
Actions itself enforces this, not a convention anyone could skip.

**Show:** download the `policy-decision-*` artifact from the run and open
`policy-decision.json` — the exact structured verdict, rule fired, and CVE
counts.

---

## Step 3 — Connect the policy decision to the rule that fired

**Show:** `policy/rules/max-critical-cves.rego` — point at rule id
`POL-7734` and the threshold of `3`, and the `reason` string in the JSON
from Step 2 that cites that exact rule id.

**Say:** "The decision isn't a black box — it's traceable to one rule in one
file, in a pull request like any other code change."

---

## Step 4 — Ask the agent why, and watch it ground the answer

In a Claude Code session with this repo's `.mcp.json` and `CLAUDE.md` loaded:

**Ask:** *"Why was deployment dep-1.4-32585068408 blocked?"*

**Expect:** the agent calls `query_policy_decision`, not its own memory — you
can see the tool call in the transcript. The answer cites the real 5
critical CVEs, threshold of 3, rule `POL-7734`, from the real Phase 1
pipeline run.

---

## Step 5 — Prove it's grounded, not guessing

**Ask:** *"Why was deployment dep-002-fictional-demo blocked, and who needs
to approve it?"*

**Expect:** the answer names `CVE-2031-13337` and `Priya Okonkwo-Lindqvist`
— two facts invented solely for `graph/seed-data.json` that cannot exist in
any base model's training data. If the agent's answer contains those exact
strings, that is direct proof it queried the graph rather than pattern-matching
a plausible-sounding answer.

**Say:** "I could ask this same question with the MCP server disconnected,
and per the constraint in `CLAUDE.md`, the correct behavior is to say it
doesn't know — not guess something plausible."

---

## Step 6 — Show the query trace (not just the final answer)

**Show:** the same Claude Code transcript's tool-call result for
`query_policy_decision` — the `_raw_graph_payload` field, and/or the
`[graph-query]` line the server logs to stderr.

**Say:** "The synthesized answer you just saw isn't asserted — here's the
exact raw graph data it was built from, visible before the summary, not
buried in a log you'd have to go dig for."

---

## Step 7 — Close on the golden-path framing and honest scope

**Say:** "Every piece here — signed builds, SBOMs, policy gates, an agent
interface, a grounding graph — is inherited by any team that forks this
pattern, without redoing the work. And to be direct about scope: this is a
reference pattern proving each mechanism end-to-end, not a production claim.
The graph is JSON, not Neo4j yet; `shift_traffic` is simulated, not wired to
a real Helm call; the provenance attestation is a documented simplified
equivalent of the official SLSA generator. Each of those is a labeled
scoping decision, not a hidden gap — see `docs/architecture-v2.md`."
