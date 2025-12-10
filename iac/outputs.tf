# Terraform outputs

output "eks_cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.blue_green_cluster.name
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = aws_eks_cluster.blue_green_cluster.endpoint
}

output "ecr_repository_uri" {
  description = "ECR repository URI for app images"
  value       = aws_ecr_repository.app_repo.repository_url
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

output "github_actions_role_arn" {
  description = "GitHub Actions OIDC role ARN"
  value       = aws_iam_role.github_actions_role.arn
}
