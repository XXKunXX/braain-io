"use client";

import { useRef, useState, useEffect } from "react";

/**
 * Dynamically shows or hides tab labels based on available container width.
 * Mark label elements with data-tab-label so they can be measured.
 *
 * The containerRef div must NOT have overflow:hidden — put that on a parent
 * wrapper so scrollWidth reflects the true natural content width.
 */
export function useTabLabels() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const check = () => {
      const labels = container.querySelectorAll<HTMLElement>("[data-tab-label]");
      const buttons = container.querySelectorAll<HTMLElement>("button");
      // Temporarily reveal labels + disable flex-shrink to get natural width
      labels.forEach((el) => (el.style.display = "inline"));
      buttons.forEach((el) => (el.style.flexShrink = "0"));
      const wouldOverflow = container.scrollWidth > container.clientWidth;
      // Restore
      labels.forEach((el) => (el.style.display = ""));
      buttons.forEach((el) => (el.style.flexShrink = ""));
      setShowLabels(!wouldOverflow);
    };

    const observer = new ResizeObserver(check);
    observer.observe(container);
    check();
    return () => observer.disconnect();
  }, []);

  return { containerRef, showLabels };
}
