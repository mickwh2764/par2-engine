import { useState } from "react";
import { APP_VERSION } from "@/lib/version";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { 
  BookOpen, 
  Upload, 
  BarChart3, 
  Download, 
  Beaker,
  Code,
  FileJson,
  Zap,
  Target,
  Activity,
  ArrowRight,
  CheckCircle,
  Clock,
  Shield,
  AlertTriangle,
  XCircle,
  Info
} from "lucide-react";
import HowTo from "@/components/HowTo";
import { GlossaryPanel } from "@/components/Glossary";

const TOUR_STEPS = [
  { step: 1, title: "Start at the Home Page", description: "Browse 38 pre-loaded datasets from mouse, human, baboon, and plant tissues. Pick one to see a quick overview.", route: "/", icon: BarChart3, color: "emerald" },
  { step: 2, title: "Run Your First Analysis", description: "Select a dataset and click 'Run Analysis'. The platform calculates persistence scores for all gene pairs — results appear in seconds.", route: "/", icon: Zap, color: "cyan" },
  { step: 3, title: "Explore the Dynamics Map", description: "See where genes land on a 2D map based on their behaviour. Each gene gets a unique position that reveals whether it oscillates, decays, or persists.", route: "/root-space", icon: Activity, color: "purple" },
  { step: 4, title: "Check the Evidence", description: "Review validation across multiple species, model comparisons, and independence checks. This confirms the persistence scores capture something real and unique.", route: "/ar2-diagnostics", icon: CheckCircle, color: "amber" },
  { step: 5, title: "Screen for Disease Effects", description: "Compare healthy vs disease patterns across 10 matched pairs. See which genes shift the most and whether the normal clock hierarchy breaks down.", route: "/disease-screen", icon: Target, color: "red" },
  { step: 6, title: "Test Robustness", description: "Run reliability checks: re-sample the data, shuffle labels, and test stability to make sure findings hold up and aren't just noise.", route: "/supplementary-analyses", icon: Shield, color: "blue" },
  { step: 7, title: "Upload Your Own Data", description: "Drop in your own CSV — gene expression, wearable device data, or any time series. Get persistence scores with quality checks and diagnostics.", route: "/discovery-engine", icon: Upload, color: "emerald" },
];

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; ring: string; iconBg: string }> = {
  emerald: { border: "border-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-300", iconBg: "bg-emerald-100" },
  cyan:    { border: "border-cyan-400",    bg: "bg-cyan-50",    text: "text-cyan-700",    ring: "ring-cyan-300",    iconBg: "bg-cyan-100" },
  purple:  { border: "border-purple-400",  bg: "bg-purple-50",  text: "text-purple-700",  ring: "ring-purple-300",  iconBg: "bg-purple-100" },
  amber:   { border: "border-amber-400",   bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-300",   iconBg: "bg-amber-100" },
  red:     { border: "border-red-400",     bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-300",     iconBg: "bg-red-100" },
  blue:    { border: "border-blue-400",    bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-300",    iconBg: "bg-blue-100" },
};

export default function GettingStarted() {
  const [currentStep, setCurrentStep] = useState<number>(0);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-4 py-8">
          <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
            Getting Started Guide
          </Badge>
          <h1 className="text-4xl font-bold text-slate-900">
            PAR(2) Discovery Engine
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Go beyond "is there a rhythm?" to "how strong and stable is it?" — 
            using persistence scores that work across genes, species, and conditions.
          </p>
        </div>

        <HowTo
          title="Getting Started Guide"
          summary="A step-by-step introduction to the PAR(2) Discovery Engine for new users. Walks you through the key concepts, the navigation structure, and the recommended order for exploring the platform."
          steps={[
            { label: "Follow the guide", detail: "Read through each section in order for a structured introduction to the platform." },
            { label: "Try the links", detail: "Click the embedded links to jump directly to the relevant analysis pages as you learn about them." }
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center mb-2">
                <Zap className="w-6 h-6 text-emerald-600" />
              </div>
              <CardTitle className="text-slate-900">Fast</CardTitle>
              <CardDescription className="text-slate-600">
                Analyse 1000+ gene pairs in seconds — no coding needed
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center mb-2">
                <Target className="w-6 h-6 text-cyan-600" />
              </div>
              <CardTitle className="text-slate-900">Predictive</CardTitle>
              <CardDescription className="text-slate-600">
                See which genes might respond to drugs or disease
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <CardTitle className="text-slate-900">Validated</CardTitle>
              <CardDescription className="text-slate-600">
                Tested across 721 analyses in 72 biological contexts
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card className="bg-white border-slate-200 shadow-sm" data-testid="card-model-explanation">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Info className="w-5 h-5 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">What This Model Does — In Plain Language</h2>
                <p className="text-sm text-slate-500">No statistics background needed</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 text-slate-700 leading-relaxed">
            <p>
              Imagine you measure how active a gene is every few hours over the course of a day or two. 
              You get a sequence of numbers — a time series. This tool asks a simple question about that sequence:
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-3">
              <p className="text-center text-lg font-medium text-slate-900">
                "How well do the last two measurements predict the next one?"
              </p>
              <p className="text-sm text-slate-600 text-center">
                That is literally all the AR(2) model does. It fits a simple equation with just two numbers 
                (coefficients) that describe how much the recent past determines the near future.
              </p>
            </div>
            <p>
              From those two coefficients, the platform calculates a single score called the <strong className="text-slate-900">eigenvalue modulus (|&#955;|)</strong>. 
              Think of it as a "memory score":
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700">Low</p>
                <p className="text-sm text-emerald-600">|&#955;| below 0.5</p>
                <p className="text-xs text-slate-600 mt-1">Signal fades fast — the gene responds and moves on</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">Medium</p>
                <p className="text-sm text-amber-600">|&#955;| around 0.5–0.7 (at 2h sampling)</p>
                <p className="text-xs text-slate-600 mt-1">Signal lingers — the gene carries forward what happened before</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-700">High</p>
                <p className="text-sm text-red-600">|&#955;| above 0.7 (at 2h sampling)</p>
                <p className="text-xs text-slate-600 mt-1">Signal persists strongly — slow to change, hard to reset</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 italic">Note: |λ| values depend on sampling interval (Δt). Typical ranges above are for 2-hour sampling. Datasets with 1-hour sampling will show higher absolute values across all categories — compare genes within a dataset, not across datasets with different Δt.</p>
            <p>
              The key discovery is that this score reveals a <strong className="text-slate-900">hierarchy</strong> hidden in the data: 
              the body's core clock genes (like BMAL1 and PER2) consistently score higher than the downstream 
              genes they control. Clock genes have more "memory" — they hold their pattern longer. 
              This hierarchy has been confirmed in most tissues and species tested (mouse, human, baboon, and plant),
              though the absolute values and the strength of the separation vary with tissue type and sampling interval.
              When the clock breaks (for example, in BMAL1 knockout mice), the hierarchy collapses.
            </p>
            <p>
              That is the entire model. Two coefficients, one score, one hierarchy. Everything else on this 
              platform — the robustness tests, the disease comparisons, the before/after trajectories — is about 
              checking whether that simple finding holds up under scrutiny. So far, it does.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Guided Discovery Path</h2>
                <p className="text-sm text-slate-500">Follow these 7 steps to understand the full platform</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {TOUR_STEPS.map((tourStep) => {
                const isActive = currentStep === tourStep.step;
                const isCompleted = currentStep > 0 && tourStep.step < currentStep;
                const colors = COLOR_MAP[tourStep.color] || COLOR_MAP.emerald;
                const IconComponent = tourStep.icon;

                return (
                  <div
                    key={tourStep.step}
                    data-testid={`tour-step-${tourStep.step}`}
                    className={`rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? `${colors.border} ${colors.bg} ring-2 ${colors.ring}`
                        : "border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300"
                    }`}
                    onClick={() => setCurrentStep(isActive ? 0 : tourStep.step)}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCompleted
                          ? "bg-emerald-100"
                          : isActive
                            ? colors.iconBg
                            : "bg-slate-200"
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className={`text-sm font-bold ${isActive ? colors.text : "text-slate-800"}`}>
                            {tourStep.step}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <IconComponent className={`w-4 h-4 flex-shrink-0 ${isActive ? colors.text : "text-slate-500"}`} />
                        <span className={`font-medium ${isActive ? colors.text : "text-slate-700"}`}>
                          {tourStep.title}
                        </span>
                      </div>
                      <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                        isActive ? `${colors.text} rotate-90` : "text-slate-400"
                      }`} />
                    </div>
                    {isActive && (
                      <div className="px-3 pb-3 pl-14 space-y-3">
                        <p className="text-sm text-slate-700">{tourStep.description}</p>
                        <Link href={tourStep.route}>
                          <Button
                            size="sm"
                            className="bg-slate-800 hover:bg-slate-700 text-white"
                            data-testid={`tour-goto-${tourStep.step}`}
                          >
                            Go to Page <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={currentStep <= 1}
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                data-testid="tour-prev"
              >
                Previous
              </Button>
              <span className="text-xs text-slate-500">
                {currentStep === 0
                  ? "Click a step to begin"
                  : `Step ${currentStep} of ${TOUR_STEPS.length}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
                disabled={currentStep === 0 || currentStep >= TOUR_STEPS.length}
                onClick={() => setCurrentStep((prev) => Math.min(TOUR_STEPS.length, prev + 1))}
                data-testid="tour-next"
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="researchers" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 border border-slate-200">
            <TabsTrigger value="researchers" data-testid="tab-researchers">For Researchers</TabsTrigger>
            <TabsTrigger value="programmers" data-testid="tab-programmers">For Programmers</TabsTrigger>
            <TabsTrigger value="clinicians" data-testid="tab-clinicians">For Clinicians</TabsTrigger>
          </TabsList>
          
          <TabsContent value="researchers" className="space-y-6 mt-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  Quick Start (5 minutes)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { n: 1, title: "Start at the Home Page", desc: "Click \"Home\" in the navigation to visit the home page." },
                    { n: 2, title: "Select a Pre-loaded Dataset", desc: "Choose from 39 embedded datasets (mouse tissues, human blood, Arabidopsis, organoids)." },
                    { n: 3, title: "Click \"Run Analysis\"", desc: "The engine analyzes all clock-target gene pairs and computes eigenvalues." },
                    { n: 4, title: "Read the Results", desc: null },
                  ].map(({ n, title, desc }) => (
                    <div key={n} className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold">{n}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{title}</h3>
                        {desc ? (
                          <p className="text-slate-600">{desc}</p>
                        ) : (
                          <p className="text-slate-600">
                            <strong>Below 0.50</strong> — Signal fades quickly (low persistence)<br/>
                            <strong>0.50–0.70</strong> — Signal lingers (sustained memory)<br/>
                            <strong>Above 0.70</strong> — Signal persists strongly (slow to recover)<br/>
                            <em className="text-xs text-slate-500">Values shown for 2h sampling — scale with Δt</em>
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-200">
                  <Link href="/">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-go-home">
                      Go to Home <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-cyan-600" />
                  Upload Your Own Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">Your CSV should have this format:</p>
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre className="text-slate-200">
{`Gene,ZT0,ZT4,ZT8,ZT12,ZT16,ZT20
Per2,5.2,8.1,6.3,4.1,7.9,5.8
Cry1,4.8,6.2,7.1,5.3,4.9,6.5
Lgr5,3.1,3.4,3.2,3.5,3.3,3.1`}
                  </pre>
                </div>
                <ul className="space-y-2 text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    First column: Gene names (symbols or Ensembl IDs)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Remaining columns: Expression values at timepoints
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    Minimum 6 timepoints recommended (more = better CIs)
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="programmers" className="space-y-6 mt-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <Code className="w-5 h-5 text-cyan-600" />
                  API Quick Start
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-600">All endpoints return JSON. Base URL: <code className="text-emerald-700 bg-emerald-50 px-1 rounded">/api</code></p>
                <div className="space-y-4">
                  {[
                    { title: "Run Analysis", code: `POST /api/analyze\nContent-Type: application/json\n\n{\n  "datasetName": "GSE157357_WT",\n  "clockGene": "Per2",\n  "targetGene": "Lgr5"\n}` },
                    { title: "Get Eigenvalue Results", code: `GET /api/analyses\n\nResponse:\n{\n  "analyses": [...],\n  "eigenvalue": 0.537,\n  "phi1": 1.0,\n  "phi2": -0.27\n}` },
                    { title: "Download Reports", code: `GET /api/download/verification-report\nGET /api/download/report` },
                  ].map(({ title, code }) => (
                    <div key={title}>
                      <h4 className="font-semibold text-slate-900 mb-2">{title}</h4>
                      <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                        <pre className="text-slate-200">{code}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-purple-600" />
                  CLI Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                  <pre className="text-slate-200">
{`# Run verification suite
npx tsx server/verification-suite.ts

# Run drug perturbation simulator
npx tsx server/drug-perturbation.ts

# Run recovery threshold calculator
npx tsx server/recovery-threshold.ts

# Run sleep deprivation analysis
npx tsx server/sleep-phase-gating-test.ts`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="clinicians" className="space-y-6 mt-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-purple-600" />
                  Clinical Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      Recovery Time Estimates
                    </h4>
                    <p className="text-slate-600 text-sm mb-2">How long to bounce back from disruption?</p>
                    <ul className="text-sm space-y-1">
                      <li className="text-emerald-700">Low persistence (0.54) → ~7 days</li>
                      <li className="text-amber-700">Medium persistence (0.70) → ~13 days</li>
                      <li className="text-red-700">High persistence (0.95) → 90+ days</li>
                    </ul>
                  </div>
                  
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-2">
                      <Beaker className="w-4 h-4 text-cyan-600" />
                      Drug Simulator
                    </h4>
                    <p className="text-slate-600 text-sm mb-2">Predict treatment effects:</p>
                    <ul className="text-sm space-y-1">
                      <li className="text-slate-700">Wnt Inhibitor → -0.01 |λ|</li>
                      <li className="text-slate-700">Wnt+Notch → REMISSION</li>
                      <li className="text-red-700">Circadian Disruptor → +0.21 |λ|</li>
                    </ul>
                  </div>
                </div>
                
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-semibold text-amber-800 mb-2">Important Note</h4>
                  <p className="text-amber-900 text-sm">
                    This tool is for research purposes only. Clinical decisions should be made 
                    in consultation with qualified healthcare professionals. The drug simulator 
                    provides theoretical predictions that require experimental validation.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-emerald-600" />
                  Reading the Persistence Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-4 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded"></div>
                    <span className="text-slate-700">Below 0.50 — Signal fades quickly (low persistence)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-4 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded"></div>
                    <span className="text-slate-700">0.50–0.70 — Signal lingers moderately (sustained memory)</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-4 bg-gradient-to-r from-red-500 to-red-600 rounded"></div>
                    <span className="text-slate-700">Above 0.70 — Signal persists strongly (slow to recover)</span>
                  </div>
                  <p className="text-xs text-slate-500 italic pt-1">Ranges calibrated for 2-hour sampling. |λ| scales with Δt — do not compare values across datasets with different sampling intervals.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="bg-white border-amber-200 shadow-sm" data-testid="card-can-cannot">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">What This Tool Can and Cannot Do</h2>
                <p className="text-sm text-slate-500">Important for interpreting your results correctly</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                What it CAN do
              </h3>
              <ul className="space-y-2 text-slate-700 text-sm">
                {[
                  ["Screen for persistence patterns", "identify which genes hold their expression patterns longest and which fade quickly, across any time-series dataset with 6+ timepoints."],
                  ["Compare conditions", "show how the persistence hierarchy shifts between healthy and disease states, before and after treatment, or across different tissues."],
                  ["Rank genes by temporal memory", "provide a continuous, quantitative persistence score that goes beyond the binary \"rhythmic vs non-rhythmic\" classification."],
                  ["Generate hypotheses", "flag genes whose persistence changes dramatically between conditions as candidates for further experimental investigation."],
                  ["Monitor population-level trends", "track how groups of genes behave across datasets, tissues, and species."],
                ].map(([bold, rest], i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-emerald-600 mt-0.5 shrink-0">{i + 1}.</span>
                    <span><strong className="text-slate-900">{bold}</strong> — {rest}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-red-700 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                What it CANNOT do
              </h3>
              <ul className="space-y-2 text-slate-700 text-sm">
                {[
                  ["Diagnose from a single sample", "the tool needs a time series (multiple measurements over time). A single blood draw or biopsy is not enough."],
                  ["Prove a gene is rhythmic", <>high |λ| means a gene's expression is self-sustaining and persistent — it does <em>not</em> confirm 24-hour periodicity. A slowly decaying non-oscillatory process can also produce high |λ|. Always check the eigenperiod alongside the modulus.</>],
                  ["Compare values across different sampling intervals", "a clock gene measured at 1-hour resolution will show a higher |λ| than the same gene measured at 2-hour resolution. Absolute |λ| values are only comparable within a dataset; cross-dataset comparisons require matching Δt."],
                  ["Identify causal mechanisms", <>it tells you <em>what</em> persists, not <em>why</em>. It cannot identify signalling pathways, protein interactions, or regulatory mechanisms.</>],
                  ["Replace simpler methods for binary detection", "for the specific question of whether a gene oscillates rhythmically (yes/no), AR(1) or cosinor regression is competitive and simpler. AR(2) eigenvalue adds most value when you need to rank or quantify persistence, not just detect it."],
                  ["Predict individual patient outcomes", "the persistence scores describe population-level patterns in gene expression data, not individual clinical trajectories."],
                  ["Replace experimental validation", "all findings are statistical associations that require independent experimental confirmation before any clinical application."],
                  ["Detect very fast oscillations", "signals faster than twice the sampling interval (e.g. 2-hour cycles in 4-hour data) are invisible due to the Nyquist limit."],
                ].map(([bold, rest], i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-red-600 mt-0.5 shrink-0">{i + 1}.</span>
                    <span><strong className="text-slate-900">{bold}</strong> — {rest}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                <strong className="text-slate-900">In short:</strong> this is a screening and hypothesis-generation tool. 
                It finds patterns worth investigating further. It is not a diagnostic device, a mechanistic model, 
                or a clinical decision-making system. The drug simulator and recovery time estimates on the 
                clinicians tab are theoretical projections that have not been validated in clinical trials.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900 flex items-center gap-2">
              <Download className="w-5 h-5 text-emerald-600" />
              Download Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a 
                href="/api/download/verification-report" 
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-colors"
                data-testid="link-download-verification"
              >
                <h4 className="font-semibold text-slate-900 mb-1">Verification Report</h4>
                <p className="text-slate-600 text-sm">3-part validation suite results</p>
              </a>
              
              <a 
                href="/api/download/report" 
                className="p-4 bg-slate-50 border border-slate-200 rounded-lg hover:bg-white hover:border-slate-300 transition-colors"
                data-testid="link-download-report"
              >
                <h4 className="font-semibold text-slate-900 mb-1">Findings Report</h4>
                <p className="text-slate-600 text-sm">Full analysis results</p>
              </a>

              <a 
                href="/api/download/user-guide" 
                download
                className="p-4 bg-teal-50 border border-teal-200 rounded-lg hover:bg-white hover:border-teal-300 transition-colors"
                data-testid="link-download-user-guide"
              >
                <h4 className="font-semibold text-teal-700 mb-1">User Guide & Handbook</h4>
                <p className="text-slate-600 text-sm">Complete guide to every feature (save as PDF)</p>
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-900">Key Terms Explained</CardTitle>
            <CardDescription className="text-slate-600">
              Hover over dotted-underlined terms throughout the platform for quick definitions, or browse the full list here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GlossaryPanel />
          </CardContent>
        </Card>

        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">
            PAR(2) Discovery Engine v{APP_VERSION} | 721 analyses | 72 biological contexts | 129 consensus gene pairs
          </p>
        </div>
      </div>
    </div>
  );
}
