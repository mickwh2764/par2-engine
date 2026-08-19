import { useState } from "react";
import { Download, FileText, Table2, BookOpen, CheckCircle2, ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";

const CONTENTS = [
  { icon: FileText, label: "Paper_A_Core_Methods.tex", note: "LaTeX source — updated hierarchy claim, Δt caveat, eigenperiod table, lag-1 benchmark" },
  { icon: FileText, label: "Paper_A_Core_Methods.pdf", note: "Compiled manuscript PDF" },
  { icon: FileText, label: "cover_letter_CI.pdf", note: "Chronobiology International cover letter" },
  { icon: Table2, label: "Supplementary_Table_S8_Fit_Diagnostics.csv", note: "Updated — now includes clock_target_preserved (12/12) and target_background_preserved (8/12) columns" },
  { icon: Table2, label: "Supplementary_Table_S9_AR1_vs_AR2_Benchmarks.csv", note: "AR(1) vs AR(2) hierarchy benchmarks across 251,460 fits in 12 tissues" },
  { icon: Table2, label: "Supplementary_Table_S1b_Per_Gene_Eigenvalues.csv", note: "Per-gene |λ|, R², confidence, ADF stationarity" },
  { icon: BookOpen, label: "references.bib", note: "Full bibliography (46 references)" },
  { icon: FileText, label: "README.md", note: "Submission checklist" },
];

const CHANGES = [
  { label: "Hierarchy claim softened", detail: "Abstract, intro, results, discussion: \"Clock > Target > Background\" → \"Clock ≫ Target ≈ Background\". Target vs background gap is real in 8/12 tissues; clock separation holds 12/12." },
  { label: "Δt non-portability caveat added", detail: "New Limitations bullet: |λ| scales with sampling interval; cross-dataset magnitude comparisons require Δt-matched controls. Primary results use 2h sampling (GSE54650) throughout." },
  { label: "Eigenperiod/complex-root advantage sharpened", detail: "Model Order section: AR(2) recovers complex roots with circadian eigenperiods (Arntl 21.4 h, Per2 25.6 h, Cry1 19.7 h, Nr1d1 17.0 h) in 83/96 core-clock fits; housekeeping genes fit as real roots — a classification a scalar lag-1 autocorrelation cannot provide." },
  { label: "Lag-1 AUC comparison added", detail: "Discussion: lag-1 autocorrelation AUC 0.96 vs |λ| 0.88 for binary clock/housekeeping call. Added value of AR(2) is the eigenperiod + complex/real root type, not the scalar magnitude." },
  { label: "\"Orthogonal\" replaced with \"complementary\"", detail: "All occurrences: ρ ≈ 0.24 described as complementary information; figure caption annotated as dataset- and Δt-specific." },
  { label: "S8 hierarchy columns corrected", detail: "hierarchy_preserved now reflects true 3-tier result (True: 8/12). Two new columns: clock_target_preserved (True: 12/12) and target_background_preserved (True: 8/12)." },
];

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify-download-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.valid) {
        onUnlock();
      } else {
        setError("Incorrect password.");
        setPassword("");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-4">
            <Lock className="text-cyan-400" size={20} />
          </div>
          <div className="text-xs text-cyan-400 font-medium uppercase tracking-wide mb-1">Paper A · CI Submission Package</div>
          <h1 className="text-lg font-bold text-slate-100 text-center leading-tight">
            AR(2) Eigenvalue Hierarchy
          </h1>
          <p className="text-slate-500 text-sm mt-2 text-center">Password required to access this page.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500"
            data-testid="input-paper-a-password"
          />
          {error && (
            <p className="text-red-400 text-xs text-center" data-testid="text-paper-a-password-error">{error}</p>
          )}
          <Button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold"
            data-testid="button-paper-a-unlock"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Verifying…
              </span>
            ) : "Unlock"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/manuscript">
            <button className="text-xs text-slate-500 hover:text-slate-300 transition-colors" data-testid="link-back-from-gate">
              ← Back to manuscripts
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PaperADownload() {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!unlocked) {
    return <PasswordGate onUnlock={() => setUnlocked(true)} />;
  }

  async function handleDownload() {
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch("/api/download/paper-a-package");
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `PaperA_Core_Methods_${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      alert("Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <Link href="/manuscript">
          <button className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-sm mb-8 transition-colors" data-testid="link-back-manuscripts">
            <ArrowLeft size={14} />
            All manuscripts
          </button>
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <span className="text-cyan-400 font-black text-lg leading-none">A</span>
          </div>
          <div>
            <div className="text-xs text-cyan-400 font-medium uppercase tracking-wide">Paper A · v2.4 · Updated July 2026</div>
            <h1 className="text-xl font-bold text-slate-100 leading-tight" data-testid="text-paper-a-title">
              AR(2) Eigenvalue Hierarchy — CI Submission Package
            </h1>
          </div>
        </div>

        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          Revised following Devin benchmark analysis on GSE54650 (12 tissues, 2h × 24 tp). Core claims confirmed; hierarchy language, Δt portability, and AR(2)-over-lag-1 framing updated.
        </p>

        <Button
          onClick={handleDownload}
          disabled={loading}
          className="w-full py-5 text-base font-semibold bg-cyan-600 hover:bg-cyan-700 text-white mb-3 rounded-xl"
          data-testid="button-download-paper-a"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Preparing package…
            </span>
          ) : done ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              Downloaded — ready to submit
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Download size={18} />
              Download Paper A Package (.zip · ~3.9 MB)
            </span>
          )}
        </Button>

        <div className="flex gap-2 mb-10">
          <a
            href="/api/view/paper-pdf?id=paper-a"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
            data-testid="link-view-pdf-paper-a"
          >
            <FileText size={14} />
            View PDF
          </a>
          <a
            href="https://doi.org/10.21203/rs.3.rs-9283100/v1"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm transition-colors"
            data-testid="link-preprint-paper-a"
          >
            <ExternalLink size={14} />
            Preprint (v1)
          </a>
        </div>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">What changed in this revision</h2>
          <div className="space-y-3">
            {CHANGES.map((c, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 size={15} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-slate-200 mb-0.5">{c.label}</div>
                    <div className="text-xs text-slate-400 leading-relaxed">{c.detail}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Package contents</h2>
          <div className="space-y-1.5">
            {CONTENTS.map((f, i) => (
              <div key={i} className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-slate-900/60 border border-slate-800/60">
                <f.icon size={14} className="text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-mono text-slate-300">{f.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{f.note}</div>
                </div>
              </div>
            ))}
            <div className="py-2 px-3 text-xs text-slate-500">
              + 9 figures (PDF + PNG), ODE validation JSON, robustness JSON, dataset summaries JSON
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
