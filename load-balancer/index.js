import dotenv from 'dotenv';
dotenv.config();
import http from 'http';
import httpProxy from 'http-proxy';
import morgan from 'morgan';
import { SERVER_REGISTRY, getTargetService } from '../shared/config/server.js';

const PORT = process.env.LOAD_BALANCER_PORT || 3000;
const HOST = '0.0.0.0';

// Initialize the native proxy engine
const proxy = httpProxy.createProxyServer({
  proxyTimeout: 15000,
  timeout: 15000,
  ws: true,
  changeOrigin: true, // Rewrites public headers to match private target names
  autoRewrite: true,
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

// Main Server Logic
const server = http.createServer((req, res) => {
  // 1. Handle Health Check
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

  // 2. Wrap routing logic with the logger middleware
  logger(req, res, () => {
    const originalUrl = req.url;
    const targetService = getTargetService(originalUrl);

    // Guard: Path doesn't match any registered microservice prefix
    if (!targetService) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Not Found',
        message: `No service registered for ${originalUrl}`,
      }));
    }

    // Slice prefix out cleanly (e.g. /auth/api/auth/login -> /api/auth/login)
    const rewrittenPath = originalUrl.slice(targetService.prefix.length) || '/';

    console.log(`[LB] ${req.method} ${originalUrl} -> ${targetService.target}${rewrittenPath}`);

    // Mutate the request object's URL field so the proxy knows the target's downstream path
    req.url = rewrittenPath;

    // Extract raw internal domain target host cleanly (e.g. "innospace-auth:10000")
    const cleanHost = targetService.target.replace(/^https?:\/\//, '');

    // Send the uncorrupted native stream to the internal network target
    proxy.web(req, res, {
      target: targetService.target,
      buffer: httpProxy.buffer(req), // Buffer the request to preserve the original stream for retries
      headers: {
        host: cleanHost, // Explicitly overrides header matching rules for Render
      }
    });
  });
});

// Boot up the Load Balancer
server.listen(PORT, HOST, () => {
  console.clear();
  console.log(`\n🚀 INNOSPACE LOAD BALANCER`);
  console.log(`=====================================`);
  
  if (Array.isArray(SERVER_REGISTRY)) {
    SERVER_REGISTRY.forEach(s => {
      const name = (s.name || 'Unknown').padEnd(20);
      const prefix = (s.prefix || 'N/A').padEnd(10);
      console.log(`📦 ${name} | Prefix: ${prefix} → ${s.target}`);
    });
  }
  
  console.log(`\n✅ Gateway Live & Listening on port ${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is busy.`);
    process.exit(1);
  }
});