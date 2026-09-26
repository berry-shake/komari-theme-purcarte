import { lazy, Suspense, useMemo } from "react";
import { ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/config/hooks";
import { normalizeRegion, regionName, summarizeRegions } from "@/utils/regions";
import type { NodeData } from "@/types/node";

const WorldMap = lazy(() => import("./WorldMap"));
type PortfolioNode = NodeData & { stats?: { online?: boolean } };
interface Props {
  scopedNodes: PortfolioNode[];
  mapOpen: boolean;
  setMapOpen: (open: boolean) => void;
  selectedRegion: string | null;
  setSelectedRegion: (code: string | null) => void;
}

export default function PortfolioOverview({ scopedNodes, mapOpen, setMapOpen, selectedRegion, setSelectedRegion }: Props) {
  const { t } = useLocale();
  const regions = useMemo(() => summarizeRegions(scopedNodes), [scopedNodes]);
  const unknownRegions = scopedNodes.filter(n => !normalizeRegion(n.region || "")).length;
  const selectRegion = (code: string) => setSelectedRegion(selectedRegion === code ? null : code);
  if (!mapOpen && !selectedRegion) return null;

  return <section id="portfolio-overview" className="my-4 space-y-3" aria-label={t("portfolio.mapTitle")}>
    {mapOpen && <Card id="world-map-panel" className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div>
          <h2 className="font-semibold">{t("portfolio.mapTitle")}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--accent-9)" }} />{t("portfolio.onlineRegion")}</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: "var(--accent-6)" }} />{t("portfolio.offlineRegion")}</span>
          {unknownRegions > 0 && <span>{t("portfolio.unknownRegions", { count: unknownRegions })}</span>}
          <Button size="sm" variant="ghost" onClick={() => setMapOpen(false)}>
            <ChevronUp className="size-4" aria-hidden="true" />{t("portfolio.collapseMap")}
          </Button>
        </div>
      </div>
      <Suspense fallback={<div className="py-16 text-center text-secondary-foreground">{t("portfolio.loadingMap")}</div>}>
        <WorldMap nodes={scopedNodes} regions={regions} selectedRegion={selectedRegion} onSelectRegion={selectRegion} />
      </Suspense>
    </Card>}

    {selectedRegion && <div className="flex gap-2 items-center text-sm">
      <span>{t("portfolio.regionSelected", { name: regionName(selectedRegion) })}</span>
      <Button size="sm" variant="ghost" onClick={() => setSelectedRegion(null)}>{t("portfolio.clearRegion")}</Button>
    </div>}

  </section>;
}
