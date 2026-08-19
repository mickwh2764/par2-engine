import { Target } from "lucide-react";
import type { EigenvaluePoint } from "./types";

export function UnitCircleDiagram({ 
  eigenvalues, 
  width = 280, 
  height = 280,
  title = "Unit Circle (Eigenvalue Stability)"
}: { 
  eigenvalues: EigenvaluePoint[];
  width?: number;
  height?: number;
  title?: string;
}) {
  const padding = 40;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = (Math.min(width, height) - padding * 2) / 2;
  
  const scale = radius / 1.5;
  
  const toScreenX = (x: number) => centerX + x * scale;
  const toScreenY = (y: number) => centerY - y * scale;
  
  return (
    <div className="bg-slate-50 rounded-lg p-3" data-testid="diagram-unit-circle">
      <div className="text-xs font-medium text-cyan-400 mb-2 flex items-center gap-2">
        <Target size={14} />
        {title}
      </div>
      <svg width={width} height={height} className="mx-auto">
        <line x1={padding} y1={centerY} x2={width-padding} y2={centerY} stroke="#334155" strokeWidth="1" />
        <line x1={centerX} y1={padding} x2={centerX} y2={height-padding} stroke="#334155" strokeWidth="1" />
        
        <circle 
          cx={centerX} 
          cy={centerY} 
          r={radius / 1.5} 
          fill="none" 
          stroke="#22c55e" 
          strokeWidth="2" 
          strokeDasharray="5,3"
          opacity="0.8"
        />
        
        <circle 
          cx={centerX} 
          cy={centerY} 
          r={(0.518 * radius) / 1.5} 
          fill="none" 
          stroke="#f0b90b" 
          strokeWidth="1" 
          opacity="0.5"
        />
        <circle 
          cx={centerX} 
          cy={centerY} 
          r={(0.718 * radius) / 1.5} 
          fill="none" 
          stroke="#f0b90b" 
          strokeWidth="1" 
          opacity="0.5"
        />
        <path
          d={`
            M ${centerX + (0.518 * radius) / 1.5} ${centerY}
            A ${(0.518 * radius) / 1.5} ${(0.518 * radius) / 1.5} 0 1 1 ${centerX - (0.518 * radius) / 1.5} ${centerY}
            A ${(0.518 * radius) / 1.5} ${(0.518 * radius) / 1.5} 0 1 1 ${centerX + (0.518 * radius) / 1.5} ${centerY}
            M ${centerX + (0.718 * radius) / 1.5} ${centerY}
            A ${(0.718 * radius) / 1.5} ${(0.718 * radius) / 1.5} 0 1 0 ${centerX - (0.718 * radius) / 1.5} ${centerY}
            A ${(0.718 * radius) / 1.5} ${(0.718 * radius) / 1.5} 0 1 0 ${centerX + (0.718 * radius) / 1.5} ${centerY}
          `}
          fill="#f0b90b"
          opacity="0.1"
          fillRule="evenodd"
        />
        
        <circle 
          cx={centerX} 
          cy={centerY} 
          r={(0.618 * radius) / 1.5} 
          fill="none" 
          stroke="#a855f7" 
          strokeWidth="1.5" 
          strokeDasharray="3,2"
          opacity="0.7"
        />
        
        <text x={width - padding + 5} y={centerY + 4} className="text-[10px] fill-slate-400">Re</text>
        <text x={centerX + 4} y={padding - 5} className="text-[10px] fill-slate-400">Im</text>
        
        <text x={toScreenX(1) + 3} y={centerY + 12} className="text-[9px] fill-slate-500">1</text>
        <text x={toScreenX(-1) - 8} y={centerY + 12} className="text-[9px] fill-slate-500">-1</text>
        <text x={centerX + 4} y={toScreenY(1) + 3} className="text-[9px] fill-slate-500">i</text>
        <text x={centerX + 4} y={toScreenY(-1) + 3} className="text-[9px] fill-slate-500">-i</text>
        
        {eigenvalues.map((ev, i) => (
          <g key={i}>
            <circle
              cx={toScreenX(ev.real)}
              cy={toScreenY(ev.imag)}
              r={8}
              fill={ev.isStable ? (ev.inBand ? "#f0b90b" : "#22c55e") : "#ef4444"}
              stroke="#1e293b"
              strokeWidth="2"
              opacity="0.85"
            />
            {ev.label && (
              <text
                x={toScreenX(ev.real) + 12}
                y={toScreenY(ev.imag) + 4}
                className="text-[10px] fill-slate-200 font-medium"
              >
                {ev.label}
              </text>
            )}
          </g>
        ))}
        
        <g transform={`translate(${padding - 5}, ${height - 55})`}>
          <circle cx={5} cy={5} r={4} fill="#22c55e" />
          <text x={12} y={8} className="text-[8px] fill-slate-400">Stable (|λ|&lt;1)</text>
          <circle cx={5} cy={18} r={4} fill="#f0b90b" />
          <text x={12} y={21} className="text-[8px] fill-slate-400">In Band [0.518-0.718]</text>
          <circle cx={5} cy={31} r={4} fill="#ef4444" />
          <text x={12} y={34} className="text-[8px] fill-slate-400">Explosive (|λ|≥1)</text>
        </g>
      </svg>
    </div>
  );
}
