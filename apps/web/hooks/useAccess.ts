"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const RETRY_MS = 10_000;

/**
 * A feature's access check (plan, limits), kept fresh. `data` stays null until a request
 * succeeds, and a failed request never reads as "not allowed": the API gates every action
 * itself, so a network blip or an API restart must not lock the page until a reload. It
 * retries while it has no answer, and re-reads when the tab regains focus or the
 * connection comes back, so an upgrade made elsewhere shows up too.
 * `settled` is true once the first request has finished, either way.
 */
export function useAccess<T>(path: string): { data: T | null; settled: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const load = () => {
      clearTimeout(retry);
      api
        .get<T>(path, { requireAuth: true })
        .then((res) => alive && setData(res))
        // ponytail: fixed 10s retry while the API is unreachable; back off if that ever matters.
        .catch(() => { if (alive) retry = setTimeout(load, RETRY_MS); })
        .finally(() => alive && setSettled(true));
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("online", load);
    return () => {
      alive = false;
      clearTimeout(retry);
      window.removeEventListener("focus", load);
      window.removeEventListener("online", load);
    };
  }, [path]);

  return { data, settled };
}
