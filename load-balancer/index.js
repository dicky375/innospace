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
  logger(req, res, () => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: SERVER_REGISTRY?.length || 0,
        environment: process.env.NODE_ENV || 'development'
      }));
    }

    const targetService = getTargetService(req.url);

    if (!targetService) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Not Found',
        message: `No service registered for ${req.url}`
      }));
    }

    // Path Rewrite: Strips the prefix if it exists
    const originalPath = req.url;
    const prefix = targetService.prefix || '';
    const rewrittenPath = req.url.startsWith(prefix) 
      ? req.url.replace(prefix, '') || '/' 
      : req.url;
    
    req.url = rewrittenPath;

    console.log(`[LB] ${req.method} ${originalPath} → ${targetService.name}${rewrittenPath}`);
    proxy.web(req, res, { target: targetService.target });
  });
});

//Health Check Endpoint
app.get("/", (req, res) => {
  res.json({
    gateway: "InnoSpace Load Balancer",
    status: "running",
    services: [
      "auth",
      "register",
      "payment"
    ]
  });
});

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