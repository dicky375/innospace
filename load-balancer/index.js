import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import httpProxy from 'http-proxy';
import morgan from 'morgan';
import { SERVER_REGISTRY, getTargetService } from '../shared/config/server.js';

const PORT = process.env.LOAD_BALANCER_PORT || 3000;
const HOST = '0.0.0.0';

const proxy = httpProxy.createProxyServer({
  proxyTimeout: 15000,
  timeout: 15000,
  ws: true,
  changeOrigin: true,
});

const logger = morgan('combined');

// Global Proxy Error Handler
proxy.on('error', (err, req, res) => {
  console.error(`[LB] Proxy Error: ${err.code} | ${req.method} ${req.url}`);
  
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Bad Gateway',
      message: 'The requested service is down or unreachable.',
    }));
  }
});
// Restream the body safely to prevent data stream truncation over internal containers
proxy.on('proxyReq', (proxyReq, req, res, options) => {
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
    // Collect the incoming body stream if it hasn't been written to the socket yet
    let bodyData = '';
    
    req.on('data', (chunk) => {
      bodyData += chunk;
    });

    req.on('end', () => {
      if (bodyData) {
        // Enforce the headers match the payload length exactly
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Write the body cleanly straight into the proxied request socket stream
        proxyReq.write(bodyData);
        proxyReq.end();
      }
    });
  }
});
// Main Server Logic
const server = http.createServer((req, res) => {
  // 1. Handle Health Check first
  if (req.url === '/health') {
    return logger(req, res, () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: SERVER_REGISTRY?.length || 0,
        environment: process.env.NODE_ENV || 'production',
      }));
    });
  }

 // Find the target service
const originalUrl = req.url;
const targetService = getTargetService(originalUrl);

if (!targetService) {
  res.writeHead(404, { 'Content-Type': 'application/json' });
  return res.end(
    JSON.stringify({
      success: false,
      error: 'Not Found',
      message: `No service registered for ${originalUrl}`, // Fixed: uses originalUrl
    })
  );
}

// Calculate the rewritten path safely without mutating req.url early
const rewrittenPath = originalUrl.slice(targetService.prefix.length) || '/';

console.log(
  `[LB] ${req.method} ${originalUrl} -> ${targetService.target}${rewrittenPath}`
);
// update the incoming request URL property so http-poxy sends to the stripped version
req.url = rewrittenPath;
// Forward using the rewritten path variable explicitly
proxy.web(req, res, {
  target: targetService.target,
  changeOrigin: true
});
});

// Create HTTP server and handle incoming requests
server.listen(PORT, HOST, () => {
  console.clear();
  console.log(`\n🚀 INNOSPACE LOAD BALANCER`);
  console.log(`=====================================`);
  
  // Robust logging to prevent padEnd crashes
  if (Array.isArray(SERVER_REGISTRY)) {
    SERVER_REGISTRY.forEach(s => {
      const name = (s.name || 'Unknown').padEnd(15);
      const prefix = (s.prefix || 'N/A').padEnd(18);
      console.log(`📦 ${name} | Prefix: ${prefix} → ${s.target}`);
    });
  }
  
  console.log(`\n✅ Ready at http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is busy.`);
    process.exit(1);
  }
});