import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  POS_EXPANDED_DEFAULT_KEY,
  POS_LAYOUT_KEY,
  POS_VERTICAL_CATEGORY_CARD_KEY,
  POS_SELECTED_CATEGORY_LABEL_KEY,
  POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY,
  POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY,
  isPosExpandedByDefault,
  setPosExpandedByDefault,
  getPosLayout,
  setPosLayout,
  isPosVerticalCategoryCardVisible,
  setPosVerticalCategoryCardVisible,
  isPosSelectedCategoryLabelVisible,
  setPosSelectedCategoryLabelVisible,
  isPosDummyImageBgForUploaded,
  setPosDummyImageBgForUploaded,
  isPosDummyImageBgShowBadge,
  setPosDummyImageBgShowBadge,
} from "./posAppearanceSettings";

describe("posAppearanceSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("defaults to true when no label or localStorage is present", () => {
    expect(isPosExpandedByDefault()).toBe(true);
    expect(isPosExpandedByDefault({})).toBe(true);
  });

  it("respects org admin labels when provided", () => {
    expect(
      isPosExpandedByDefault({ [POS_EXPANDED_DEFAULT_KEY]: "false" })
    ).toBe(false);
    expect(
      isPosExpandedByDefault({ [POS_EXPANDED_DEFAULT_KEY]: "true" })
    ).toBe(true);
  });

  it("falls back to localStorage when label is not provided", () => {
    localStorage.setItem(POS_EXPANDED_DEFAULT_KEY, "false");
    expect(isPosExpandedByDefault()).toBe(false);

    localStorage.setItem(POS_EXPANDED_DEFAULT_KEY, "true");
    expect(isPosExpandedByDefault()).toBe(true);
  });

  it("sets preference in localStorage and invokes setAdminLabel", () => {
    const mockSetAdminLabel = vi.fn();
    setPosExpandedByDefault(false, mockSetAdminLabel);

    expect(localStorage.getItem(POS_EXPANDED_DEFAULT_KEY)).toBe("false");
    expect(mockSetAdminLabel).toHaveBeenCalledWith(
      POS_EXPANDED_DEFAULT_KEY,
      "false"
    );
  });

  it("dispatches custom event on change", () => {
    const listener = vi.fn();
    window.addEventListener("pos-expanded-default-changed", listener);

    setPosExpandedByDefault(true);

    expect(listener).toHaveBeenCalled();
    window.removeEventListener("pos-expanded-default-changed", listener);
  });

  describe("getPosLayout and setPosLayout", () => {
    it("defaults to 'standard' when no label or localStorage is present", () => {
      expect(getPosLayout()).toBe("standard");
      expect(getPosLayout({})).toBe("standard");
    });

    it("respects org admin labels when provided", () => {
      expect(
        getPosLayout({ [POS_LAYOUT_KEY]: "vertical-category" })
      ).toBe("vertical-category");
      expect(
        getPosLayout({ [POS_LAYOUT_KEY]: "standard" })
      ).toBe("standard");
    });

    it("falls back to localStorage when label is not provided", () => {
      localStorage.setItem(POS_LAYOUT_KEY, "vertical-category");
      expect(getPosLayout()).toBe("vertical-category");

      localStorage.setItem(POS_LAYOUT_KEY, "standard");
      expect(getPosLayout()).toBe("standard");
    });

    it("sets layout preference in localStorage and invokes setAdminLabel", () => {
      const mockSetAdminLabel = vi.fn();
      setPosLayout("vertical-category", mockSetAdminLabel);

      expect(localStorage.getItem(POS_LAYOUT_KEY)).toBe("vertical-category");
      expect(mockSetAdminLabel).toHaveBeenCalledWith(
        POS_LAYOUT_KEY,
        "vertical-category"
      );
    });

    it("dispatches custom event on layout change", () => {
      const listener = vi.fn();
      window.addEventListener("pos-layout-changed", listener);

      setPosLayout("vertical-category");

      expect(listener).toHaveBeenCalled();
      window.removeEventListener("pos-layout-changed", listener);
    });
  });

  describe("isPosVerticalCategoryCardVisible and setPosVerticalCategoryCardVisible", () => {
    it("defaults to true when no label or localStorage is present", () => {
      expect(isPosVerticalCategoryCardVisible()).toBe(true);
      expect(isPosVerticalCategoryCardVisible({})).toBe(true);
    });

    it("respects org admin labels when provided", () => {
      expect(
        isPosVerticalCategoryCardVisible({ [POS_VERTICAL_CATEGORY_CARD_KEY]: "false" })
      ).toBe(false);
      expect(
        isPosVerticalCategoryCardVisible({ [POS_VERTICAL_CATEGORY_CARD_KEY]: "true" })
      ).toBe(true);
    });

    it("falls back to localStorage when label is not provided", () => {
      localStorage.setItem(POS_VERTICAL_CATEGORY_CARD_KEY, "false");
      expect(isPosVerticalCategoryCardVisible()).toBe(false);

      localStorage.setItem(POS_VERTICAL_CATEGORY_CARD_KEY, "true");
      expect(isPosVerticalCategoryCardVisible()).toBe(true);
    });

    it("sets preference in localStorage and invokes setAdminLabel", () => {
      const mockSetAdminLabel = vi.fn();
      setPosVerticalCategoryCardVisible(false, mockSetAdminLabel);

      expect(localStorage.getItem(POS_VERTICAL_CATEGORY_CARD_KEY)).toBe("false");
      expect(mockSetAdminLabel).toHaveBeenCalledWith(
        POS_VERTICAL_CATEGORY_CARD_KEY,
        "false"
      );
    });

    it("dispatches custom event on card visibility change", () => {
      const listener = vi.fn();
      window.addEventListener("pos-vertical-category-card-changed", listener);

      setPosVerticalCategoryCardVisible(false);

      expect(listener).toHaveBeenCalled();
      window.removeEventListener("pos-vertical-category-card-changed", listener);
    });
  });

  describe("isPosSelectedCategoryLabelVisible and setPosSelectedCategoryLabelVisible", () => {
    it("defaults to true when no label or localStorage is present", () => {
      expect(isPosSelectedCategoryLabelVisible()).toBe(true);
      expect(isPosSelectedCategoryLabelVisible({})).toBe(true);
    });

    it("respects org admin labels when provided", () => {
      expect(
        isPosSelectedCategoryLabelVisible({ [POS_SELECTED_CATEGORY_LABEL_KEY]: "false" })
      ).toBe(false);
      expect(
        isPosSelectedCategoryLabelVisible({ [POS_SELECTED_CATEGORY_LABEL_KEY]: "true" })
      ).toBe(true);
    });

    it("falls back to localStorage when label is not provided", () => {
      localStorage.setItem(POS_SELECTED_CATEGORY_LABEL_KEY, "false");
      expect(isPosSelectedCategoryLabelVisible()).toBe(false);

      localStorage.setItem(POS_SELECTED_CATEGORY_LABEL_KEY, "true");
      expect(isPosSelectedCategoryLabelVisible()).toBe(true);
    });

    it("sets preference in localStorage and invokes setAdminLabel", () => {
      const mockSetAdminLabel = vi.fn();
      setPosSelectedCategoryLabelVisible(false, mockSetAdminLabel);

      expect(localStorage.getItem(POS_SELECTED_CATEGORY_LABEL_KEY)).toBe("false");
      expect(mockSetAdminLabel).toHaveBeenCalledWith(
        POS_SELECTED_CATEGORY_LABEL_KEY,
        "false"
      );
    });

    it("dispatches custom event on label visibility change", () => {
      const listener = vi.fn();
      window.addEventListener("pos-selected-category-label-changed", listener);

      setPosSelectedCategoryLabelVisible(false);

      expect(listener).toHaveBeenCalled();
      window.removeEventListener("pos-selected-category-label-changed", listener);
    });
  });

  describe("POS dummy image background for uploaded items", () => {
    it("defaults to false when no label or localStorage is present", () => {
      expect(isPosDummyImageBgForUploaded()).toBe(false);
      expect(isPosDummyImageBgForUploaded({})).toBe(false);
    });

    it("respects org admin labels when provided", () => {
      expect(
        isPosDummyImageBgForUploaded({ [POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY]: "true" })
      ).toBe(true);
      expect(
        isPosDummyImageBgForUploaded({ [POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY]: "false" })
      ).toBe(false);
    });

    it("falls back to localStorage when label is not provided", () => {
      localStorage.setItem(POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY, "true");
      expect(isPosDummyImageBgForUploaded()).toBe(true);

      localStorage.setItem(POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY, "false");
      expect(isPosDummyImageBgForUploaded()).toBe(false);
    });

    it("sets preference in localStorage and invokes setAdminLabel", () => {
      const mockSetAdminLabel = vi.fn();
      setPosDummyImageBgForUploaded(true, mockSetAdminLabel);

      expect(localStorage.getItem(POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY)).toBe("true");
      expect(mockSetAdminLabel).toHaveBeenCalledWith(
        POS_DUMMY_IMAGE_BG_FOR_UPLOADED_KEY,
        "true"
      );
    });

    it("dispatches custom event on dummy image bg change", () => {
      const listener = vi.fn();
      window.addEventListener("pos-dummy-image-bg-changed", listener);

      setPosDummyImageBgForUploaded(true);

      expect(listener).toHaveBeenCalled();
      window.removeEventListener("pos-dummy-image-bg-changed", listener);
    });
  });

  describe("POS dummy image background brand badge", () => {
    it("defaults to true when no label or localStorage is present", () => {
      expect(isPosDummyImageBgShowBadge()).toBe(true);
      expect(isPosDummyImageBgShowBadge({})).toBe(true);
    });

    it("respects org admin labels when provided", () => {
      expect(
        isPosDummyImageBgShowBadge({ [POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY]: "false" })
      ).toBe(false);
      expect(
        isPosDummyImageBgShowBadge({ [POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY]: "true" })
      ).toBe(true);
    });

    it("falls back to localStorage when label is not provided", () => {
      localStorage.setItem(POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY, "false");
      expect(isPosDummyImageBgShowBadge()).toBe(false);

      localStorage.setItem(POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY, "true");
      expect(isPosDummyImageBgShowBadge()).toBe(true);
    });

    it("sets preference in localStorage and invokes setAdminLabel", () => {
      const mockSetAdminLabel = vi.fn();
      setPosDummyImageBgShowBadge(false, mockSetAdminLabel);

      expect(localStorage.getItem(POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY)).toBe("false");
      expect(mockSetAdminLabel).toHaveBeenCalledWith(
        POS_DUMMY_IMAGE_BG_SHOW_BADGE_KEY,
        "false"
      );
    });

    it("dispatches custom event on badge visibility change", () => {
      const listener = vi.fn();
      window.addEventListener("pos-dummy-image-bg-show-badge-changed", listener);

      setPosDummyImageBgShowBadge(false);

      expect(listener).toHaveBeenCalled();
      window.removeEventListener("pos-dummy-image-bg-show-badge-changed", listener);
    });
  });
});
