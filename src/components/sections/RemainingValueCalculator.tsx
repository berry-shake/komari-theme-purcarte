import { useState, type SelectHTMLAttributes } from "react";
import { Dialog } from "@radix-ui/themes";
import { Calculator, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppConfig, useLocale } from "@/config/hooks";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { FX_TTL } from "@/services/exchangeRates";
import { formatCny } from "@/utils/valuation";
import { calculateRemainingValue, localDateTimeValue } from "@/utils/remainingValueCalculator";

const currencies = [
  ["CNY", "人民币"], ["USD", "美元"], ["EUR", "欧元"], ["GBP", "英镑"],
  ["HKD", "港币"], ["TWD", "新台币"], ["SGD", "新加坡元"], ["JPY", "日元"],
  ["AUD", "澳元"], ["CAD", "加元"], ["KRW", "韩元"], ["RUB", "卢布"],
  ["CHF", "瑞士法郎"], ["INR", "印度卢比"], ["VND", "越南盾"], ["THB", "泰铢"],
];
const fieldClass = "h-10 min-w-0 w-full rounded-md border border-border bg-(--color-panel-solid) px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

function CalculatorSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="relative block">
    <select {...props} className={`${fieldClass} cursor-pointer appearance-none pr-10`} />
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-secondary-foreground" />
  </span>;
}

function initialFields() {
  const now = new Date();
  return { price: "", currency: "CNY", cycle: "30", customDays: "30", asOf: localDateTimeValue(now), expiresAt: localDateTimeValue(new Date(now.getTime() + 30 * 86_400_000)) };
}

function CalculatorForm() {
  const { t } = useLocale();
  const { enableLocalStorage } = useAppConfig();
  const [fields, setFields] = useState(initialFields);
  const update = (name: keyof typeof fields, value: string) => setFields(previous => ({ ...previous, [name]: value }));
  const cycleDays = Number(fields.cycle === "custom" ? fields.customDays : fields.cycle);
  const price = fields.price.trim() ? Number(fields.price) : NaN;
  const result = calculateRemainingValue(price, cycleDays, Date.parse(fields.expiresAt), Date.parse(fields.asOf));
  const foreign = fields.currency !== "CNY";
  const fx = useExchangeRates(Boolean(foreign && result && result.amount > 0), enableLocalStorage);
  const rate = foreign ? fx.cache?.rates[fields.currency] : undefined;
  const converted = result ? (!foreign || result.amount === 0 ? result.amount : rate ? result.amount * rate.rate : null) : null;
  const cny = converted !== null && Number.isFinite(converted) ? converted : null;
  const original = result && new Intl.NumberFormat("zh-CN", { style: "currency", currency: fields.currency, currencyDisplay: "code", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(result.amount);

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      <label className="min-w-0 space-y-1.5 text-sm">
        <span>{t("calculator.price")}</span>
        <Input className={fieldClass} type="number" inputMode="decimal" min="0" step="any" placeholder="0.00" value={fields.price} onChange={event => update("price", event.target.value)} />
      </label>
      <label className="min-w-0 space-y-1.5 text-sm">
        <span>{t("calculator.currency")}</span>
        <CalculatorSelect aria-label={t("calculator.currency")} value={fields.currency} onChange={event => update("currency", event.target.value)}>
          {currencies.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
        </CalculatorSelect>
      </label>
    </div>
    <div className={`grid gap-3 ${fields.cycle === "custom" ? "grid-cols-2" : "grid-cols-1"}`}>
      <label className="min-w-0 space-y-1.5 text-sm">
        <span>{t("calculator.cycle")}</span>
        <CalculatorSelect aria-label={t("calculator.cycle")} value={fields.cycle} onChange={event => update("cycle", event.target.value)}>
          <option value="7">{t("calculator.week")}</option>
          <option value="30">{t("calculator.month")}</option>
          <option value="90">{t("calculator.quarter")}</option>
          <option value="180">{t("calculator.halfYear")}</option>
          <option value="365">{t("calculator.year")}</option>
          <option value="730">{t("calculator.twoYears")}</option>
          <option value="1095">{t("calculator.threeYears")}</option>
          <option value="custom">{t("calculator.custom")}</option>
        </CalculatorSelect>
      </label>
      {fields.cycle === "custom" && <label className="min-w-0 space-y-1.5 text-sm">
        <span>{t("calculator.cycleDays")}</span>
        <Input className={fieldClass} type="number" inputMode="decimal" min="0.000001" step="any" value={fields.customDays} onChange={event => update("customDays", event.target.value)} />
      </label>}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="min-w-0 space-y-1.5 text-sm">
        <span>{t("calculator.asOf")}</span>
        <Input className={`${fieldClass} calculator-datetime pr-10`} type="datetime-local" value={fields.asOf} onChange={event => update("asOf", event.target.value)} />
      </label>
      <label className="min-w-0 space-y-1.5 text-sm">
        <span>{t("calculator.expiresAt")}</span>
        <Input className={`${fieldClass} calculator-datetime pr-10`} type="datetime-local" value={fields.expiresAt} onChange={event => update("expiresAt", event.target.value)} />
      </label>
    </div>
    <div className="flex items-center justify-between gap-2 text-xs text-secondary-foreground">
      <span>{t("calculator.localTime")}</span>
      <Button size="sm" variant="ghost" onClick={() => update("asOf", localDateTimeValue(new Date()))}>{t("calculator.useNow")}</Button>
    </div>
    <div role="status" aria-live="polite" aria-atomic="true" className="rounded-xl border border-(--accent-a5) bg-(--accent-a3) p-4 space-y-2">
      <p className="text-sm text-secondary-foreground">{t("portfolio.nodeValue")}</p>
      {result ? <>
        <p className="text-2xl font-semibold tabular-nums break-all">{foreign ? original : formatCny(result.amount)}</p>
        {foreign && <p className="text-sm tabular-nums">{cny !== null ? t("calculator.converted", { amount: formatCny(cny) }) : t(fx.loading || !fx.failed && !fx.cache ? "portfolio.loadingRates" : "calculator.noRate")}</p>}
        <p className="text-xs text-secondary-foreground">{t("calculator.remainingDays", { days: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 4 }).format(result.remainingDays) })}</p>
        {foreign && rate && result.amount > 0 && <p className="text-xs text-secondary-foreground">{t("portfolio.rateDate", { date: rate.date })} · Frankfurter{fx.cache && (fx.failed || Date.now() - fx.cache.fetchedAt >= FX_TTL) ? ` · ${t("portfolio.cachedRates")}` : ""}</p>}
      </> : <p className="text-sm text-secondary-foreground">{t(fields.price === "" ? "calculator.empty" : "calculator.invalid")}</p>}
    </div>
    <p className="text-xs leading-relaxed text-secondary-foreground">{t("calculator.formula")}</p>
    <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => setFields(initialFields())}>{t("calculator.reset")}</Button></div>
  </div>;
}

export default function RemainingValueCalculator() {
  const { t } = useLocale();
  return <Dialog.Root>
    <Dialog.Trigger>
      <Button variant="ghost" size="icon" aria-label={t("calculator.title")} title={t("calculator.title")}><Calculator className="size-5 text-primary" /></Button>
    </Dialog.Trigger>
    <Dialog.Content size="3" maxWidth="540px" className="remaining-value-calculator" style={{ maxHeight: "calc(100dvh - 2rem)", overflowY: "auto" }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <Dialog.Title mb="0">{t("calculator.title")}</Dialog.Title>
        <Dialog.Close><Button variant="ghost" size="icon" aria-label={t("calculator.close")}><X className="size-4" /></Button></Dialog.Close>
      </div>
      <Dialog.Description size="2" mb="4" className="text-secondary-foreground">{t("calculator.description")}</Dialog.Description>
      <CalculatorForm />
    </Dialog.Content>
  </Dialog.Root>;
}
