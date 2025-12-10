#!/bin/bash
# Extract Terraform outputs and generate Octopus variables file

set -e

TERRAFORM_DIR="$(dirname "$0")"
OUTPUT_FILE="$TERRAFORM_DIR/octopus-variables.json"

echo "Extracting Terraform outputs..."

# Get Terraform outputs as JSON
terraform -chdir="$TERRAFORM_DIR" output -json > "$OUTPUT_FILE"

echo "✅ Octopus variables file generated: $OUTPUT_FILE"
echo ""
echo "📋 Configuration Summary:"
echo "========================"

# Extract and display values
OCTOPUS_IP=$(terraform -chdir="$TERRAFORM_DIR" output -raw octopus_server_public_ip)
EKS_CLUSTER=$(terraform -chdir="$TERRAFORM_DIR" output -raw eks_cluster_name)
ECR_REPO=$(terraform -chdir="$TERRAFORM_DIR" output -raw ecr_repository_uri)
S3_BUCKET=$(terraform -chdir="$TERRAFORM_DIR" output -raw octopus_artifacts_bucket)
REGION=$(terraform -chdir="$TERRAFORM_DIR" output -raw aws_region)

echo "Octopus Server:     http://$OCTOPUS_IP:8080"
echo "EKS Cluster:        $EKS_CLUSTER"
echo "ECR Repository:     $ECR_REPO"
echo "S3 Artifacts:       s3://$S3_BUCKET/"
echo "AWS Region:         $REGION"
echo ""
echo "📁 Variables file for Octopus import:"
echo "   $OUTPUT_FILE"
echo ""
echo "🔗 Next steps:"
echo "   1. Log into Octopus at http://$OCTOPUS_IP:8080"
echo "   2. Create a project and set these variables:"
echo "      - eks_cluster_name: $EKS_CLUSTER"
echo "      - ecr_repository: $ECR_REPO"
echo "      - aws_region: $REGION"
echo "      - s3_artifacts_bucket: $S3_BUCKET"
