#!/bin/bash
# Tear down all AWS infrastructure this project provisions (EKS cluster +
# node group, VPC/networking, ECR repository and every image in it, the
# GitHub Actions IAM role/OIDC provider).
#
# Order matters: the Istio ingress gateway creates a real AWS ELB/NLB via a
# Kubernetes `LoadBalancer` Service that Terraform never tracked. If
# `terraform destroy` runs while that Service still exists, its network
# interfaces are still attached to the VPC's subnets/security group, and
# destroy will hang, fail with a DependencyViolation, or leave an orphaned
# (still-billing) load balancer behind. So this script always deletes
# LoadBalancer-type Services first and waits for AWS to deprovision them
# before touching Terraform.
#
# This is destructive and effectively irreversible (short of a full
# `terraform apply` re-provision, which recreates infrastructure, not data).
# Requires explicit confirmation unless --yes is passed (for the teardown.yml
# workflow, which gates on its own typed-confirmation input instead).
#
# Usage:
#   scripts/teardown-aws.sh              # interactive, asks you to type "destroy"
#   scripts/teardown-aws.sh --yes        # non-interactive (CI use)
#   scripts/teardown-aws.sh --dry-run    # print what would happen, change nothing

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IAC_DIR="$SCRIPT_DIR/../iac"
AWS_REGION="${AWS_REGION:-us-east-1}"
EKS_CLUSTER_NAME="${EKS_CLUSTER_NAME:-octopus-eks-demo}"

DRY_RUN=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes|-y) ASSUME_YES=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--yes] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

run() {
  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

echo "=================================================="
echo "  AWS Infrastructure Teardown"
echo "=================================================="
echo "  Region:  $AWS_REGION"
echo "  Cluster: $EKS_CLUSTER_NAME"
echo "  Dry run: $DRY_RUN"
echo "=================================================="
echo ""
echo "This will PERMANENTLY DESTROY:"
echo "  - The EKS cluster and node group"
echo "  - The VPC, subnets, and networking"
echo "  - The ECR repository and ALL images in it"
echo "  - The GitHub Actions IAM role/OIDC provider"
echo ""

if [ "$ASSUME_YES" != true ] && [ "$DRY_RUN" != true ]; then
  read -r -p "Type 'destroy' to continue: " CONFIRM
  if [ "$CONFIRM" != "destroy" ]; then
    echo "Aborted — input did not match 'destroy'."
    exit 1
  fi
fi

echo ""
echo "--- Step 1: Release the Istio ingress gateway's AWS load balancer ---"
if aws eks describe-cluster --name "$EKS_CLUSTER_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  run aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER_NAME"

  if kubectl cluster-info >/dev/null 2>&1; then
    LB_SERVICES=$(kubectl get svc -A -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.namespace}{" "}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)
    if [ -n "$LB_SERVICES" ]; then
      echo "$LB_SERVICES" | while read -r ns name; do
        [ -z "$ns" ] && continue
        run kubectl delete svc "$name" -n "$ns" --wait=true --timeout=120s
      done
      echo "Waiting 60s for AWS to deprovision the load balancer(s)..."
      [ "$DRY_RUN" = true ] || sleep 60
    else
      echo "No LoadBalancer-type Services found — nothing to release."
    fi
  else
    echo "kubectl can't reach the cluster with the updated kubeconfig — skipping LB cleanup."
  fi
else
  echo "EKS cluster '$EKS_CLUSTER_NAME' not found in $AWS_REGION — nothing to release at the Kubernetes level."
fi

echo ""
echo "--- Step 2: terraform destroy ---"
run terraform -chdir="$IAC_DIR" init -input=false

if [ "$DRY_RUN" != true ]; then
  STATE_COUNT=$(terraform -chdir="$IAC_DIR" state list 2>/dev/null | wc -l | tr -d ' ')
  if [ "$STATE_COUNT" -eq 0 ]; then
    echo "::error::Terraform state has 0 resources in it. This almost always means" >&2
    echo "this run doesn't have access to the state file that actually tracks your" >&2
    echo "infrastructure (e.g. running in CI without a remote backend, when state" >&2
    echo "only exists locally). Destroying against empty state does nothing —" >&2
    echo "refusing to proceed rather than silently 'succeed' at doing nothing." >&2
    echo "Run this script on the machine that holds iac/terraform.tfstate." >&2
    exit 1
  fi
  echo "Found $STATE_COUNT resources in state — proceeding."
fi

run terraform -chdir="$IAC_DIR" destroy -auto-approve

echo ""
echo "=================================================="
echo "  Teardown complete."
echo "=================================================="
