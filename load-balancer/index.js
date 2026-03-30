import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import httpProxy from 'http-proxy';
import morgan from 'morgan';
import { SERVER_REGISTRY } from '../shared/config/server.js';

const PORT = process.env.LOAD_BALANCER_PORT || 3000;

// 1. Initialize Proxy with high-performance settings
const proxy = httpProxy.createProxyServer({
  proxyTimeout: 5000, 
  timeout: 5000,
  ws: true 
});

const logger = morgan('dev');

// 3. Centralized Error Handling
proxy.on('error', (err, req, res) => {
  console.error(`[LB] Critical Proxy Error: ${err.code}`);
  
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      error: 'Gateway Error', 
      message: 'The requested service is currently offline.',
      code: err.code 
    }));
  }
});

// 4. Advanced Route Resolver
function resolveTarget(url) {
  const path = url.split('?')[0];
  return SERVER_REGISTRY.find(server => 
    server.routes.some(prefix => path.startsWith(prefix))
  );
}

// 5. Create the Server
const server = http.createServer((req, res) => {
  logger(req, res, () => {
    
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ 
        status: 'UP', 
        timestamp: new Date().toISOString(),
        services: SERVER_REGISTRY.length 
      }));
    }

    const targetService = resolveTarget(req.url);

    if (!targetService) {
      console.warn(`[LB] 404 - No route found for: ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: `Route ${req.url} not found.` }));
    }

    proxy.web(req, res, { 
      target: targetService.target,
      changeOrigin: true 
    });
  });
});

// 6. Start the Engine with Port Check
server.listen(PORT, () => {
  console.clear();
  console.log(`\n🚀 INNOSPACE LOAD BALANCER`);
  console.log(`-----------------------------------`);
  console.log(`Listening on: http://localhost:${PORT}`);
  
  SERVER_REGISTRY.forEach((s) => {
    console.log(`📦 ${s.name.padEnd(15)} -> ${s.target}`);
  });
  console.log(`-----------------------------------\n`);
});

/**
 * CRITICAL: Catch EADDRINUSE (Port Busy)
 */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ ERROR: Port ${PORT} is already in use!`);
    console.error(`👉 Run: "fuser -k ${PORT}/tcp" to kill the old process.\n`);
    process.exit(1);
  } else {
    console.error('[LB] Server Error:', err);
  }
});