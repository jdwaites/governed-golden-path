# Project Brief

## Purpose

Extend the existing `maroon-alligator` EKS blue/green reference architecture into a
governed, agent-operable platform reference — built as an interview artifact for the
Experian Distinguished Platform Solutions Architect role, and reusable afterward as a
portfolio piece / consulting demo asset.

This is not a production system. It's a **credible, inspectable demonstration** of how
Jamal thinks about platform architecture at the Distinguished level: golden-path CI/CD,
supply-chain integrity, agentic operability via MCP, and grounded (non-hallucinated)
decision-making via a local knowledge graph.

---

## Working Title / Repo Name Options

Keep the existing repo naming convention (`maroon-alligator`, `sock-app`) if you want
continuity, or make it more legible to a hiring panel skimming GitHub. Suggestions:

**Continuing the playful convention:**
- `copper-mongoose` / `amber-falcon` (random adjective-animal, matches existing style)

**Legible/professional (recommended for interview sharing):**
- `governed-golden-path` — leads with the supply-chain/policy theme
- `grounded-platform-ops` — leads with the knowledge-graph/agent theme
- `agentic-eks-platform` — leads with the agentic delivery theme
- `platform-of-record` — broader, sounds like a real internal platform name

**Recommendation:** Use a professional name as the *display* name/README title even if
the actual repo slug stays whimsical — e.g. repo `copper-mongoose`, README title
"Governed Golden Path: An Agent-Operable EKS Delivery Platform." That gives you the fun
internal name for casual reference and a serious framing for the panel.

---

## One-Line Description

*A working reference platform showing how a blue/green EKS deployment pipeline becomes
agent-operable and policy-governed — supply-chain attestation (SLSA/SBOM), policy-as-code
gates, an MCP server exposing deployment operations as agent tools, and a local knowledge
graph that grounds agent answers in real system state instead of model guesswork.*

---

## Why This Matters For The Interview

Maps directly onto the JD themes and the real gaps flagged in Jamal's Experian fit
analysis:

| JD Theme | What This Project Demonstrates |
|---|---|
| Golden-path CI/CD | Existing pipeline reframed explicitly as a paved-road template, now with mandatory security/policy gates |
| SLSA / SBOM / policy-as-code | Real, working implementation — not just resume language |
| MCP as universal interface | An actual MCP server exposing pipeline operations as agent tools |
| Agentic software delivery | An agent that can check status, evaluate policy, explain decisions, and (carefully) act |
| Knowledge Graph grounding | A local graph the agent must query — provably not answering from base-model knowledge |
| Governed AI marketplace (adjacent) | Policy-as-code + auditable decision provenance is the same governance instinct at smaller scale |

---

## Success Criteria (What "Done" Looks Like By Interview Day)

1. Can walk the panel through a `build → sign → attest → SBOM → policy-check → deploy`
   pipeline run, live or via recording.
2. Can ask the agent a real question about the system ("why was this deploy blocked?")
   and show it querying the graph and citing the specific data it used.
3. Can show the query trace (not just the final answer) so the grounding is inspectable,
   not asserted.
4. Can articulate, in Distinguished-Architect language, *why* each piece exists — not
   just that it exists. (See interview narrative notes in build spec.)
5. Everything is honestly scoped — this is presented as a reference/demo pattern, not a
   claim of production-scale operation. That honesty is itself part of the Distinguished
   positioning; overclaiming is a bigger risk than a small, well-reasoned demo.

---

## Non-Goals (Explicitly Out of Scope for the Weekend)

- Production-scale agent orchestration (multi-agent, long-running autonomous ops)
- Live "pull the rug" graph-mutation demo, on/off toggle demo, negative-space test suite
  — good techniques, deferred until there's time to design real test cases (see build
  spec Phase 4/Stretch)
- Full enterprise Knowledge Graph tooling — this is a minimal graph proving the grounding
  *pattern*, not a KG platform
- Named observability tooling (Prometheus/Grafana/Datadog) — stretch goal only if time
  allows after core phases land
