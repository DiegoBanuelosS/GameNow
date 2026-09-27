import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const gamesLoadedCounter = new Counter('gamenow_games_retrieved');
const securityBlockedCounter = new Counter('gamenow_security_rate_limited_429');
const catalogResponseTime = new Trend('gamenow_catalog_latency_ms');
const errorRate = new Rate('gamenow_error_rate');

export const options = {
  stages: [
    { duration: '5s', target: 10 },   // Calentamiento
    { duration: '15s', target: 25 },  // Carga sostenida estándar
    { duration: '5s', target: 50 },   // Pico de estrés de usuarios simultáneos
    { duration: '5s', target: 0 },    // Enfriamiento
  ],
  thresholds: {
    'http_req_duration': ['p(95)<600'], // El 95% de las peticiones deben responder en menos de 600ms
    'gamenow_error_rate': ['rate<0.05'], // Tasa de errores no esperados menor al 5%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8787';

export default function () {
  // 1. Verificación de Salud del Sistema (Health Check)
  group('01_Health_Check', () => {
    const res = http.get(`${BASE_URL}/api/health`);
    const passed = check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check payload ok': (r) => {
        try {
          return JSON.parse(r.body).ok === true;
        } catch (_) {
          return false;
        }
      },
    });
    if (!passed) errorRate.add(1);
    else errorRate.add(0);
  });

  sleep(0.3);

  // 2. Consulta del Catálogo de Tienda (Juegos alojados en Base de Datos)
  group('02_Store_Catalog_DB', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/store`);
    catalogResponseTime.add(Date.now() - start);

    const passed = check(res, {
      'store status 200': (r) => r.status === 200,
      'has game banners / sections': (r) => {
        try {
          const data = JSON.parse(r.body);
          return Array.isArray(data.banners) || Array.isArray(data.offers) || Array.isArray(data.featured);
        } catch (_) {
          return false;
        }
      },
    });

    if (passed) {
      gamesLoadedCounter.add(1);
      errorRate.add(0);
    } else {
      errorRate.add(1);
    }
  });

  sleep(0.3);

  // 3. Consulta de Juegos Paginados con Filtros en BD
  group('03_Games_Pagination_DB', () => {
    const res = http.get(`${BASE_URL}/api/games?page=1&tab=all&min=0&max=1000&stars=4`);
    const passed = check(res, {
      'games query status 200': (r) => r.status === 200,
      'games list received from DB': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.items) || Array.isArray(body);
        } catch (_) {
          return false;
        }
      },
    });
    if (!passed) errorRate.add(1);
    else errorRate.add(0);
  });

  sleep(0.3);

  // 4. Calendario de Lanzamientos alojado en BD
  group('04_Releases_Calendar_DB', () => {
    const res = http.get(`${BASE_URL}/api/releases`);
    const passed = check(res, {
      'releases status 200': (r) => r.status === 200,
    });
    if (!passed) errorRate.add(1);
    else errorRate.add(0);
  });

  sleep(0.5);

  // 5. Prueba de Seguridad y Defensa: Rate Limiting & Input Validation
  group('05_Security_Defense_RateLimit', () => {
    // Intento de registro malicioso con contraseña débil (debe ser bloqueado con 400 por validación estricta)
    const weakPayload = JSON.stringify({
      username: 'hacker_test_' + Math.floor(Math.random() * 100000),
      email: 'hacker@malicious.com',
      password: '123', // Insegura
    });

    const secRes = http.post(`${BASE_URL}/api/auth/register`, weakPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(secRes, {
      'defense blocked weak password (400)': (r) => r.status === 400,
    });

    // Ráfaga para verificar activación del rate limiter (429 Too Many Requests)
    for (let i = 0; i < 5; i++) {
      const burstRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: 'target@probe.com',
        password: 'WrongPassword123!',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      if (burstRes.status === 429) {
        securityBlockedCounter.add(1);
      }
    }
  });

  sleep(0.5);
}
