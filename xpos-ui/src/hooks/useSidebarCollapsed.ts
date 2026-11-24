import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "xpos_sidebar_collapsed";

function readStored(): boolean {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s === "true" || s === "false") return s === "true";
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.innerWidth < 1024) {
    return true;
  }
  return false;
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  return [collapsed, toggle];
}
