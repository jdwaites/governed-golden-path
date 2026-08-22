# Policy: require-signed-image (rule id POL-SIG-01)
#
# Blocks a deploy when the target image's cosign keyless signature could not
# be verified against the expected GitHub Actions OIDC identity. This is the
# supply-chain integrity gate: an unsigned, unverifiable, or tampered image
# never reaches the Helm deploy step, regardless of its CVE posture.
#
# Expected input shape (see policy/README.md for the full contract):
#   { "image": "<ref>", "signature": { "verified": <bool> }, ... }
package main

import rego.v1

deny contains msg if {
	input.signature.verified == false
	msg := sprintf("POL-SIG-01: cosign signature could not be verified for %s — deploy blocked", [input.image])
}
