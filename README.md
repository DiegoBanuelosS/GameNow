# GameNow 🎮

> **High-Performance Omnichannel Digital Gaming Distribution Simulation Platform**  
> _Academic & Personal Software Engineering Project_

[![Live Demo](https://img.shields.io/badge/Live%20Demo-gamenow--549.pages.dev-blue?style=for-the-badge&logo=cloudflare)](https://gamenow-549.pages.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Flutter](https://img.shields.io/badge/Flutter-Desktop-02569B?style=for-the-badge&logo=flutter)](https://flutter.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Security](https://img.shields.io/badge/Security-OWASP%20Hardened%20%2B%20E2EE-red?style=for-the-badge&logo=shield)](DOCUMENTATION.md#5-platform-defense-hardening--cybersecurity-measures)

---

## Live Preview / Demostración en Vivo

Experience the live web storefront deployed at the edge:  
 **[https://gamenow-549.pages.dev/](https://gamenow-549.pages.dev/)**

---

## 🎓 About This Project / Acerca de este Proyecto

**English:**  
GameNow is a personal and university academic project developed purely for software engineering research, portfolio showcase, and technical demonstration. It is not a commercial enterprise or real-world gaming store, but rather a professional-grade, hyper-realistic simulation designed to faithfully replicate the full architecture, cryptographic defenses, checkout flows, database throughput, and user experience of a modern digital distribution platform.

**Español:**  
GameNow es un proyecto personal y universitario desarrollado con fines puramente académicos, de investigación en ingeniería de software y demostración técnica. No es una plataforma comercial real en producción, sino una simulación hiperrealista de nivel profesional diseñada para emular con la máxima fidelidad posible la arquitectura, seguridad, flujos transaccionales, rendimiento y experiencia de usuario de una plataforma real de distribución digital.

---

## Technical Documentation / Documentación Técnica

Full technical architecture, database schemas, security hardening analysis, and k6 stress benchmarks:

- **[English Technical Documentation (DOCUMENTATION.md)](DOCUMENTATION.md)**
- **[Documentación Técnica en Español (DOCUMENTACION.md)](DOCUMENTACION.md)**

---

## Key Features / Características Principales

- **Centralized Database Storage:** Full game catalog (188,900+ titles), hardware requirements, media assets, and user libraries stored and indexed in MongoDB Atlas.
- **Omnichannel Architecture:**
  - **Web Client:** Ultra-fast React 18 + Vite + TypeScript deployed on Cloudflare Pages.
  - **Desktop Client:** High-performance native Windows client built with Flutter, featuring real-time PC hardware compatibility inspection (`pcFit`).
  - **Windows Installer:** Custom modern installer suite with C# low-level engine and Flutter UI.
- **Enterprise-Grade Security:**
  - `scrypt` cryptographic key derivation ($N=16384, r=8, p=1$) with 16-byte random salts.
  - Constant-time equality checks (`timingSafeEqual`) mitigating side-channel timing attacks.
  - Sliding-window adaptive rate limiting (20 req/min) with background memory leak protection.
  - Smart account lockout after consecutive failed attempts.
  - Stateless JWT with `tokenVersion` support for immediate cross-device session revocation (`POST /api/auth/revoke-sessions`).
  - Zero-knowledge End-to-End Encrypted (E2EE) private messaging (ECDH / JsonWebKey / AES-GCM 256-bit).
  - Perimeter HTTP header defense using `helmet` (HSTS for 1 year, NoSniff, Clickjacking defense, COOP/CORP).
  - Reverse proxy trust configuration (`trust proxy`) defeating IP spoofing.
- **Performance & Load Testing:**
  - Verified with Grafana k6 under 25 concurrent virtual users: **71.71 req/s** throughput, **31ms** median latency, 0.00% server error rate, and 100% defense against automated brute-force attacks.

---

## Quick Start / Inicio Rápido

### Backend API

```bash
cd API
npm install
npm run dev
```

### Web Client

```bash
cd WWW
npm install
npm run dev
```

### Run k6 Performance & Security Benchmark

```bash
node tests/k6/run_benchmark.mjs
```

---

_Created by Diego Bañuelos — 2026_
