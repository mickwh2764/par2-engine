import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { getGeneAnnotation, getCategoryColor, getHierarchyInfo } from "@/lib/gene-annotations";

interface GeneTooltipProps {
  gene: string;
  children?: React.ReactNode;
  className?: string;
}

export default function GeneTooltip({ gene, children, className }: GeneTooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: "top" as "top" | "bottom" });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const annotation = getGeneAnnotation(gene);

  const handleEnter = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const placement = rect.top < 240 ? "bottom" : "top";
      setCoords({
        top: placement === "top" ? rect.top + window.scrollY : rect.bottom + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
        placement,
      });
    }
    setShow(true);
  }, []);

  if (!annotation) {
    return <span className={className}>{children || gene}</span>;
  }

  const catColor = getCategoryColor(annotation.category);
  const hierarchyInfo = getHierarchyInfo(annotation.hierarchy);

  const tooltipStyle: React.CSSProperties = {
    position: "absolute",
    zIndex: 99999,
    width: 320,
    pointerEvents: "none",
    left: coords.left,
    ...(coords.placement === "top"
      ? { top: coords.top - 8, transform: "translate(-50%, -100%)" }
      : { top: coords.top + 8, transform: "translateX(-50%)" }),
  };

  return (
    <span
      ref={triggerRef}
      className={`inline-flex cursor-help ${className || ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      data-testid={`gene-tooltip-${gene}`}
    >
      <span className="border-b border-dotted border-slate-500 hover:border-slate-300 transition-colors">
        {children || gene}
      </span>
      {show && createPortal(
        <div style={tooltipStyle}>
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-left relative">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-bold text-slate-900 text-sm">{annotation.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${catColor}20`, color: catColor, border: `1px solid ${catColor}40` }}
              >
                {annotation.category}
              </span>
            </div>
            {annotation.fullName !== annotation.name && (
              <div className="text-[11px] text-blue-600 mb-1.5 leading-tight font-medium">
                {annotation.fullName}
              </div>
            )}
            <div className="text-[11px] text-slate-600 leading-relaxed mb-1.5">
              {annotation.function}
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Role:</span>
                <span className="text-[11px] font-medium" style={{ color: catColor }}>
                  {annotation.role}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-200">
              <span className="text-[10px]" style={{ color: hierarchyInfo.color }}>{hierarchyInfo.icon}</span>
              <span className="text-[10px] font-semibold" style={{ color: hierarchyInfo.color }}>
                {annotation.hierarchy}
              </span>
              <span className="text-[9px] text-slate-400 leading-tight flex-1">
                {hierarchyInfo.description}
              </span>
            </div>
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-white border-slate-200 ${
                coords.placement === "top" ? "bottom-[-5px] border-r border-b" : "top-[-5px] border-l border-t"
              }`}
            />
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
