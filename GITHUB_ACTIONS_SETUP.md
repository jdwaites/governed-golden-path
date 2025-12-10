# GitHub Actions Setup Guide

This document outlines all the secrets and parameters required for the GitHub Actions workflows to function properly.

## Required GitHub Secrets

Add these secrets to your GitHub repository via `Settings → Secrets and variables → Actions → New repository secret`:

### 1. `AWS_ROLE_ARN` (Required for all workflows)
- **Description**: ARN of the AWS IAM role for OIDC federation
- **Value**: Your AWS role ARN for GitHub Actions OIDC
- **Format**: `arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME`
- **How to find it**: 
  ```bash
  aws iam list-roles --query 'Roles[?RoleName==`octopus-eks-demo-github-actions`].Arn' --output text
  ```
- **Used by**: `build.yml`, `deploy.yml`, `terraform.yml`

### 2. `ECR_REGISTRY` (Required for build workflow)
- **Description**: AWS ECR registry URL
- **Value**: Your AWS account ID
- **Format**: `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com`
- **Example**: `801507307735.dkr.ecr.us-east-1.amazonaws.com`
- **How to find it**:
  ```bash
  aws sts get-caller-identity --query Account --output text
  ```
- **Used by**: `build.yml`

## Repository Variables (Optional but recommended)

Add these variables via `Settings → Secrets and variables → Actions → New repository variable`:

### 1. `AWS_REGION`
- **Value**: `us-east-1`
- **Used by**: All workflows

### 2. `EKS_CLUSTER_NAME`
- **Value**: `octopus-eks-demo`
- **Used by**: `deploy.yml`

### 3. `ECR_REPOSITORY`
- **Value**: `octopus-eks-demo-app`
- **Used by**: `build.yml`, `deploy.yml`

## Workflow Input Parameters

These are provided when manually triggering workflows via GitHub UI.

### build.yml - Workflow Dispatch Inputs
When running manually (`Actions → Build and Push Image (ECR) → Run workflow`):

| Parameter | Type | Default | Options | Description |
|-----------|------|---------|---------|-------------|
| `app_variant` | Choice | `blue` | `blue`, `green` | Which sock service variant to build |

**Triggered automatically on:**
- Push to `main` or `develop` branches
- Pull requests to `main`

---

### deploy.yml - Workflow Dispatch Inputs
When running manually (`Actions → Deploy to EKS → Run workflow`):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `environment` | Choice | Yes | Target deployment slot: `blue` or `green` |
| `image_tag` | String | Yes | ECR image tag to deploy (e.g., `a1b2c3d-blue` or `latest-blue`) |

**Example usage:**
1. After `build.yml` completes, note the image tag from the job output
2. Go to `Actions → Deploy to EKS → Run workflow`
3. Select environment: `blue` or `green`
4. Enter image_tag: `a1b2c3d-blue` (replace with actual tag)
5. Click "Run workflow"

---

### terraform.yml - Workflow Dispatch Inputs
When running manually (`Actions → Terraform Infrastructure → Run workflow`):

| Parameter | Type | Required | Options | Default | Description |
|-----------|------|----------|---------|---------|-------------|
| `action` | Choice | Yes | `plan`, `apply`, `destroy` | - | Terraform operation to perform |
| `auto_approve` | Boolean | No | - | `false` | Auto-approve apply/destroy (skip approval prompt) |

**Triggered automatically on:**
- Push to `main` branch with changes in `iac/` directory
- Push to `main` branch with changes to `.github/workflows/terraform.yml`

**Example workflows:**
- **Plan changes**: `action=plan`, `auto_approve=false`
- **Apply changes**: `action=apply`, `auto_approve=true` (or review and approve manually)
- **Destroy infrastructure**: `action=destroy`, `auto_approve=true` (⚠️ USE WITH CAUTION)

---

## Setup Checklist

- [ ] Create AWS IAM role for GitHub OIDC with proper permissions
- [ ] Add `AWS_ROLE_ARN` secret to GitHub
- [ ] Add `ECR_REGISTRY` secret to GitHub (your AWS Account ID)
- [ ] Verify ECR repository exists: `octopus-eks-demo-app`
- [ ] Verify EKS cluster exists: `octopus-eks-demo`
- [ ] Test `build.yml` workflow manually
- [ ] Test `deploy.yml` workflow manually with output from build
- [ ] Test `terraform.yml` workflow with `action=plan` first

## AWS IAM Permissions Required

The IAM role for GitHub Actions needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "arn:aws:ecr:us-east-1:*:repository/octopus-eks-demo-app"
    },
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeSecurityGroups",
        "ec2:DescribeSubnets",
        "ec2:DescribeVpcs"
      ],
      "Resource": "*"
    }
  ]
}
```

## Troubleshooting

### Workflow fails with "Bad credentials"
- Verify `AWS_ROLE_ARN` secret is set correctly
- Verify GitHub OIDC provider is configured in AWS
- Check role trust relationship includes GitHub repo

### ECR login fails
- Verify `ECR_REGISTRY` is set to correct format
- Ensure ECR repository exists in your account

### kubectl commands fail in deploy.yml
- Verify IAM role has EKS cluster access
- Check `EKS_CLUSTER_NAME` matches your actual cluster name
- Verify kubeconfig update worked: `aws eks update-kubeconfig --region us-east-1 --name octopus-eks-demo`

### Terraform fails with state locking
- Check if another workflow is running
- Manual state unlock: `terraform force-unlock LOCK_ID` (use with caution)
