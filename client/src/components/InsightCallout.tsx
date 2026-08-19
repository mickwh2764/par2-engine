import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";

interface InsightCalloutProps {
  title?: string;
  children: React.ReactNode;
  variant?: "info" | "finding" | "warning";
}

const variantConfig = {
  info: {
    border: "border-l-cyan-500",
    bg: "bg-cyan-50",
    icon: Lightbulb,
    iconColor: "text-cyan-600",
    titleColor: "text-cyan-900",
    bodyColor: "text-slate-700",
  },
  finding: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-50",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    titleColor: "text-emerald-900",
    bodyColor: "text-slate-700",
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    titleColor: "text-amber-900",
    bodyColor: "text-slate-700",
  },
};

export default function InsightCallout({
  title = "What This Means",
  children,
  variant = "info",
}: InsightCalloutProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div
      className={`${config.bg} border border-l-4 ${config.border} rounded-lg p-4 space-y-2`}
      data-testid="insight-callout"
    >
      <div className="flex items-center gap-2">
        <Icon size={16} className={config.iconColor} />
        <span className={`text-sm font-semibold ${config.titleColor}`}>{title}</span>
      </div>
      <div className={`text-sm ${config.bodyColor} leading-relaxed`}>{children}</div>
    </div>
  );
}
