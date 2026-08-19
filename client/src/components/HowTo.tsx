import { useState, useId } from "react";
import { HelpCircle, ChevronDown, ChevronUp } from "lucide-react";

interface HowToStep {
  label: string;
  detail: string;
}

interface HowToProps {
  title: string;
  summary: string;
  steps?: HowToStep[];
  defaultOpen?: boolean;
}

export default function HowTo({ title, summary, steps, defaultOpen = false }: HowToProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="mb-4" data-testid="howto-section">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
        data-testid="button-howto-toggle"
      >
        <HelpCircle size={15} className="text-blue-400 group-hover:text-blue-300 shrink-0" />
        <span className="font-medium">How to use this page</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div
          id={contentId}
          role="region"
          aria-label={title}
          className="mt-2 p-4 rounded-lg border border-blue-500/20 bg-blue-500/5 text-sm space-y-3"
          data-testid="howto-content"
        >
          <p className="font-semibold text-foreground/90">{title}</p>
          <p className="text-muted-foreground leading-relaxed">{summary}</p>
          {steps && steps.length > 0 && (
            <ol className="space-y-1.5 text-muted-foreground list-decimal list-inside">
              {steps.map((s, i) => (
                <li key={i}>
                  <span className="font-medium text-foreground/80">{s.label}</span>
                  {" — "}
                  <span>{s.detail}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
