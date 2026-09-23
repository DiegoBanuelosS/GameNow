import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

export interface SteamLibraryGame {
  slug: string;
  steamAppId?: string;
  name: string;
  cover: string;
  coverSrcSet?: string;
  coverFallback?: string;
  banner?: string;
  miniIcon: string;
  genre: "RPG" | "Acción" | "Aventura" | "Shooter" | "Estrategia" | "Indie";
  lastPlayed: string;
  lastPlayedTimestamp: number;
  playTimeHours: number;
  isInstalled: boolean;
  isFavorite: boolean;
  userRating?: number;
  userNote?: string;
  purchased?: boolean;
  desktopShortcut?: boolean;
  taskbarPin?: boolean;
  beta?: string;
}

export interface User {
  _id: string;
  username: string;
  email: string;
  role: "user" | "admin";
  avatarUrl?: string;
  steamId?: string;
  steamName?: string;
  steamAvatarUrl?: string;
  steamFrameUrl?: string;
  steamBackgroundUrl?: string;
  steamBackgroundVideo?: string;
  steamGameCount?: number;
  steamGames?: SteamLibraryGame[];
  createdAt?: string;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  connectSteam: () => Promise<{ ok: boolean; error?: string }>;
  refreshSteam: () => Promise<{ ok: boolean; error?: string }>;
  updateLibraryGame: (
    slug: string,
    patch: {
      userRating?: number;
      isInstalled?: boolean;
      userNote?: string;
      desktopShortcut?: boolean;
      taskbarPin?: boolean;
      beta?: string;
      sell?: boolean;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
  purchaseGames: (slugs: string[]) => Promise<{ ok: boolean; error?: string }>;
  unlinkSteam: () => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "gamenow_auth_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<AuthStatus>("loading");

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const verifyToken = useCallback(async (authToken: string) => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setStatus("authenticated");
      } else {
        // Token inválido o expirado
        logout();
      }
    } catch {
      // Error de red temporal: si ya tenemos token, no desloguear inmediatamente a menos que sea 401
      setStatus("unauthenticated");
    }
  }, [logout]);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setStatus("unauthenticated");
    }
  }, [verifyToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { ok: false, error: data.error || "Error al iniciar sesión." };
        }

        try {
          localStorage.setItem(TOKEN_KEY, data.token);
        } catch {}

        setToken(data.token);
        setUser(data.user);
        setStatus("authenticated");

        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: "No se pudo conectar con el servidor. Revisa tu conexión a internet.",
        };
      }
    },
    [],
  );

  const connectSteam = useCallback(async () => {
    if (!token) {
      return { ok: false, error: "Inicia sesión en GameNow antes de vincular Steam." };
    }
    try {
      const response = await fetch("/api/auth/steam/start", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") {
        return { ok: false, error: data.error || "No se pudo abrir Steam." };
      }
      window.location.assign(data.url);
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo conectar con Steam." };
    }
  }, [token]);

  const refreshSteam = useCallback(async () => {
    if (!token) return { ok: false, error: "No autorizado." };
    try {
      const response = await fetch("/api/auth/steam/refresh", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, error: data.error || "No se pudo actualizar Steam." };
      }
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo leer tu perfil de Steam." };
    }
  }, [token]);

  const updateLibraryGame = useCallback(
    async (
      slug: string,
      patch: {
        userRating?: number;
        isInstalled?: boolean;
        userNote?: string;
        desktopShortcut?: boolean;
        taskbarPin?: boolean;
        beta?: string;
        sell?: boolean;
      },
    ) => {
      if (!token) return { ok: false, error: "No autorizado." };
      try {
        const response = await fetch("/api/steam/library", {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug, ...patch }),
        });
        const data = await response.json();
        if (!response.ok) {
          return { ok: false, error: data.error || "No se pudo guardar el cambio." };
        }
        setUser(data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: "No se pudo guardar el cambio." };
      }
    },
    [token],
  );

  const purchaseGames = useCallback(
    async (slugs: string[]) => {
      if (!token) return { ok: false, error: "No autorizado." };
      try {
        const response = await fetch("/api/steam/library", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slugs }),
        });
        const data = await response.json();
        if (!response.ok) {
          return { ok: false, error: data.error || "No se pudo agregar el juego a la biblioteca." };
        }
        setUser(data.user);
        return { ok: true };
      } catch {
        return { ok: false, error: "No se pudo agregar el juego a la biblioteca." };
      }
    },
    [token],
  );

  const unlinkSteam = useCallback(async () => {
    if (!token) return { ok: false, error: "No autorizado." };
    try {
      const response = await fetch("/api/auth/steam", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        return { ok: false, error: data.error || "No se pudo desvincular Steam." };
      }
      setUser(data.user);
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo desvincular Steam." };
    }
  }, [token]);

  const refreshedSteam = useRef("");
  useEffect(() => {
    if (!user?.steamId || !token) {
      refreshedSteam.current = "";
      return;
    }
    if (refreshedSteam.current === user.steamId) return;
    refreshedSteam.current = user.steamId;
    refreshSteam();
  }, [user?.steamId, token, refreshSteam]);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          return { ok: false, error: data.error || "Error al crear la cuenta." };
        }

        try {
          localStorage.setItem(TOKEN_KEY, data.token);
        } catch {}

        setToken(data.token);
        setUser(data.user);
        setStatus("authenticated");

        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: "No se pudo conectar con el servidor. Revisa tu conexión a internet.",
        };
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        status,
        login,
        register,
        logout,
        connectSteam,
        refreshSteam,
        updateLibraryGame,
        purchaseGames,
        unlinkSteam,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
}
