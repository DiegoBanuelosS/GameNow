## Navigation and IA

GameNow is a video game store. Auth sits outside the signed-in frame.

### Sitemap

- `Tienda` (`/`) – browse games. No session required.
- `Mi biblioteca` (`/library`) – games the user owns. Visible in the top nav.
- `Iniciar sesión` (`/auth`) – optional. Close returns to `Tienda`.
- `Ofertas` (`/offers`) – discounted games
- `Juego` (`/game/:id`) – a single game
- `Panel` (`/dashboard`) – account overview

### Guidelines

- Use the same noun in nav, headings, and buttons (`Biblioteca`, not `Mis juegos` in one place and `Library` in another).
- Auth is a gateway, not a signed-in section. After a valid session, land on `Tienda`.
- Keep depth to three levels: section → game → purchase / details.
