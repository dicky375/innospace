import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import httpProxy from 'http-proxy';
import morgan from 'morgan';
import { SERVER_REGISTRY } from '../shared/config/server.js';

const PORT = process.env.LOAD_BALANCER_PORT || 3000;
// CRITICAL: Bind to 0.0.0.0 to allow network-wide access (192.168.43.82)
const HOST = '0.0.0.0'; 

// 1. Initialize Proxy with high-performance settings
const proxy = httpProxy.createProxyServer({
  proxyTimeout: 10000, // Increased to 10s to prevent early timeouts
  timeout: 10000,
  ws: true 
});

const logger = morgan('dev');

// 2. Centralized Error Handling
proxy.on('error', (err, req, res) => {
  console.error(`[LB] Critical Proxy Error: ${err.code}`);
  
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Gateway Error', 
      message: 'The requested microservice is offline or unreachable.',
      code: err.code 
    }));
  }
});

// 3. Route Resolver Logic
function resolveTarget(url) {
  const path = url.split('?')[0];
  return SERVER_REGISTRY.find(server => 
    server.routes.some(prefix => path.startsWith(prefix))
  );
}

// 4. Create the Primary HTTP Server
const server = http.createServer((req, res) => {
  logger(req, res, () => {
    
    // Health Check Endpoint for Monitoring
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        status: 'UP', 
        timestamp: new Date().toISOString(),
        node: process.version,
        active_routes: SERVER_REGISTRY.length 
      }));
    }

    const targetService = resolveTarget(req.url);

    if (!targetService) {
      console.warn(`[LB] 404 - No route registered for: ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Route ${req.url} not found in registry.` }));
    }

    // Forward the request to the target microservice
    proxy.web(req, res, { 
      target: targetService.target,
      changeOrigin: true 
    });
  });
});

// 5. Start the Engine
server.listen(PORT, HOST, () => {
  console.clear();
  console.log(`\n🚀 INNOSPACE LOAD BALANCER (index.js)`);
  console.log(`-------------------------------------------`);
  console.log(`Network URL: http://192.168.43.82:${PORT}`);
  console.log(`Local URL:   http://localhost:${PORT}`);
  console.log(`Status:      Listening on all interfaces`);
  console.log(`-------------------------------------------`);
  
  SERVER_REGISTRY.forEach((s) => {
    console.log(`📦 ${s.name.padEnd(15)} -> ${s.target}`);
  });
  console.log(`-------------------------------------------\n`);
});

/**
 * Port Conflict & Fatal Error Handling
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: Port ${PORT} is already occupied!`);
    console.error(`👉 Run: "sudo fuser -k ${PORT}/tcp" before restarting.\n`);
    process.exit(1);
  } else {
    console.error('[LB] Server Crash:', err);
  }
});