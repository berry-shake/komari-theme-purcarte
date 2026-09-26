import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNodeData } from "./NodeDataContext";
import { useAppConfig } from "@/config/hooks";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { estimateRemainingValue, type Valuation } from "@/utils/valuation";

type ValueContext = ReturnType<typeof useExchangeRates> & {
  enabled: boolean;
  now: number;
  values: Map<string, Valuation>;
};
const RemainingValueContext = createContext<ValueContext | null>(null);

export function RemainingValueProvider({ children }: { children: ReactNode }) {
  const { nodes } = useNodeData();
  const { enableRemainingValue: enabled, enableLocalStorage } = useAppConfig();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => { if (document.visibilityState !== "hidden") setNow(Date.now()); };
    tick();
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [enabled]);
  const needsRates = useMemo(() => enabled && nodes.some(node =>
    estimateRemainingValue(node, {}, now).reason === "rateMissing"
  ), [enabled, nodes, now]);
  const fx = useExchangeRates(needsRates, enableLocalStorage);
  const values = useMemo(() => new Map(enabled ? nodes.map(node =>
    [node.uuid, estimateRemainingValue(node, fx.cache?.rates ?? {}, now)]
  ) : []), [enabled, nodes, fx.cache, now]);
  const value = useMemo(() => ({ ...fx, enabled, now, values }), [fx, enabled, now, values]);
  return <RemainingValueContext.Provider value={value}>{children}</RemainingValueContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRemainingValues() {
  const context = useContext(RemainingValueContext);
  if (!context) throw new Error("useRemainingValues must be used within RemainingValueProvider");
  return context;
}
