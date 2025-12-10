#!/bin/bash
# Install Istio on EKS cluster

set -e

echo "=================================================="
echo "  Installing Istio for Canary Deployments"
echo "=================================================="

# Download Istio
if [ ! -d "istio-1.24.0" ]; then
  echo "Downloading Istio..."
  curl -L https://istio.io/downloadIstio | ISTIO_VERSION=1.24.0 sh -
fi

cd istio-1.24.0
export PATH=$PWD/bin:$PATH

# Install Istio with minimal profile (suitable for EKS)
echo "Installing Istio control plane..."
istioctl install --set profile=demo -y

# Enable automatic sidecar injection for default namespace
echo "Enabling sidecar injection for default namespace..."
kubectl label namespace default istio-injection=enabled --overwrite

# Verify installation
echo ""
echo "Verifying Istio installation..."
kubectl get pods -n istio-system

echo ""
echo "=================================================="
echo "  Istio Installation Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Apply Istio gateway and routing: kubectl apply -f ../k8s/istio/"
echo "2. Get Istio Gateway URL:"
echo "   kubectl get svc istio-ingressgateway -n istio-system"
echo ""
