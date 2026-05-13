"use client";

import { useState, useEffect } from "react";

/**
 * Hook that returns `true` only after the component has mounted on the client.
 * Use this to gate any rendering that could cause React Hydration Error #418.
 * 
 * Usage:
 *   const isClient = useIsClient();
 *   if (!isClient) return <LoadingSpinner />;
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  return isClient;
}
