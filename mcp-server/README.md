# governed-golden-path MCP server

Exposes this repo's deployment status, policy decisions, and CVE state as
[MCP](https://modelcontextprotocol.io) tools, backed by the knowledge graph
in `../graph/` (schema: `../graph/schema.md`, seed data:
`../graph/seed-data.json`). This is the "MCP as universal interface" proof
point — an agent that wants to answer a question about this platform's real
state has to call a tool and read the result, not recall it.

## Setup

```bash
cd mcp-server
npm install
npm run build
```

## Running it

```bash
npm start          # runs dist/index.js on stdio
npm run smoke-test  # builds, then drives every tool through a real MCP client — no agent needed
```

You'll see `Importing JSON modules is an experimental feature` from Node —
that's an expected, harmless warning from the `graph/seed-data.json` import
in `src/graph/seed.ts`, not an error.

## Wiring this to an agent

This repo's root `.mcp.json` already wires it in for Claude Code — open a new
Claude Code session in the repo root and it's available automatically (after
you approve it on first launch). That file currently points at this
machine's actual absolute paths (`node` binary and `mcp-server/dist/index.js`)
since that's what the live demo runs against — if you clone this repo
elsewhere, either update those two paths or make sure `node` resolves on
`PATH` and switch `command` to plain `"node"` with a relative
`mcp-server/dist/index.js` arg.

To wire it into a different MCP client, add it as a stdio server, e.g.:

```json
{
  "mcpServers": {
    "governed-golden-path": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### Required system prompt constraint

This is the part that makes the grounding demo real instead of cosmetic — the
calling agent's system prompt **must** include this constraint verbatim (or
equivalent), which is why it's in this repo's `CLAUDE.md`:

> You have no built-in knowledge of this system's deployment history, policy
> decisions, or vulnerability state. For any question about current or
> historical deployment status, policy verdicts, or CVEs, you must call the
> appropriate tool before answering. If a tool call returns no data, say so
> directly — do not infer or guess.

An MCP server can't set the calling agent's system prompt for it — this has
to be configured on whatever client/agent connects to this server.

## Tools

| Tool | Purpose |
|---|---|
| `query_deployment_status` | Current blue/green weights and versions for a service |
| `query_policy_decision` | Pass/block verdict, rule fired, CVEs, approver for a deployment id — the "show your work" tool; logs the raw graph payload to stderr and returns it in `_raw_graph_payload` before any synthesized field |
| `query_service_graph` | Full local neighborhood for a service — deployments, images, CVEs, decisions, approvers |
| `explain_last_deploy` | Narration-ready summary of a service's most recent deployment |
| `shift_traffic` | The one **action** tool — gated behind `confirm: true`, and **simulated even when confirmed** (see below) |

## Demo questions this proves out

- *"Why was `dep-1.4-32585068408` blocked?"* → real answer, from the real
  Phase 1 pipeline run: 5 critical CVEs against `POL-7734`'s threshold of 3.
- *"Why was `dep-002-fictional-demo` blocked, and who needs to approve it?"*
  → answerable only by querying this graph: `CVE-2031-13337` (a CVE ID that
  cannot exist — 2031 hasn't happened) and approver `Priya Okonkwo-Lindqvist`
  (a name that exists nowhere but this seed file). An agent that produces
  either exact fact did not get it from training data.

## What's demo-stubbed vs. real

- **Real**: the graph query layer, the trace logging, and the `dep-1.4-...`
  deployment/decision data (copied directly from the actual Phase 1 pipeline
  run — see `graph/schema.md` for provenance).
- **Demo-stubbed**: `shift_traffic` never calls `helm upgrade` against a real
  cluster — it validates inputs, requires explicit confirmation, and returns
  a message describing what the real command would be
  (`helm upgrade --install sock-app ./helm/sock-app --set traffic.blue.weight=...`,
  the same one `.github/workflows/deploy.yml` runs). Wiring it to a real Helm
  call is a documented next step, not a hidden gap — deliberately deferred
  per the project brief's non-goals (no live-mutation demo this phase).
- **JSON graph, not Neo4j**: see `graph/schema.md` for why, and what a real
  swap would involve.
