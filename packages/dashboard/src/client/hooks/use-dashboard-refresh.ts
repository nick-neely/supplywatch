import { useCallback, useEffect, useRef, useState } from "react";

type MountedCheck = () => boolean;
type DashboardRefresh = (isMounted: MountedCheck) => Promise<void>;

export function useDashboardRefresh(
  refresh: DashboardRefresh,
  refreshIntervalMs: number,
): { isRefreshing: boolean; refreshNow: () => void } {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshNow = useCallback(() => {
    setIsRefreshing(true);

    void refresh(() => isMountedRef.current).finally(() => {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    });
  }, [refresh]);

  useEffect(() => {
    refreshNow();

    if (refreshIntervalMs <= 0) {
      return;
    }

    const interval = window.setInterval(refreshNow, refreshIntervalMs);

    return () => window.clearInterval(interval);
  }, [refreshIntervalMs, refreshNow]);

  return { isRefreshing, refreshNow };
}
