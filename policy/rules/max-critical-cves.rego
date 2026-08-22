# Policy: max-critical-cves (rule id POL-7734)
#
# Blocks a deploy when the target image's SBOM-derived vulnerability scan
# reports more Critical-severity CVEs than the threshold below. The rule id
# and threshold are deliberately specific (not a round, guessable number) so
# that when this decision later shows up as a PolicyDecision -[:APPLIED_RULE]->
# PolicyRule edge in the Phase 3 knowledge graph, it is unambiguously traceable
# back to this exact rule — see graph/schema.md.
#
# Expected input shape (see policy/README.md for the full contract):
#   { "image": "<ref>", "cves": { "critical": <int>, "high": <int> }, ... }
package main

import rego.v1

max_critical := 3

deny contains msg if {
	input.cves.critical > max_critical
	msg := sprintf(
		"POL-7734: image has %d critical CVEs, exceeds max allowed (%d) — %s",
		[input.cves.critical, max_critical, input.image],
	)
}
