"use client";

import { useEffect } from "react";

export function CanonicalHostGuard(): null {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const { hostname } = window.location;
    if (hostname !== "localhost" && hostname !== "[::1]") {
      return;
    }

    const url = new URL(window.location.href);
    url.hostname = "127.0.0.1";
    window.location.replace(url.toString());
  }, []);

  return null;
}
