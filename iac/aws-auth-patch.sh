#!/bin/bash
# Add GitHub Actions IAM role to EKS aws-auth ConfigMap
# This allows GitHub Actions to authenticate to the cluster

CLUSTER_NAME="octopus-eks-demo"
GITHUB_ACTIONS_ROLE_ARN="$(aws iam list-roles --query "Roles[?RoleName=='$CLUSTER_NAME-github-actions'].Arn" --output text)"
REGION="us-east-1"

if [ -z "$GITHUB_ACTIONS_ROLE_ARN" ]; then
  echo "Error: Could not find GitHub Actions role ARN"
  exit 1
fi

echo "Adding role to aws-auth ConfigMap:"
echo "  Cluster: $CLUSTER_NAME"
echo "  Role ARN: $GITHUB_ACTIONS_ROLE_ARN"
echo ""

# Get current aws-auth ConfigMap
aws eks update-kubeconfig --region $REGION --name $CLUSTER_NAME
CONFIGMAP=$(kubectl get configmap aws-auth -n kube-system -o json)

# Check if role is already present
if echo "$CONFIGMAP" | grep -q "$GITHUB_ACTIONS_ROLE_ARN"; then
  echo "✅ Role already present in aws-auth ConfigMap"
  exit 0
fi

# Add role to mapRoles section
UPDATED_CONFIGMAP=$(echo "$CONFIGMAP" | jq ".data.mapRoles |= . + \"- rolearn: $GITHUB_ACTIONS_ROLE_ARN\n  username: github-actions\n  groups:\n    - system:masters\n\"")

# Apply updated ConfigMap
echo "$UPDATED_CONFIGMAP" | kubectl apply -f -

echo "✅ GitHub Actions role added to aws-auth ConfigMap"
