import { Route, Routes } from "react-router-dom";
import { CatalogProvider } from "./data/CatalogContext";
import { AuthProvider, useAuth } from "./data/AuthContext";
import { ChatProvider } from "./data/ChatContext";
import { DownloadsProvider } from "./data/DownloadsContext";
import { LaunchProvider } from "./data/LaunchContext";
import { AppPanelsProvider } from "./data/AppPanelsContext";
import { DownloadBar } from "./components/DownloadBar";
import { LaunchScreen } from "./components/LaunchScreen";
import { checkIsDesktopApp } from "./data/useDesktopApp";
import { AuthPage } from "./pages/Auth/AuthPage";
import { CartPage } from "./pages/cart/CartPage";
import { PayPage } from "./pages/cart/PayPage";
import { CartProvider } from "./data/CartContext";
import { GamePage } from "./pages/game/GamePage";
import { LibraryPage } from "./pages/library/LibraryPage";
import { FriendsPage } from "./pages/library/FriendsPage";
import { MessagesPage } from "./pages/library/MessagesPage";
import { GamesPage } from "./pages/Store/GamesPage";
import { ReleasePage } from "./pages/Store/ReleasePage";
import { StorePage } from "./pages/Store/StorePage";
import { ProfilePage } from "./pages/profile/ProfilePage";
import { PublicProfilePage } from "./pages/profile/PublicProfilePage";
import { SettingsPanel } from "./pages/Store/SettingsPanel";
import { HelpPanel } from "./pages/Store/HelpPanel";

function AppRoutes() {
  const { status } = useAuth();
  const isDesktop = checkIsDesktopApp();

  if (isDesktop) {
    if (status === "loading") {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#000",
            display: "grid",
            placeItems: "center",
            color: "#ECE7DE",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <img
              src="/logotipes/micrologotipe.svg"
              alt="GameNow"
              width="64"
              height="64"
              style={{ margin: "0 auto 16px", display: "block" }}
            />
            <p style={{ color: "#9C9588", fontSize: "14px", letterSpacing: "0.5px" }}>
              Iniciando sesión en GameNow…
            </p>
          </div>
        </div>
      );
    }

    if (status === "unauthenticated") {
      return <AuthPage isMandatory={true} />;
    }
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<StorePage />} />
        <Route path="/juegos" element={<GamesPage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/amigos" element={<FriendsPage />} />
        <Route path="/mensajes" element={<MessagesPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/pago" element={<PayPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/perfil/:steamId" element={<PublicProfilePage />} />
        <Route path="/game/:id" element={<GamePage />} />
        <Route path="/lanzamiento/:appId" element={<ReleasePage />} />
      </Routes>
      <SettingsPanel />
      <HelpPanel />
    </>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppPanelsProvider>
        <ChatProvider>
          <DownloadsProvider>
            <LaunchProvider>
              <CartProvider>
                <CatalogProvider>
                  <AppRoutes />
                  <DownloadBar />
                  <LaunchScreen />
                </CatalogProvider>
              </CartProvider>
            </LaunchProvider>
          </DownloadsProvider>
        </ChatProvider>
      </AppPanelsProvider>
    </AuthProvider>
  );
}
