import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const GLOSSARY: Record<string, string> = {
  "AR(2)": "Autoregressive model of order 2 — predicts a value from its two previous time points, measuring how much 'memory' the system has.",
  "eigenvalue": "A number showing how strongly a signal persists over time. Higher = longer-lasting, lower = fades quickly.",
  "|λ|": "The eigenvalue modulus — how persistent the signal is. Near 0 = fades quickly. Near 1 = barely decays. Exactly 1 = the theoretical value for a true periodic oscillator (like a clock gene). Reported values are population-level lower bounds — bulk averaging pulls them below the true per-cell value.",
  "eigenvalue modulus": "How persistent the signal is. Near 0 = fades quickly. Near 1 = barely decays. A true periodic oscillator has |λ| = 1.0 in theory; observed clock-gene values (~0.65) are lower bounds reflecting bulk-averaging attenuation, not true dampening.",
  "clock gene": "A gene driving the body's ~24-hour clock (e.g. PER2, BMAL1). These genes oscillate rhythmically every day.",
  "target gene": "A gene controlled by clock genes — for example, genes managing cell division or metabolism.",
  "FDR": "False Discovery Rate — adjusts for testing many genes at once so you don't get false positives.",
  "p-value": "How likely this result is due to chance. Smaller = more significant. Below 0.05 is usually considered meaningful.",
  "stationarity": "The signal's pattern stays consistent over time — it isn't drifting up or down.",
  "root-space": "A 2D map placing each gene by its AR(2) coefficients. Position reveals whether behaviour is oscillatory, decaying, or persistent.",
  "bootstrap": "A reliability check: re-analyse random subsets of the data many times to see how stable the results are.",
  "permutation test": "A significance test: shuffle the data randomly many times to check if the real result is stronger than chance.",
  "circadian": "Relating to biological rhythms with a ~24-hour cycle, driven by the body's internal clock.",
  "chronotherapy": "Timing drug treatments to match the body clock for better effectiveness or fewer side effects.",
  "Granger causality": "Does knowing gene A's past help predict gene B's future, beyond gene B's own history?",
  "ODE": "Ordinary Differential Equation — a math model describing how quantities change continuously over time.",
  "AIC": "Akaike Information Criterion — balances model accuracy vs complexity. Lower = better model.",
  "BIC": "Bayesian Information Criterion — like AIC but penalises complexity more. Lower = better model.",
  "Cohen's d": "Effect size — how big the difference between two groups is, measured in standard deviations.",
  "persistence hierarchy": "Clock genes consistently show stronger persistence (higher eigenvalues) than the target genes they regulate.",
  "phi1": "The first AR(2) coefficient (β₁) — how much the previous time point influences the current one.",
  "phi2": "The second AR(2) coefficient (β₂) — how much the time point two steps back influences the current one.",
  "R²": "R-squared — the fraction of variation explained by the model. 1.0 = perfect fit, 0.0 = no fit at all.",
  "R-squared": "The fraction of variation explained by the model. 1.0 = perfect fit, 0.0 = no fit at all.",
  "Ljung-Box": "A test checking if the model captured all the patterns. PASS = good fit (residuals are random noise).",
  "residuals": "The leftover differences between the model's predictions and the actual data. Should look like random noise if the model fits well.",
  "ACF": "Autocorrelation Function — checks if leftover patterns remain at different time lags. Bars inside the dashed lines = good.",
  "state space": "A plot of the two AR(2) coefficients (β₁, β₂) showing where each signal falls in terms of dynamic behaviour.",
  "stability": "Whether a signal stays bounded (stable) or grows without limit (unstable). Stable signals have eigenvalues below 1.",
  "gearbox": "The 'gearbox hypothesis' — clock genes act as a persistent driver, while target genes respond with lower persistence, creating a hierarchy.",
  "time series": "A sequence of measurements taken at regular intervals over time — like gene expression measured every 4 hours.",
  "confidence score": "A 0–100 rating of how trustworthy the analysis result is, based on multiple quality checks.",
  "implied period": "If the signal oscillates, this estimates the cycle length in time units (e.g. ~24 for a circadian rhythm).",
  "white noise": "Random fluctuations with no pattern — what good residuals should look like after the model removes the signal.",
  "half-life": "Expression persistence half-life — how long a gene's expression pattern sustains above half its peak change. This is NOT the same as mRNA molecular half-life (how fast the molecule degrades). A gene can have a short-lived mRNA but high expression persistence if it is continuously retranscribed.",
};

export function Term({ children }: { children: string }) {
  const term = children;
  const definition = GLOSSARY[term] || GLOSSARY[term.toLowerCase()];

  if (!definition) {
    return <span>{children}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 cursor-help"
          data-testid={`glossary-${term.replace(/[^a-zA-Z0-9]/g, '-')}`}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        <p className="font-semibold text-primary mb-1">{term}</p>
        <p>{definition}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function GlossaryPanel() {
  const sorted = Object.entries(GLOSSARY).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="space-y-3" data-testid="glossary-panel">
      <h3 className="text-sm font-semibold text-foreground">Glossary</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {sorted.map(([term, def]) => (
          <div key={term} className="space-y-0.5">
            <dt className="text-xs font-semibold text-primary">{term}</dt>
            <dd className="text-[11px] text-muted-foreground leading-relaxed">{def}</dd>
          </div>
        ))}
      </div>
    </div>
  );
}

export { GLOSSARY };
