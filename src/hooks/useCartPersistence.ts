import { useEffect, useRef } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { addLine } from "@/store/slices/cartSlice";
import { selectToken } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import { fetchPendingCart, savePendingCart, deletePendingCart } from "@/api/pendingCart";
import { store } from "@/store";

/**
 * Loads the pending cart from the backend on mount, and debounce-saves
 * cart changes back to the backend (1s delay).
 *
 * Place this hook once in the operator layout or POS page.
 */
export function useCartPersistence() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCartJsonRef = useRef<string>("");

  // Load cart from backend on first mount (when context is ready)
  useEffect(() => {
    if (!token || !orgId || !branchId || loadedRef.current) return;
    loadedRef.current = true;

    fetchPendingCart(token, orgId, branchId)
      .then((saved) => {
        if (saved && Array.isArray(saved.lines) && saved.lines.length > 0) {
          // Only restore if the current cart is empty
          const current = store.getState().cart;
          if (current.lines.length === 0) {
            for (const line of saved.lines) {
              dispatch(
                addLine({
                  itemId: line.itemId,
                  itemName: line.itemName,
                  primaryImageUrl: line.primaryImageUrl,
                  qty: line.qty,
                  unitPrice: line.unitPrice,
                  modifiers: line.modifiers,
                  notes: line.notes,
                }),
              );
            }
          }
        }
        // Snapshot current state so we don't immediately re-save what we just loaded
        prevCartJsonRef.current = JSON.stringify(store.getState().cart);
      })
      .catch(() => {
        // Silently ignore — cart just won't be restored
      });
  }, [token, orgId, branchId, dispatch]);

  // Debounce-save cart to backend on every change
  useEffect(() => {
    if (!token || !orgId || !branchId) return;

    const unsubscribe = store.subscribe(() => {
      const cart = store.getState().cart;
      const json = JSON.stringify(cart);

      // Skip if nothing changed
      if (json === prevCartJsonRef.current) return;
      prevCartJsonRef.current = json;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        if (cart.lines.length === 0) {
          deletePendingCart(token, orgId, branchId).catch(() => {});
        } else {
          savePendingCart(token, orgId, branchId, cart).catch(() => {});
        }
      }, 1000);
    });

    return () => {
      unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        // Flush pending save immediately on unmount
        const cart = store.getState().cart;
        if (cart.lines.length === 0) {
          deletePendingCart(token, orgId, branchId).catch(() => {});
        } else {
          savePendingCart(token, orgId, branchId, cart).catch(() => {});
        }
      }
    };
  }, [token, orgId, branchId]);
}

/**
 * Clears the pending cart on the backend (call on logout/idle).
 */
export async function clearPendingCartOnServer(
  token: string | null,
  orgId: string | null,
  branchId: string | null
): Promise<void> {
  if (!token || !orgId || !branchId) return;
  try {
    await deletePendingCart(token, orgId, branchId);
  } catch {
    // Best-effort
  }
}
