/** Arte forzado en biblioteca / ofertas de edición (overrides de Steam). */

export const CYBERPUNK_LIBRARY_BANNER =
  "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,dpr_auto,c_limit,g_center,w_1440/gamenow/presskit/cp-home";

/** Antes era la carátula de Ultimate; ahora es Phantom Liberty. */
export const PHANTOM_LIBERTY_COVER =
  "https://res.cloudinary.com/fj6z6mba/image/upload/f_auto,q_auto:best,dpr_auto,c_limit,g_center,w_1440/gamenow/presskit/cp-liberty";

export const CYBERPUNK_ULTIMATE_COVER =
  "https://press.cdn.cdpr.app/media/assets/766/CP2077_UE_KV_1x1_RGB_CLEAN_v1_q90_680x680.png";

export function libraryBannerFor(game: { slug?: string; steamAppId?: string; banner?: string }) {
  if (game.slug === "cyberpunk-2077" || game.steamAppId === "1091500") {
    return CYBERPUNK_LIBRARY_BANNER;
  }
  return game.banner || "";
}

export function libraryCoverFor(game: { slug?: string; steamAppId?: string; cover?: string; coverFallback?: string }) {
  if (
    game.slug === "cyberpunk-2077:phantom-liberty" ||
    game.slug === "phantom-liberty" ||
    game.steamAppId === "2138330"
  ) {
    return PHANTOM_LIBERTY_COVER;
  }
  return game.cover || game.coverFallback || "";
}
