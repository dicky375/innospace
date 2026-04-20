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
      message: 'Service is currently unavailable. Please try again later.',
    }));
  }
});

// Main Server
const server = http.createServer((req, res) => {
  logger(req, res, () => {
    // 1. Health Check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: SERVER_REGISTRY.length,
        environment: process.env.NODE_ENV || 'development'
      }));
    }

    // 2. Resolve Target (Now correctly placed inside the request handler)
    const targetService = getTargetService(req.url);

    if (!targetService) {
      console.warn(`[LB] No matching service for: ${req.method} ${req.url}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        success: false,
        error: 'Not Found',
        message: `No service registered for ${req.url}`
      }));
    }

    // 3. Proxy the request
    console.log(`[LB] ${req.method} ${req.url} → ${targetService.name}`);
    proxy.web(req, res, { target: targetService.target });
  });
});

// Start Load Balancer
server.listen(PORT, HOST, () => {
  console.clear();
  console.log(`\n🚀 INNOSPACE LOAD BALANCER RUNNING`);
  console.log(`=====================================`);
  console.log(`Network : http://192.168.43.82:${PORT}`);
  console.log(`Local   : http://localhost:${PORT}`);
  console.log(`Mode    : ${process.env.NODE_ENV || 'development'}`);
  console.log(`=====================================\n`);

  SERVER_REGISTRY.forEach(s => {
    console.log(`📦 ${s.name.padEnd(18)} → ${s.target}`);
  });
  console.log(`\n✅ Load Balancer is ready to route requests.\n`);
});

// Port Error Handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    process.exit(1);
  } else {
    console.error('[LB] Server Error:', err);
  }
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Load Balancer...');
  server.close(() => process.exit(0));
});