import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer, { addLine } from "./slices/cartSlice";
import orgContextReducer from "./slices/orgContextSlice";
import { setOrg, setBranch, setTerminal } from "./slices/orgContextSlice";
import { getStoredAuth } from "@/utils/authStorage";
import { getStoredContext, getStoredAdminContext } from "@/utils/contextStorage";
import { getStoredCart, setStoredCart } from "@/utils/cartStorage";

const storedAuth = getStoredAuth();

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orgContext: orgContextReducer,
    cart: cartReducer,
  },
  preloadedState:
    storedAuth != null
      ? {
          auth: {
            token: storedAuth.token,
            iamUserId: storedAuth.iamUserId,
            username: storedAuth.username ?? null,
            expiresAt: storedAuth.expiresAt,
            refreshToken: storedAuth.refreshToken ?? null,
            roles: storedAuth.roles ?? [],
          },
        }
      : undefined,
});

// Restore cart from sessionStorage
const storedCart = getStoredCart();
if (storedCart) {
  for (const line of storedCart.lines) {
    store.dispatch(
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

// Persist cart to sessionStorage on every change
store.subscribe(() => {
  setStoredCart(store.getState().cart);
});

// Restore context from sessionStorage so refresh keeps user context (Analytics, Revenue, etc.)
const storedContext = getStoredContext();
if (storedContext != null) {
  store.dispatch(setOrg({ orgId: storedContext.orgId, orgName: storedContext.orgName }));
  store.dispatch(setBranch({ branchId: storedContext.branchId, branchName: storedContext.branchName }));
  store.dispatch(
    setTerminal({ terminalId: storedContext.terminalId, terminalName: storedContext.terminalName })
  );
} else {
  const adminContext = getStoredAdminContext();
  if (adminContext != null) {
    store.dispatch(setOrg({ orgId: adminContext.orgId, orgName: adminContext.orgName }));
    store.dispatch(setBranch({ branchId: adminContext.branchId, branchName: adminContext.branchName }));
  }
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
