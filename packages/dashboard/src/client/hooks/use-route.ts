import { useEffect, useState } from "react";

export function useRoute(): { pathname: string; search: string } {
  const [route, setRoute] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
  }));

  useEffect(() => {
    const updateRoute = () =>
      setRoute({
        pathname: window.location.pathname,
        search: window.location.search,
      });

    window.addEventListener("popstate", updateRoute);
    window.addEventListener("supplywatch:navigate", updateRoute);

    return () => {
      window.removeEventListener("popstate", updateRoute);
      window.removeEventListener("supplywatch:navigate", updateRoute);
    };
  }, []);

  return route;
}
