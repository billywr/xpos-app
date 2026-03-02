/**
 * API types for catalog and related entities. Align with backend DTOs.
 */

export interface Category {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
}

export type ItemType = "STOCK" | "SERVICE" | "MENU" | "BUNDLE";

export interface Item {
  id: string;
  orgId: string;
  sku: string | null;
  name: string;
  itemType: ItemType;
  categoryId: string | null;
  baseUomId: string | null;
  taxProfileId: string | null;
  trackInventory: boolean;
  active: boolean;
  primaryImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ModifierGroup {
  id: string;
  orgId: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  required: boolean;
}

export interface ModifierOption {
  id: string;
  modifierGroupId: string;
  name: string;
  priceDelta: number;
}

export interface ItemModifierGroupLink {
  id: string;
  itemId: string;
  modifierGroupId: string;
}

export interface Uom {
  id: string;
  orgId: string;
  name: string;
  symbol: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaxProfile {
  id: string;
  orgId: string;
  name: string;
  vatCategory?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemBarcode {
  id: string;
  itemId: string;
  barcode: string;
  createdAt?: string;
}
