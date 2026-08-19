import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Hypothesis } from "./types";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  active?: boolean;
}

export function StatCard({ label, value, icon: Icon, active = false }: StatCardProps) {
  return (
    <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${active ? 'border-primary/40 bg-primary/5' : ''}`}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider" data-testid={`text-stat-label-${label.toLowerCase().replace(/\s+/g, '-')}`}>{label}</p>
          <p className={`text-3xl font-mono font-bold mt-2 ${active ? 'text-primary' : 'text-foreground'}`} data-testid={`text-stat-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${active ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
          <Icon size={20} />
        </div>
      </CardContent>
    </Card>
  );
}

interface ResultCardProps {
  result: Hypothesis;
  index: number;
  onClick?: () => void;
}

export function ResultCard({ result, index, onClick }: ResultCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card 
        className={`overflow-hidden transition-all hover:shadow-lg ${result.significant ? 'border-l-4 border-l-primary border-y-border/50 border-r-border/50 cursor-pointer hover:bg-primary/5' : 'border-border/50 opacity-80'}`}
        data-testid={`card-result-${result.targetGene}-${result.clockGene}`}
        onClick={result.significant ? onClick : undefined}
      >
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row items-stretch">
            <div className={`w-full md:w-24 flex flex-col items-center justify-center p-4 ${result.significant ? 'bg-primary/10' : 'bg-secondary/30'}`}>
              {result.significant ? (
                <>
                  <CheckCircle2 className="text-primary mb-2" size={24} data-testid={`icon-significant-${result.targetGene}`} />
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">Found</span>
                  <span className="text-[10px] text-primary/70 mt-1">Click for details</span>
                </>
              ) : (
                <>
                  <XCircle className="text-muted-foreground mb-2" size={24} />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Null</span>
                </>
              )}
            </div>

            <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                 <div className="flex items-center gap-3 mb-2">
                   <Badge variant="outline" className="font-mono text-chart-1 border-chart-1/30 bg-chart-1/5" data-testid={`badge-clock-${result.clockGene}`}>{result.clockGene}</Badge>
                   <ArrowRight size={14} className="text-muted-foreground" />
                   <Badge variant="outline" className="font-mono text-chart-3 border-chart-3/30 bg-chart-3/5" data-testid={`badge-target-${result.targetGene}`}>{result.targetGene}</Badge>
                   {result.modelQuality && (
                     <Badge 
                       variant="outline" 
                       className={`text-xs ${
                         result.modelQuality === 'high' 
                           ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' 
                           : result.modelQuality === 'medium'
                             ? 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                             : 'text-muted-foreground border-muted-foreground/30 bg-muted-foreground/5'
                       }`}
                       data-testid={`badge-quality-${result.targetGene}`}
                     >
                       {result.modelQuality === 'high' ? '●' : result.modelQuality === 'medium' ? '●' : '○'} {result.modelQuality}
                     </Badge>
                   )}
                   {result.significant && (
                     <Badge 
                       variant="outline" 
                       className={`text-[10px] font-bold ${
                         result.significantAfterFDR && (result.effectSizeCohensF2 ?? 0) >= 0.35 && (result.qValue ?? 1) < 0.01
                           ? 'bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 text-emerald-300 border-emerald-400/50' 
                           : result.significantAfterFDR && (result.effectSizeCohensF2 ?? 0) >= 0.35 && (result.qValue ?? 1) < 0.05
                             ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
                             : (result.significantAfterFDR || (result.effectSizeCohensF2 ?? 0) >= 0.35) && (result.qValue ?? 1) < 0.10
                               ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                               : 'bg-gray-500/20 text-slate-500 border-gray-400/40'
                       }`}
                       data-testid={`badge-tier-${result.targetGene}`}
                       title={
                         result.significantAfterFDR && (result.effectSizeCohensF2 ?? 0) >= 0.35 && (result.qValue ?? 1) < 0.01
                           ? 'Strong Candidate: q<0.01 + large effect - prioritize for validation'
                           : result.significantAfterFDR && (result.effectSizeCohensF2 ?? 0) >= 0.35 && (result.qValue ?? 1) < 0.05
                             ? 'Candidate: q<0.05 + effect size - worth investigating'
                             : (result.significantAfterFDR || (result.effectSizeCohensF2 ?? 0) >= 0.35) && (result.qValue ?? 1) < 0.10
                               ? 'Weak Candidate: q<0.10 - lower priority'
                               : 'Exploratory: high FDR - hypothesis-generating only'
                       }
                     >
                       {result.significantAfterFDR && (result.effectSizeCohensF2 ?? 0) >= 0.35 && (result.qValue ?? 1) < 0.01
                         ? '★ STRONG' 
                         : result.significantAfterFDR && (result.effectSizeCohensF2 ?? 0) >= 0.35 && (result.qValue ?? 1) < 0.05
                           ? '◆ CANDIDATE'
                           : (result.significantAfterFDR || (result.effectSizeCohensF2 ?? 0) >= 0.35) && (result.qValue ?? 1) < 0.10
                             ? '● WEAK'
                             : '○ EXPLORE'}
                     </Badge>
                   )}
                 </div>
                 <h3 className="text-lg font-semibold" data-testid={`text-description-${result.targetGene}`}>{result.description}</h3>
                 <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1.5 font-mono">
                       P-Value: <span className={result.significant ? "text-foreground font-bold" : ""} data-testid={`text-pvalue-${result.targetGene}`}>{result.pValue?.toFixed(4) || 'N/A'}</span>
                    </span>
                    {result.effectSizeCohensF2 != null && (
                      <span className="flex items-center gap-1.5 font-mono" data-testid={`text-effect-${result.targetGene}`}>
                         f²: <span className={
                           result.effectSizeCohensF2 >= 0.35 ? "text-emerald-400 font-bold" : 
                           result.effectSizeCohensF2 >= 0.15 ? "text-amber-400 font-bold" : 
                           result.effectSizeCohensF2 >= 0.02 ? "text-foreground" : "text-muted-foreground"
                         }>{result.effectSizeCohensF2.toFixed(3)}</span>
                         <Badge 
                           variant="outline" 
                           className={`ml-1 text-[9px] px-1 ${
                             result.effectSizeInterpretation === 'large' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' :
                             result.effectSizeInterpretation === 'medium' ? 'bg-amber-500/20 text-amber-400 border-amber-400/30' :
                             result.effectSizeInterpretation === 'small' ? 'bg-blue-500/20 text-blue-400 border-blue-400/30' :
                             'bg-muted text-muted-foreground'
                           }`}
                         >
                           {result.effectSizeInterpretation}
                         </Badge>
                      </span>
                    )}
                    {result.rSquaredChange != null && result.rSquaredChange > 0 && (
                      <span className="flex items-center gap-1.5 font-mono" data-testid={`text-rsq-${result.targetGene}`}>
                         ΔR²: <span className={result.rSquaredChange >= 0.10 ? "text-emerald-400 font-bold" : result.rSquaredChange >= 0.05 ? "text-amber-400" : ""}>{(result.rSquaredChange * 100).toFixed(1)}%</span>
                      </span>
                    )}
                    {(result.qValue != null || result.fdrAdjustedPValue != null) && (
                      <span className="flex items-center gap-1.5 font-mono" data-testid={`text-fdr-${result.targetGene}`}>
                         q: <span className={(result.qValue ?? result.fdrAdjustedPValue ?? 1) < 0.05 ? "text-emerald-400 font-bold" : (result.qValue ?? result.fdrAdjustedPValue ?? 1) < 0.1 ? "text-amber-400" : ""}>
                           {(result.qValue ?? result.fdrAdjustedPValue)?.toFixed(4)}
                         </span>
                         {result.significantAfterFDR && (
                           <Badge className="ml-1 bg-emerald-500/20 text-emerald-400 text-[9px] px-1">FDR✓</Badge>
                         )}
                      </span>
                    )}
                    {result.significant && result.significantTerms?.length > 0 && (
                      <span className="flex items-center gap-1.5" data-testid={`text-terms-${result.targetGene}`}>
                         Terms: {result.significantTerms.join(", ")}
                      </span>
                    )}
                 </div>
              </div>
              {result.significant && (
                <div className="text-primary/50">
                  <ArrowRight size={20} />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
    </motion.div>
  );
}
