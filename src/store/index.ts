import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import cartReducer from "./slices/cartSlice";
import orgContextReducer from "./slices/orgContextSlice";
import { setOrg, setBranch, setTerminal } from "./slices/orgContextSlice";
import { getStoredAuth } from "@/utils/authStorage";
import { getStoredContext } from "@/utils/contextStorage";

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
            expiresAt: storedAuth.expiresAt,
          },
        }
      : undefined,
});

// Restore operator context from sessionStorage so refresh keeps user on menu-order etc.
const storedContext = getStoredContext();
if (storedContext != null) {
  store.dispatch(setOrg({ orgId: storedContext.orgId, orgName: storedContext.orgName }));
  store.dispatch(setBranch({ branchId: storedContext.branchId, branchName: storedContext.branchName }));
  store.dispatch(
    setTerminal({ terminalId: storedContext.terminalId, terminalName: storedContext.terminalName })
  );
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
