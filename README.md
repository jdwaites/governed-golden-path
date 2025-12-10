# Jamal's Socks - Blue-Green Canary Deployment Demo

Clean, minimal Node.js app demonstrating blue-green and canary deployments on AWS EKS with Istio.

## Architecture

```
Users → Istio Gateway (LB) → VirtualService (traffic split) → blue/green pods
```

## Quick Start

### 1. Install Istio
```bash
./scripts/install-istio.sh
```

### 2. Deploy Application
```bash
kubectl apply -f k8s/green-deployment.yaml
kubectl apply -f k8s/blue-deployment.yaml
kubectl apply -f k8s/istio/
```

### 3. Get Gateway URL
```bash
export GATEWAY_URL=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "App URL: http://$GATEWAY_URL"
```

## Canary Deployment Workflow

### Deploy New Version to Blue
```bash
# Build new version (auto-increments from .version file)
git push origin main

# Update blue deployment with new version
kubectl set image deployment/blue-app app=801507307735.dkr.ecr.us-east-1.amazonaws.com/octopus-eks-demo-app:1.1
```

### Gradual Traffic Shift
```bash
./scripts/canary-deploy.sh 10   # 10% to blue
./scripts/canary-deploy.sh 50   # 50/50 split
./scripts/canary-deploy.sh 100  # Full rollout
```

### Promote Blue to Green
```bash
kubectl set image deployment/green-app app=ECR_IMAGE:VERSION
./scripts/canary-deploy.sh 0  # Reset to green
```

## Project Structure

- `app/` - Node.js application
- `k8s/` - Kubernetes manifests
- `k8s/istio/` - Istio configuration
- `scripts/` - Deployment automation
- `iac/` - Terraform infrastructure

## Required GitHub Secrets

- `AWS_ROLE_ARN`
- `ECR_REGISTRY`

See `GITHUB_ACTIONS_SETUP.md` for details.
