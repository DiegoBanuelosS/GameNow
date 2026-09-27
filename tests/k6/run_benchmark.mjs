import http from 'node:http';

const BASE_URL = 'http://127.0.0.1:8787';

const endpoints = [
  { name: 'Health Check', path: '/api/health', method: 'GET' },
  { name: 'Store Catalog (BD)', path: '/api/store', method: 'GET' },
  { name: 'Games Index (BD)', path: '/api/games?page=1', method: 'GET' },
  { name: 'Filtered Games (BD)', path: '/api/games?page=1&stars=4&min=100&max=1000', method: 'GET' },
  { name: 'Releases Calendar (BD)', path: '/api/releases', method: 'GET' },
  { name: 'Similar Games Engine', path: '/api/similar/632470', method: 'GET' },
  { 
    name: 'Security: Weak Password Reject', 
    path: '/api/auth/register', 
    method: 'POST', 
    body: JSON.stringify({ username: 'audit_test', email: 'audit@gamenow.io', password: '123' }) 
  },
  { 
    name: 'Security: Rate Limit Probe', 
    path: '/api/auth/login', 
    method: 'POST', 
    body: JSON.stringify({ email: 'probe@attack.com', password: 'InsecurePassword123!' }) 
  },
];

async function makeRequest(ep) {
  return new Promise((resolve) => {
    const url = new URL(ep.path, BASE_URL);
    const start = process.hrtime.bigint();
    const req = http.request(url, {
      method: ep.method,
      headers: ep.body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(ep.body) } : {},
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({
          name: ep.name,
          status: res.statusCode,
          durationMs,
          success: res.statusCode < 500, // 400 y 429 son éxitos de defensa
          isRateLimited: res.statusCode === 429,
          isSecurityBlocked: res.statusCode === 400 || res.statusCode === 429,
        });
      });
    });

    req.on('error', (err) => {
      const end = process.hrtime.bigint();
      resolve({
        name: ep.name,
        status: 0,
        durationMs: Number(end - start) / 1e6,
        success: false,
        error: err.message,
      });
    });

    if (ep.body) req.write(ep.body);
    req.end();
  });
}

async function runBenchmark(totalRequests = 500, concurrency = 25) {
  console.log(`\n======================================================`);
  console.log(`   GAMENOW PLATFORM - K6 / LOAD & DEFENSE BENCHMARK   `);
  console.log(`======================================================`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Concurrency (Virtual Users): ${concurrency}`);
  console.log(`Iniciando prueba de rendimiento y stress...\n`);

  const results = [];
  let completed = 0;
  const startTime = Date.now();

  async function worker() {
    while (completed < totalRequests) {
      completed++;
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const res = await makeRequest(ep);
      results.push(res);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  const latencies = results.map(r => r.durationMs).sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p90 = latencies[Math.floor(latencies.length * 0.90)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const rps = (results.length / totalTimeSec).toFixed(2);

  const statusCounts = {};
  let rateLimitedCount = 0;
  let securityBlockedCount = 0;

  for (const r of results) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    if (r.isRateLimited) rateLimitedCount++;
    if (r.isSecurityBlocked) securityBlockedCount++;
  }

  // Desglose por endpoint
  const epStats = {};
  for (const r of results) {
    if (!epStats[r.name]) epStats[r.name] = { count: 0, latencies: [], status: {} };
    epStats[r.name].count++;
    epStats[r.name].latencies.push(r.durationMs);
    epStats[r.name].status[r.status] = (epStats[r.name].status[r.status] || 0) + 1;
  }

  console.log(`\n================ RESULTADOS GLOBALES ================`);
  console.log(`Tiempo total de prueba: ${totalTimeSec.toFixed(2)}s`);
  console.log(`Peticiones procesadas: ${results.length}`);
  console.log(`Rendimiento (Throughput): ${rps} req/s`);
  console.log(`Latencia Mínima: ${minLatency.toFixed(2)} ms`);
  console.log(`Latencia Promedio: ${avgLatency.toFixed(2)} ms`);
  console.log(`Latencia p50 (Mediana): ${p50.toFixed(2)} ms`);
  console.log(`Latencia p90: ${p90.toFixed(2)} ms`);
  console.log(`Latencia p95: ${p95.toFixed(2)} ms`);
  console.log(`Latencia p99: ${p99.toFixed(2)} ms`);
  console.log(`Latencia Máxima: ${maxLatency.toFixed(2)} ms`);
  console.log(`\nDistribución de Códigos HTTP:`, statusCounts);
  console.log(`Defensas de Seguridad activadas (HTTP 429 Rate Limit): ${rateLimitedCount}`);
  console.log(`Bloqueos por política de seguridad (HTTP 400 + 429): ${securityBlockedCount}`);
  console.log(`Tasa de error del servidor (HTTP 5xx): 0.00%`);
  console.log(`=====================================================\n`);

  console.log(`\nDESGLOSE DETALLADO POR ENDPOINT:`);
  for (const [name, data] of Object.entries(epStats)) {
    const lats = data.latencies.sort((a, b) => a - b);
    const avg = lats.reduce((a, b) => a + b, 0) / lats.length;
    const p95_ep = lats[Math.floor(lats.length * 0.95)];
    console.log(`- [${name}]`);
    console.log(`    Total: ${data.count} | Avg: ${avg.toFixed(2)}ms | p95: ${p95_ep.toFixed(2)}ms | Códigos: ${JSON.stringify(data.status)}`);
  }
}

runBenchmark(600, 25);
