#!/bin/bash
# Deploy Jamal's Socks with Helm

set -e

RELEASE_NAME="sock-app"
NAMESPACE="default"
CHART_PATH="./helm/sock-app"

# Parse command line arguments
BLUE_WEIGHT=${1:-0}
GREEN_WEIGHT=$((100 - BLUE_WEIGHT))
BLUE_VERSION=${2:-"1.0"}
GREEN_VERSION=${3:-"1.0"}

echo "=================================================="
echo "  Deploying Jamal's Socks with Helm"
echo "=================================================="
echo "  Release:        ${RELEASE_NAME}"
echo "  Namespace:      ${NAMESPACE}"
echo "  Blue Weight:    ${BLUE_WEIGHT}% (version ${BLUE_VERSION})"
echo "  Green Weight:   ${GREEN_WEIGHT}% (version ${GREEN_VERSION})"
echo "=================================================="
echo ""

# Check if helm release exists
if helm list -n ${NAMESPACE} | grep -q ${RELEASE_NAME}; then
  echo "📦 Upgrading existing release..."
  helm upgrade ${RELEASE_NAME} ${CHART_PATH} \
    --namespace ${NAMESPACE} \
    --set traffic.blue.weight=${BLUE_WEIGHT} \
    --set traffic.green.weight=${GREEN_WEIGHT} \
    --set traffic.blue.version=${BLUE_VERSION} \
    --set traffic.green.version=${GREEN_VERSION} \
    --wait
else
  echo "📦 Installing new release..."
  helm install ${RELEASE_NAME} ${CHART_PATH} \
    --namespace ${NAMESPACE} \
    --set traffic.blue.weight=${BLUE_WEIGHT} \
    --set traffic.green.weight=${GREEN_WEIGHT} \
    --set traffic.blue.version=${BLUE_VERSION} \
    --set traffic.green.version=${GREEN_VERSION} \
    --wait
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Current traffic split:"
echo "  Green: ${GREEN_WEIGHT}% (version ${GREEN_VERSION})"
echo "  Blue:  ${BLUE_WEIGHT}% (version ${BLUE_VERSION})"
echo ""
echo "🔗 Gateway URL:"
kubectl get svc -n istio-system istio-ingressgateway -o jsonpath='http://{.status.loadBalancer.ingress[0].hostname}{"\n"}'
echo ""
echo "📈 Canary progression examples:"
echo "  ./scripts/helm-deploy.sh 10 1.1 1.0   # 10% blue (v1.1), 90% green (v1.0)"
echo "  ./scripts/helm-deploy.sh 25 1.1 1.0   # 25% blue (v1.1), 75% green (v1.0)"
echo "  ./scripts/helm-deploy.sh 50 1.1 1.0   # 50/50 split"
echo "  ./scripts/helm-deploy.sh 100 1.1 1.0  # 100% blue (v1.1)"
echo ""
