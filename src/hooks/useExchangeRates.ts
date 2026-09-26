import { useEffect, useState } from "react";
import { createExchangeRateClient, FX_CACHE_KEY } from "../services/exchangeRates";

const client = createExchangeRateClient({ storage: () => window.localStorage });

export function useExchangeRates(enabled: boolean, persist: boolean) {
  const [state, setState] = useState(() => ({
    cache: client.read(persist), loading: false, failed: false,
  }));
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const update = async () => {
      if (document.visibilityState === "hidden") return;
      const cache = client.read(persist);
      setState(previous => ({ ...previous, cache, loading: !cache }));
      const result = await client.refresh(persist);
      if (active) setState({ ...result, loading: false });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === FX_CACHE_KEY) void update();
    };
    void update();
    const timer = window.setInterval(() => void update(), 60_000);
    window.addEventListener("online", update);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("online", update);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled, persist]);
  return state;
}
