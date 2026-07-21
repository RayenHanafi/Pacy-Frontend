"use client";

import { useEffect } from "react";

/**
 * Registers the app-shell service worker (see `public/sw.js` for what it will
 * and won't cache).
 *
 * Production only. In dev a worker sitting in front of Turbopack's asset URLs
 * serves stale chunks after an edit, which reads as "my change didn't apply".
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs us installability, nothing more — the
        // app works identically without it, so never surface this to a user.
      });
    };

    // Registration competes with the first data fetches for bandwidth; wait
    // until the page has settled.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
