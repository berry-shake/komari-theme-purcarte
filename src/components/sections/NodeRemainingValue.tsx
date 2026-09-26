import { Popover } from "@radix-ui/themes";
import { useRemainingValues } from "@/contexts/RemainingValueContext";
import { useLocale } from "@/config/hooks";
import { formatCny } from "@/utils/valuation";
import { FX_TTL } from "@/services/exchangeRates";
import type { NodeData } from "@/types/node";

export default function NodeRemainingValue({ node }: { node: NodeData }) {
  const { t } = useLocale();
  const { enabled, values, cache, failed, now } = useRemainingValues();
  const value = values.get(node.uuid);
  if (!enabled || !value || value.cny === null || value.cny < 0.005) return null;
  const amount = formatCny(value.cny);
  const rate = value.currency && value.currency !== "CNY" && value.original !== 0 ? cache?.rates[value.currency] : null;
  return <Popover.Root>
    <Popover.Trigger>
      <button type="button" data-node-value={node.uuid}
        aria-label={`${node.name} · ${t("portfolio.nodeValue")} ${amount}`}
        title={`${t("portfolio.nodeValue")} ${amount}`}
        onClick={event => event.stopPropagation()}
        className="ml-auto inline-flex shrink-0 self-start rounded py-0.5 text-xs leading-4 focus-visible:outline-2 focus-visible:outline-ring hover:text-(--accent-11)">
        <span className="font-medium tabular-nums">{amount}</span>
      </button>
    </Popover.Trigger>
    <Popover.Content size="1" side="bottom" align="start" className="purcarte-blur z-50"
      style={{ maxWidth: "min(20rem, calc(100vw - 2rem))" }} onClick={event => event.stopPropagation()}>
      <div className="space-y-2 text-xs whitespace-normal">
        <p className="font-medium">{t("portfolio.valueTitle")} · {amount}</p>
        {value.cny !== null && value.original !== null && value.original > 0 && <>
          <p>{node.currency} {node.price} / {t("portfolio.days", { count: node.billing_cycle })} · {t("portfolio.remainingTime")} {t("portfolio.days", { count: Math.ceil(value.remainingDays!) })}</p>
          {rate && <p>{value.currency} {value.original.toFixed(2)} · {t("portfolio.rateDate", { date: rate.date })} · Frankfurter</p>}
          {rate && cache && (failed || now - cache.fetchedAt >= FX_TTL) && <p>{t("portfolio.cachedRates")}</p>}
          <p className="text-secondary-foreground">{t("portfolio.formula")}</p>
        </>}
      </div>
    </Popover.Content>
  </Popover.Root>;
}
