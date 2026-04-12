import { useEffect, useRef } from "react";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { addLine, clearCart } from "@/store/slices/cartSlice";
import { selectToken, selectIamUserId } from "@/store/selectors/authSelectors";
import { selectOrgId, selectBranchId } from "@/store/selectors/orgContextSelectors";
import { fetchPendingCart, savePendingCart, deletePendingCart } from "@/api/pendingCart";
import { store } from "@/store";

/**
 * Loads the pending cart from the backend when the operator layout mounts
 * or when the user/branch context changes. Debounce-saves cart changes
 * back to the backend (1s delay).
 */
export function useCartPersistence() {
  const dispatch = useAppDispatch();
  const token = useAppSelector(selectToken);
  const orgId = useAppSelector(selectOrgId);
  const branchId = useAppSelector(selectBranchId);
  const iamUserId = useAppSelector(selectIamUserId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCartJsonRef = useRef<string>("");
  const loadedKeyRef = useRef<string>("");

  // Load cart from backend whenever user or branch changes
  useEffect(() => {
    if (!token || !orgId || !branchId || !iamUserId) return;

    const key = `${iamUserId}:${orgId}:${branchId}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;

    // Clear any stale cart from a previous session
    dispatch(clearCart());

    fetchPendingCart(token, orgId, branchId)
      .then((saved) => {
        // Verify context hasn't changed during the async fetch
        const currentState = store.getState();
        if (currentState.auth.iamUserId !== iamUserId) return;

        if (saved && Array.isArray(saved.lines) && saved.lines.length > 0) {
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
        prevCartJsonRef.current = JSON.stringify(store.getState().cart);
      })
      .catch(() => {});
  }, [token, orgId, branchId, iamUserId, dispatch]);

  // Debounce-save cart to backend on every change
  useEffect(() => {
    if (!token || !orgId || !branchId) return;

    const unsubscribe = store.subscribe(() => {
      const cart = store.getState().cart;
      const json = JSON.stringify(cart);

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
