import { Route, Routes } from "react-router-dom";
import { CatalogProvider } from "./data/CatalogContext";
import { AuthPage } from "./pages/Auth/AuthPage";
import { CartPage } from "./pages/cart/CartPage";
import { GamePage } from "./pages/game/GamePage";
import { LibraryPage } from "./pages/library/LibraryPage";
import { GamesPage } from "./pages/Store/GamesPage";
import { StorePage } from "./pages/Store/StorePage";

export function App() {
  return (
    <CatalogProvider>
      <Routes>
        <Route path="/" element={<StorePage />} />
        <Route path="/juegos" element={<GamesPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/game/:id" element={<GamePage />} />
      </Routes>
    </CatalogProvider>
  );
}
