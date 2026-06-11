import dotenv from 'dotenv';
dotenv.config();
const app = express();
import http from 'http';
import httpProxy from 'http-proxy';
import morgan from 'morgan';
import { SERVER_REGISTRY, getTargetService } from '../shared/config/server.js';
import express from 'express';

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

  // 2. Find the target service IMMEDIATELY before reading streams
  const originalUrl = req.url;
  const targetService = getTargetService(originalUrl);

  if (!targetService) {
    return logger(req, res, () => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Not Found',
        message: `No service registered for ${originalUrl}`,
      }));
    });
  }

  // 3. Rewrite path and forward immediately (Preserves the POST body stream)
  const rewrittenPath = originalUrl.slice(targetService.prefix.length) || '/';
  req.url = rewrittenPath;

  console.log(`[LB] ${req.method} ${originalUrl} -> ${targetService.target}${rewrittenPath}`);

  // Forward right away!
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