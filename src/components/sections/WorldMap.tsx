import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import world from "@/assets/world-map.json";
import { normalizeRegion, regionName, type RegionSummary } from "@/utils/regions";
import { useLocale } from "@/config/hooks";
import { useIsMobile } from "@/hooks/useMobile";
import type { NodeData } from "@/types/node";

interface WorldMapProps {
  regions: RegionSummary[];
  nodes: (NodeData & { stats?: { online?: boolean } })[];
  selectedRegion: string | null;
  onSelectRegion: (code: string) => void;
}

export default function WorldMap({ regions, nodes, selectedRegion, onSelectRegion }: WorldMapProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState<string | null>(null);
  const byCode = useMemo(() => new Map(regions.map(r => [r.code, r])), [regions]);
  const active = byCode.get((isMobile ? selectedRegion : hovered) || "");
  const geometry = active && world.regions.find(region => region.code === active.code);
  const activeNodes = useMemo(() => active ? nodes.filter(node => normalizeRegion(node.region || "") === active.code)
    .sort((a, b) => Number(Boolean(b.stats?.online)) - Number(Boolean(a.stats?.online))) : [], [nodes, active]);
  const label = (r: RegionSummary) => t("portfolio.regionDetail", { name: regionName(r.code), total: r.total, online: r.online });
  const color = (code: string) => {
    const region = byCode.get(code);
    if (!region) return "var(--gray-a3)";
    if (selectedRegion === code || hovered === code) return "var(--accent-11)";
    return region.online > 0 ? "var(--accent-9)" : "var(--accent-6)";
  };
  return (
    <div>
      <div className="relative mx-auto w-full" style={{ maxWidth: `min(100%, ${world.width / world.height * 50}vh, ${world.width / world.height * 440}px)` }}
        onMouseLeave={() => setHovered(null)} onKeyDown={event => { if (event.key === "Escape") setHovered(null); }}>
      <svg viewBox={`0 0 ${world.width} ${world.height}`} className="block w-full" role="group" aria-label={t("portfolio.mapTitle")}>
        <title>{t("portfolio.mapTitle")}</title>
        {world.regions.map(region => {
          const count = byCode.get(region.code);
          return <path
            key={region.code} d={region.path} fill={color(region.code)}
            stroke={count ? "var(--accent-a5)" : "var(--gray-a4)"} strokeWidth="0.5" strokeLinejoin="round"
            className={count ? "cursor-pointer outline-none focus-visible:stroke-(--accent-11) focus-visible:stroke-1" : undefined}
            role={count ? "button" : undefined} tabIndex={count ? 0 : undefined}
            aria-label={count ? label(count) : undefined} aria-pressed={count ? selectedRegion === region.code : undefined}
            onMouseEnter={() => setHovered(count ? region.code : null)}
            onFocus={() => setHovered(region.code)} onBlur={() => setHovered(null)}
            onClick={() => count && onSelectRegion(region.code)}
            onKeyDown={event => {
              if (count && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelectRegion(region.code); }
            }}>
            {!count && <title>{region.name}</title>}
          </path>;
        })}
        {world.regions.filter(r => r.small && byCode.has(r.code)).map(region => {
          return <circle key={region.code} cx={region.marker[0]} cy={region.marker[1]} r="5"
            fill={color(region.code)} stroke="var(--background)" strokeWidth="1.5"
            className="cursor-pointer" aria-hidden="true"
            onMouseEnter={() => setHovered(region.code)}
            onClick={() => onSelectRegion(region.code)} />;
        })}
      </svg>
      {active && geometry && <div role="region" aria-label={t("portfolio.regionServers", { name: regionName(active.code) })}
        className={`${isMobile ? "mt-2" : "absolute z-10 w-64 max-w-[calc(100%-1rem)]"} rounded-lg border border-border bg-(--color-panel-solid) p-3 shadow-lg text-sm`}
        style={isMobile ? undefined : { left: `clamp(8px, ${geometry.marker[0] / world.width * 100}%, calc(100% - 17rem))`, top: `clamp(8px, ${geometry.marker[1] / world.height * 100}%, calc(100% - 14rem))` }}>
        <div className="font-semibold">{regionName(active.code)}</div>
        <p className="text-xs text-secondary-foreground mt-1 mb-2">{t("portfolio.serverCount", { count: active.total })} · {t("portfolio.onlineCount", { count: active.online })}</p>
        <div className="max-h-40 overflow-y-auto border-t border-border pt-1 space-y-0.5">
          {activeNodes.map(node => <Link key={node.uuid} to={`/instance/${encodeURIComponent(node.uuid)}`} className="flex items-center gap-2 rounded py-1 text-xs hover:text-(--accent-11) focus-visible:outline-2 focus-visible:outline-ring">
            <span className="size-1.5 rounded-full shrink-0" style={{ background: node.stats?.online ? "var(--green-9)" : "var(--gray-8)" }} aria-label={t(node.stats?.online ? "node.online" : "node.offline")} />
            <span className="truncate">{node.name}</span>
          </Link>)}
        </div>
      </div>}
      </div>
    </div>
  );
}
