import { createSlice } from "@reduxjs/toolkit";

/**
 * Cart state for operator POS. Holds pending line items and order context
 * until the sale is created and lines are sent to the backend.
 */

export interface CartModifier {
  modifierOptionId: string;
  modifierOptionName: string;
  qty: number;
  unitPriceDelta: number;
}

export interface CartLine {
  tempId: string;
  itemId: string;
  itemName: string;
  primaryImageUrl: string | null;
  qty: number;
  unitPrice: number;
  modifiers: CartModifier[];
  notes?: string;
}

export interface CartState {
  lines: CartLine[];
  orderType: "DINE_IN" | "TAKEAWAY" | "DELIVERY";
  tableId: string | null;
  customerId: string | null;
  priceListId: string | null;
  saleId: string | null;
}

const initialState: CartState = {
  lines: [],
  orderType: "DINE_IN",
  tableId: null,
  customerId: null,
  priceListId: null,
  saleId: null,
};

function nextTempId(): string {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addLine: (
      state,
      action: {
        payload: {
          itemId: string;
          itemName: string;
          primaryImageUrl: string | null;
          qty: number;
          unitPrice: number;
          modifiers?: CartModifier[];
          notes?: string;
        };
      }
    ) => {
      const { itemId, itemName, primaryImageUrl, qty, unitPrice, modifiers, notes } =
        action.payload;
      const sameItem = (l: CartLine) =>
        l.itemId === itemId &&
        (l.modifiers?.length ?? 0) === (modifiers?.length ?? 0) &&
        !l.notes &&
        !notes;
      const existing = state.lines.find(sameItem);
      if (existing && (!modifiers || modifiers.length === 0) && !notes) {
        existing.qty += qty;
        return;
      }
      state.lines.push({
        tempId: nextTempId(),
        itemId,
        itemName,
        primaryImageUrl: primaryImageUrl ?? null,
        qty,
        unitPrice,
        modifiers: modifiers ?? [],
        notes,
      });
    },
    updateLineQty: (
      state,
      action: { payload: { tempId: string; qty: number } }
    ) => {
      const line = state.lines.find((l) => l.tempId === action.payload.tempId);
      if (line) {
        if (action.payload.qty <= 0) {
          state.lines = state.lines.filter((l) => l.tempId !== action.payload.tempId);
        } else {
          line.qty = action.payload.qty;
        }
      }
    },
    removeLine: (state, action: { payload: string }) => {
      state.lines = state.lines.filter((l) => l.tempId !== action.payload);
    },
    setOrderType: (state, action: { payload: CartState["orderType"] }) => {
      state.orderType = action.payload;
    },
    setTableId: (state, action: { payload: string | null }) => {
      state.tableId = action.payload;
    },
    setCustomerId: (state, action: { payload: string | null }) => {
      state.customerId = action.payload;
    },
    setPriceListId: (state, action: { payload: string | null }) => {
      state.priceListId = action.payload;
    },
    setSaleId: (state, action: { payload: string | null }) => {
      state.saleId = action.payload;
    },
    clearCart: () => initialState,
  },
});

export const {
  addLine,
  updateLineQty,
  removeLine,
  setOrderType,
  setTableId,
  setCustomerId,
  setPriceListId,
  setSaleId,
  clearCart,
} = cartSlice.actions;
export default cartSlice.reducer;