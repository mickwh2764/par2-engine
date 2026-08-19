import { Activity } from "lucide-react";
import type { CoefficientPoint } from "./types";

export function StabilityTriangleDiagram({ 
  coefficients, 
  width = 280, 
  height = 280,
  title = "AR(2) Stability Triangle"
}: { 
  coefficients: CoefficientPoint[];
  width?: number;
  height?: number;
  title?: string;
}) {
  const padding = 45;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  
  const scaleX = plotWidth / 5;
  const scaleY = plotHeight / 3;
  
  const toScreenX = (x: number) => padding + (x + 2.5) * scaleX;
  const toScreenY = (y: number) => padding + (1.5 - y) * scaleY;
  
  const trianglePoints = [
    { x: toScreenX(-2), y: toScreenY(-1) },
    { x: toScreenX(2), y: toScreenY(-1) },
    { x: toScreenX(0), y: toScreenY(1) },
  ];
  
  return (
    <div className="bg-slate-50 rounded-lg p-3" data-testid="diagram-stability-triangle">
      <div className="text-xs font-medium text-purple-400 mb-2 flex items-center gap-2">
        <Activity size={14} />
        {title}
      </div>
      <svg width={width} height={height} className="mx-auto">
        {[-2, -1, 0, 1, 2].map(x => (
          <line key={`vgrid-${x}`} x1={toScreenX(x)} y1={padding} x2={toScreenX(x)} y2={height-padding} stroke="#334155" strokeWidth="0.5" />
        ))}
        {[-1, 0, 1].map(y => (
          <line key={`hgrid-${y}`} x1={padding} y1={toScreenY(y)} x2={width-padding} y2={toScreenY(y)} stroke="#334155" strokeWidth="0.5" />
        ))}
        
        <line x1={padding} y1={toScreenY(0)} x2={width-padding} y2={toScreenY(0)} stroke="#94a3b8" strokeWidth="1" />
        <line x1={toScreenX(0)} y1={padding} x2={toScreenX(0)} y2={height-padding} stroke="#94a3b8" strokeWidth="1" />
        
        <polygon
          points={`${trianglePoints[0].x},${trianglePoints[0].y} ${trianglePoints[1].x},${trianglePoints[1].y} ${trianglePoints[2].x},${trianglePoints[2].y}`}
          fill="#22c55e"
          opacity="0.15"
          stroke="#22c55e"
          strokeWidth="2"
        />
        
        <text x={toScreenX(-1) - 40} y={toScreenY(0)} className="text-[8px] fill-slate-400" transform={`rotate(-45, ${toScreenX(-1) - 40}, ${toScreenY(0)})`}>β₂ = 1 + β₁</text>
        <text x={toScreenX(1) + 5} y={toScreenY(0)} className="text-[8px] fill-slate-400" transform={`rotate(45, ${toScreenX(1) + 5}, ${toScreenY(0)})`}>β₂ = 1 - β₁</text>
        <text x={toScreenX(0)} y={toScreenY(-1) + 15} className="text-[8px] fill-slate-400" textAnchor="middle">β₂ = -1</text>
        
        <text x={width - padding + 5} y={toScreenY(0) + 4} className="text-[10px] fill-slate-400">β₁</text>
        <text x={toScreenX(0) + 5} y={padding - 5} className="text-[10px] fill-slate-400">β₂</text>
        
        <text x={toScreenX(2)} y={toScreenY(0) + 15} className="text-[9px] fill-slate-500" textAnchor="middle">2</text>
        <text x={toScreenX(-2)} y={toScreenY(0) + 15} className="text-[9px] fill-slate-500" textAnchor="middle">-2</text>
        <text x={toScreenX(0) - 12} y={toScreenY(1) + 4} className="text-[9px] fill-slate-500">1</text>
        <text x={toScreenX(0) - 15} y={toScreenY(-1) + 4} className="text-[9px] fill-slate-500">-1</text>
        
        {coefficients.map((coef, i) => (
          <g key={i}>
            <circle
              cx={toScreenX(coef.beta1)}
              cy={toScreenY(coef.beta2)}
              r={8}
              fill={coef.isStable ? (coef.inBand ? "#f0b90b" : "#22c55e") : "#ef4444"}
              stroke="#1e293b"
              strokeWidth="2"
              opacity="0.85"
            />
            {coef.label && (
              <text
                x={toScreenX(coef.beta1) + 12}
                y={toScreenY(coef.beta2) + 4}
                className="text-[10px] fill-slate-200 font-medium"
              >
                {coef.label}
              </text>
            )}
          </g>
        ))}
        
        <g transform={`translate(${padding - 5}, ${height - 40})`}>
          <rect x={0} y={0} width={8} height={8} fill="#22c55e" opacity="0.3" stroke="#22c55e" />
          <text x={12} y={7} className="text-[8px] fill-slate-400">Stable Region</text>
          <circle cx={4} cy={18} r={4} fill="#f0b90b" />
          <text x={12} y={21} className="text-[8px] fill-slate-400">In Stability Band</text>
        </g>
      </svg>
    </div>
  );
}
