import { useEffect, useRef } from "react";

/**
 * Calls `handler` when the Escape key is pressed, but only when `enabled` is true.
 * The handler ref is kept up-to-date so callers don't need useCallback.
 */
export function useEscapeKey(handler: () => void, enabled: boolean) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handlerRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
