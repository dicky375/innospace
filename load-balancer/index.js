require('dotenv').config();
const http = require('http');
const httpProxy = require('http-proxy');
const { SERVER_REGISTRY } = require('../shared/config/servers');

const PORT = process.env.LOAD_BALANCER_PORT || 3000;
const proxy = httpProxy.createProxyServer({});

proxy.on('error', (err, req, res) => {
  console.error(`[LB] Proxy error:`, err.message);
  if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Bad gateway — target server unavailable' }));
});

function resolveTarget(url) {
  for (const server of SERVER_REGISTRY) {
    if (server.routes.some((prefix) => url.startsWith(prefix))) return server;
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', servers: SERVER_REGISTRY }));
  }

  const url = req.url.split('?')[0];
  const target = resolveTarget(url);

  if (!target) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: `No server handles route: ${url}` }));
  }

  console.log(`[LB] ${req.method} ${req.url} → ${target.name}`);
  proxy.web(req, res, { target: target.target });
});

server.listen(PORT, () => {
  console.log(`\n🔀 Load Balancer running on port ${PORT}`);
  SERVER_REGISTRY.forEach((s) => {
    console.log(`  ${s.name} → ${s.target}`);
    s.routes.forEach((r) => console.log(`    • ${r}`));
  });
});