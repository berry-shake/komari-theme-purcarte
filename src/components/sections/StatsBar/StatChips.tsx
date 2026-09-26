import { memo, useEffect, useState } from "react";
import { cn } from "@/utils";
import { useLocale } from "@/config/hooks";

export const StatChip = memo(
  ({
    label,
    lines,
    isLabelVertical,
    isInHeader,
    isMobile,
    textLeft,
    onClick,
    expanded,
    title,
  }: {
    label: string;
    lines: string[];
    isLabelVertical?: boolean;
    isInHeader?: boolean;
    isMobile: boolean;
    textLeft?: boolean;
    onClick?: () => void;
    expanded?: boolean;
    title?: string;
  }) => {
    const Wrapper = onClick ? "button" : "div";
    if (isMobile || isInHeader) {
      return (
        <Wrapper
          title={title}
          onClick={onClick}
          aria-expanded={expanded}
          type={onClick ? "button" : undefined}
          className={cn(
            "flex shrink-0 bg-transition px-1.5 py-0.5 text-center items-center",
            onClick && "cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-ring",
            isLabelVertical ? "" : "flex-col"
          )}>
          <div
            className={cn(
              "text-xs font-semibold",
              isMobile ? "" : "tracking-widest"
            )}
            style={
              !isMobile && isLabelVertical ? { writingMode: "vertical-rl" } : {}
            }>
            {label}
          </div>
          <div
            className={`text-xs font-semibold leading-tight ${
              textLeft ? "text-left" : ""
            }`}>
            {lines.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </Wrapper>
      );
    }

    return (
      <Wrapper title={title} onClick={onClick} aria-expanded={expanded} type={onClick ? "button" : undefined} className={cn("w-full py-1", onClick && "cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-ring")}>
        <div className="flex flex-col gap-2 items-center">
          <span>{label}</span>
          <div className={`font-medium -mt-2 ${textLeft ? "text-left" : ""}`}>
            {lines.map((line, index) => (
              <div key={index}>{line}</div>
            ))}
          </div>
        </div>
      </Wrapper>
    );
  }
);

export const CurrentTimeChip = memo(
  ({ isInHeader, isMobile }: { isInHeader?: boolean; isMobile: boolean }) => {
    const [time, setTime] = useState(() => new Date());
    const { t } = useLocale();

    useEffect(() => {
      const timer = setInterval(() => setTime(new Date()), 1000);
      return () => clearInterval(timer);
    }, []);

    return (
      <StatChip
        key="currentTime"
        label={t("statsBar.currentTime")}
        lines={[time.toLocaleTimeString()]}
        isInHeader={isInHeader}
        isMobile={isMobile}
      />
    );
  }
);
