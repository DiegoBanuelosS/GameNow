import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const CART_KEY = "gamenow_cart";

export type CartItem = {
  slug: string;
  name: string;
  price: string;
  priceValue: number;
  cover: string;
};

type CartContextValue = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (slug: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const data = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item) => item && typeof item.slug === "string" && typeof item.name === "string" && typeof item.priceValue === "number",
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch {
      /* el navegador puede bloquear el almacenamiento */
    }
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((current) => {
      const rest = current.filter((row) => row.slug !== item.slug);
      return [...rest, item];
    });
  }, []);

  const remove = useCallback((slug: string) => {
    setItems((current) => current.filter((row) => row.slug !== slug));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({ items, add, remove, clear }), [items, add, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart fuera de CartProvider");
  return value;
}

export function formatMxn(value: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);
}
