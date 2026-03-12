import http from "http";
import httpProxy from "http-proxy";

const proxy = httpProxy.createProxyServer();

const servers = [
  "http://localhost:5000",
  "http://localhost:5001",
  "http://localhost:5002"
];

let current = 0;

const server = http.createServer((req, res) => {
  
  const target = servers[current];

  current = (current + 1) % servers.length;

  console.log(`Forwarding request to ${target}`);

  proxy.web(req, res, { target });
});

server.listen(4000, () => {
  console.log("Load balancer running on port 4000");
});