# EKS Blue-Green Canary Deployment Infrastructure
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.33"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Talks to the EKS cluster defined below to manage RBAC and aws-auth —
# needed so the github_actions_role (IAM) is actually authorized inside
# the cluster, not just against the AWS EKS API.
provider "kubernetes" {
  host                   = aws_eks_cluster.blue_green_cluster.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.blue_green_cluster.certificate_authority[0].data)
  token                  = data.aws_eks_cluster_auth.cluster.token
}

data "aws_eks_cluster_auth" "cluster" {
  name = aws_eks_cluster.blue_green_cluster.name
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "octopus-eks-demo"
}

variable "istio_installed" {
  description = "Whether Istio (and its istio-system namespace) is installed on the cluster. The Helm chart's VirtualService/Gateway/DestinationRule templates and deploy.yml's ingress-gateway lookup both require it — set true only once Istio has actually been installed, or the istio-system RoleBinding below fails with 'namespace not found'."
  type        = bool
  default     = false
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# VPC for the infrastructure
resource "aws_vpc" "app_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.cluster_name}-vpc"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "app_igw" {
  vpc_id = aws_vpc.app_vpc.id

  tags = {
    Name = "${var.cluster_name}-igw"
  }
}

# Public Subnets
resource "aws_subnet" "public_subnet" {
  count                   = 2
  vpc_id                  = aws_vpc.app_vpc.id
  cidr_block              = "10.0.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = {
    Name = "${var.cluster_name}-public-${count.index + 1}"
    "kubernetes.io/cluster/${var.cluster_name}" = "shared"
    "kubernetes.io/role/elb" = "1"
    Type = "public"
  }
}

# Route table for public subnet
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.app_vpc.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.app_igw.id
  }
  tags = {
    Name = "${var.cluster_name}-public-rt"
  }
}

resource "aws_route_table_association" "public_rta" {
  count          = 2
  subnet_id      = aws_subnet.public_subnet[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

# Security Groups
resource "aws_security_group" "app_sg" {
  name        = "${var.cluster_name}-app-sg"
  description = "Security group for EKS cluster"
  vpc_id      = aws_vpc.app_vpc.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.cluster_name}-app-sg"
  }
}

# IAM Role for EKS Cluster
resource "aws_iam_role" "cluster_role" {
  name = "${var.cluster_name}-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "cluster_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster_role.name
}

# IAM Role for EKS Node Group
resource "aws_iam_role" "node_role" {
  name = "${var.cluster_name}-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "node_worker_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.node_role.name
}

resource "aws_iam_role_policy_attachment" "node_cni_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.node_role.name
}

resource "aws_iam_role_policy_attachment" "node_registry_policy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.node_role.name
}

# EKS Cluster
resource "aws_eks_cluster" "blue_green_cluster" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster_role.arn
  version  = "1.31"

  vpc_config {
    subnet_ids              = aws_subnet.public_subnet[*].id
    endpoint_private_access = false
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.cluster_policy
  ]

  tags = {
    Name        = var.cluster_name
    Environment = "blue-green-demo"
  }
}

# EKS Node Group
resource "aws_eks_node_group" "blue_green_nodes" {
  cluster_name    = aws_eks_cluster.blue_green_cluster.name
  node_group_name = "${var.cluster_name}-nodes"
  node_role_arn   = aws_iam_role.node_role.arn
  subnet_ids      = aws_subnet.public_subnet[*].id

  scaling_config {
    desired_size = 2
    max_size     = 4
    min_size     = 2
  }

  instance_types = ["t3.small"]

  update_config {
    max_unavailable = 1
  }

  depends_on = [
    aws_iam_role_policy_attachment.node_worker_policy,
    aws_iam_role_policy_attachment.node_cni_policy,
    aws_iam_role_policy_attachment.node_registry_policy,
  ]

  tags = {
    Name        = "${var.cluster_name}-nodes"
    Environment = "blue-green-demo"
  }
}

# ECR Repository for application images
resource "aws_ecr_repository" "app_repo" {
  name                 = "${var.cluster_name}-app"
  image_tag_mutability = "MUTABLE"
  # Without this, `terraform destroy` fails on this resource once any image
  # has ever been pushed ("RepositoryNotEmptyException") — needed for
  # scripts/teardown-aws.sh to tear down cleanly in one pass.
  force_delete = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.cluster_name}-ecr"
  }
}

# IAM Role for GitHub Actions OIDC
data "tls_certificate" "github" {
  url = "https://token.actions.githubusercontent.com"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
  url             = "https://token.actions.githubusercontent.com"

  tags = {
    Name = "${var.cluster_name}-github-oidc"
  }
}

resource "aws_iam_role" "github_actions_role" {
  name = "${var.cluster_name}-github-actions"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRoleWithWebIdentity"
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github_actions.arn
      }
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          # Wildcarded after the owner/repo names because GitHub appends
          # immutable owner/repo IDs (e.g. "jdwaites@7519634") to the sub
          # claim once a repo has been renamed (this one was, from
          # maroon-alligator) — confirmed via CloudTrail on the actual
          # AssumeRoleWithWebIdentity calls, which showed
          # "repo:jdwaites@7519634/governed-golden-path@1342502784:ref:...".
          "token.actions.githubusercontent.com:sub" = "repo:jdwaites*/governed-golden-path*:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "github_actions_policy" {
  name = "${var.cluster_name}-github-actions-policy"
  role = aws_iam_role.github_actions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages"
        ]
        Resource = "${aws_ecr_repository.app_repo.arn}*"
      },
      {
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster",
          "eks:ListClusters",
          "eks:DescribeNodegroup",
          "eks:ListNodegroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcs",
          "ec2:DescribeInternetGateways",
          "ec2:DescribeRouteTables",
          "ec2:DescribeNetworkInterfaces"
        ]
        Resource = "*"
      }
    ]
  })
}

# --- Kubernetes RBAC for the GitHub Actions role -------------------------
# IAM lets github_actions_role call the AWS EKS API (DescribeCluster etc.),
# but the cluster's own RBAC is a separate authorization layer — without an
# aws-auth mapping, Helm deploys fail with "the server has asked for the
# client to provide credentials" even though `aws eks update-kubeconfig`
# succeeds. Scoped to only what helm/sock-app's chart manages, rather than
# system:masters, to match the rest of this pipeline's least-privilege
# posture (signed images, SBOM/CVE gate, etc.).

resource "kubernetes_cluster_role" "sock_app_deployer" {
  metadata {
    name = "sock-app-deployer"
  }

  rule {
    api_groups = [""]
    resources  = ["services", "secrets", "configmaps"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = [""]
    resources  = ["pods", "events"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = ["apps"]
    resources  = ["deployments", "replicasets"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }

  rule {
    api_groups = ["networking.istio.io"]
    resources  = ["virtualservices", "gateways", "destinationrules"]
    verbs      = ["get", "list", "watch", "create", "update", "patch", "delete"]
  }
}

resource "kubernetes_role_binding" "sock_app_deployer_default" {
  metadata {
    name      = "sock-app-deployer-binding"
    namespace = "default"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.sock_app_deployer.metadata[0].name
  }

  subject {
    kind      = "Group"
    name      = "sock-app-deployers"
    api_group = "rbac.authorization.k8s.io"
  }
}

# deploy.yml also reads the ingress gateway's LoadBalancer hostname from
# istio-system after deploying — a separate, much narrower grant in that
# namespace rather than folding it into the ClusterRole above.
resource "kubernetes_cluster_role" "istio_gateway_reader" {
  metadata {
    name = "istio-gateway-reader"
  }

  rule {
    api_groups = [""]
    resources  = ["services"]
    verbs      = ["get", "list"]
  }
}

resource "kubernetes_role_binding" "istio_gateway_reader_binding" {
  count = var.istio_installed ? 1 : 0

  metadata {
    name      = "istio-gateway-reader-binding"
    namespace = "istio-system"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.istio_gateway_reader.metadata[0].name
  }

  subject {
    kind      = "Group"
    name      = "sock-app-deployers"
    api_group = "rbac.authorization.k8s.io"
  }
}

# aws-auth is auto-created by EKS (currently holds only the node role
# mapping) rather than owned by Terraform, so this patches in the
# github_actions_role entry via a data merge instead of a full resource —
# it won't clobber the node role entry or anything else added by AWS.
resource "kubernetes_config_map_v1_data" "aws_auth" {
  metadata {
    name      = "aws-auth"
    namespace = "kube-system"
  }

  data = {
    mapRoles = yamlencode([
      {
        rolearn  = aws_iam_role.node_role.arn
        username = "system:node:{{EC2PrivateDNSName}}"
        groups   = ["system:bootstrappers", "system:nodes"]
      },
      {
        rolearn  = aws_iam_role.github_actions_role.arn
        username = "github-actions-ci"
        groups   = ["sock-app-deployers"]
      }
    ])
  }

  force = true

  depends_on = [aws_eks_node_group.blue_green_nodes]
}
