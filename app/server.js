const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const VERSION = process.env.APP_VERSION || '1.0';
const BUILD_SHA = process.env.BUILD_SHA || 'local';

// Feature: Blue-green canary deployments with Istio traffic splitting

// Sock images based on version
const getSockImage = (version) => {
  const sockColors = ['red', 'blue', 'purple', 'green', 'orange', 'yellow'];
  const versionNum = parseFloat(version);
  const index = Math.floor(versionNum * 10) % sockColors.length;
  return sockColors[index];
};

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: VERSION,
    buildSha: BUILD_SHA,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main application endpoint
app.get('/', (req, res) => {
  const sockColor = getSockImage(VERSION);
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Jamal's Socks v${VERSION}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: white;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 600px;
    }
    h1 {
      font-size: 42px;
      margin-bottom: 20px;
      font-weight: 700;
    }
    .sock {
      font-size: 120px;
      margin: 40px 0;
      filter: hue-rotate(${getSockImage(VERSION) === 'red' ? '0deg' : 
                         getSockImage(VERSION) === 'blue' ? '220deg' :
                         getSockImage(VERSION) === 'purple' ? '280deg' :
                         getSockImage(VERSION) === 'green' ? '120deg' :
                         getSockImage(VERSION) === 'orange' ? '30deg' : '60deg'});
    }
    .version {
      font-size: 96px;
      font-weight: 800;
      letter-spacing: -2px;
      margin: 20px 0 10px;
      color: #000;
    }
    .build-info {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Jamal's sock app</h1>
    <div class="sock">🧦</div>
    <div class="version">Version ${VERSION}</div>
    <div class="build-info">
      Build: ${BUILD_SHA.substring(0, 8)}<br>
      ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;
  res.send(html);
});

// JSON API endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: "Jamal's Socks",
    version: VERSION,
    buildSha: BUILD_SHA,
    timestamp: new Date().toISOString()
  });
});

// API status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    api: 'GitHub Copilot Demo API',
    status: 'operational',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Demo endpoint with sample data
app.get('/demo', (req, res) => {
  res.json({
    title: 'GitHub Copilot Agent Demo',
    description: 'End-to-End CI/CD Pipeline Demonstration',
    pipeline: {
      source: 'GitHub Repository',
      ci: 'GitHub Actions',
      registry: 'Amazon ECR',
      orchestration: 'Kubernetes/EKS',
      deployment: 'Helm Charts',
      cd: 'Octopus Deploy (Optional)'
    },
    benefits: [
      'Automated builds and deployments',
      'Container security scanning',
      'Infrastructure as Code',
      'Cost-optimized with spot instances',
      'Local development with Kind'
    ],
    costOptimizations: [
      'Spot instances (60-70% savings)',
      'Auto-scaling to zero',
      'Local development environment',
      'Conditional EKS deployment'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: ['/', '/health', '/api/status', '/demo']
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;