import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Shield, AlertTriangle, CheckCircle2, Upload, Info, 
  FileText, BarChart2, Target, Layers, TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Fingerprint {
  tissue: string;
  organism: string;
  platform: string;
  datasetId: string;
  nGenes: number;
  lambdaMean: number;
  lambdaStd: number;
  lambdaRange: [number, number];
}

interface AtlasData {
  tier1: { tissues: string[]; count: number; fingerprints: Fingerprint[] };
  tier2: { tissues: string[]; count: number; fingerprints: Fingerprint[] };
  summary: {
    totalTissues: number;
    organisms: string[];
    meanLambdaRange: [number, number];
    tissueRanking: { tissue: string; lambdaMean: number }[];
  };
  methodology: { preprocessing: string; source: string };
}

interface ScaleDetection {
  scale: string;
  confidence: number;
  evidence: string[];
  warnings: string[];
  stats: {
    min: number;
    max: number;
    mean: number;
  };
}

export default function ScaleGuardrail() {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectionResult, setDetectionResult] = useState<{
    fileName: string;
    detection: ScaleDetection;
    recommendation: string;
  } | null>(null);

  const { data: fingerprints, isLoading: loadingFingerprints } = useQuery<{
    count: number;
    fingerprints: Fingerprint[];
  }>({
    queryKey: ["/api/guardrail/fingerprints"],
  });

  const { data: atlas } = useQuery<AtlasData>({
    queryKey: ["/api/guardrail/atlas"],
    queryFn: async () => {
      const res = await fetch("/api/guardrail/atlas");
      if (!res.ok) throw new Error("Failed to fetch atlas");
      return res.json();
    }
  });

  const detectScaleMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/guardrail/detect-scale", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to detect scale");
      return res.json();
    },
    onSuccess: (data) => {
      setDetectionResult(data);
      toast({
        title: "Scale Detected",
        description: `${data.detection.scale} (${(data.detection.confidence * 100).toFixed(0)}% confidence)`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: String(error),
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      detectScaleMutation.mutate(file);
    }
  };

  const getScaleBadgeColor = (scale: string) => {
    switch (scale) {
      case "log2": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "tpm_fpkm": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "raw_intensity": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "counts": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/50 border-cyan-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-cyan-400">
            <Shield className="h-5 w-5" />
            Transform & Scale Guardrail
          </CardTitle>
          <CardDescription>
            Auto-detect data scale and ensure valid cross-dataset AR(2) comparisons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="max-w-xs bg-slate-800 border-slate-700"
              data-testid="input-scale-file"
            />
            {detectScaleMutation.isPending && (
              <span className="text-sm text-slate-400">Analyzing...</span>
            )}
          </div>

          {detectionResult && (
            <div className="space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-300">{detectionResult.fileName}</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Detected Scale</div>
                  <Badge className={getScaleBadgeColor(detectionResult.detection.scale)}>
                    {detectionResult.detection.scale.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Confidence</div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={detectionResult.detection.confidence * 100} 
                      className="h-2 flex-1"
                    />
                    <span className="text-sm text-slate-300">
                      {(detectionResult.detection.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Range</div>
                  <span className="text-sm text-slate-300">
                    [{detectionResult.detection.stats.min.toFixed(1)}, {detectionResult.detection.stats.max.toFixed(1)}]
                  </span>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <div className="text-xs text-slate-400 mb-1">Mean</div>
                  <span className="text-sm text-slate-300">
                    {detectionResult.detection.stats.mean.toFixed(2)}
                  </span>
                </div>
              </div>

              {detectionResult.detection.scale !== "log2" && (
                <Alert className="bg-yellow-500/10 border-yellow-500/30">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <AlertTitle className="text-yellow-400">Transform Required</AlertTitle>
                  <AlertDescription className="text-yellow-300/80">
                    {detectionResult.recommendation}
                  </AlertDescription>
                </Alert>
              )}

              {detectionResult.detection.scale === "log2" && (
                <Alert className="bg-green-500/10 border-green-500/30">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <AlertTitle className="text-green-400">Ready for Analysis</AlertTitle>
                  <AlertDescription className="text-green-300/80">
                    {detectionResult.recommendation}
                  </AlertDescription>
                </Alert>
              )}

              {detectionResult.detection.warnings.length > 0 && (
                <div className="text-sm text-slate-400 space-y-1">
                  {detectionResult.detection.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5 text-slate-400" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900/50 border-purple-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-purple-400">
            <Target className="h-5 w-5" />
            Reference Distribution Fingerprints
          </CardTitle>
          <CardDescription>
            Compare your dataset against validated tissue-specific λ distributions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingFingerprints ? (
            <div className="text-slate-400 text-sm">Loading fingerprints...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fingerprints?.fingerprints.map((fp, i) => (
                <div 
                  key={i}
                  className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 hover:border-purple-500/30 transition-colors"
                  data-testid={`fingerprint-${fp.tissue}-${fp.datasetId}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                        {fp.tissue}
                      </Badge>
                      <span className="text-xs text-slate-400">{fp.organism}</span>
                    </div>
                    <span className="text-xs text-slate-400">{fp.datasetId}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-slate-400">Mean λ</div>
                      <div className="text-cyan-400 font-mono">{fp.lambdaMean.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Std</div>
                      <div className="text-slate-300 font-mono">±{fp.lambdaStd.toFixed(3)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">Range</div>
                      <div className="text-slate-300 font-mono text-xs">
                        [{fp.lambdaRange[0].toFixed(2)}, {fp.lambdaRange[1].toFixed(2)}]
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    {fp.platform} • {fp.nGenes} genes
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {atlas && (
        <Card className="bg-slate-900/50 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Layers className="h-5 w-5" />
              Reference λ-Atlas (Tier Classification)
              <Badge className="bg-amber-500 text-white text-[10px] ml-2">NEW</Badge>
            </CardTitle>
            <CardDescription>
              Tissue ranking by AR(2) eigenvalue persistence (higher λ = slower dynamics)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                <div className="text-xs text-emerald-400 font-semibold mb-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> TIER-1 (Core)
                </div>
                <div className="space-y-1">
                  {atlas.tier1.tissues.map(t => (
                    <div key={t} className="text-sm text-slate-300 capitalize">{t}</div>
                  ))}
                </div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="text-xs text-blue-400 font-semibold mb-2 flex items-center gap-1">
                  <Layers className="h-3 w-3" /> TIER-2 (Extended)
                </div>
                <div className="space-y-1">
                  {atlas.tier2.tissues.map(t => (
                    <div key={t} className="text-sm text-slate-300 capitalize">{t}</div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="text-xs text-slate-400 mb-2">Tissue Ranking by Mean λ</div>
              <div className="space-y-2">
                {atlas.summary.tissueRanking.map((t, i) => (
                  <div key={t.tissue} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                    <span className="text-sm text-slate-300 capitalize flex-1">{t.tissue}</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="h-2 bg-gradient-to-r from-cyan-500 to-purple-500 rounded"
                        style={{ width: `${t.lambdaMean * 100}px` }}
                      />
                      <span className="text-xs text-cyan-400 font-mono w-12">
                        λ={t.lambdaMean.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-400">
              Source: {atlas.methodology.source} • {atlas.methodology.preprocessing}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
