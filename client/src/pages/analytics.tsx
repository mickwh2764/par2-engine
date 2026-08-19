import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { ArrowLeft, Globe, BarChart3, Users, Activity, MapPin, Clock, Eye, Download, Trash2, CalendarDays, X, Upload, UserX, Route, Layers, Monitor, Smartphone, Tablet, LogIn, LogOut, TrendingDown, Map, MessageSquare, FlaskConical } from "lucide-react";
import WorldHeatMap from "@/components/WorldHeatMap";
import { Switch } from "@/components/ui/switch";

interface AnalyticsSummary {
  totalVisits: number;
  totalAnalyses: number;
  uniqueCountries: string[];
  visitsByCountry: Record<string, number>;
  visitsByPage: Record<string, number>;
  recentVisits: Array<{
    id: string;
    eventType: string;
    page: string | null;
    country: string | null;
    city: string | null;
    region: string | null;
    referrer: string | null;
    createdAt: string;
  }>;
  visitsByDay: Record<string, number>;
  trafficSources: Record<string, number>;
  visitsByLocation: Record<string, number>;
}

interface AnalyticsSession {
  id: string;
  userAgent: string;
  country: string | null;
  city: string | null;
  pages: string[];
  eventCount: number;
  uploads: number;
  analyses: number;
  firstSeen: string;
  lastSeen: string;
  durationMinutes: number;
  tier: 'bounce' | 'browser' | 'engaged' | 'power';
  isSelf: boolean;
}

interface EngagementSummary {
  bounce: number;
  browser: number;
  engaged: number;
  power: number;
  totalSessions: number;
}

interface EnhancedData {
  sessions: AnalyticsSession[];
  engagement: EngagementSummary;
}

const TIER_CONFIG = {
  bounce: { label: 'Bounce', desc: '1 page only', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/30' },
  browser: { label: 'Browser', desc: '2-5 pages', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  engaged: { label: 'Engaged', desc: '6+ pages', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  power: { label: 'Power User', desc: 'Uploaded data or ran analysis', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
};

const DATE_RANGES = [
  { label: "Today", days: 1 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 14 Days", days: 14 },
  { label: "Last 30 Days", days: 30 },
  { label: "All Time", days: 9999 },
];

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#64748b", "#14b8a6"];

function parseDevice(ua: string): 'Mobile' | 'Tablet' | 'Desktop' {
  if (/Mobile|Android.*Mobile|iPhone|iPod/i.test(ua)) return 'Mobile';
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

function parseBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera';
  if (/Chrome\//i.test(ua) && !/Edg/i.test(ua)) return 'Chrome';
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/HeadlessChrome/i.test(ua)) return 'Bot';
  return 'Other';
}

const DEVICE_ICONS: Record<string, typeof Monitor> = { Desktop: Monitor, Mobile: Smartphone, Tablet: Tablet };
const DEVICE_COLORS: Record<string, string> = { Desktop: '#3b82f6', Mobile: '#10b981', Tablet: '#f59e0b' };

interface AnalysisResult {
  channel: string;
  eigenvalue: number;
  phi1: number;
  phi2: number;
  r2: number;
  stability: string;
  overallConfidence: string;
  sampleCount: number;
}

interface AnalysisEntry {
  id: string;
  fileName: string;
  detectedFormat: string;
  createdAt: string;
  autoSaved: boolean;
  channelsAnalyzed: number;
  totalRecords: number;
  results: AnalysisResult[];
  gearboxAnalysis: {
    clockChannel: string;
    clockEigenvalue: number;
    targetChannel: string;
    targetEigenvalue: number;
    gap: number;
    hierarchyStatus: string;
  } | null;
}

function AnalysisHistory({ password }: { password: string }) {
  const [analyses, setAnalyses] = useState<AnalysisEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!password) return;
    setLoading(true);
    fetch("/api/app/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
      .then(r => r.ok ? r.json() : { analyses: [] })
      .then(d => { setAnalyses(d.analyses || []); setLoading(false); setLoaded(true); })
      .catch(() => { setLoading(false); setLoaded(true); });
  }, [password]);

  if (loading) return (
    <Card data-testid="card-analysis-history">
      <CardContent className="py-6">
        <p className="text-sm text-muted-foreground text-center">Loading analysis history...</p>
      </CardContent>
    </Card>
  );

  if (!loaded || analyses.length === 0) return null;

  return (
    <Card data-testid="card-analysis-history">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity size={16} />
          Analysis Results History
          <span className="text-xs font-normal text-muted-foreground ml-1">
            ({analyses.length} saved)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {analyses.map((a) => (
            <div key={a.id} className="border border-border/30 rounded-lg p-3">
              <div
                className="flex items-center gap-3 text-xs cursor-pointer"
                onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              >
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  a.autoSaved ? 'bg-cyan-500/10 text-cyan-500' : 'bg-purple-500/10 text-purple-500'
                }`}>
                  {a.autoSaved ? 'AUTO' : 'SHARED'}
                </span>
                <span className="font-mono text-slate-300 truncate max-w-48">{a.fileName}</span>
                <span className="text-muted-foreground">{a.channelsAnalyzed} ch</span>
                <span className="text-muted-foreground">{a.totalRecords.toLocaleString()} rec</span>
                <span className="text-muted-foreground">{a.detectedFormat}</span>
                <span className="ml-auto text-muted-foreground whitespace-nowrap">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
                <span className="text-muted-foreground">{expanded === a.id ? '▲' : '▼'}</span>
              </div>
              {expanded === a.id && (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {a.results.map((r, i) => (
                      <div key={i} className="bg-slate-800/50 rounded p-2 text-xs">
                        <div className="font-medium text-slate-200 mb-1">{r.channel}</div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                          <span>|λ|:</span><span className="text-slate-300 font-mono">{r.eigenvalue?.toFixed(4)}</span>
                          <span>φ₁:</span><span className="text-slate-300 font-mono">{r.phi1?.toFixed(4)}</span>
                          <span>φ₂:</span><span className="text-slate-300 font-mono">{r.phi2?.toFixed(4)}</span>
                          <span>R²:</span><span className="text-slate-300 font-mono">{r.r2?.toFixed(4)}</span>
                          <span>N:</span><span className="text-slate-300">{r.sampleCount}</span>
                          <span>Status:</span><span className="text-slate-300">{r.stability}</span>
                          <span>Conf:</span><span className="text-slate-300">{r.overallConfidence}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {a.gearboxAnalysis && (
                    <div className="bg-slate-800/30 rounded p-2 text-xs border border-slate-700/50">
                      <span className="text-muted-foreground">Hierarchy: </span>
                      <span className="text-slate-200">{a.gearboxAnalysis.hierarchyStatus}</span>
                      <span className="text-muted-foreground ml-3">
                        {a.gearboxAnalysis.clockChannel} ({a.gearboxAnalysis.clockEigenvalue?.toFixed(3)})
                        → {a.gearboxAnalysis.targetChannel} ({a.gearboxAnalysis.targetEigenvalue?.toFixed(3)})
                        = gap {a.gearboxAnalysis.gap?.toFixed(3)}
                      </span>
                    </div>
                  )}
                  {!a.autoSaved && (
                    <div className="text-xs text-muted-foreground">
                      Shareable link: <a href={`/shared/${a.id}`} className="text-cyan-400 underline">/shared/{a.id}</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface FeedbackItem {
  id: string;
  type: string;
  message: string;
  email: string | null;
  page: string | null;
  createdAt: string;
}

function FeedbackList({ password }: { password: string }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!password) return;
    setLoading(true);
    fetch("/api/app/feedback-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
      .then(r => r.ok ? r.json() : { feedback: [] })
      .then(d => { setItems(d.feedback || []); setLoading(false); setLoaded(true); })
      .catch(() => { setLoading(false); setLoaded(true); });
  }, [password]);

  if (loading) return (
    <Card data-testid="card-feedback-list">
      <CardContent className="py-6">
        <p className="text-sm text-muted-foreground text-center">Loading feedback...</p>
      </CardContent>
    </Card>
  );

  return (
    <Card data-testid="card-feedback-list">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          User Feedback ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded || items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="border border-border/50 rounded-lg p-3 space-y-1.5" data-testid={`feedback-item-${item.id}`}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                    item.type === 'bug' ? 'bg-red-500/20 text-red-400' :
                    item.type === 'feature' ? 'bg-blue-500/20 text-blue-400' :
                    item.type === 'question' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {item.type}
                  </span>
                  {item.page && <span className="font-mono">{item.page}</span>}
                  <span className="ml-auto whitespace-nowrap">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm">{item.message}</p>
                {item.email && (
                  <p className="text-xs text-muted-foreground">
                    Contact: <a href={`mailto:${item.email}`} className="underline hover:text-foreground">{item.email}</a>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Analytics() {
  const storedPw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("admin_pw") ?? "" : "";
  const [password, setPassword] = useState(storedPw);
  const [authenticated, setAuthenticated] = useState(false);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState("30");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<AnalyticsSummary['recentVisits']>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [excludeSelf, setExcludeSelf] = useState(true);
  const [enhanced, setEnhanced] = useState<EnhancedData | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("admin_pw");
    if (saved && !authenticated) {
      setPassword(saved);
      loadAnalyticsWithPw(saved);
    }
  }, []);

  const loadAnalyticsWithPw = async (pw: string, selfFilter?: boolean) => {
    setLoading(true);
    setError("");
    const filterSelf = selfFilter !== undefined ? selfFilter : excludeSelf;
    try {
      const [summaryRes, enhancedRes] = await Promise.all([
        fetch("/api/app/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw, excludeSelf: filterSelf }),
        }),
        fetch("/api/app/enhanced", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: pw, excludeSelf: filterSelf }),
        }),
      ]);
      if (!summaryRes.ok) {
        try {
          const errBody = await summaryRes.json();
          if (errBody.lockedOut) {
            const mins = Math.ceil((errBody.remainingSeconds || 900) / 60);
            setError(`Too many failed attempts. Locked out for ${mins} minute${mins !== 1 ? 's' : ''}. Try again later.`);
          } else if (errBody.attemptsRemaining !== undefined) {
            setError(`Invalid password. ${errBody.attemptsRemaining} attempt${errBody.attemptsRemaining !== 1 ? 's' : ''} remaining before lockout.`);
          } else {
            setError("Invalid password");
            sessionStorage.removeItem("admin_pw");
          }
        } catch {
          setError("Invalid password");
          sessionStorage.removeItem("admin_pw");
        }
        setLoading(false);
        return;
      }
      const summary = await summaryRes.json();
      setData(summary);
      if (enhancedRes.ok) {
        const enh = await enhancedRes.json();
        setEnhanced(enh);
      }
      setAuthenticated(true);
    } catch {
      setError("Failed to load analytics");
    }
    setLoading(false);
  };

  const loadAnalytics = async (selfFilter?: boolean) => {
    return loadAnalyticsWithPw(password, selfFilter);
  };

  const clearAnalytics = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/app/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setData({
          totalVisits: 0,
          totalAnalyses: 0,
          uniqueCountries: [],
          visitsByCountry: {},
          visitsByLocation: {},
          visitsByPage: {},
          recentVisits: [],
          visitsByDay: {},
          trafficSources: {},
        });
        setEnhanced({ sessions: [], engagement: { bounce: 0, browser: 0, engaged: 0, power: 0, totalSessions: 0 } });
        setSelectedDay(null);
        setConfirmClear(false);
      }
    } catch {
      setError("Failed to clear analytics");
    }
    setClearing(false);
  };

  const sortedCountries = data
    ? Object.entries(data.visitsByCountry).sort((a, b) => b[1] - a[1])
    : [];

  const sortedPages = data
    ? Object.entries(data.visitsByPage).sort((a, b) => b[1] - a[1])
    : [];

  const rangeDays = parseInt(dateRange);

  const filteredDays = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.visitsByDay).sort((a, b) => a[0].localeCompare(b[0]));
    if (rangeDays === 1) {
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = entries.find(([d]) => d === today);
      return todayEntry ? [{ day: todayEntry[0].slice(5), fullDay: todayEntry[0], visits: todayEntry[1] }] : [];
    }
    return entries.slice(-rangeDays).map(([day, count]) => ({
      day: day.slice(5),
      fullDay: day,
      visits: count,
    }));
  }, [data, rangeDays]);

  const countryChartData = useMemo(() => {
    return sortedCountries.slice(0, 10).map(([country, count]) => ({ country, visits: count }));
  }, [sortedCountries]);

  const pageChartData = useMemo(() => {
    return sortedPages.slice(0, 10).map(([page, count]) => ({
      page: page.length > 20 ? page.slice(0, 20) + "…" : page,
      fullPage: page,
      visits: count,
    }));
  }, [sortedPages]);

  const loadDayEvents = useCallback(async (day: string) => {
    setSelectedDay(day);
    setDayLoading(true);
    try {
      const res = await fetch("/api/app/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, day }),
      });
      if (res.ok) {
        const result = await res.json();
        setDayEvents(result.events || []);
      }
    } catch {
      setDayEvents([]);
    }
    setDayLoading(false);
  }, [password]);

  const handleBarClick = useCallback((barData: any) => {
    if (barData?.activePayload?.[0]?.payload?.fullDay) {
      loadDayEvents(barData.activePayload[0].payload.fullDay);
    }
  }, [loadDayEvents]);

  const exportCSV = () => {
    if (!data) return;
    const rows = ["Date,Visits"];
    Object.entries(data.visitsByDay).sort((a, b) => a[0].localeCompare(b[0])).forEach(([d, c]) => rows.push(`${d},${c}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "par2_analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-analytics-title">
              <BarChart3 size={20} />
              Usage Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your admin password to view usage analytics.
            </p>
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadAnalytics()}
              data-testid="input-analytics-password"
            />
            {error && <p className="text-sm text-red-500" data-testid="text-analytics-error">{error}</p>}
            <Button onClick={() => loadAnalytics()} disabled={loading} className="w-full" data-testid="button-analytics-login">
              {loading ? "Loading..." : "View Analytics"}
            </Button>
            <Link href="/">
              <Button variant="ghost" className="w-full gap-2" data-testid="button-analytics-back">
                <ArrowLeft size={14} />
                Back to Home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-analytics-heading">
              <BarChart3 size={24} />
              PAR(2) Discovery — Usage Analytics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Private dashboard showing how your tool is being used worldwide.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 mr-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50" data-testid="toggle-exclude-self">
              <UserX size={14} className={excludeSelf ? 'text-amber-400' : 'text-slate-500'} />
              <span className="text-xs text-slate-400 whitespace-nowrap">Exclude my traffic</span>
              <Switch
                checked={excludeSelf}
                onCheckedChange={(checked) => {
                  setExcludeSelf(checked);
                  loadAnalytics(checked);
                }}
                data-testid="switch-exclude-self"
              />
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} data-testid="button-export-csv">
              <Download size={14} />
              Export CSV
            </Button>
            {!confirmClear ? (
              <Button variant="outline" size="sm" className="gap-2 text-red-500 hover:text-red-400 hover:border-red-500/50" onClick={() => setConfirmClear(true)} data-testid="button-clear-analytics">
                <Trash2 size={14} />
                Clear All
              </Button>
            ) : (
              <div className="flex items-center gap-1">
                <Button variant="destructive" size="sm" className="gap-1" onClick={clearAnalytics} disabled={clearing} data-testid="button-confirm-clear">
                  {clearing ? "Clearing..." : "Confirm Clear"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)} data-testid="button-cancel-clear">
                  <X size={14} />
                </Button>
              </div>
            )}
            <Link href="/">
              <Button variant="outline" className="gap-2" data-testid="button-back-home">
                <ArrowLeft size={14} />
                Home
              </Button>
            </Link>
          </div>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card data-testid="card-total-visits">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Eye size={20} className="text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.totalVisits.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Page Views</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-total-analyses">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Activity size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.totalAnalyses.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Analyses Run</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-countries">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Globe size={20} className="text-purple-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{data.uniqueCountries.length}</p>
                      <p className="text-xs text-muted-foreground">Countries</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-unique-sessions">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <Users size={20} className="text-orange-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {enhanced ? enhanced.sessions.length : new Set(data.recentVisits.map(v => v.createdAt.split('T')[0])).size}
                      </p>
                      <p className="text-xs text-muted-foreground">{enhanced ? 'Total Sessions' : 'Active Days'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card data-testid="card-bounce-rate">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <TrendingDown size={20} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {enhanced && enhanced.engagement.totalSessions > 0
                          ? ((enhanced.engagement.bounce / enhanced.engagement.totalSessions) * 100).toFixed(0) + '%'
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Bounce Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-daily-chart">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock size={16} />
                    Daily Visits
                    <span className="text-xs font-normal text-muted-foreground ml-1">(click a bar to see details)</span>
                  </CardTitle>
                  <Select value={dateRange} onValueChange={setDateRange} data-testid="select-date-range">
                    <SelectTrigger className="w-[150px]" data-testid="select-date-range-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGES.map((r) => (
                        <SelectItem key={r.days} value={String(r.days)} data-testid={`select-range-${r.days}`}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredDays.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                    <BarChart data={filteredDays} margin={{ top: 5, right: 10, bottom: 20, left: 10 }} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="day"
                        tick={{ fill: "#64748b", fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDay || ""}
                      />
                      <Bar dataKey="visits" radius={[3, 3, 0, 0]} name="Visits">
                        {filteredDays.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fullDay === selectedDay ? "#f59e0b" : "#3b82f6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No visit data available</p>
                )}
              </CardContent>
            </Card>

            {selectedDay && (
              <Card data-testid="card-daily-detail">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CalendarDays size={16} />
                      Activity for {selectedDay}
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''})
                      </span>
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)} data-testid="button-close-daily">
                      <X size={14} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {dayLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Loading events...</p>
                  ) : dayEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No events recorded for this day.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {dayEvents.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/30 last:border-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            event.eventType === 'page_view' ? 'bg-blue-500/10 text-blue-500' :
                            event.eventType === 'analysis_run' ? 'bg-emerald-500/10 text-emerald-500' :
                            'bg-gray-500/10 text-gray-400'
                          }`}>
                            {event.eventType === 'page_view' ? 'VIEW' : event.eventType === 'analysis_run' ? 'ANALYSIS' : event.eventType.toUpperCase()}
                          </span>
                          <span className="font-mono text-muted-foreground truncate max-w-40">{event.page || '/'}</span>
                          {event.country && (
                            <span className="text-muted-foreground">
                              {event.city ? `${event.city}, ` : ''}{event.country}
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground whitespace-nowrap">
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {enhanced && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card data-testid="card-engagement-tiers">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers size={16} />
                      Engagement Depth
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({enhanced.engagement.totalSessions} sessions)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {enhanced.engagement.totalSessions === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No sessions recorded yet</p>
                    ) : (
                      <div className="space-y-3">
                        {(['power', 'engaged', 'browser', 'bounce'] as const).map(tier => {
                          const cfg = TIER_CONFIG[tier];
                          const count = enhanced.engagement[tier];
                          const pct = enhanced.engagement.totalSessions > 0
                            ? ((count / enhanced.engagement.totalSessions) * 100).toFixed(0) : '0';
                          return (
                            <div key={tier} className="space-y-1" data-testid={`tier-${tier}`}>
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{cfg.desc}</span>
                                </div>
                                <span className="font-mono text-slate-300">{count} ({pct}%)</span>
                              </div>
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    tier === 'power' ? 'bg-amber-500' :
                                    tier === 'engaged' ? 'bg-emerald-500' :
                                    tier === 'browser' ? 'bg-blue-500' : 'bg-slate-500'
                                  }`}
                                  style={{ width: `${Math.max(2, parseFloat(pct))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card data-testid="card-session-stats">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Route size={16} />
                      Session Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {enhanced.sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No sessions recorded yet</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-white">{enhanced.sessions.length}</p>
                            <p className="text-xs text-muted-foreground">Total Sessions</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-white">
                              {enhanced.sessions.length > 0
                                ? (enhanced.sessions.reduce((a, s) => a + s.pages.length, 0) / enhanced.sessions.length).toFixed(1)
                                : '0'}
                            </p>
                            <p className="text-xs text-muted-foreground">Avg Pages/Session</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-white">
                              {enhanced.sessions.length > 0
                                ? Math.round(enhanced.sessions.reduce((a, s) => a + s.durationMinutes, 0) / enhanced.sessions.length)
                                : 0} min
                            </p>
                            <p className="text-xs text-muted-foreground">Avg Duration</p>
                          </div>
                          <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                            <p className="text-2xl font-bold text-white">
                              {enhanced.sessions.reduce((a, s) => a + s.uploads, 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">Total Uploads</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {enhanced && enhanced.sessions.length > 0 && (
              <Card data-testid="card-visitor-sessions">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Route size={16} />
                    Visitor Sessions
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      (most recent {Math.min(enhanced.sessions.length, 100)})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                    {enhanced.sessions.map((session) => {
                      const cfg = TIER_CONFIG[session.tier];
                      const isExpanded = expandedSession === session.id;
                      return (
                        <div key={session.id} className="border border-border/30 rounded-lg">
                          <div
                            className="flex items-center gap-3 text-xs p-3 cursor-pointer hover:bg-slate-800/30 transition"
                            onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                            data-testid={`session-row-${session.id}`}
                          >
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            <span className="text-slate-300 shrink-0">
                              {session.pages.length} page{session.pages.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-muted-foreground shrink-0">
                              {session.durationMinutes > 0 ? `${session.durationMinutes} min` : '<1 min'}
                            </span>
                            {session.uploads > 0 && (
                              <span className="text-amber-400 shrink-0">
                                {session.uploads} upload{session.uploads !== 1 ? 's' : ''}
                              </span>
                            )}
                            {session.country && (
                              <span className="text-muted-foreground shrink-0">
                                {session.city ? `${session.city}, ` : ''}{session.country}
                              </span>
                            )}
                            <span className="ml-auto text-muted-foreground whitespace-nowrap shrink-0">
                              {new Date(session.firstSeen).toLocaleDateString()} {new Date(session.firstSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {session.pages.map((page, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 text-[11px]">
                                    {i > 0 && <span className="text-slate-600">→</span>}
                                    <span className="font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">{page}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-4 text-[11px] text-muted-foreground">
                                <span>{session.eventCount} total events</span>
                                <span>UA: {session.userAgent.slice(0, 60)}...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {enhanced && enhanced.sessions.length > 0 && (() => {
              const deviceCounts: Record<string, number> = {};
              const browserCounts: Record<string, number> = {};
              const entryCounts: Record<string, number> = {};
              const exitCounts: Record<string, number> = {};
              const hourlyCounts: number[] = new Array(24).fill(0);

              enhanced.sessions.forEach(s => {
                const device = parseDevice(s.userAgent);
                deviceCounts[device] = (deviceCounts[device] || 0) + 1;
                const browser = parseBrowser(s.userAgent);
                browserCounts[browser] = (browserCounts[browser] || 0) + 1;
                if (s.pages.length > 0) {
                  const entry = s.pages[0];
                  entryCounts[entry] = (entryCounts[entry] || 0) + 1;
                  const exit = s.pages[s.pages.length - 1];
                  exitCounts[exit] = (exitCounts[exit] || 0) + 1;
                }
                try {
                  const hour = new Date(s.firstSeen).getHours();
                  hourlyCounts[hour]++;
                } catch {}
              });

              const deviceData = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
              const browserData = Object.entries(browserCounts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
              const entryData = Object.entries(entryCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
              const exitData = Object.entries(exitCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
              const hourlyData = hourlyCounts.map((count, hour) => ({
                hour: `${hour.toString().padStart(2, '0')}:00`,
                sessions: count,
              }));
              const totalSessions = enhanced.sessions.length;

              return (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card data-testid="card-device-breakdown">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Monitor size={16} />
                          Device Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {deviceData.map(d => {
                            const pct = ((d.value / totalSessions) * 100).toFixed(0);
                            const DevIcon = DEVICE_ICONS[d.name] || Monitor;
                            return (
                              <div key={d.name} className="space-y-1" data-testid={`device-${d.name.toLowerCase()}`}>
                                <div className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <DevIcon size={14} style={{ color: DEVICE_COLORS[d.name] || '#64748b' }} />
                                    <span>{d.name}</span>
                                  </div>
                                  <span className="font-mono text-muted-foreground">{d.value} ({pct}%)</span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${Math.max(3, parseFloat(pct))}%`, backgroundColor: DEVICE_COLORS[d.name] || '#64748b' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-browser-breakdown">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Globe size={16} />
                          Browser Breakdown
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {browserData.map((b, i) => {
                            const pct = ((b.value / totalSessions) * 100).toFixed(0);
                            return (
                              <div key={b.name} className="flex items-center justify-between text-sm" data-testid={`browser-${b.name.toLowerCase()}`}>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                  <span>{b.name}</span>
                                </div>
                                <span className="font-mono text-muted-foreground">{b.value} ({pct}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-hourly-pattern">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock size={16} />
                          Hourly Traffic Pattern
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={180} minWidth={1} minHeight={1}>
                          <BarChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 20, left: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 9 }} angle={-45} textAnchor="end" height={40} interval={2} />
                            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} width={25} />
                            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }} />
                            <Bar dataKey="sessions" fill="#8b5cf6" radius={[2, 2, 0, 0]} name="Sessions" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card data-testid="card-entry-pages">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <LogIn size={16} />
                          Top Entry Pages
                          <span className="text-xs font-normal text-muted-foreground ml-1">where visitors land first</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {entryData.map(([page, count]) => {
                            const pct = ((count / totalSessions) * 100).toFixed(0);
                            return (
                              <div key={page} className="flex items-center justify-between text-sm">
                                <span className="font-mono text-xs truncate max-w-48">{page || '/'}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(4, parseFloat(pct))}%` }} />
                                  </div>
                                  <span className="font-mono text-muted-foreground text-xs w-16 text-right">{count} ({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    <Card data-testid="card-exit-pages">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <LogOut size={16} />
                          Top Exit Pages
                          <span className="text-xs font-normal text-muted-foreground ml-1">where visitors leave</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {exitData.map(([page, count]) => {
                            const pct = ((count / totalSessions) * 100).toFixed(0);
                            return (
                              <div key={page} className="flex items-center justify-between text-sm">
                                <span className="font-mono text-xs truncate max-w-48">{page || '/'}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.max(4, parseFloat(pct))}%` }} />
                                  </div>
                                  <span className="font-mono text-muted-foreground text-xs w-16 text-right">{count} ({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              );
            })()}

            <Card data-testid="card-world-map">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Map size={16} />
                  Global Visitor Map
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WorldHeatMap visitsByCountry={data.visitsByCountry} />
                {data.visitsByLocation && Object.keys(data.visitsByLocation).length > 0 && (
                  <div className="mt-4 max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 text-muted-foreground">
                          <th className="text-left py-1.5 px-2">Country</th>
                          <th className="text-left py-1.5 px-2">Region</th>
                          <th className="text-left py-1.5 px-2">City</th>
                          <th className="text-right py-1.5 px-2">Visits</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(data.visitsByLocation)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 30)
                          .map(([key, count]) => {
                            const [country, region, city] = key.split('|');
                            return (
                              <tr key={key} className="border-b border-border/10 hover:bg-accent/30" data-testid={`row-location-${key}`}>
                                <td className="py-1 px-2 font-medium">{country}</td>
                                <td className="py-1 px-2 text-muted-foreground">{region || '—'}</td>
                                <td className="py-1 px-2 text-muted-foreground">{city || '—'}</td>
                                <td className="py-1 px-2 text-right tabular-nums">{count}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card data-testid="card-visits-by-country">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin size={16} />
                    Visits by Country (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {countryChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No location data yet</p>
                  ) : (
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-1">
                        <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                          <BarChart data={countryChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                            <YAxis type="category" dataKey="country" tick={{ fill: "#64748b", fontSize: 11 }} width={55} />
                            <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
                            <Bar dataKey="visits" fill="#8b5cf6" radius={[0, 3, 3, 0]} name="Visits" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-32 flex-shrink-0">
                        <ResponsiveContainer width="100%" height={180} minWidth={1} minHeight={1}>
                          <PieChart>
                            <Pie data={countryChartData} dataKey="visits" nameKey="country" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                              {countryChartData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card data-testid="card-visits-by-page">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 size={16} />
                    Most Visited Pages (Top 10)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pageChartData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No page data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
                      <BarChart data={pageChartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="page" tick={{ fill: "#64748b", fontSize: 10 }} width={75} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: "8px", fontSize: "12px" }}
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullPage || ""}
                        />
                        <Bar dataKey="visits" fill="#10b981" radius={[0, 3, 3, 0]} name="Visits" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {data.trafficSources && Object.keys(data.trafficSources).length > 0 && (
              <Card data-testid="card-traffic-sources">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe size={16} />
                    Traffic Sources
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({Object.values(data.trafficSources).reduce((a, b) => a + b, 0)} tracked visits)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(data.trafficSources)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 15)
                      .map(([source, count]) => {
                        const total = Object.values(data.trafficSources).reduce((a, b) => a + b, 0);
                        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                        const isTwitter = source.includes('t.co') || source === 'twitter' || source === 'x';
                        const isGoogle = source.includes('google');
                        const isLinkedIn = source.includes('linkedin');
                        const isGitHub = source.includes('github');
                        return (
                          <div key={source} className="flex items-center gap-3 text-sm">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              isTwitter ? 'bg-sky-500/10 text-sky-400' :
                              isGoogle ? 'bg-red-500/10 text-red-400' :
                              isLinkedIn ? 'bg-blue-500/10 text-blue-400' :
                              isGitHub ? 'bg-purple-500/10 text-purple-400' :
                              'bg-slate-500/10 text-slate-400'
                            }`}>
                              {isTwitter ? 'Twitter/X' : isGoogle ? 'Google' : isLinkedIn ? 'LinkedIn' : isGitHub ? 'GitHub' : 'Web'}
                            </span>
                            <span className="text-slate-300 font-mono text-xs truncate max-w-48">{source}</span>
                            <div className="flex-1 mx-2">
                              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-cyan-500 rounded-full"
                                  style={{ width: `${Math.max(4, parseFloat(pct))}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-muted-foreground text-xs whitespace-nowrap">{count} ({pct}%)</span>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity size={16} />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {data.recentVisits.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/30 last:border-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        event.eventType === 'page_view' ? 'bg-blue-500/10 text-blue-500' :
                        event.eventType === 'analysis_run' ? 'bg-emerald-500/10 text-emerald-500' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        {event.eventType === 'page_view' ? 'VIEW' : event.eventType === 'analysis_run' ? 'ANALYSIS' : event.eventType.toUpperCase()}
                      </span>
                      <span className="font-mono text-muted-foreground truncate max-w-32">{event.page || '/'}</span>
                      {event.country && (
                        <span className="text-muted-foreground">
                          {event.city ? `${event.city}, ` : ''}{event.country}
                        </span>
                      )}
                      <span className="ml-auto text-muted-foreground whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {data.recentVisits.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">No activity recorded yet. Visits will appear here once users start accessing your tool.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <AnalysisHistory password={password} />

            <FeedbackList password={password} />

            {/* Upload Activity */}
            {(() => {
              const uploads = data.recentVisits
                .filter(e => e.eventType === 'file_upload')
                .map(e => {
                  let meta: any = {};
                  try { meta = e.referrer ? JSON.parse(e.referrer) : {}; } catch {}
                  return { ...e, meta };
                });
              return uploads.length > 0 ? (
                <Card data-testid="card-upload-activity">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Upload size={16} />
                      File Upload Activity
                      <span className="text-xs font-normal text-muted-foreground ml-1">
                        ({uploads.length} upload{uploads.length !== 1 ? 's' : ''})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {uploads.map((event) => (
                        <div key={event.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/30 last:border-0">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-500">
                            UPLOAD
                          </span>
                          <span className="font-mono text-slate-300 truncate max-w-48">
                            {event.meta.fileName || 'Unknown file'}
                          </span>
                          {event.meta.fileSize && (
                            <span className="text-muted-foreground">
                              {(event.meta.fileSize / 1024).toFixed(1)} KB
                            </span>
                          )}
                          {event.meta.geneCount && (
                            <span className="text-muted-foreground">
                              {event.meta.geneCount.toLocaleString()} genes
                            </span>
                          )}
                          {event.meta.channelCount && (
                            <span className="text-muted-foreground">
                              {event.meta.channelCount} channels
                            </span>
                          )}
                          {event.meta.totalRecords && (
                            <span className="text-muted-foreground">
                              {event.meta.totalRecords.toLocaleString()} records
                            </span>
                          )}
                          {event.meta.timepointCount && (
                            <span className="text-muted-foreground">
                              {event.meta.timepointCount} timepoints
                            </span>
                          )}
                          {event.country && (
                            <span className="text-muted-foreground">
                              {event.city ? `${event.city}, ` : ''}{event.country}
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground whitespace-nowrap">
                            {new Date(event.createdAt).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {/* Discovery Engine Activity */}
            {(() => {
              const deUploads = data.recentVisits
                .filter((e: any) => e.eventType === 'file_upload' && e.page === '/discovery-engine')
                .map((e: any) => {
                  let meta: any = {};
                  try { meta = e.referrer ? JSON.parse(e.referrer) : {}; } catch {}
                  return { ...e, meta };
                });

              const datasetRuns = data.recentVisits
                .filter((e: any) => e.eventType === 'dataset_run')
                .map((e: any) => {
                  let meta: any = {};
                  try { meta = e.referrer ? JSON.parse(e.referrer) : {}; } catch {}
                  return { ...e, meta };
                });

              const datasetCounts: Record<string, { label: string; count: number; last: string }> = {};
              for (const run of datasetRuns) {
                const key = run.meta.datasetKey || 'unknown';
                if (!datasetCounts[key]) {
                  datasetCounts[key] = { label: run.meta.datasetLabel || key, count: 0, last: run.createdAt };
                }
                datasetCounts[key].count++;
                if (new Date(run.createdAt) > new Date(datasetCounts[key].last)) {
                  datasetCounts[key].last = run.createdAt;
                }
              }

              const hasActivity = deUploads.length > 0 || datasetRuns.length > 0;
              if (!hasActivity) return null;

              return (
                <Card data-testid="card-discovery-engine-activity">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FlaskConical size={16} />
                      Discovery Engine Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* Summary row */}
                    <div className="flex gap-3">
                      <div className="flex-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 text-center">
                        <div className="text-xl font-bold text-cyan-400">{deUploads.length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">User Uploads</div>
                      </div>
                      <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-center">
                        <div className="text-xl font-bold text-emerald-400">{datasetRuns.length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Preloaded Runs</div>
                      </div>
                      <div className="flex-1 rounded-lg bg-slate-500/10 border border-slate-500/20 px-3 py-2 text-center">
                        <div className="text-xl font-bold text-slate-300">{Object.keys(datasetCounts).length}</div>
                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Distinct Datasets</div>
                      </div>
                    </div>

                    {/* Dataset breakdown */}
                    {Object.keys(datasetCounts).length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Preloaded datasets run (all time)</p>
                        <div className="space-y-1">
                          {Object.entries(datasetCounts)
                            .sort((a, b) => b[1].count - a[1].count)
                            .map(([key, info]) => (
                            <div key={key} className="flex items-center gap-2 text-xs py-1 border-b border-border/20 last:border-0">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 tabular-nums min-w-[28px] text-center">
                                {info.count}×
                              </span>
                              <span className="text-slate-300 flex-1">{info.label}</span>
                              <span className="text-muted-foreground whitespace-nowrap">
                                last {new Date(info.last).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* User uploads log */}
                    {deUploads.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">User-uploaded files</p>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {deUploads.map((event: any) => (
                            <div key={event.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/20 last:border-0">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/10 text-cyan-400">UPLOAD</span>
                              <span className="font-mono text-slate-300 truncate max-w-40">{event.meta.fileName || 'Unknown file'}</span>
                              {event.meta.geneCount && <span className="text-muted-foreground">{event.meta.geneCount.toLocaleString()} genes</span>}
                              {event.meta.timepointCount && <span className="text-muted-foreground">{event.meta.timepointCount} timepoints</span>}
                              {event.country && <span className="text-muted-foreground">{event.city ? `${event.city}, ` : ''}{event.country}</span>}
                              <span className="ml-auto text-muted-foreground whitespace-nowrap">{new Date(event.createdAt).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
