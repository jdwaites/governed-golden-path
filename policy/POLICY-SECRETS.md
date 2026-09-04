# Secrets Policy

| | |
|---|---|
| **Policy ID** | SEC-POL-01 |
| **Applies to** | This repository's source, CI/CD pipeline, and deployed infrastructure |
| **Enforced by** | [`secret-scan.yml`](../.github/workflows/secret-scan.yml) (Gitleaks) |
| **Status key** | ✅ Met · ⚠️ Partially met · ❌ Gap — see [Open Gaps](#open-gaps) |

## 1. Purpose

Prevent credentials, keys, and other sensitive material from ever reaching a
committed, deployable, or running state where they could be exfiltrated or
misused — whether by accidental commit, a leaked build artifact, or an
unencrypted secret at rest.

## 2. Policy Statements

### 2.1 Approved secrets management

> Secrets shall be stored in an approved secrets management system on
> enterprise vault.

**Control:** all cloud credentials this pipeline uses are obtained via
short-lived, per-run OIDC federation (GitHub Actions → AWS STS `AssumeRoleWithWebIdentity`,
and GitHub Actions → Sigstore Fulcio for cosign signing) — see
`role-to-assume: ${{ secrets.AWS_ROLE_ARN }}` in every workflow that touches
AWS. No long-lived AWS access key or cosign private key is stored anywhere in
this repo or its secrets store. The only values held in GitHub's encrypted
Actions secrets are the IAM role ARN and the ECR registry URI — identifiers,
not credentials.

**Status:** ⚠️ Partially met. Eliminating long-lived credentials via OIDC is
a stronger posture than storing static secrets in *any* vault, including an
enterprise one — but it is not literally "stored in an approved secrets
management system on enterprise vault," and this repo does not currently
integrate with one (e.g. HashiCorp Vault, AWS Secrets Manager). See
[Open Gaps §5.1](#51-enterprise-vault-integration).

### 2.2 Continuous scanning in CI/CD

> There shall be continuous secret scanning in CI/CD pipeline to identify
> accidental leaks on push runs against every PR and on every branch.

**Control:** [`secret-scan.yml`](../.github/workflows/secret-scan.yml) runs
Gitleaks against full commit history (`fetch-depth: 0`) on:
- `push` — every branch, no filter
- `pull_request` — every PR, any target branch
- a weekly scheduled full-history sweep (`0 6 * * 1`), to catch anything a
  push-time scan could have missed
- `workflow_dispatch`, for on-demand runs
- `workflow_call`, so `build.yml` gates directly on it as a hard prerequisite,
  not just a parallel report

**Status:** ✅ Met. (The `pull_request` trigger was previously restricted to
`branches: [main]`, which meant a PR opened against any other branch wasn't
scanned — fixed to cover every PR regardless of target branch.)

### 2.3 Automated detection

> There shall be automated secret detection.

**Control:** [Gitleaks](https://github.com/gitleaks/gitleaks) v8.30.1 runs
unattended on every trigger in §2.2 — no manual review step is required for
detection to occur. Findings are uploaded both as a downloadable SARIF
workflow artifact and to this repo's Security → Code Scanning tab, so a leak
surfaces as a first-class finding, not a line buried in a build log.

**Status:** ✅ Met.

### 2.4 Encryption of production secrets, keys, and certificates

> Encryption shall be required for all production secrets, encryption keys,
> certificates.

**Control:**
- The two values held as GitHub Actions secrets (`AWS_ROLE_ARN`, `ECR_REGISTRY`)
  are encrypted at rest by GitHub (libsodium sealed box) and only decrypted
  into the ephemeral runner environment for the duration of a job.
- Image signing uses cosign **keyless** signing: a short-lived certificate is
  issued by Sigstore Fulcio per signing operation and logged to the public
  Rekor transparency log — there is no long-lived private signing key or
  certificate file to encrypt or leak in the first place, in this repo or
  anywhere else.
- No TLS/service certificates are checked into this repository.

**Status:** ✅ Met for everything this pipeline currently stores or handles.
This scopes narrower than §2.1 — it's about what's actually held (nothing
requiring at-rest encryption beyond GitHub's own), not about vault adoption.

## 3. Enforcement

A policy that can be silently skipped isn't enforced, only advisory.
`build.yml` runs the scan as a hard job dependency (`needs: secret-scan`), so
no image builds from a commit this scan hasn't cleared, regardless of merge
state. `main` is additionally protected by a repository ruleset requiring
the `Scan for committed secrets` check to pass before any commit — merge or
direct push, no bypass for any actor — can land on it; see [Open Gaps
§5.2](#52-branch-protection) for the rollout note.

## 4. Exceptions

None. There is no override or approver path for a Gitleaks finding in this
pipeline — a true positive must be remediated (secret rotated + history
scrubbed) and a false positive addressed via Gitleaks' own allowlist
(`.gitleaks.toml`), not bypassed at the workflow level.

## 5. Open Gaps

### 5.1 Enterprise vault integration

§2.1 is not fully met. This pipeline's OIDC-federated, no-static-credentials
design is arguably a stronger default than a vault-backed static secret for
CI use specifically, but it doesn't satisfy the policy's literal requirement,
and any secrets that *aren't* CI cloud credentials (e.g. application-level
secrets the deployed service might need at runtime) have no vault story here
at all yet. Adopting an enterprise vault (HashiCorp Vault, AWS Secrets
Manager, etc.) for those is a real infrastructure decision — new service
dependency, migration path, access-control design — and is intentionally
left as a decision for whoever owns that tradeoff, not something this
document resolves unilaterally.

### 5.2 Branch protection

Requiring the secret-scan check on `main` (§3) means no actor can push a
commit directly to `main` without it having already passed on a separate
ref first — including this pipeline's own automation. `build.yml`'s
version-bump step was reworked to push to a short-lived branch and open an
auto-merging PR rather than push to `main` directly, specifically so it
goes through the same gate as everyone else with no standing exception.

## 6. Review

This document should be reviewed whenever `secret-scan.yml` changes, and at
minimum whenever a new class of secret (application runtime secrets, TLS
certs, etc.) is introduced anywhere in this system.
