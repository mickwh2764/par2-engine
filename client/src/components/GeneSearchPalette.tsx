import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, BookOpen, Activity, Link2, ExternalLink,
  Dna, Atom, Globe, Microscope, FlaskConical, X,
  ChevronRight, Beaker, AlertCircle,
} from "lucide-react";

interface GeneProfileResponse {
  gene: string;
  category: string;
  categoryMeta: { label: string; color: string; description: string };
  literature: {
    found: boolean;
    entries: Array<{
      pathway: string;
      discoveryMethod: string;
      citation: string;
      year: number;
      finding: string;
    }>;
  };
  par2: {
    crossDataset: {
      datasetsFound: number;
      meanEigenvalue: number | null;
      minEigenvalue: number | null;
      maxEigenvalue: number | null;
      results: Array<{
        datasetName: string;
        eigenvalue: number;
        r2: number;
        confidence: string;
        species: string;
      }>;
    };
    tissueCoupling: {
      tissuesAnalyzed: number;
      tissuesCoupled: number;
      results: Array<{
        tissue: string;
        deltaAIC: number;
        pValue: number;
        significant: boolean;
        peakPhase: number;
        amplitude: number;
      }>;
    };
    isCouplingReference?: boolean;
  };
  connection: {
    literatureConfirmed: boolean;
    couplingValidated: boolean;
    agreementSummary: string;
    deepLinks: Array<{ label: string; route: string; description: string }>;
  };
}

const ICON_MAP: Record<string, typeof Dna> = {
  "Gene Explorer": Dna,
  "Phase Portrait": Activity,
  "Root-Space Geometry": Atom,
  "Genome-Wide Coupling": Globe,
  "Literature Validation": BookOpen,
};

export default function GeneSearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedGene, setSubmittedGene] = useState("");
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<GeneProfileResponse>({
    queryKey: ["/api/gene-profile", submittedGene],
    queryFn: async () => {
      const res = await fetch(`/api/gene-profile?gene=${encodeURIComponent(submittedGene)}`);
      if (!res.ok) throw new Error("Gene profile fetch failed");
      return res.json();
    },
    enabled: submittedGene.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSearch = () => {
    const trimmed = query.trim();
    if (trimmed.length > 0) {
      setSubmittedGene(trimmed);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleDeepLink = (route: string) => {
    setOpen(false);
    navigate(route);
  };

  const hasResults = !!data && submittedGene.length > 0;
  const litCount = data?.literature.entries.length ?? 0;
  const dsCount = data?.par2.crossDataset.datasetsFound ?? 0;
  const coupledCount = data?.par2.tissueCoupling.tissuesCoupled ?? 0;
  const totalTissues = data?.par2.tissueCoupling.tissuesAnalyzed ?? 0;

  return (
    <>
      <button
        data-testid="button-gene-search"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-3 text-white shadow-lg shadow-violet-500/25 transition-all hover:shadow-xl hover:shadow-violet-500/40 hover:scale-105 active:scale-95"
      >
        <Search className="h-5 w-5" />
        <span className="hidden sm:inline text-sm font-medium">Gene Search</span>
        <kbd className="hidden md:inline-flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
          <span className="text-xs">Ctrl</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-2xl p-0 gap-0 overflow-hidden border-border/50 bg-background/95 backdrop-blur-xl"
          data-testid="dialog-gene-search"
        >
          <div className="flex items-center border-b border-border/50 px-4">
            <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
            <input
              data-testid="input-gene-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search any gene (e.g. Wee1, Per2, Fasn)..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setSubmittedGene(""); }}
                className="text-muted-foreground hover:text-foreground p-1"
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSearch}
              disabled={query.trim().length === 0}
              className="ml-1"
              data-testid="button-submit-search"
            >
              Search
            </Button>
          </div>

          <ScrollArea className="max-h-[70vh]">
            {!submittedGene && !isLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6" data-testid="search-empty-state">
                <Dna className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Type a gene name and press Enter to see literature findings, PAR(2) results, and connections.</p>
                <p className="text-xs text-muted-foreground/60 mt-2">
                  Try: Wee1, Per2, Fasn, Tp53, Gapdh
                </p>
              </div>
            )}

            {isLoading && (
              <div className="p-6 space-y-4" data-testid="search-loading">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {isError && (
              <div className="flex flex-col items-center py-12 text-center px-6" data-testid="search-error">
                <AlertCircle className="h-8 w-8 text-destructive/60 mb-2" />
                <p className="text-sm text-destructive">Failed to load gene profile. Please try again.</p>
              </div>
            )}

            {hasResults && (
              <div className="divide-y divide-border/50">
                <div className="px-4 py-3 flex items-center gap-3" data-testid="gene-header">
                  <h3 className="text-lg font-bold tracking-tight">{data.gene}</h3>
                  <Badge
                    style={{ backgroundColor: data.categoryMeta.color + "22", color: data.categoryMeta.color, borderColor: data.categoryMeta.color + "44" }}
                  >
                    {data.categoryMeta.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{data.categoryMeta.description}</span>
                </div>

                <div className="p-4" data-testid="panel-literature">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-amber-500" />
                    <h4 className="text-sm font-semibold">Literature</h4>
                    {data.literature.found ? (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-[10px]">{litCount} citation{litCount !== 1 ? "s" : ""}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">No annotations</Badge>
                    )}
                  </div>
                  {data.literature.found ? (
                    <div className="space-y-2">
                      {data.literature.entries.map((entry, i) => (
                        <div key={i} className="rounded-lg border border-border/40 bg-card/50 p-3 text-xs" data-testid={`lit-entry-${i}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-foreground">{entry.pathway}</span>
                            <span className="text-muted-foreground font-mono">{entry.year}</span>
                          </div>
                          <p className="text-muted-foreground leading-relaxed">{entry.finding}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/70">
                            <Beaker className="h-3 w-3" />
                            <span>{entry.discoveryMethod}</span>
                            <span className="mx-1">|</span>
                            <span>{entry.citation}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">This gene has no curated circadian literature annotations in our database.</p>
                  )}
                </div>

                <div className="p-4" data-testid="panel-par2">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-violet-500" />
                    <h4 className="text-sm font-semibold">PAR(2) Results</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/40 bg-card/50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cross-Dataset</div>
                      {dsCount > 0 ? (
                        <>
                          <div className="text-lg font-bold" data-testid="text-mean-eigenvalue">
                            |&lambda;| = {data.par2.crossDataset.meanEigenvalue?.toFixed(4)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Range: {data.par2.crossDataset.minEigenvalue?.toFixed(4)} - {data.par2.crossDataset.maxEigenvalue?.toFixed(4)} across {dsCount} dataset{dsCount !== 1 ? "s" : ""}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">Not found in processed datasets</div>
                      )}
                    </div>

                    <div className="rounded-lg border border-border/40 bg-card/50 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">BMAL1 Coupling</div>
                      {data.par2.isCouplingReference ? (
                        <div className="text-xs text-amber-500 leading-relaxed" data-testid="text-coupling-reference">
                          Coupling reference gene — drives other genes, self-coupling not tested
                        </div>
                      ) : totalTissues > 0 ? (
                        <>
                          <div className="text-lg font-bold" data-testid="text-coupling-count">
                            {coupledCount}/{totalTissues}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            tissues with significant coupling
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">No tissue coupling data</div>
                      )}
                    </div>
                  </div>

                  {data.par2.tissueCoupling.results.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {data.par2.tissueCoupling.results.map((t) => (
                        <Badge
                          key={t.tissue}
                          variant="outline"
                          className={`text-[10px] ${t.significant ? "text-emerald-500 border-emerald-500/30" : "text-muted-foreground border-border/30"}`}
                          data-testid={`tissue-badge-${t.tissue}`}
                        >
                          {t.tissue} {t.significant ? "+" : "-"}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4" data-testid="panel-connection">
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="h-4 w-4 text-cyan-500" />
                    <h4 className="text-sm font-semibold">Connection</h4>
                    <div className="flex gap-1.5 ml-auto">
                      {data.connection.literatureConfirmed && (
                        <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-[10px]">Lit. Confirmed</Badge>
                      )}
                      {data.connection.couplingValidated && (
                        <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px]">Coupling Validated</Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3" data-testid="text-agreement-summary">
                    {data.connection.agreementSummary}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {data.connection.deepLinks.map((link) => {
                      const Icon = ICON_MAP[link.label] || ExternalLink;
                      return (
                        <Button
                          key={link.route}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1.5"
                          onClick={() => handleDeepLink(link.route)}
                          data-testid={`link-${link.label.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Icon className="h-3 w-3" />
                          {link.label}
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
