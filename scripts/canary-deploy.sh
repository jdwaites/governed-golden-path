#!/bin/bash
# Canary deployment script - gradually shift traffic from green to blue

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <blue_weight>"
  echo "Example: $0 10   # Route 10% to blue, 90% to green"
  echo "Example: $0 50   # Route 50% to blue, 50% to green"
  echo "Example: $0 100  # Route 100% to blue, 0% to green"
  exit 1
fi

BLUE_WEIGHT=$1
GREEN_WEIGHT=$((100 - BLUE_WEIGHT))

echo "=================================================="
echo "  Canary Deployment: Traffic Split"
echo "=================================================="
echo "  Green (Current): ${GREEN_WEIGHT}%"
echo "  Blue (New):      ${BLUE_WEIGHT}%"
echo "=================================================="
echo ""

# Update VirtualService with new weights
kubectl patch virtualservice app-routes -n default --type merge -p "{
  \"spec\": {
    \"http\": [{
      \"match\": [{
        \"uri\": {
          \"prefix\": \"/\"
        }
      }],
      \"route\": [
        {
          \"destination\": {
            \"host\": \"green-service.default.svc.cluster.local\",
            \"port\": {
              \"number\": 80
            }
          },
          \"weight\": ${GREEN_WEIGHT}
        },
        {
          \"destination\": {
            \"host\": \"blue-service.default.svc.cluster.local\",
            \"port\": {
              \"number\": 80
            }
          },
          \"weight\": ${BLUE_WEIGHT}
        }
      ]
    }]
  }
}"

echo ""
echo "✅ Traffic split updated successfully!"
echo ""
echo "Monitor with:"
echo "  kubectl logs -n istio-system -l app=istio-ingressgateway -f"
echo ""
echo "📊 Suggested canary progression:"
echo "  ./scripts/canary-deploy.sh 10   # Start with 10%"
echo "  ./scripts/canary-deploy.sh 25   # Increase to 25%"
echo "  ./scripts/canary-deploy.sh 50   # Half traffic"
echo "  ./scripts/canary-deploy.sh 100  # Full rollout"
echo ""
