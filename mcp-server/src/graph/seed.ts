// The repo root's graph/seed-data.json is the single source of truth for
// seed nodes/edges (see graph/schema.md) — this module just loads and types
// it. Swapping in a real Neo4j-backed client later means replacing
// client.ts's query functions; this file and graph/seed-data.json can seed
// that database directly.
import graphData from "../../../graph/seed-data.json" with { type: "json" };
import type { GraphData } from "./types.js";

export const seedGraph = graphData as unknown as GraphData;
