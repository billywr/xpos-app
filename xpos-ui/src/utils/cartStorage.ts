import type { CartState } from "@/store/slices/cartSlice";

const CART_STORAGE_PREFIX = "xpos_cart_";

function cartKey(userId: string): string {
  return `${CART_STORAGE_PREFIX}${userId}`;
}

export function getStoredCart(userId: string | null): CartState | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(cartKey(userId));
    if (!raw) return null;
    const data = JSON.parse(raw) as CartState;
    if (!Array.isArray(data.lines)) return null;
    return data;
  } catch {
    sessionStorage.removeItem(cartKey(userId));
    return null;
  }
}

export function setStoredCart(userId: string | null, cart: CartState): void {
  if (!userId) return;
  sessionStorage.setItem(cartKey(userId), JSON.stringify(cart));
}

export function clearStoredCart(userId: string | null): void {
  if (!userId) return;
  sessionStorage.removeItem(cartKey(userId));
}
