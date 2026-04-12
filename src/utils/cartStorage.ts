import type { CartState } from "@/store/slices/cartSlice";

const CART_STORAGE_KEY = "xpos_cart";

export function getStoredCart(): CartState | null {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CartState;
    if (!Array.isArray(data.lines)) return null;
    return data;
  } catch {
    sessionStorage.removeItem(CART_STORAGE_KEY);
    return null;
  }
}

export function setStoredCart(cart: CartState): void {
  sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

export function clearStoredCart(): void {
  sessionStorage.removeItem(CART_STORAGE_KEY);
}
