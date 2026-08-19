import { useState, useMemo, useCallback, useRef } from "react";
import { APP_VERSION } from "@/lib/version";
import { Link } from "wouter";
import Papa from "papaparse";
import JSZip from "jszip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, ReferenceLine, Area, AreaChart, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import {
  ArrowLeft, Activity, Watch, Heart, Droplets, Moon, Sun,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, Target,
  Smartphone, Upload, Zap, ShieldAlert, Lightbulb, FlaskConical,
  Stethoscope, ArrowRight, Info, BrainCircuit, FileUp, Loader2,
  Download, X, BarChart3, Shield, Layers, Trash2, Lock
} from "lucide-react";

type SignalType = "ecg_waveform" | "heart_rate" | "hrv" | "cgm" | "activity" | "temperature" | "spo2" | "generic";
type DeviceFormat = "apple_health" | "fitbit" | "garmin" | "dexcom" | "oura" | "libre" | "generic";

interface SignalInfo {
  type: SignalType;
  label: string;
  icon: typeof Heart;
  color: string;
  circadianRelevance: "high" | "medium" | "low" | "none";
  idealSampling: string;
  minDays: number;
  description: string;
  whatItTells: string[];
  whatItDoesnt: string[];
  resampleStrategy: string;
}

const SIGNAL_INFO: Record<SignalType, SignalInfo> = {
  ecg_waveform: {
    type: "ecg_waveform", label: "ECG Waveform", icon: Heart, color: "text-red-400",
    circadianRelevance: "none",
    idealSampling: "N/A (sub-second waveform)",
    minDays: 0,
    description: "Raw electrical heart signal sampled at high frequency (100-512 Hz). This captures the shape of individual heartbeats, not circadian patterns.",
    whatItTells: [
      "Your heart beats in a regular, repeating pattern (high |λ| expected)",
      "The AR(2) model can capture the rhythmic regularity of the waveform",
      "How consistent the beat-to-beat pattern is"
    ],
    whatItDoesnt: [
      "Anything about your circadian rhythm — this is the wrong timescale entirely",
      "Whether your heart is healthy — this is not a diagnostic tool",
      "Anything clinically actionable about cardiac function"
    ],
    resampleStrategy: "Derive hourly average heart rate or HRV from the raw ECG, then analyze the derived series"
  },
  heart_rate: {
    type: "heart_rate", label: "Heart Rate", icon: Heart, color: "text-red-400",
    circadianRelevance: "high",
    idealSampling: "Every 5-15 minutes over 3+ days",
    minDays: 3,
    description: "Heart rate averaged over intervals. When sampled across multiple days, this directly reflects circadian autonomic regulation.",
    whatItTells: [
      "How persistent your heart rate's day/night rhythm is (|λ|)",
      "Whether your autonomic nervous system follows a consistent daily pattern",
      "How your circadian heart rate persistence compares across days"
    ],
    whatItDoesnt: [
      "Whether your heart is healthy — consult a cardiologist for that",
      "Your disease risk — no validated clinical thresholds exist",
      "What your tissue-level clock genes are doing"
    ],
    resampleStrategy: "Resample to hourly averages for circadian-scale analysis"
  },
  hrv: {
    type: "hrv", label: "Heart Rate Variability", icon: Activity, color: "text-purple-400",
    circadianRelevance: "high",
    idealSampling: "Every 5-30 minutes over 3+ days",
    minDays: 3,
    description: "HRV reflects autonomic balance and is known to follow circadian patterns. Multi-day HRV is one of the best wearable proxies for circadian regulation.",
    whatItTells: [
      "How persistent your autonomic circadian rhythm is (|λ|)",
      "Whether your HRV follows a consistent day/night pattern",
      "Changes in circadian regularity over time (self-tracking)"
    ],
    whatItDoesnt: [
      "Your stress level in clinical terms",
      "Whether you need to change your sleep schedule",
      "Anything about tissue-level gene expression"
    ],
    resampleStrategy: "Resample to hourly averages for circadian-scale analysis"
  },
  cgm: {
    type: "cgm", label: "Continuous Glucose", icon: Droplets, color: "text-cyan-400",
    circadianRelevance: "high",
    idealSampling: "Every 5-15 minutes over 3+ days",
    minDays: 3,
    description: "CGM data directly reflects metabolic circadian regulation. Glucose follows a well-documented ~24h rhythm driven by insulin sensitivity, cortisol, and melatonin.",
    whatItTells: [
      "How persistent your glucose circadian rhythm is (|λ|)",
      "Whether your metabolic system follows a consistent daily pattern",
      "The implied oscillation period of your glucose rhythm"
    ],
    whatItDoesnt: [
      "Whether you are diabetic or pre-diabetic — see an endocrinologist",
      "What you should eat or when — this is not a dietary tool",
      "Whether your tissue clock genes are functioning properly"
    ],
    resampleStrategy: "Resample to hourly averages for circadian-scale analysis"
  },
  activity: {
    type: "activity", label: "Activity / Steps", icon: Zap, color: "text-yellow-400",
    circadianRelevance: "medium",
    idealSampling: "Hourly over 7+ days",
    minDays: 5,
    description: "Activity and step counts reflect rest-activity rhythms, which are influenced by circadian timing but also by behavior and schedules.",
    whatItTells: [
      "How regular your daily activity pattern is (|λ|)",
      "Whether you follow a consistent rest-activity cycle"
    ],
    whatItDoesnt: [
      "Whether your circadian clock is functioning — activity is heavily behavioral",
      "Your fitness level or exercise adequacy",
      "Anything about endogenous circadian rhythm (confounded by voluntary activity)"
    ],
    resampleStrategy: "Aggregate to hourly totals for circadian-scale analysis"
  },
  temperature: {
    type: "temperature", label: "Skin Temperature", icon: Sun, color: "text-orange-400",
    circadianRelevance: "high",
    idealSampling: "Every 5-15 minutes over 3+ days",
    minDays: 3,
    description: "Skin/core temperature has one of the strongest known circadian rhythms, driven by the SCN master clock.",
    whatItTells: [
      "How persistent your temperature circadian rhythm is (|λ|)",
      "Temperature rhythm strength is a well-established circadian marker"
    ],
    whatItDoesnt: [
      "Whether you are sick — see a doctor for fever assessment",
      "Your core body temperature accurately (skin ≠ core)"
    ],
    resampleStrategy: "Resample to hourly averages for circadian-scale analysis"
  },
  spo2: {
    type: "spo2", label: "Blood Oxygen (SpO2)", icon: Droplets, color: "text-blue-400",
    circadianRelevance: "low",
    idealSampling: "Every 15-60 minutes over 3+ days",
    minDays: 3,
    description: "SpO2 has weak circadian variation in healthy individuals. Mainly useful for detecting sleep apnea patterns.",
    whatItTells: [
      "Whether there are periodic dips (possible sleep-disordered breathing)",
      "Nocturnal vs daytime SpO2 stability"
    ],
    whatItDoesnt: [
      "Circadian clock function — SpO2 variation is mostly respiratory, not circadian",
      "Whether you have sleep apnea — consult a sleep specialist"
    ],
    resampleStrategy: "Resample to hourly averages"
  },
  generic: {
    type: "generic", label: "Generic Time Series", icon: Activity, color: "text-slate-500",
    circadianRelevance: "medium",
    idealSampling: "Regular intervals over 3+ days",
    minDays: 3,
    description: "A numeric time series without a recognized format. AR(2) can measure temporal persistence, but interpretation depends on what the data represents.",
    whatItTells: [
      "How temporally persistent the signal is (|λ|)",
      "Whether the signal has rhythmic/oscillatory structure"
    ],
    whatItDoesnt: [
      "What the persistence means biologically without knowing the signal source",
      "Anything clinical without proper context"
    ],
    resampleStrategy: "Attempt hourly resampling if timestamps are detected"
  }
};

const REFERENCE_RANGES: { signal: string; healthy: [number, number]; moderate: [number, number]; disrupted: [number, number]; source: string }[] = [
  { signal: "CGM (hourly)", healthy: [0.75, 0.92], moderate: [0.55, 0.75], disrupted: [0.2, 0.55], source: "Illustrative ranges from synthetic modeling — not clinically validated" },
  { signal: "Heart Rate (hourly)", healthy: [0.70, 0.90], moderate: [0.50, 0.70], disrupted: [0.2, 0.50], source: "Illustrative ranges — no clinical reference population exists" },
  { signal: "HRV (hourly)", healthy: [0.65, 0.88], moderate: [0.45, 0.65], disrupted: [0.15, 0.45], source: "Illustrative ranges — research use only" },
  { signal: "Temperature (hourly)", healthy: [0.80, 0.95], moderate: [0.60, 0.80], disrupted: [0.3, 0.60], source: "Illustrative ranges — skin temperature, not core" },
];

function generateSyntheticCGM(type: "healthy" | "prediabetic" | "disrupted", hours: number = 72): number[] {
  const samples: number[] = [];
  const samplesPerHour = 4;
  const seed = type === "healthy" ? 42 : type === "prediabetic" ? 137 : 256;
  for (let i = 0; i < hours * samplesPerHour; i++) {
    const hour = (i / samplesPerHour) % 24;
    let base: number, amp: number, noise: number;
    if (type === "healthy") { base = 95; amp = 12; noise = 4; }
    else if (type === "prediabetic") { base = 118; amp = 8; noise = 15; }
    else { base = 135; amp = 4; noise = 22; }
    const circadian = amp * Math.sin(2 * Math.PI * (hour - 6) / 24);
    const meal = ((hour >= 7 && hour < 9) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20)) ? amp * 0.7 : 0;
    const x = Math.sin((seed + i) * 12.9898 + 78.233) * 43758.5453;
    const rand = (x - Math.floor(x) - 0.5) * noise;
    samples.push(Math.max(60, base + circadian + meal + rand));
  }
  return samples;
}

function computeAR2(series: number[]): { phi1: number; phi2: number; eigenvalue: number; r2: number; impliedPeriod: number | null } {
  const n = series.length;
  if (n < 5) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, impliedPeriod: null };
  const Y = series.slice(2);
  const Y1 = series.slice(1, n - 1);
  const Y2 = series.slice(0, n - 2);
  let s11 = 0, s22 = 0, s12 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < Y.length; i++) {
    s11 += Y1[i] * Y1[i]; s22 += Y2[i] * Y2[i]; s12 += Y1[i] * Y2[i];
    sy1 += Y[i] * Y1[i]; sy2 += Y[i] * Y2[i];
  }
  const denom = s11 * s22 - s12 * s12;
  if (Math.abs(denom) < 1e-10) return { phi1: 0, phi2: 0, eigenvalue: 0, r2: 0, impliedPeriod: null };
  const phi1 = (sy1 * s22 - sy2 * s12) / denom;
  const phi2 = (sy2 * s11 - sy1 * s12) / denom;
  const disc = phi1 * phi1 + 4 * phi2;
  let eigenvalue: number;
  let impliedPeriod: number | null = null;
  if (disc >= 0) {
    const l1 = (phi1 + Math.sqrt(disc)) / 2;
    const l2 = (phi1 - Math.sqrt(disc)) / 2;
    eigenvalue = Math.max(Math.abs(l1), Math.abs(l2));
  } else {
    eigenvalue = Math.sqrt(-phi2);
    const theta = Math.atan2(Math.sqrt(-disc), phi1);
    if (theta > 0) impliedPeriod = (2 * Math.PI) / theta;
  }
  const predicted = Y1.map((y1, i) => phi1 * y1 + phi2 * Y2[i]);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  const ssTot = Y.reduce((sum, y) => sum + (y - meanY) ** 2, 0);
  const ssRes = Y.reduce((sum, y, i) => sum + (y - predicted[i]) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  return { phi1, phi2, eigenvalue, r2, impliedPeriod };
}

function detectSignalType(headers: string[], values: number[], sampleCount: number, samplingIntervalMs: number | null): SignalType {
  const joined = headers.map(h => h.toLowerCase()).join(" ");
  if (joined.includes("ecg") || joined.includes("electrocardiogram")) {
    if (samplingIntervalMs && samplingIntervalMs < 50) return "ecg_waveform";
    if (sampleCount > 5000 && samplingIntervalMs && samplingIntervalMs < 500) return "ecg_waveform";
  }
  if (joined.includes("glucose") || joined.includes("cgm") || joined.includes("dexcom") || joined.includes("libre")) return "cgm";
  if (joined.includes("hrv") || joined.includes("heart rate variability") || joined.includes("rmssd") || joined.includes("sdnn")) return "hrv";
  if (joined.includes("heart") || joined.includes("hr") || joined.includes("pulse") || joined.includes("bpm")) return "heart_rate";
  if (joined.includes("step") || joined.includes("activity") || joined.includes("calories") || joined.includes("distance")) return "activity";
  if (joined.includes("temp") || joined.includes("skin")) return "temperature";
  if (joined.includes("spo2") || joined.includes("oxygen") || joined.includes("o2")) return "spo2";
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values.slice(0, 1000));
  const min = Math.min(...values.slice(0, 1000));
  if (mean > 50 && mean < 250 && min > 30 && max < 500) {
    if (mean > 60 && mean < 200 && max < 400) return "cgm";
    return "heart_rate";
  }
  if (sampleCount > 5000 && samplingIntervalMs && samplingIntervalMs < 100) return "ecg_waveform";
  return "generic";
}

function detectDeviceFormat(headers: string[], rawText: string): DeviceFormat {
  const joined = headers.map(h => h.toLowerCase()).join(" ");
  const textSample = rawText.slice(0, 2000).toLowerCase();
  if (textSample.includes("dexcom") || joined.includes("glucose value")) return "dexcom";
  if (textSample.includes("oura") || joined.includes("readiness") || joined.includes("bedtime")) return "oura";
  if (textSample.includes("apple") || textSample.includes("health") || joined.includes("sourcename")) return "apple_health";
  if (textSample.includes("fitbit") || joined.includes("fitbit")) return "fitbit";
  if (textSample.includes("garmin") || joined.includes("garmin") || joined.includes("connect")) return "garmin";
  if (textSample.includes("libre") || textSample.includes("freestyle")) return "libre";
  return "generic";
}

function resampleToHourly(values: number[], originalSamplesPerHour: number): number[] {
  if (originalSamplesPerHour <= 1) return values;
  const hourly: number[] = [];
  const chunkSize = Math.max(1, Math.round(originalSamplesPerHour));
  for (let i = 0; i < values.length; i += chunkSize) {
    const chunk = values.slice(i, i + chunkSize);
    if (chunk.length > 0) hourly.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
  }
  return hourly;
}

function computeCircadianScore(eigenvalue: number, sampleCount: number, r2: number, daysOfData: number, signalType: SignalType): { score: number; label: string; color: string; explanation: string } {
  const info = SIGNAL_INFO[signalType];
  if (info.circadianRelevance === "none") {
    return { score: 0, label: "Not Applicable", color: "#94a3b8", explanation: `${info.label} data is not on a circadian timescale. AR(2) measures waveform regularity, not circadian rhythm.` };
  }
  let base = 0;
  if (eigenvalue >= 0.85) base = 90;
  else if (eigenvalue >= 0.75) base = 75;
  else if (eigenvalue >= 0.60) base = 55;
  else if (eigenvalue >= 0.40) base = 35;
  else base = 15;
  let qualityPenalty = 0;
  if (sampleCount < 30) qualityPenalty += 25;
  else if (sampleCount < 72) qualityPenalty += 10;
  if (r2 < 0.5) qualityPenalty += 15;
  else if (r2 < 0.8) qualityPenalty += 5;
  if (daysOfData < info.minDays) qualityPenalty += 15;
  if (info.circadianRelevance === "low") qualityPenalty += 10;
  else if (info.circadianRelevance === "medium") qualityPenalty += 5;
  const score = Math.max(0, Math.min(100, base - qualityPenalty));
  let label: string, color: string, explanation: string;
  if (score >= 80) {
    label = "Strong"; color = "#22c55e";
    explanation = "Your data shows a consistent, repeating daily pattern with strong temporal persistence.";
  } else if (score >= 60) {
    label = "Moderate"; color = "#eab308";
    explanation = "Your data shows some daily regularity but with notable day-to-day variation.";
  } else if (score >= 40) {
    label = "Weak"; color = "#f97316";
    explanation = "Limited daily pattern detected. This could reflect genuine rhythm disruption or insufficient data.";
  } else if (score > 0) {
    label = "Minimal"; color = "#ef4444";
    explanation = "Very little consistent daily pattern detected. Consider collecting more data before interpreting.";
  } else {
    label = "N/A"; color = "#64748b";
    explanation = "Circadian scoring is not applicable for this signal type at this timescale.";
  }
  return { score, label, color, explanation };
}

function computeDayOverDayConsistency(hourlyData: number[]): { correlations: number[]; meanCorrelation: number; dayData: number[][] } {
  const days: number[][] = [];
  for (let i = 0; i < hourlyData.length; i += 24) {
    const day = hourlyData.slice(i, i + 24);
    if (day.length === 24) days.push(day);
  }
  if (days.length < 2) return { correlations: [], meanCorrelation: 0, dayData: days };
  const correlations: number[] = [];
  for (let i = 0; i < days.length - 1; i++) {
    const a = days[i], b = days[i + 1];
    const meanA = a.reduce((s, v) => s + v, 0) / 24;
    const meanB = b.reduce((s, v) => s + v, 0) / 24;
    let num = 0, denA = 0, denB = 0;
    for (let h = 0; h < 24; h++) {
      const da = a[h] - meanA, db = b[h] - meanB;
      num += da * db; denA += da * da; denB += db * db;
    }
    const den = Math.sqrt(denA * denB);
    correlations.push(den > 0 ? num / den : 0);
  }
  const meanCorrelation = correlations.reduce((s, v) => s + v, 0) / correlations.length;
  return { correlations, meanCorrelation, dayData: days };
}

interface UploadResult {
  fileName: string;
  rawValues: number[];
  hourlyValues: number[];
  signalType: SignalType;
  deviceFormat: DeviceFormat;
  sampleCount: number;
  hourlySampleCount: number;
  samplesPerHour: number;
  daysOfData: number;
  ar2Raw: ReturnType<typeof computeAR2>;
  ar2Hourly: ReturnType<typeof computeAR2>;
  circadianScore: ReturnType<typeof computeCircadianScore>;
  dayConsistency: ReturnType<typeof computeDayOverDayConsistency>;
  needsResampling: boolean;
  headers: string[];
}

const SAMPLE_DATASETS = [
  {
    id: "apple_watch_hr",
    url: "/sample-data/apple_watch_hr_physionet.csv",
    label: "Apple Watch HR — 7-day sleep study",
    points: "7,569",
    icon: "heart",
    source: "PhysioNet Sleep-Accel study (Walch et al., 2019)",
    description: "Heart rate recorded by an Apple Watch during a polysomnography sleep study. 7 nights of continuous monitoring from a real participant. The engine measures how persistently the heart rate follows a daily rhythm across these nights.",
    whatItMeasures: "Temporal persistence of heart rate's daily pattern — whether HR consistently rises and falls on a ~24h cycle across multiple days.",
    whatItDoesNotMeasure: "Whether your circadian clock genes are healthy. Heart rate rhythm reflects many factors (activity, stress, caffeine) beyond the molecular clock.",
  },
  {
    id: "dexcom_cgm",
    url: "/sample-data/dexcom_g6_cgm_real.csv",
    label: "Dexcom G6 CGM — 8-day glucose",
    points: "2,148",
    icon: "cgm",
    source: "cgmquantify package (Bent et al.), real Dexcom G6 export",
    description: "Continuous glucose readings every 5 minutes from a real Dexcom G6 sensor over 8 days. Glucose has a well-documented circadian rhythm influenced by cortisol, insulin sensitivity, and meal timing.",
    whatItMeasures: "How persistent the daily glucose pattern is — whether glucose follows a repeatable 24-hour cycle across the 8 days.",
    whatItDoesNotMeasure: "Diabetes risk, insulin resistance, or metabolic health. Those require clinical assessment, not just rhythm persistence.",
  },
  {
    id: "fitbit_hr",
    url: "/sample-data/fitbit_hr_5min_fitabase.csv",
    label: "Fitbit HR — 8-day continuous",
    points: "2,270",
    icon: "heart",
    source: "Fitabase example data (CC0, 2017)",
    description: "Heart rate averaged every 5 minutes from a Fitbit tracker over 8 days. Demonstrates how consumer-grade HR monitors capture circadian autonomic patterns, including nighttime drops and daytime elevations.",
    whatItMeasures: "Temporal persistence of heart rate rhythm — how consistently the HR follows a day/night pattern across the full recording.",
    whatItDoesNotMeasure: "Cardiac health, fitness level, or clinical heart conditions. The eigenvalue reflects rhythm regularity, not cardiovascular function.",
  },
  {
    id: "libre_cgm",
    url: "/sample-data/libre_cgm_sprague.csv",
    label: "Libre CGM — 14-day glucose",
    points: "1,318",
    icon: "cgm",
    source: "R. Sprague, FreeStyle Libre export (GitHub, CC0)",
    description: "14 days of FreeStyle Libre continuous glucose data sampled every ~15 minutes. A second CGM dataset from a different device and person, allowing comparison with the Dexcom data above.",
    whatItMeasures: "Glucose circadian persistence from a Libre sensor — whether the daily glucose rhythm repeats consistently over 14 days.",
    whatItDoesNotMeasure: "Metabolic health or diabetes status. The AR(2) eigenvalue measures rhythm persistence, not glucose control quality.",
  },
  {
    id: "fitbit_steps",
    url: "/sample-data/fitbit_steps_hourly_fitabase.csv",
    label: "Fitbit Steps — 8-day hourly",
    points: "192",
    icon: "activity",
    source: "Fitabase example data (CC0, 2017)",
    description: "Hourly step counts from a Fitbit tracker over 8 days. Activity data is behavioral rather than physiological — it reflects your schedule, not your internal clock. Included to demonstrate the difference.",
    whatItMeasures: "How regular your daily activity pattern is — whether step counts follow a repeatable daily rhythm.",
    whatItDoesNotMeasure: "Circadian clock function. Steps are driven by behavior (work schedule, habits), not by the endogenous circadian oscillator. Expect lower |λ| than HR or CGM.",
  },
  {
    id: "mimic_icu_hr",
    url: "/downloads/MIMIC_Demo_ICU_HeartRate.csv",
    label: "MIMIC-IV ICU — Heart Rate (20 days)",
    points: "481",
    icon: "clinical",
    source: "MIMIC-IV Demo, PhysioNet (CC BY 4.0). De-identified; dates shifted to 2000-01-01 baseline.",
    description: "Hourly heart rate from a critically ill ICU patient over 20 days. ICU patients have severely disrupted circadian rhythms due to constant light, sedation, and mechanical interventions. Compare against the Apple Watch / Fitbit datasets to see how illness affects temporal persistence.",
    whatItMeasures: "Temporal persistence of heart rate in a clinical ICU setting — expected to be lower than healthy wearable data due to circadian disruption.",
    whatItDoesNotMeasure: "Individual health status or clinical outcomes. This is a de-identified research dataset for methodological demonstration only.",
  },
  {
    id: "mimic_icu_spo2",
    url: "/downloads/MIMIC_Demo_ICU_SpO2.csv",
    label: "MIMIC-IV ICU — SpO₂ (20 days)",
    points: "474",
    icon: "clinical",
    source: "MIMIC-IV Demo, PhysioNet (CC BY 4.0). De-identified; dates shifted to 2000-01-01 baseline.",
    description: "Hourly blood oxygen saturation from the same ICU patient over 20 days. SpO₂ in ICU patients on supplemental oxygen tends to be artificially stabilised — expect very high |λ| driven by clinical management rather than biological rhythm.",
    whatItMeasures: "Temporal persistence of SpO₂ in a clinical ICU setting. High persistence here likely reflects oxygen therapy keeping values in a fixed range.",
    whatItDoesNotMeasure: "Circadian rhythm quality. Clinically managed SpO₂ does not reflect endogenous circadian regulation.",
  },
  {
    id: "mimic_icu_rr",
    url: "/downloads/MIMIC_Demo_ICU_RespiratoryRate.csv",
    label: "MIMIC-IV ICU — Respiratory Rate (20 days)",
    points: "483",
    icon: "clinical",
    source: "MIMIC-IV Demo, PhysioNet (CC BY 4.0). De-identified; dates shifted to 2000-01-01 baseline.",
    description: "Hourly respiratory rate from the same ICU patient over 20 days. Respiratory rate in a ventilated patient may be largely machine-set — persistence reflects ventilator settings as much as biology.",
    whatItMeasures: "Temporal persistence of respiratory rate in an ICU patient — a mix of biological and machine-driven regularity.",
    whatItDoesNotMeasure: "Circadian lung function or respiratory health. Clinical context is essential to interpret this signal.",
  },
];

function processCSVText(text: string, fileName: string): UploadResult | { error: string } {
  const parsed = Papa.parse(text, { header: false, skipEmptyLines: true, dynamicTyping: false });
  let rows = parsed.data as string[][];
  if (rows.length < 2) return { error: "File has too few rows." };

  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const row = rows[r];
    const numNonEmpty = row.filter(c => (c || "").trim().length > 0).length;
    if (numNonEmpty < 2) continue;
    const numNumeric = row.filter(c => { const v = parseFloat((c || "").trim()); return !isNaN(v) && (c || "").trim().length > 0; }).length;
    const numText = numNonEmpty - numNumeric;
    if (numText >= 2 && numNonEmpty >= 2) { headerRowIdx = r; break; }
  }
  const headers = rows[headerRowIdx].map(h => (h || "").trim());
  const dataRows = rows.slice(headerRowIdx + 1).filter(row => row.some(c => (c || "").trim().length > 0));
  if (dataRows.length < 3) return { error: `Found only ${dataRows.length} data rows. Need at least 5.` };

  const numericCols: number[] = [];
  for (let col = 0; col < headers.length; col++) {
    let numericCount = 0;
    for (let r = 0; r < Math.min(dataRows.length, 20); r++) {
      const raw = (dataRows[r]?.[col] || "").trim();
      if (raw.length > 0 && !isNaN(parseFloat(raw))) numericCount++;
    }
    if (numericCount >= Math.min(3, dataRows.length * 0.3)) numericCols.push(col);
  }
  if (numericCols.length === 0) return { error: "No numeric columns found." };

  let bestCol = numericCols[0];
  let maxVariance = 0;
  for (const col of numericCols) {
    const vals: number[] = [];
    for (let i = 0; i < Math.min(dataRows.length, 500); i++) {
      const raw = (dataRows[i]?.[col] || "").trim();
      const v = parseFloat(raw);
      if (!isNaN(v)) vals.push(v);
    }
    if (vals.length > 2) {
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
      if (variance > maxVariance) { maxVariance = variance; bestCol = col; }
    }
  }

  const allValues: number[] = [];
  for (const row of dataRows) {
    const raw = (row?.[bestCol] || "").trim();
    const v = parseFloat(raw);
    if (!isNaN(v)) allValues.push(v);
  }
  if (allValues.length < 5) return { error: `Only ${allValues.length} numeric values found. Need at least 5.` };

  let timestampCol = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toLowerCase();
    if (h.includes("time") || h.includes("date") || h.includes("timestamp") || h.includes("epoch")) { timestampCol = i; break; }
  }

  let samplingIntervalMs: number | null = null;
  let samplesPerHour = 1;
  if (timestampCol >= 0 && dataRows.length > 10) {
    const intervals: number[] = [];
    for (let i = 0; i < Math.min(dataRows.length - 1, 50); i++) {
      const ts1 = (dataRows[i]?.[timestampCol] || "").trim();
      const ts2 = (dataRows[i + 1]?.[timestampCol] || "").trim();
      if (!ts1 || !ts2) continue;
      let d1 = new Date(ts1).getTime();
      let d2 = new Date(ts2).getTime();
      if (isNaN(d1) || isNaN(d2)) {
        const n1 = parseFloat(ts1), n2 = parseFloat(ts2);
        if (!isNaN(n1) && !isNaN(n2)) {
          if (n1 > 1e12) { d1 = n1; d2 = n2; } else if (n1 > 1e9) { d1 = n1 * 1000; d2 = n2 * 1000; } else continue;
        } else continue;
      }
      const diff = d2 - d1;
      if (diff > 0 && diff < 86400000) intervals.push(diff);
    }
    if (intervals.length >= 3) {
      intervals.sort((a, b) => a - b);
      samplingIntervalMs = intervals[Math.floor(intervals.length / 2)];
      samplesPerHour = Math.max(1, Math.round(3600000 / samplingIntervalMs));
    }
  }
  if (!samplingIntervalMs) {
    if (allValues.length > 500) { samplesPerHour = 12; samplingIntervalMs = 300000; }
    else if (allValues.length > 100) { samplesPerHour = 4; samplingIntervalMs = 900000; }
    else { samplesPerHour = 1; samplingIntervalMs = 3600000; }
  }

  const signalType = detectSignalType(headers, allValues, allValues.length, samplingIntervalMs);
  const deviceFormat = detectDeviceFormat(headers, text);
  const needsResampling = samplesPerHour > 1;
  const hourlyValues = needsResampling ? resampleToHourly(allValues, samplesPerHour) : allValues;
  const daysOfData = hourlyValues.length / 24;
  const ar2Raw = computeAR2(allValues);
  const ar2Hourly = computeAR2(hourlyValues);
  const circadianScore = computeCircadianScore(ar2Hourly.eigenvalue, hourlyValues.length, ar2Hourly.r2, daysOfData, signalType);
  const dayConsistency = computeDayOverDayConsistency(hourlyValues);

  return {
    fileName, rawValues: allValues, hourlyValues, signalType, deviceFormat,
    sampleCount: allValues.length, hourlySampleCount: hourlyValues.length,
    samplesPerHour, daysOfData, ar2Raw, ar2Hourly, circadianScore, dayConsistency,
    needsResampling, headers
  };
}

interface AppleHealthSignal {
  type: string;
  label: string;
  count: number;
  daysSpan: number;
  firstDate: string;
  lastDate: string;
}

interface AppleHealthExtraction {
  signals: AppleHealthSignal[];
  extractSignal: (type: string) => string;
}

const APPLE_HEALTH_TYPES: Record<string, { label: string; csvHeader: string; signalType: SignalType }> = {
  "HKQuantityTypeIdentifierHeartRate": { label: "Heart Rate (bpm)", csvHeader: "heart_rate_bpm", signalType: "heart_rate" },
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": { label: "HRV - SDNN (ms)", csvHeader: "hrv_sdnn_ms", signalType: "hrv" },
  "HKQuantityTypeIdentifierRestingHeartRate": { label: "Resting Heart Rate (bpm)", csvHeader: "resting_hr_bpm", signalType: "heart_rate" },
  "HKQuantityTypeIdentifierStepCount": { label: "Steps", csvHeader: "steps", signalType: "activity" },
  "HKQuantityTypeIdentifierActiveEnergyBurned": { label: "Active Calories", csvHeader: "active_calories", signalType: "activity" },
  "HKQuantityTypeIdentifierBodyTemperature": { label: "Body Temperature", csvHeader: "temperature", signalType: "temperature" },
  "HKQuantityTypeIdentifierAppleWalkingSteadiness": { label: "Walking Steadiness", csvHeader: "walking_steadiness", signalType: "generic" },
  "HKQuantityTypeIdentifierOxygenSaturation": { label: "Blood Oxygen (SpO2)", csvHeader: "spo2_percent", signalType: "spo2" },
  "HKQuantityTypeIdentifierRespiratoryRate": { label: "Respiratory Rate", csvHeader: "respiratory_rate", signalType: "generic" },
  "HKQuantityTypeIdentifierWalkingHeartRateAverage": { label: "Walking Heart Rate Avg", csvHeader: "walking_hr_bpm", signalType: "heart_rate" },
};

function parseAppleHealthDate(dateStr: string): Date | null {
  const d = new Date(dateStr.replace(" +", "+").replace(" -", "-").replace(/\s+/g, (m, offset) => offset > 10 ? m : "T"));
  if (!isNaN(d.getTime())) return d;
  const m = dateStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const fallback = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    if (!isNaN(fallback.getTime())) return fallback;
  }
  return null;
}

function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function parseAppleHealthZip(file: File, onProgress?: (msg: string) => void): Promise<AppleHealthExtraction | { error: string }> {
  const fileSizeMB = (file.size / 1048576).toFixed(1);
  onProgress?.(`Opening ZIP file (${fileSizeMB} MB)... This may take 30-60 seconds for large exports.`);
  await yieldToMain();
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return { error: "Could not open this ZIP file. Make sure it's a valid Apple Health export." };
  }

  let xmlFile = zip.file("apple_health_export/export.xml");
  if (!xmlFile) {
    xmlFile = zip.file("export.xml");
  }
  if (!xmlFile) {
    const xmlFiles = Object.keys(zip.files).filter(f => f.endsWith("export.xml"));
    if (xmlFiles.length > 0) xmlFile = zip.file(xmlFiles[0]);
  }
  if (!xmlFile) {
    const allFiles = Object.keys(zip.files).filter(f => !f.endsWith("/"));
    const csvFiles = allFiles.filter(f => f.endsWith(".csv"));
    if (csvFiles.length > 0) {
      return { error: `This ZIP contains CSV files (${csvFiles.slice(0, 3).join(", ")}), not an Apple Health export. Extract the CSV and upload it directly instead.` };
    }
    return { error: `No export.xml found in this ZIP. Apple Health exports should contain an export.xml file. Found: ${allFiles.slice(0, 5).join(", ")}` };
  }

  onProgress?.("Decompressing health data (this may take a moment for large exports)...");
  const xmlText = await xmlFile.async("string", (metadata) => {
    if (metadata.percent) {
      onProgress?.(`Decompressing... ${Math.round(metadata.percent)}%`);
    }
  });
  const xmlSizeMB = (xmlText.length / 1048576).toFixed(1);
  onProgress?.(`Loaded ${xmlSizeMB} MB of health data. Scanning for records...`);

  const recordsByType: Record<string, { values: number[]; dates: Date[] }> = {};
  let totalParsed = 0;
  let totalRecordTags = 0;
  let skippedNoType = 0;
  let skippedNoValue = 0;
  let skippedNoDate = 0;
  let skippedDateParse = 0;
  let firstRecordSample = "";

  let lastYield = Date.now();
  let pos = 0;
  const xmlLen = xmlText.length;
  let recordBuffer = "";

  function processRecordTag(tag: string) {
    totalRecordTags++;
    if (totalRecordTags === 1) {
      firstRecordSample = tag.trim().substring(0, 300);
    }

    const typeMatch = tag.match(/type="([^"]+)"/);
    if (!typeMatch) { skippedNoType++; return; }
    const type = typeMatch[1];
    if (!APPLE_HEALTH_TYPES[type]) return;

    const valMatch = tag.match(/value="([^"]+)"/);
    if (!valMatch) { skippedNoValue++; return; }
    const val = parseFloat(valMatch[1]);
    if (isNaN(val)) { skippedNoValue++; return; }

    const dateMatch = tag.match(/startDate="([^"]+)"/);
    if (!dateMatch) { skippedNoDate++; return; }
    const date = parseAppleHealthDate(dateMatch[1]);
    if (!date) { skippedDateParse++; return; }

    if (!recordsByType[type]) recordsByType[type] = { values: [], dates: [] };
    recordsByType[type].values.push(val);
    recordsByType[type].dates.push(date);
    totalParsed++;
  }

  while (pos < xmlLen) {
    const nextLine = xmlText.indexOf("\n", pos);
    const lineEnd = nextLine === -1 ? xmlLen : nextLine;
    const line = xmlText.substring(pos, lineEnd);
    pos = lineEnd + 1;

    if (pos % 500000 < (line.length + 1)) {
      const now = Date.now();
      if (now - lastYield > 100) {
        const pct = Math.round((pos / xmlLen) * 100);
        onProgress?.(`Scanning records... ${pct}% (${totalParsed.toLocaleString()} extracted from ${totalRecordTags.toLocaleString()} records)`);
        await yieldToMain();
        lastYield = Date.now();
      }
    }

    if (recordBuffer) {
      recordBuffer += " " + line.trim();
      if (recordBuffer.includes("/>") || recordBuffer.includes(">")) {
        processRecordTag(recordBuffer);
        recordBuffer = "";
      }
      continue;
    }

    if (!line.includes("<Record ")) continue;

    if (line.includes("/>") || line.match(/<Record\s[^>]*>/)) {
      processRecordTag(line);
    } else {
      recordBuffer = line.trim();
    }
  }

  onProgress?.(`Scan complete: ${totalParsed.toLocaleString()} readings from ${totalRecordTags.toLocaleString()} records`);

  if (totalParsed === 0) {
    let diagnostic = `Found export.xml (${xmlSizeMB} MB). `;
    diagnostic += `Detected ${totalRecordTags.toLocaleString()} Record tags total. `;
    if (totalRecordTags === 0) {
      diagnostic += "No <Record> elements found at all — the file may use a different format or be empty.";
    } else {
      diagnostic += `Skipped: ${skippedNoType} (unrecognized type), ${skippedNoValue} (no numeric value), ${skippedNoDate} (no start date), ${skippedDateParse} (unparseable date). `;
      if (firstRecordSample) {
        diagnostic += `\n\nFirst Record seen:\n${firstRecordSample}`;
      }
    }
    return { error: diagnostic };
  }

  const signals: AppleHealthSignal[] = [];
  for (const [type, data] of Object.entries(recordsByType)) {
    const info = APPLE_HEALTH_TYPES[type];
    if (!info || data.values.length < 10) continue;
    const sorted = [...data.dates].sort((a, b) => a.getTime() - b.getTime());
    const daysSpan = (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / 86400000;
    signals.push({
      type,
      label: info.label,
      count: data.values.length,
      daysSpan: Math.round(daysSpan * 10) / 10,
      firstDate: sorted[0].toISOString().split("T")[0],
      lastDate: sorted[sorted.length - 1].toISOString().split("T")[0],
    });
  }

  signals.sort((a, b) => b.count - a.count);

  const extractSignal = (type: string): string => {
    const data = recordsByType[type];
    const info = APPLE_HEALTH_TYPES[type];
    if (!data || !info) return "";
    const paired = data.dates.map((d, i) => ({ date: d, value: data.values[i] }));
    paired.sort((a, b) => a.date.getTime() - b.date.getTime());
    const csvLines = [`timestamp,${info.csvHeader}`];
    for (const p of paired) {
      const ts = p.date.toISOString().replace("T", " ").replace("Z", "").split(".")[0];
      csvLines.push(`${ts},${p.value}`);
    }
    return csvLines.join("\n");
  };

  return { signals, extractSignal };
}

function EigenvalueGauge({ value, label, size = 120 }: { value: number; label: string; size?: number }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(value, 1.0);
  const offset = circumference * (1 - progress);
  let color = "#22c55e";
  if (value >= 0.95) color = "#ef4444";
  else if (value >= 0.85) color = "#f97316";
  else if (value >= 0.7) color = "#eab308";
  else if (value >= 0.5) color = "#22c55e";
  else color = "#3b82f6";
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={`${color}20`} strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x={size/2} y={size/2 - 4} textAnchor="middle" fill={color} fontSize="20" fontWeight="bold">
          {value.toFixed(3)}
        </text>
        <text x={size/2} y={size/2 + 12} textAnchor="middle" fill="#94a3b8" fontSize="9">|λ|</text>
      </svg>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function CircadianScoreCard({ score, circadianScore }: { score: ReturnType<typeof computeCircadianScore>; circadianScore: number }) {
  return (
    <Card className="bg-white border-slate-200" data-testid="card-circadian-score">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400" />
          Circadian Rhythm Score
        </CardTitle>
        <CardDescription className="text-[10px]">
          A single number combining eigenvalue persistence + data quality + signal relevance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke={score.color} strokeWidth="8"
                strokeLinecap="round" strokeDasharray={`${circadianScore * 2.51} 251`}
                transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray 1s ease" }} />
              <text x="50" y="46" textAnchor="middle" fill={score.color} fontSize="22" fontWeight="bold">
                {circadianScore}
              </text>
              <text x="50" y="60" textAnchor="middle" fill="#94a3b8" fontSize="10">/100</text>
            </svg>
          </div>
          <div className="flex-1">
            <Badge style={{ backgroundColor: `${score.color}20`, color: score.color, borderColor: `${score.color}40` }}>
              {score.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">{score.explanation}</p>
          </div>
        </div>
        <div className="mt-3 p-2 rounded bg-amber-500/5 border border-amber-500/10">
          <p className="text-[10px] text-amber-300/80">
            <strong>Research only:</strong> This score is illustrative. No clinical validation exists for wearable-derived circadian scores. Do not use for medical decisions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ReferenceRangeChart({ eigenvalue, signalType }: { eigenvalue: number; signalType: SignalType }) {
  const applicableRanges = REFERENCE_RANGES.filter(r => {
    if (signalType === "cgm" && r.signal.includes("CGM")) return true;
    if ((signalType === "heart_rate" || signalType === "ecg_waveform") && r.signal.includes("Heart Rate")) return true;
    if (signalType === "hrv" && r.signal.includes("HRV")) return true;
    if (signalType === "temperature" && r.signal.includes("Temperature")) return true;
    return false;
  });

  if (applicableRanges.length === 0) return null;
  const range = applicableRanges[0];

  return (
    <Card className="bg-white border-slate-200" data-testid="card-reference-ranges">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Reference Range Comparison
        </CardTitle>
        <CardDescription className="text-[10px]">
          Where your |λ| falls relative to illustrative ranges (NOT clinically validated)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-12 bg-slate-100 rounded-lg overflow-hidden mb-3">
          <div className="absolute inset-y-0 flex w-full">
            <div className="bg-red-500/20 border-r border-red-500/30" style={{ width: `${range.disrupted[1] * 100}%` }}>
              <span className="text-[8px] text-red-400 absolute bottom-0.5 left-1">Disrupted</span>
            </div>
            <div className="bg-orange-500/20 border-r border-orange-500/30" style={{ width: `${(range.moderate[1] - range.disrupted[1]) * 100}%` }}>
              <span className="text-[8px] text-orange-400 absolute bottom-0.5 left-1">Moderate</span>
            </div>
            <div className="bg-green-500/20" style={{ width: `${(range.healthy[1] - range.moderate[1]) * 100}%` }}>
              <span className="text-[8px] text-green-400 absolute bottom-0.5 left-1">Healthy</span>
            </div>
            <div className="bg-slate-100 flex-1">
              <span className="text-[8px] text-slate-500 absolute bottom-0.5 left-1">Near-Critical</span>
            </div>
          </div>
          <div className="absolute inset-y-0 w-0.5 bg-white z-10" style={{ left: `${Math.min(eigenvalue, 1) * 100}%` }}>
            <div className="absolute -top-5 -translate-x-1/2 bg-white text-black text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
              Your |λ| = {eigenvalue.toFixed(3)}
            </div>
          </div>
        </div>
        <p className="text-[9px] text-slate-500 italic">{range.source}</p>
      </CardContent>
    </Card>
  );
}

interface ComparisonEntry {
  result: UploadResult;
  context: typeof SAMPLE_DATASETS[0] | null;
  id: string;
}

function CircadianFingerprint({ entries }: { entries: ComparisonEntry[] }) {
  const sorted = [...entries].sort((a, b) => b.result.ar2Hourly.eigenvalue - a.result.ar2Hourly.eigenvalue);
  const eigenvalues = sorted.map(e => e.result.ar2Hourly.eigenvalue);
  const meanEV = eigenvalues.reduce((s, v) => s + v, 0) / eigenvalues.length;
  const maxEV = eigenvalues[0];
  const minEV = eigenvalues[eigenvalues.length - 1];
  const gap = maxEV - minEV;
  const stdEV = Math.sqrt(eigenvalues.reduce((s, v) => s + (v - meanEV) ** 2, 0) / eigenvalues.length);

  const circadianSignals = sorted.filter(e => {
    const info = SIGNAL_INFO[e.result.signalType];
    return info.circadianRelevance === "high" || info.circadianRelevance === "medium";
  });
  const circadianMean = circadianSignals.length > 0
    ? circadianSignals.reduce((s, e) => s + e.result.ar2Hourly.eigenvalue, 0) / circadianSignals.length : 0;

  const meanR2 = sorted.reduce((s, e) => s + e.result.ar2Hourly.r2, 0) / sorted.length;
  const totalDays = Math.max(...sorted.map(e => e.result.daysOfData));

  const radarData = sorted.map(e => {
    const info = SIGNAL_INFO[e.result.signalType];
    return {
      signal: info.label.replace("Heart Rate Variability", "HRV").replace("Blood Oxygen (SpO2)", "SpO2").replace("Skin Temperature", "Temperature").replace("Activity / Steps", "Activity").replace("Continuous Glucose", "CGM").replace("Generic Time Series", "Generic"),
      eigenvalue: parseFloat((e.result.ar2Hourly.eigenvalue * 100).toFixed(1)),
      r2: parseFloat((e.result.ar2Hourly.r2 * 100).toFixed(1)),
      fullMark: 100,
    };
  });

  const overallLabel = meanEV >= 0.8 ? "Highly Rhythmic" :
    meanEV >= 0.65 ? "Moderately Rhythmic" :
    meanEV >= 0.45 ? "Mixed Rhythmicity" : "Low Rhythmicity";
  const overallColor = meanEV >= 0.8 ? "text-green-400" :
    meanEV >= 0.65 ? "text-cyan-400" :
    meanEV >= 0.45 ? "text-yellow-400" : "text-orange-400";

  const coherenceLabel = gap < 0.15 ? "Tightly Coupled" :
    gap < 0.3 ? "Moderately Spread" :
    gap < 0.5 ? "Widely Spread" : "Highly Divergent";
  const coherenceColor = gap < 0.15 ? "text-green-400" :
    gap < 0.3 ? "text-cyan-400" :
    gap < 0.5 ? "text-yellow-400" : "text-orange-400";

  const topSignal = sorted[0];
  const bottomSignal = sorted[sorted.length - 1];

  const shortDurationCircadian = circadianSignals.filter(e => {
    const info = SIGNAL_INFO[e.result.signalType];
    return e.result.daysOfData < (info.minDays || 3);
  });

  const interpretation = (() => {
    const parts: string[] = [];
    if (circadianSignals.length === 0) {
      parts.push("None of the analyzed signals have high or medium circadian relevance. This fingerprint reflects temporal persistence of the signals, but cannot be interpreted as a circadian rhythm profile. Consider adding heart rate, HRV, temperature, or glucose data for circadian-relevant analysis.");
    } else if (circadianMean >= 0.75) {
      const entrained = shortDurationCircadian.length > 0
        ? `, though ${shortDurationCircadian.length} signal(s) have less than the recommended days of data — interpret with caution`
        : "";
      parts.push(`The circadian-relevant signals (${circadianSignals.map(e => SIGNAL_INFO[e.result.signalType].label).join(", ")}) show strong temporal persistence (mean |λ| = ${circadianMean.toFixed(3)})${entrained}. When data duration is adequate, this is consistent with a well-entrained daily rhythm in those systems.`);
    } else if (circadianMean >= 0.5) {
      parts.push(`The circadian-relevant signals show moderate temporal persistence (mean |λ| = ${circadianMean.toFixed(3)}). This could reflect a real but not dominant daily rhythm, or data quality limitations.`);
      if (shortDurationCircadian.length > 0) {
        parts.push(`Note: ${shortDurationCircadian.length} circadian-relevant signal(s) have less than the recommended recording duration, which may underestimate true persistence.`);
      }
    } else {
      parts.push(`The circadian-relevant signals show relatively low persistence (mean |λ| = ${circadianMean.toFixed(3)}). This may indicate disrupted daily patterns, insufficient data duration, or behavioral irregularity during the recording period.`);
      if (shortDurationCircadian.length > 0) {
        parts.push(`Important: ${shortDurationCircadian.length} signal(s) have less than the minimum recommended days. Short recordings often produce lower eigenvalues regardless of true circadian strength.`);
      }
    }

    if (gap > 0.3) {
      parts.push(`There is a large spread between the most persistent signal (${SIGNAL_INFO[topSignal.result.signalType].label}, |λ| = ${maxEV.toFixed(3)}) and the least (${SIGNAL_INFO[bottomSignal.result.signalType].label}, |λ| = ${minEV.toFixed(3)}). This suggests different physiological systems have different degrees of rhythmic regulation in this individual.`);
    } else if (gap > 0.1) {
      parts.push(`The signals show moderate spread (gap = ${gap.toFixed(3)}), suggesting some systems are more rhythmically regulated than others.`);
    } else {
      parts.push(`All signals cluster tightly (gap = ${gap.toFixed(3)}), suggesting similar levels of temporal persistence across measured systems.`);
    }

    if (meanR2 < 0.5) {
      parts.push("Caution: average model fit (R²) is below 0.5, meaning AR(2) captures less than half the variance. Interpret eigenvalues with care.");
    }

    return parts.join(" ");
  })();

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-indigo-900/20 border-indigo-500/30" data-testid="card-circadian-fingerprint">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-400" />
          </div>
          Circadian Fingerprint
        </CardTitle>
        <CardDescription className="text-xs">
          Multi-signal AR(2) persistence profile from {entries.length} physiological signals over {totalDays.toFixed(0)} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/40 text-center">
            <div className={`text-xl font-bold font-mono ${overallColor}`}>{meanEV.toFixed(3)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Mean |λ|</div>
            <div className={`text-[9px] font-medium mt-0.5 ${overallColor}`}>{overallLabel}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/40 text-center">
            <div className={`text-xl font-bold font-mono ${coherenceColor}`}>{gap.toFixed(3)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Persistence Gap</div>
            <div className={`text-[9px] font-medium mt-0.5 ${coherenceColor}`}>{coherenceLabel}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/40 text-center">
            <div className="text-xl font-bold font-mono text-purple-400">{meanR2.toFixed(3)}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Mean R²</div>
            <div className="text-[9px] font-medium mt-0.5 text-purple-400">{meanR2 >= 0.7 ? "Good Fit" : meanR2 >= 0.4 ? "Fair Fit" : "Poor Fit"}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/40 text-center">
            <div className="text-xl font-bold font-mono text-emerald-400">{entries.length}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Signals</div>
            <div className="text-[9px] font-medium mt-0.5 text-emerald-400">{circadianSignals.length} circadian-relevant</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex justify-center items-center">
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} outerRadius="75%">
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey="signal" tick={{ fontSize: 9, fill: "#64748b" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 8, fill: "#64748b" }} tickCount={5} />
                <Radar name="Eigenvalue %" dataKey="eigenvalue" stroke="#818cf8" fill="#818cf8" fillOpacity={0.55} strokeWidth={2} />
                <Radar name="R² %" dataKey="r2" stroke="#34d399" fill="#34d399" fillOpacity={0.3} strokeWidth={1} strokeDasharray="4 2" />
                <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">Signal Hierarchy</h4>
            {sorted.map((entry, i) => {
              const info = SIGNAL_INFO[entry.result.signalType];
              const ev = entry.result.ar2Hourly.eigenvalue;
              const barWidth = Math.max(2, ev * 100);
              const barColor = ev >= 0.8 ? "#22c55e" : ev >= 0.6 ? "#06b6d4" : ev >= 0.4 ? "#eab308" : "#f97316";
              return (
                <div key={entry.id} className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 w-3 text-right font-mono">{i + 1}</span>
                  <span className="text-[10px] text-slate-600 w-24 truncate">{info.label}</span>
                  <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
                    <span className="absolute right-1.5 top-0 text-[8px] font-mono text-slate-600 leading-[14px]">{ev.toFixed(3)}</span>
                  </div>
                  {info.circadianRelevance === "high" && <span className="text-[7px] text-green-400 font-bold">HIGH</span>}
                  {info.circadianRelevance === "medium" && <span className="text-[7px] text-yellow-400 font-bold">MED</span>}
                  {info.circadianRelevance === "low" && <span className="text-[7px] text-orange-400 font-bold">LOW</span>}
                  {info.circadianRelevance === "none" && <span className="text-[7px] text-slate-500 font-bold">N/A</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/20">
          <h4 className="text-[11px] font-semibold text-indigo-300 flex items-center gap-2 mb-2">
            <BrainCircuit className="w-3.5 h-3.5" /> Interpretation
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">{interpretation}</p>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <h4 className="text-[11px] font-semibold text-amber-300 flex items-center gap-2 mb-2">
            <Info className="w-3.5 h-3.5" /> What we'd need to know about this person
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {[
              { q: "Age & sex", why: "Circadian amplitude declines with age; some rhythms differ by sex" },
              { q: "Work schedule", why: "Shift work, irregular hours, or consistent 9-5 shapes behavioral signals" },
              { q: "Sleep schedule", why: "Consistent vs. variable bedtimes directly affect rhythm persistence" },
              { q: "Medications", why: "Beta-blockers flatten HR rhythm; stimulants affect activity patterns" },
              { q: "Health conditions", why: "Diabetes, sleep apnea, cardiac conditions alter specific signals" },
              { q: "Travel / time zones", why: "Jet lag during recording disrupts circadian alignment" },
              { q: "Device wear pattern", why: "Gaps from removing the device create artifacts in the analysis" },
              { q: "Exercise habits", why: "Regular exercise timing strengthens activity rhythm persistence" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-1.5 py-0.5">
                <span className="text-[9px] text-amber-400 mt-0.5 shrink-0">*</span>
                <div>
                  <span className="text-[10px] text-slate-600 font-medium">{item.q}</span>
                  <span className="text-[9px] text-slate-500"> — {item.why}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <h4 className="text-[11px] font-semibold text-red-400 flex items-center gap-2 mb-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Limitations
          </h4>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            This fingerprint measures <em>signal regularity</em> using AR(2) modeling — real math on real data.
            It does not measure molecular clock gene activity, diagnose any condition, or predict health outcomes.
            The connection between wearable signal persistence and tissue-level circadian biology is a hypothesis under investigation, not an established fact.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const REFERENCE_BENCHMARKS: {
  signalType: SignalType;
  label: string;
  source: string;
  population: string;
  device: string;
  provenance: "computed" | "estimated";
  eigenvalueRange: [number, number];
  eigenvalueMean: number;
  daysRecorded: string;
  note: string;
}[] = [
  {
    signalType: "heart_rate", label: "Apple Watch HR",
    source: "PhysioNet Sleep-Accel (Walch et al., 2019)",
    population: "Single participant from sleep study", device: "Apple Watch",
    provenance: "computed",
    eigenvalueRange: [0.82, 0.96], eigenvalueMean: 0.91,
    daysRecorded: "7 nights",
    note: "AR(2) computed from bundled sample file (apple_watch_hr_physionet.csv); single participant, not population statistics"
  },
  {
    signalType: "heart_rate", label: "Fitbit HR",
    source: "Fitabase example (CC0, 2017)",
    population: "Single participant, free-living", device: "Fitbit Charge",
    provenance: "computed",
    eigenvalueRange: [0.78, 0.94], eigenvalueMean: 0.87,
    daysRecorded: "8 days",
    note: "AR(2) computed from bundled sample file (fitbit_hr_5min_fitabase.csv); single participant extract"
  },
  {
    signalType: "cgm", label: "Dexcom G6 CGM",
    source: "cgmquantify (Bent et al.)",
    population: "Single individual", device: "Dexcom G6",
    provenance: "computed",
    eigenvalueRange: [0.75, 0.92], eigenvalueMean: 0.84,
    daysRecorded: "8 days",
    note: "AR(2) computed from bundled sample file (dexcom_g6_cgm_real.csv); single individual's data"
  },
  {
    signalType: "cgm", label: "Libre CGM",
    source: "Sprague (GitHub, CC0)",
    population: "Single individual", device: "FreeStyle Libre",
    provenance: "computed",
    eigenvalueRange: [0.70, 0.88], eigenvalueMean: 0.79,
    daysRecorded: "14 days",
    note: "AR(2) computed from bundled sample file (libre_cgm_sprague.csv); single individual's data"
  },
  {
    signalType: "activity", label: "Fitbit Steps",
    source: "Fitabase example (CC0, 2017)",
    population: "Single participant", device: "Fitbit",
    provenance: "computed",
    eigenvalueRange: [0.45, 0.78], eigenvalueMean: 0.62,
    daysRecorded: "8 days",
    note: "AR(2) computed from bundled sample file (fitbit_steps_hourly_fitabase.csv); behavioral signal, single participant"
  },
  {
    signalType: "hrv", label: "HRV (SDNN)",
    source: "Illustrative estimate",
    population: "Expected range for healthy adults", device: "Various",
    provenance: "estimated",
    eigenvalueRange: [0.75, 0.93], eigenvalueMean: 0.85,
    daysRecorded: "3-7 days",
    note: "Illustrative range based on known circadian HRV variation; not computed from a specific dataset — treat as approximate"
  },
  {
    signalType: "temperature", label: "Skin Temperature",
    source: "Illustrative estimate",
    population: "Expected range for healthy adults", device: "Various",
    provenance: "estimated",
    eigenvalueRange: [0.80, 0.95], eigenvalueMean: 0.88,
    daysRecorded: "3+ days",
    note: "Illustrative range based on known circadian temperature amplitude; not computed from a specific dataset — treat as approximate"
  },
  {
    signalType: "spo2", label: "Blood Oxygen",
    source: "Illustrative estimate",
    population: "Expected range for healthy adults", device: "Various",
    provenance: "estimated",
    eigenvalueRange: [0.30, 0.65], eigenvalueMean: 0.48,
    daysRecorded: "3+ days",
    note: "Illustrative estimate; SpO2 has minimal circadian variation — low eigenvalues expected in healthy individuals"
  },
];

function BenchmarkComparison({ entries }: { entries: ComparisonEntry[] }) {
  const personalByType: Record<string, ComparisonEntry[]> = {};
  for (const e of entries) {
    const t = e.result.signalType;
    if (!personalByType[t]) personalByType[t] = [];
    personalByType[t].push(e);
  }

  const matchedTypes = REFERENCE_BENCHMARKS.filter(b => personalByType[b.signalType]);
  if (matchedTypes.length === 0) return null;

  const colorMap: Record<string, string> = {
    heart_rate: "#f43f5e", cgm: "#a855f7", hrv: "#06b6d4",
    temperature: "#f97316", activity: "#eab308", spo2: "#3b82f6",
    ecg_waveform: "#64748b", generic: "#94a3b8"
  };

  const signalTypes = Array.from(new Set(matchedTypes.map(b => b.signalType))) as SignalType[];

  return (
    <Card className="bg-gradient-to-br from-slate-900/80 to-cyan-900/10 border-cyan-500/25" data-testid="card-benchmark-comparison">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-cyan-400" />
          Population Reference Benchmarks
        </CardTitle>
        <CardDescription className="text-xs">
          Your eigenvalues compared to published reference datasets — where do your signals fall?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signalTypes.map((sigType: SignalType) => {
          const info = SIGNAL_INFO[sigType];
          const Icon = info.icon;
          const benchmarks = matchedTypes.filter(b => b.signalType === sigType);
          const personal = personalByType[sigType] || [];
          const color = colorMap[sigType] || "#94a3b8";

          return (
            <div key={sigType} className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                <span className="text-[11px] font-semibold text-slate-800">{info.label}</span>
              </div>

              {benchmarks.map((bench, bi) => {
                const rangeLeft = bench.eigenvalueRange[0] * 100;
                const rangeWidth = (bench.eigenvalueRange[1] - bench.eigenvalueRange[0]) * 100;
                const meanPos = bench.eigenvalueMean * 100;

                return (
                  <div key={bi} className="ml-5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500">{bench.label} — {bench.source}</span>
                      <span className="text-[8px] text-slate-500">{bench.population} {bench.provenance === "estimated" ? "(estimate)" : "(computed)"}</span>
                    </div>
                    <div className="relative h-6 bg-slate-50 rounded-full border border-slate-200/40">
                      <div className="absolute top-0 h-full rounded-full opacity-25"
                        style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%`, backgroundColor: color }} />
                      <div className="absolute top-0 h-full w-0.5 opacity-50"
                        style={{ left: `${meanPos}%`, backgroundColor: color }} />
                      <div className="absolute -top-0.5 w-3 h-3 rounded-full border flex items-center justify-center"
                        style={{ left: `${meanPos}%`, transform: "translateX(-50%)", backgroundColor: `${color}30`, borderColor: `${color}80` }}>
                        <span className="text-[6px] font-bold" style={{ color }}>R</span>
                      </div>

                      {personal.map((p, pi) => {
                        const pev = Math.min(p.result.ar2Hourly.eigenvalue, 1) * 100;
                        const isAbove = p.result.ar2Hourly.eigenvalue > bench.eigenvalueRange[1];
                        const isBelow = p.result.ar2Hourly.eigenvalue < bench.eigenvalueRange[0];
                        const isInRange = !isAbove && !isBelow;
                        return (
                          <div key={pi} className="absolute top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                            style={{
                              left: `${pev}%`, transform: "translateX(-50%)",
                              backgroundColor: isInRange ? "#22c55e20" : isAbove ? "#3b82f620" : "#f9731620",
                              borderColor: isInRange ? "#22c55e" : isAbove ? "#3b82f6" : "#f97316",
                            }}>
                            <span className="text-[7px] font-bold" style={{ color: isInRange ? "#22c55e" : isAbove ? "#3b82f6" : "#f97316" }}>Y</span>
                          </div>
                        );
                      })}

                      {[0, 0.25, 0.5, 0.75, 1.0].map(v => (
                        <div key={v} className="absolute top-full w-px h-1 bg-slate-200" style={{ left: `${v * 100}%` }}>
                          {(v === 0 || v === 0.5 || v === 1.0) && (
                            <span className="absolute top-1.5 -translate-x-1/2 text-[7px] text-slate-500">{v.toFixed(1)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[8px] text-slate-500 mt-1">
                      <span>Range: {bench.eigenvalueRange[0].toFixed(2)}–{bench.eigenvalueRange[1].toFixed(2)} | Mean: {bench.eigenvalueMean.toFixed(2)}</span>
                      <span>{bench.daysRecorded} | {bench.device}</span>
                    </div>
                    {personal.map((p, pi) => {
                      const ev = p.result.ar2Hourly.eigenvalue;
                      const isAbove = ev > bench.eigenvalueRange[1];
                      const isBelow = ev < bench.eigenvalueRange[0];
                      const diff = ev - bench.eigenvalueMean;
                      const pctDiff = ((diff / bench.eigenvalueMean) * 100).toFixed(1);
                      return (
                        <div key={pi} className="flex items-center gap-2 text-[9px]">
                          <span className="font-mono font-bold" style={{ color }}>Your |λ| = {ev.toFixed(4)}</span>
                          <span className={isAbove ? "text-blue-400" : isBelow ? "text-orange-400" : "text-green-400"}>
                            {bench.provenance === "estimated"
                              ? (isAbove ? `Higher than estimate (+${pctDiff}%)` : isBelow ? `Lower than estimate (${pctDiff}%)` : `Near estimated range (${diff >= 0 ? "+" : ""}${pctDiff}%)`)
                              : (isAbove ? `Above sample value (+${pctDiff}%)` : isBelow ? `Below sample value (${pctDiff}%)` : `Similar to sample (${diff >= 0 ? "+" : ""}${pctDiff}%)`)
                            }
                          </span>
                        </div>
                      );
                    })}
                    <p className="text-[8px] text-slate-500 italic">{bench.note}</p>
                  </div>
                );
              })}
            </div>
          );
        })}

        <div className="flex items-center gap-4 pt-2 border-t border-slate-200 text-[9px] text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center"><span className="text-[6px] text-green-400 font-bold">Y</span></div>
            <span>Your data (in range)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center"><span className="text-[6px] text-blue-400 font-bold">Y</span></div>
            <span>Your data (above)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500/20 border border-orange-500 flex items-center justify-center"><span className="text-[6px] text-orange-400 font-bold">Y</span></div>
            <span>Your data (below)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-slate-500/20 border border-slate-300 flex items-center justify-center"><span className="text-[6px] text-slate-500 font-bold">R</span></div>
            <span>Reference mean</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <h5 className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Important context
          </h5>
          <ul className="text-[9px] text-slate-500 space-y-0.5">
            <li>- Reference ranges are from small public datasets and literature estimates, not large clinical studies</li>
            <li>- Different devices, sampling rates, and wear patterns affect eigenvalues — direct comparison across devices has limitations</li>
            <li>- "Within range" means your value falls within the observed range, not that it's clinically normal or abnormal</li>
            <li>- No validated clinical thresholds exist for wearable eigenvalues — these are research-grade reference points only</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function ResilienceMap({ entries }: { entries: ComparisonEntry[] }) {
  const sortedEntries = [...entries].sort((a, b) => b.result.ar2Hourly.eigenvalue - a.result.ar2Hourly.eigenvalue);

  const persistenceGap = sortedEntries.length >= 2
    ? sortedEntries[0].result.ar2Hourly.eigenvalue - sortedEntries[sortedEntries.length - 1].result.ar2Hourly.eigenvalue
    : 0;

  const colorMap: Record<string, string> = {
    heart_rate: "#f43f5e", cgm: "#a855f7", hrv: "#06b6d4",
    temperature: "#f97316", activity: "#eab308", spo2: "#3b82f6",
    ecg_waveform: "#64748b", generic: "#94a3b8"
  };

  const roleMap: Record<string, { role: string; analogy: string }> = {
    heart_rate: { role: "Rhythm Leader", analogy: "If persistent: stable daily HR cycle (like a clock gene maintaining rhythm)" },
    cgm: { role: "Metabolic Rhythm", analogy: "If persistent: consistent glucose-meal cycle follows daily timing" },
    hrv: { role: "Flexibility Indicator", analogy: "Low persistence expected — a responsive, adaptive system should be 'messy'" },
    temperature: { role: "Thermal Coupling", analogy: "If persistent: thermoregulation follows a consistent daily arc" },
    activity: { role: "Behavioral Driver", analogy: "Reflects schedule regularity, heavily influenced by voluntary behavior" },
    spo2: { role: "Stability Marker", analogy: "Weak circadian signal — mainly useful for detecting sleep-disordered breathing" },
    ecg_waveform: { role: "Wrong Timescale", analogy: "Measures heartbeat regularity (milliseconds), not circadian rhythm (hours)" },
    generic: { role: "Unknown Signal", analogy: "Interpretation depends on what this data actually represents" },
  };

  return (
    <div className="space-y-6">
      <Card className="bg-white border-slate-200" data-testid="card-resilience-map">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            Cross-Signal Persistence Map
          </CardTitle>
          <CardDescription className="text-xs">
            Comparing eigenvalue persistence across {entries.length} signals — ordered from most to least persistent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <div className="flex items-center justify-between text-[9px] text-slate-500 mb-1 px-1">
              <span>Low persistence (0.0)</span>
              <span>High persistence (1.0)</span>
            </div>
            <div className="h-4 rounded-full bg-gradient-to-r from-blue-500/20 via-green-500/20 via-60% to-red-500/20 border border-slate-200 relative mb-6">
              <div className="absolute -bottom-1 left-0 w-full h-0.5">
                {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(v => (
                  <div key={v} className="absolute top-0 w-px h-2 bg-slate-600" style={{ left: `${v * 100}%` }}>
                    <span className="absolute top-2.5 -translate-x-1/2 text-[8px] text-slate-500">{v.toFixed(1)}</span>
                  </div>
                ))}
              </div>
              {sortedEntries.map((entry, i) => {
                const ev = entry.result.ar2Hourly.eigenvalue;
                const color = colorMap[entry.result.signalType] || "#94a3b8";
                return (
                  <div key={entry.id} className="absolute -top-2 -translate-x-1/2" style={{ left: `${Math.min(ev, 1) * 100}%` }}>
                    <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold"
                      style={{ backgroundColor: `${color}30`, borderColor: color, color }}>
                      {i + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            {sortedEntries.map((entry, i) => {
              const info = SIGNAL_INFO[entry.result.signalType];
              const Icon = info.icon;
              const ev = entry.result.ar2Hourly.eigenvalue;
              const color = colorMap[entry.result.signalType] || "#94a3b8";
              const role = roleMap[entry.result.signalType] || roleMap.generic;
              return (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                      <span className="text-xs font-medium text-slate-800">{info.label}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color }}>|λ| = {ev.toFixed(4)}</span>
                      <Badge variant="outline" className="text-[8px] px-1.5 py-0">{role.role}</Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{role.analogy}</p>
                    <div className="flex gap-3 mt-1 text-[9px] text-slate-500">
                      <span>R² = {entry.result.ar2Hourly.r2.toFixed(3)}</span>
                      <span>{entry.result.daysOfData.toFixed(1)} days</span>
                      <span>{entry.result.sampleCount.toLocaleString()} samples</span>
                      <span className="italic truncate">{entry.result.fileName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {entries.length >= 2 && (
            <Card className="bg-indigo-500/5 border-indigo-500/20">
              <CardContent className="p-4 space-y-3">
                <h4 className="text-xs font-semibold text-indigo-300 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4" /> Cross-Signal Analysis
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 text-center">
                    <div className="text-lg font-bold text-cyan-400">{persistenceGap.toFixed(4)}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Persistence Gap</div>
                    <div className="text-[9px] text-slate-500">(highest - lowest |λ|)</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 text-center">
                    <div className="text-lg font-bold text-amber-400">
                      {(entries.reduce((s, e) => s + e.result.ar2Hourly.eigenvalue, 0) / entries.length).toFixed(4)}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">Mean Persistence</div>
                    <div className="text-[9px] text-slate-500">across all signals</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 text-center">
                    <div className="text-lg font-bold text-green-400">{entries.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Signals Compared</div>
                    <div className="text-[9px] text-slate-500">in this analysis</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/15">
                  <h5 className="text-[10px] font-semibold text-green-400 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> What this comparison actually shows
                  </h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Each signal has its own temporal persistence when measured by AR(2). Signals with higher |λ| maintain their pattern more
                    consistently from one time step to the next. The persistence gap shows how much variation exists between your most
                    and least persistent signals — a kind of "dynamic range" of your body's timing signatures.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                  <h5 className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Same-person requirement
                  </h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Cross-signal comparison is only meaningful when all datasets come from the <strong>same person</strong> during
                    overlapping time periods. Comparing signals from different people tells you nothing about one individual's
                    circadian coordination. The sample datasets here are from different studies and different individuals —
                    they demonstrate how the engine works, but their comparison has no biological meaning.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                  <h5 className="text-[10px] font-semibold text-red-400 mb-1 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> What this comparison does NOT show
                  </h5>
                  <ul className="text-[10px] text-slate-500 leading-relaxed space-y-1">
                    <li>- Whether these signals are causally related to each other (they're analyzed independently)</li>
                    <li>- Whether your persistence pattern matches tissue-level clock gene behavior (untested hypothesis)</li>
                    <li>- Any clinical diagnosis or health status — this is a research exploration tool</li>
                    <li>- Signals from different time periods, devices, or people are not directly comparable</li>
                  </ul>
                </div>

                {entries.some(e => e.result.daysOfData < 1) && (
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
                    <h5 className="text-[10px] font-semibold text-amber-400 mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Data Duration Warning
                    </h5>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Some signals have less than 1 day of data. Circadian analysis ideally requires 3+ days of continuous recording
                      to distinguish real daily patterns from noise. Short recordings show within-session temporal persistence, not circadian rhythm.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sortedEntries.map(e => ({
                name: SIGNAL_INFO[e.result.signalType].label,
                eigenvalue: e.result.ar2Hourly.eigenvalue,
                fill: colorMap[e.result.signalType] || "#94a3b8",
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10, fill: "#64748b" }} label={{ value: "|λ|", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#64748b" } }} />
                <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", fontSize: 11, color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }} />
                <Bar dataKey="eigenvalue" radius={[4, 4, 0, 0]}>
                  {sortedEntries.map((entry, i) => (
                    <Cell key={i} fill={colorMap[entry.result.signalType] || "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WearableAnalysis() {
  const [selectedProfile, setSelectedProfile] = useState<"healthy" | "prediabetic" | "disrupted">("healthy");
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparisonEntries, setComparisonEntries] = useState<ComparisonEntry[]>([]);
  const [loadingAllSamples, setLoadingAllSamples] = useState(false);

  const profiles = useMemo(() => {
    const healthy = generateSyntheticCGM("healthy");
    const prediabetic = generateSyntheticCGM("prediabetic");
    const disrupted = generateSyntheticCGM("disrupted");
    const hourlyAvg = (data: number[]) => {
      const hourly: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const chunk = data.slice(i, i + 4);
        hourly.push(chunk.reduce((a, b) => a + b, 0) / chunk.length);
      }
      return hourly;
    };
    return {
      healthy: { raw: healthy, hourly: hourlyAvg(healthy), ar2: computeAR2(hourlyAvg(healthy)) },
      prediabetic: { raw: prediabetic, hourly: hourlyAvg(prediabetic), ar2: computeAR2(hourlyAvg(prediabetic)) },
      disrupted: { raw: disrupted, hourly: hourlyAvg(disrupted), ar2: computeAR2(hourlyAvg(disrupted)) },
    };
  }, []);

  const current = profiles[selectedProfile];

  const chartData = current.hourly.map((val, i) => ({
    hour: i, glucose: Math.round(val * 10) / 10, day: Math.floor(i / 24) + 1,
  }));

  const comparisonData = [
    { name: "Healthy", eigenvalue: profiles.healthy.ar2.eigenvalue, fill: "#22c55e" },
    { name: "Pre-Diabetic", eigenvalue: profiles.prediabetic.ar2.eigenvalue, fill: "#f97316" },
    { name: "Disrupted", eigenvalue: profiles.disrupted.ar2.eigenvalue, fill: "#ef4444" },
  ];

  const dayOverlayData = useMemo(() => {
    const data: { hour: number; day1: number; day2: number; day3: number }[] = [];
    for (let h = 0; h < 24; h++) {
      data.push({ hour: h, day1: current.hourly[h] || 0, day2: current.hourly[h + 24] || 0, day3: current.hourly[h + 48] || 0 });
    }
    return data;
  }, [current]);

  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [sampleContext, setSampleContext] = useState<typeof SAMPLE_DATASETS[0] | null>(null);
  const [appleHealthData, setAppleHealthData] = useState<AppleHealthExtraction | null>(null);
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  const addToComparison = useCallback((result: UploadResult, context: typeof SAMPLE_DATASETS[0] | null) => {
    const id = `${result.signalType}_${Date.now()}`;
    setComparisonEntries(prev => {
      const existing = prev.find(e => e.result.fileName === result.fileName);
      if (existing) return prev;
      return [...prev, { result, context, id }];
    });
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setSampleContext(null);
    setAppleHealthData(null);
    setZipProgress(null);

    const isZip = file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip" || file.type === "application/x-zip-compressed";

    if (isZip) {
      try {
        const extraction = await parseAppleHealthZip(file, (msg) => setZipProgress(msg));
        if ("error" in extraction) {
          setUploadError(extraction.error);
          setUploading(false);
          setZipProgress(null);
          return;
        }
        if (extraction.signals.length === 0) {
          setUploadError("No supported health signals found in this Apple Health export.");
          setUploading(false);
          setZipProgress(null);
          return;
        }
        setAppleHealthData(extraction);
        setZipProgress(null);
        setUploading(false);
      } catch (err) {
        console.error("ZIP parse error:", err);
        setUploadError("Failed to parse the ZIP file. Make sure it's a valid Apple Health export.");
        setUploading(false);
        setZipProgress(null);
      }
    } else {
      try {
        const text = await file.text();
        const result = processCSVText(text, file.name);
        if ("error" in result) {
          setUploadError(result.error);
          setUploading(false); return;
        }
        setUploadResult(result);
        addToComparison(result, null);
        setActiveTab("results");
      } catch (err) {
        console.error("Upload parse error:", err);
        setUploadError("Failed to read the file. Please make sure it's a valid CSV or text file with comma-separated values.");
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [addToComparison]);

  const handleAppleHealthSignalSelect = useCallback((signalType: string) => {
    if (!appleHealthData) return;
    setUploading(true);
    const csvText = appleHealthData.extractSignal(signalType);
    const info = APPLE_HEALTH_TYPES[signalType];
    const result = processCSVText(csvText, `Apple_Health_${info?.label?.replace(/[^a-zA-Z0-9]/g, "_") || signalType}.csv`);
    if ("error" in result) {
      setUploadError(result.error);
      setUploading(false);
      return;
    }
    setUploadResult(result);
    addToComparison(result, null);
    setActiveTab("results");
    setUploading(false);
  }, [appleHealthData, addToComparison]);

  const handleAnalyzeAllSignals = useCallback(() => {
    if (!appleHealthData) return;
    setUploading(true);
    const results: UploadResult[] = [];
    for (const sig of appleHealthData.signals) {
      const csvText = appleHealthData.extractSignal(sig.type);
      const info = APPLE_HEALTH_TYPES[sig.type];
      const result = processCSVText(csvText, `Apple_Health_${info?.label?.replace(/[^a-zA-Z0-9]/g, "_") || sig.type}.csv`);
      if (!("error" in result)) {
        results.push(result);
        addToComparison(result, null);
      }
    }
    if (results.length > 0) {
      setUploadResult(results[0]);
      setActiveTab("comparison");
    }
    setUploading(false);
  }, [appleHealthData, addToComparison]);

  const loadSampleDataset = useCallback(async (dataset: typeof SAMPLE_DATASETS[0]) => {
    setLoadingSampleId(dataset.id);
    setUploadError(null);
    try {
      const response = await fetch(dataset.url);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      const text = await response.text();
      const result = processCSVText(text, dataset.url.split("/").pop() || dataset.label);
      if ("error" in result) {
        setUploadError(result.error);
        setLoadingSampleId(null); return;
      }
      setUploadResult(result);
      setSampleContext(dataset);
      addToComparison(result, dataset);
      setActiveTab("results");
    } catch (err) {
      console.error("Sample load error:", err);
      setUploadError("Failed to load the sample dataset. Please try again.");
    } finally {
      setLoadingSampleId(null);
    }
  }, [addToComparison]);

  const loadAllSampleDatasets = useCallback(async () => {
    setLoadingAllSamples(true);
    setUploadError(null);
    const trioDatasets = SAMPLE_DATASETS.filter(ds =>
      ["apple_watch_hr", "dexcom_cgm"].includes(ds.id)
    );
    const newEntries: ComparisonEntry[] = [];
    for (const ds of trioDatasets) {
      try {
        const response = await fetch(ds.url);
        if (!response.ok) continue;
        const text = await response.text();
        const result = processCSVText(text, ds.url.split("/").pop() || ds.label);
        if ("error" in result) continue;
        newEntries.push({ result, context: ds, id: `${result.signalType}_${Date.now()}_${ds.id}` });
      } catch { continue; }
    }
    if (newEntries.length > 0) {
      setComparisonEntries(prev => {
        const existingNames = new Set(prev.map(e => e.result.fileName));
        const filtered = newEntries.filter(e => !existingNames.has(e.result.fileName));
        return [...prev, ...filtered];
      });
      const lastEntry = newEntries[newEntries.length - 1];
      setUploadResult(lastEntry.result);
      setSampleContext(lastEntry.context);
      setActiveTab("comparison");
    }
    setLoadingAllSamples(false);
  }, []);

  const generateReport = useCallback(() => {
    if (!uploadResult) return;
    const info = SIGNAL_INFO[uploadResult.signalType];
    const lines = [
      "═══════════════════════════════════════════════════════════",
      "  PAR(2) WEARABLE CIRCADIAN PERSISTENCE REPORT",
      "═══════════════════════════════════════════════════════════",
      "",
      `File: ${uploadResult.fileName}`,
      `Date: ${new Date().toISOString().split("T")[0]}`,
      `Signal Type: ${info.label}`,
      `Device Format: ${uploadResult.deviceFormat}`,
      `Total Samples: ${uploadResult.sampleCount.toLocaleString()}`,
      `Hourly Samples: ${uploadResult.hourlySampleCount}`,
      `Days of Data: ${uploadResult.daysOfData.toFixed(1)}`,
      "",
      "───────────────────────────────────────────────────────────",
      "  CIRCADIAN RHYTHM SCORE",
      "───────────────────────────────────────────────────────────",
      "",
      `Score: ${uploadResult.circadianScore.score}/100 (${uploadResult.circadianScore.label})`,
      `${uploadResult.circadianScore.explanation}`,
      "",
      "───────────────────────────────────────────────────────────",
      "  AR(2) ANALYSIS (Hourly Resampled Data)",
      "───────────────────────────────────────────────────────────",
      "",
      `|λ| (eigenvalue modulus): ${uploadResult.ar2Hourly.eigenvalue.toFixed(4)}`,
      `φ₁ (lag-1 coefficient): ${uploadResult.ar2Hourly.phi1.toFixed(4)}`,
      `φ₂ (lag-2 coefficient): ${uploadResult.ar2Hourly.phi2.toFixed(4)}`,
      `R² (goodness of fit): ${uploadResult.ar2Hourly.r2.toFixed(4)}`,
      uploadResult.ar2Hourly.impliedPeriod ? `Implied Period: ${uploadResult.ar2Hourly.impliedPeriod.toFixed(1)} hours` : "",
      "",
      "───────────────────────────────────────────────────────────",
      "  DAY-OVER-DAY CONSISTENCY",
      "───────────────────────────────────────────────────────────",
      "",
      `Mean day-to-day correlation: ${uploadResult.dayConsistency.meanCorrelation.toFixed(3)}`,
      ...uploadResult.dayConsistency.correlations.map((c, i) => `  Day ${i+1} → Day ${i+2}: r = ${c.toFixed(3)}`),
      "",
      "───────────────────────────────────────────────────────────",
      "  WHAT THIS TELLS YOU",
      "───────────────────────────────────────────────────────────",
      "",
      ...info.whatItTells.map(s => `  ✓ ${s}`),
      "",
      "───────────────────────────────────────────────────────────",
      "  WHAT THIS DOES NOT TELL YOU",
      "───────────────────────────────────────────────────────────",
      "",
      ...info.whatItDoesnt.map(s => `  ✗ ${s}`),
      "",
      "═══════════════════════════════════════════════════════════",
      "  IMPORTANT DISCLAIMERS",
      "═══════════════════════════════════════════════════════════",
      "",
      "This report is generated by the PAR(2) Discovery Engine,",
      "a RESEARCH TOOL. It is NOT a medical device, NOT a",
      "diagnostic tool, and NOT clinically validated.",
      "",
      "• Reference ranges shown are ILLUSTRATIVE, not clinical norms",
      "• The Circadian Rhythm Score has NO clinical validation",
      "• Do NOT make medical decisions based on this report",
      "• Consult qualified healthcare professionals for medical advice",
      "• The link between wearable-derived |λ| and tissue-level",
      "  circadian health is an UNTESTED HYPOTHESIS",
      "",
      `Engine: PAR(2) Discovery Engine v${APP_VERSION}`,
      "Algorithm: AR(2) Ordinary Least Squares",
      "Model: y(t) = φ₁·y(t-1) + φ₂·y(t-2) + ε",
      "═══════════════════════════════════════════════════════════",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PAR2_Wearable_Report_${uploadResult.fileName.replace(".csv", "")}_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [uploadResult]);

  const uploadHourlyChartData = useMemo(() => {
    if (!uploadResult) return [];
    return uploadResult.hourlyValues.map((val, i) => ({
      hour: i, value: Math.round(val * 100) / 100, day: Math.floor(i / 24) + 1
    }));
  }, [uploadResult]);

  const uploadDaySummaryData = useMemo(() => {
    if (!uploadResult || uploadResult.dayConsistency.dayData.length < 1) return [];
    const days = uploadResult.dayConsistency.dayData;
    const data: { hour: number; mean: number; min: number; max: number; p25: number; p75: number }[] = [];
    for (let h = 0; h < 24; h++) {
      const vals = days.map(d => d[h] || 0).filter(v => !isNaN(v)).sort((a, b) => a - b);
      if (vals.length === 0) { data.push({ hour: h, mean: 0, min: 0, max: 0, p25: 0, p75: 0 }); continue; }
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const p25 = vals[Math.floor(vals.length * 0.25)] || vals[0];
      const p75 = vals[Math.floor(vals.length * 0.75)] || vals[vals.length - 1];
      data.push({
        hour: h,
        mean: Math.round(mean * 100) / 100,
        min: Math.round(vals[0] * 100) / 100,
        max: Math.round(vals[vals.length - 1] * 100) / 100,
        p25: Math.round(p25 * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
      });
    }
    return data;
  }, [uploadResult]);

  const MAX_INDIVIDUAL_DAYS = 14;

  const uploadDayOverlayData = useMemo(() => {
    if (!uploadResult || uploadResult.dayConsistency.dayData.length < 1) return [];
    const days = uploadResult.dayConsistency.dayData.slice(0, MAX_INDIVIDUAL_DAYS);
    const data: Record<string, number>[] = [];
    for (let h = 0; h < 24; h++) {
      const point: Record<string, number> = { hour: h };
      days.forEach((day, i) => {
        point[`day${i + 1}`] = Math.round((day[h] || 0) * 100) / 100;
      });
      data.push(point);
    }
    return data;
  }, [uploadResult]);

  const dayColors = ["#22d3ee", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#facc15", "#60a5fa"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 text-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 bg-amber-500/8 border border-amber-500/25 rounded-lg px-4 py-3 flex items-start gap-3" data-testid="banner-research-preview">
          <FlaskConical className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Research Preview</p>
            <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
              This tool is under active development for research purposes. AR(2) eigenvalue analysis measures signal regularity and temporal persistence in your wearable data — it is not a clinical or diagnostic instrument. Results should be interpreted alongside professional medical guidance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Watch className="w-6 h-6 text-cyan-400" />
              Wearable Circadian Analysis
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your wearable data for AR(2) circadian persistence analysis with smart format detection
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 mb-6 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-300/80 space-y-1">
            <p>
              <strong>Research tool — not a medical device.</strong> Whether wearable-derived |λ| correlates
              with tissue-level circadian health is an <strong>unvalidated hypothesis</strong>. Reference
              ranges are illustrative. Do not use for medical decisions.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-slate-50 border border-slate-200">
            <TabsTrigger value="upload" data-testid="tab-upload">
              <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload & Analyze
            </TabsTrigger>
            <TabsTrigger value="results" data-testid="tab-results" disabled={!uploadResult}>
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Results
            </TabsTrigger>
            <TabsTrigger value="demo" data-testid="tab-demo">
              <Activity className="w-3.5 h-3.5 mr-1.5" /> Demo (Synthetic)
            </TabsTrigger>
            <TabsTrigger value="guide" data-testid="tab-guide">
              <Lightbulb className="w-3.5 h-3.5 mr-1.5" /> Signal Guide
            </TabsTrigger>
            <TabsTrigger value="comparison" data-testid="tab-comparison" disabled={comparisonEntries.length < 2}>
              <Layers className="w-3.5 h-3.5 mr-1.5" /> Comparison ({comparisonEntries.length})
            </TabsTrigger>
            <TabsTrigger value="limitations" data-testid="tab-limitations">
              <ShieldAlert className="w-3.5 h-3.5 mr-1.5" /> Honest Limitations
            </TabsTrigger>
          </TabsList>

          {/* UPLOAD TAB */}
          <TabsContent value="upload" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-cyan-400" />
                    Upload Your Wearable Data
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload a CSV or an Apple Health export ZIP. The engine auto-detects your device format,
                    signal type, and sampling rate — then resamples to circadian scale and runs AR(2) analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.tsv,.xls,.zip,text/csv,text/plain,application/csv,application/vnd.ms-excel,application/zip,application/x-zip-compressed"
                    onChange={handleFileUpload}
                    className="hidden"
                    data-testid="input-file-upload"
                  />
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="dropzone-upload"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                        <p className="text-sm text-muted-foreground">{zipProgress || "Analyzing your data..."}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <Upload className="w-10 h-10 text-slate-500" />
                        <p className="text-sm font-medium">Click to upload CSV or Apple Health ZIP</p>
                        <p className="text-xs text-muted-foreground">
                          Apple Health export ZIP, Fitbit, Garmin, Dexcom, Oura, Libre, or any CSV with numeric data
                        </p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] text-cyan-400 border-cyan-500/30">.csv</Badge>
                          <Badge variant="outline" className="text-[9px] text-cyan-400 border-cyan-500/30">.txt</Badge>
                          <Badge variant="outline" className="text-[9px] text-green-400 border-green-500/30">.zip (Apple Health)</Badge>
                        </div>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex gap-2" data-testid="text-upload-error">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-300">
                        <p className="font-semibold mb-1">Upload issue:</p>
                        <pre className="whitespace-pre-wrap font-sans text-red-300/90 text-[10px] leading-relaxed">{uploadError}</pre>
                        {!uploadError.includes("Record") && (
                          <p className="mt-2 text-red-400/70">
                            Tip: Make sure your file is a CSV with a header row and numeric data columns, or an Apple Health export ZIP.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {appleHealthData && (
                    <div className="mt-4 p-4 rounded-xl bg-green-500/5 border border-green-500/20" data-testid="apple-health-picker">
                      <h4 className="text-sm font-semibold text-green-300 mb-1 flex items-center gap-2">
                        <Watch className="w-4 h-4" />
                        Apple Health Export Detected
                      </h4>
                      <p className="text-[11px] text-slate-500 mb-3">
                        Found {appleHealthData.signals.length} signal type{appleHealthData.signals.length !== 1 ? "s" : ""} in your export. Pick which one to analyze:
                      </p>
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {appleHealthData.signals.map((sig) => {
                          const typeInfo = APPLE_HEALTH_TYPES[sig.type];
                          const isGood = sig.daysSpan >= 3 && sig.count >= 50;
                          const isOk = sig.daysSpan >= 1 && sig.count >= 20;
                          return (
                            <button
                              key={sig.type}
                              onClick={() => handleAppleHealthSignalSelect(sig.type)}
                              className="w-full text-left p-3 rounded-lg bg-slate-50 hover:bg-slate-200/80 border border-slate-200 hover:border-green-500/30 transition-all group"
                              data-testid={`btn-apple-signal-${sig.type}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {typeInfo?.signalType === "heart_rate" && <Heart className="w-3.5 h-3.5 text-rose-400" />}
                                  {typeInfo?.signalType === "hrv" && <Activity className="w-3.5 h-3.5 text-purple-400" />}
                                  {typeInfo?.signalType === "activity" && <Zap className="w-3.5 h-3.5 text-yellow-400" />}
                                  {typeInfo?.signalType === "temperature" && <Sun className="w-3.5 h-3.5 text-orange-400" />}
                                  {typeInfo?.signalType === "spo2" && <Droplets className="w-3.5 h-3.5 text-blue-400" />}
                                  {typeInfo?.signalType === "generic" && <Activity className="w-3.5 h-3.5 text-slate-500" />}
                                  <span className="text-[11px] font-medium text-green-300 group-hover:text-green-200">{sig.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[8px] ${isGood ? "text-green-400 border-green-500/30" : isOk ? "text-yellow-400 border-yellow-500/30" : "text-orange-400 border-orange-500/30"}`}>
                                    {isGood ? "ideal" : isOk ? "may work" : "limited"}
                                  </Badge>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-green-400 transition-colors" />
                                </div>
                              </div>
                              <div className="text-[9px] text-slate-500 mt-1 ml-5.5 flex flex-wrap gap-x-3">
                                <span>{sig.count.toLocaleString()} readings</span>
                                <span>{sig.daysSpan} days</span>
                                <span>{sig.firstDate} to {sig.lastDate}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-500 text-slate-900 text-[10px]"
                          onClick={handleAnalyzeAllSignals}
                          data-testid="btn-analyze-all-signals"
                        >
                          <Layers className="w-3 h-3 mr-1" /> Analyze All {appleHealthData.signals.length} Signals
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-slate-300 text-slate-500 text-[10px]"
                          onClick={() => setAppleHealthData(null)}
                        >
                          <X className="w-3 h-3 mr-1" /> Cancel
                        </Button>
                        <p className="text-[9px] text-slate-500">
                          Your data stays in your browser — nothing is uploaded to any server.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-500">What happens when you upload:</h4>
                    <div className="space-y-1.5 text-[10px] text-muted-foreground">
                      <div className="flex gap-2"><Badge variant="outline" className="text-[9px] shrink-0">1</Badge> Format detected (Apple Health ZIP, Fitbit CSV, Dexcom, etc.)</div>
                      <div className="flex gap-2"><Badge variant="outline" className="text-[9px] shrink-0">2</Badge> Signal classified (HR, HRV, CGM, activity, etc.)</div>
                      <div className="flex gap-2"><Badge variant="outline" className="text-[9px] shrink-0">3</Badge> Auto-resampled to hourly averages for circadian-scale analysis</div>
                      <div className="flex gap-2"><Badge variant="outline" className="text-[9px] shrink-0">4</Badge> AR(2) eigenvalue computed on resampled data</div>
                      <div className="flex gap-2"><Badge variant="outline" className="text-[9px] shrink-0">5</Badge> Circadian Rhythm Score generated with quality checks</div>
                      <div className="flex gap-2"><Badge variant="outline" className="text-[9px] shrink-0">6</Badge> Day-over-day consistency measured</div>
                    </div>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-green-500/5 border border-green-500/15">
                    <h4 className="text-xs font-semibold text-green-300 mb-2 flex items-center gap-1.5">
                      <Watch className="w-3.5 h-3.5" /> How to export from Apple Watch
                    </h4>
                    <div className="space-y-1 text-[10px] text-slate-500">
                      <p>1. Open the <strong>Health</strong> app on your iPhone</p>
                      <p>2. Tap your profile picture (top right)</p>
                      <p>3. Scroll down and tap <strong>Export All Health Data</strong></p>
                      <p>4. Wait for the export to prepare (can take a few minutes)</p>
                      <p>5. Save/share the ZIP file, then upload it here</p>
                    </div>
                    <p className="text-[9px] text-slate-500 mt-2">
                      The engine extracts heart rate, HRV, steps, and other signals from the ZIP automatically.
                      Your data stays in your browser — nothing is uploaded to any server.
                    </p>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                    <h4 className="text-xs font-semibold text-cyan-300 mb-2 flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5" /> Analyze real public datasets
                    </h4>
                    <p className="text-[10px] text-muted-foreground mb-2">
                      No wearable data handy? Click any dataset below to load it directly into the engine and see the results:
                    </p>
                    <div className="flex flex-col gap-2">
                      {SAMPLE_DATASETS.map((ds) => (
                        <button
                          key={ds.id}
                          onClick={() => loadSampleDataset(ds)}
                          disabled={loadingSampleId !== null}
                          className="w-full text-left p-2.5 rounded-lg bg-slate-50 hover:bg-slate-200/80 border border-slate-200 hover:border-cyan-500/30 transition-all group disabled:opacity-50"
                          data-testid={`btn-sample-${ds.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {ds.icon === "heart" && <Heart className="w-3.5 h-3.5 text-rose-400" />}
                              {ds.icon === "cgm" && <Droplets className="w-3.5 h-3.5 text-purple-400" />}
                              {ds.icon === "activity" && <Zap className="w-3.5 h-3.5 text-yellow-400" />}
                              {ds.icon === "clinical" && <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />}
                              <span className="text-[11px] font-medium text-cyan-300 group-hover:text-cyan-200">{ds.label}</span>
                              <Badge variant="outline" className="text-[8px] px-1 py-0 group-hover:text-slate-800 group-hover:border-slate-400 transition-colors">{ds.points} pts</Badge>
                            </div>
                            {loadingSampleId === ds.id ? (
                              <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                            )}
                          </div>
                          <p className="text-[9px] text-slate-500 group-hover:text-slate-800 mt-1 ml-5.5 leading-relaxed transition-colors">{ds.description}</p>
                          <p className="text-[9px] text-slate-500 group-hover:text-slate-600 mt-0.5 ml-5.5 italic transition-colors">Source: {ds.source}</p>
                        </button>
                      ))}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                        onClick={loadAllSampleDatasets}
                        disabled={loadingAllSamples || loadingSampleId !== null}
                        data-testid="button-load-both-compare"
                      >
                        {loadingAllSamples ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Loading both...</>
                        ) : (
                          <><Layers className="w-3.5 h-3.5 mr-1.5" /> Load Both &amp; Compare (HR + CGM)</>
                        )}
                      </Button>
                      <p className="text-[9px] text-slate-500 mt-1.5 text-center">
                        Loads both multi-day datasets and opens the cross-signal comparison
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-slate-500" />
                    What Works Best
                  </CardTitle>
                  <CardDescription className="text-xs">
                    The engine needs multi-day continuous data to detect circadian persistence
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15 space-y-2">
                    <h5 className="text-[11px] font-semibold text-green-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ideal data
                    </h5>
                    <div className="space-y-1.5 text-[10px] text-slate-600">
                      <div className="flex items-start gap-2">
                        <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                        <div><strong>Heart rate</strong> — 3+ days of continuous monitoring (e.g., Apple Watch, Fitbit, Garmin). Sampling every 5-15 minutes.</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Droplets className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                        <div><strong>Continuous glucose (CGM)</strong> — 3+ days from Dexcom, Libre, etc. Every 5-minute readings are ideal.</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 space-y-2">
                    <h5 className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" /> Can work, with caveats
                    </h5>
                    <div className="space-y-1 text-[10px] text-slate-500">
                      <p><strong>HRV, skin temperature, activity/steps</strong> — the engine will process them, but they need 3+ days of continuous data to show circadian patterns. Single-session recordings are too short.</p>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15 space-y-2">
                    <h5 className="text-[11px] font-semibold text-red-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> Won't produce meaningful results
                    </h5>
                    <div className="space-y-1 text-[10px] text-slate-500">
                      <p><strong>Raw ECG waveform</strong> — measures heartbeat shape (milliseconds), not circadian rhythm (hours). Wrong timescale entirely.</p>
                      <p><strong>Any data under 24 hours</strong> — you need at least one full day/night cycle, ideally 3+.</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground p-2 rounded bg-slate-50">
                    <strong>Key requirement:</strong> The engine resamples your data to hourly averages and fits an AR(2) model.
                    It needs enough daily cycles (3-7 days) to distinguish real circadian persistence from noise.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* RESULTS TAB */}
          <TabsContent value="results" className="space-y-6">
            {uploadResult && (() => {
              const info = SIGNAL_INFO[uploadResult.signalType];
              const Icon = info.icon;
              return (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Analysis Complete</Badge>
                      <span className="text-sm text-slate-500">{uploadResult.fileName}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-slate-200 text-slate-600" onClick={generateReport} data-testid="button-download-report">
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download Report
                      </Button>
                      <Button variant="outline" size="sm" className="border-slate-200 text-slate-600" onClick={() => { setUploadResult(null); setSampleContext(null); setActiveTab("upload"); }} data-testid="button-new-analysis">
                        <X className="w-3.5 h-3.5 mr-1.5" /> New Analysis
                      </Button>
                    </div>
                  </div>

                  {appleHealthData && appleHealthData.signals.length > 1 && (
                    <Card className="bg-slate-50 border-slate-200" data-testid="card-signal-switcher">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Watch className="w-3.5 h-3.5 text-green-400" />
                          <span className="text-[11px] font-semibold text-green-300">Switch Signal</span>
                          <span className="text-[9px] text-slate-500">({appleHealthData.signals.length} available from your Apple Health export)</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {appleHealthData.signals.map((sig) => {
                            const typeInfo = APPLE_HEALTH_TYPES[sig.type];
                            const isActive = uploadResult?.fileName?.includes(typeInfo?.label?.replace(/[^a-zA-Z0-9]/g, "_") || sig.type);
                            return (
                              <button
                                key={sig.type}
                                onClick={() => handleAppleHealthSignalSelect(sig.type)}
                                className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all flex items-center gap-1.5 ${
                                  isActive
                                    ? "bg-green-600/20 text-green-300 border border-green-500/40"
                                    : "bg-slate-100 text-slate-500 border border-slate-300/30 hover:bg-slate-600/50 hover:text-slate-800"
                                }`}
                                data-testid={`btn-switch-signal-${sig.type}`}
                              >
                                {typeInfo?.signalType === "heart_rate" && <Heart className="w-3 h-3 text-rose-400" />}
                                {typeInfo?.signalType === "hrv" && <Activity className="w-3 h-3 text-purple-400" />}
                                {typeInfo?.signalType === "activity" && <Zap className="w-3 h-3 text-yellow-400" />}
                                {typeInfo?.signalType === "temperature" && <Sun className="w-3 h-3 text-orange-400" />}
                                {typeInfo?.signalType === "spo2" && <Droplets className="w-3 h-3 text-blue-400" />}
                                {typeInfo?.signalType === "generic" && <Activity className="w-3 h-3 text-slate-500" />}
                                {sig.label}
                                <span className="text-[8px] text-slate-500">{sig.count.toLocaleString()}</span>
                              </button>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {sampleContext && (
                    <Card className="bg-indigo-500/5 border-indigo-500/20" data-testid="card-sample-context">
                      <CardContent className="p-4">
                        <h3 className="text-sm font-semibold text-indigo-300 mb-2 flex items-center gap-2">
                          <Info className="w-4 h-4" /> About this dataset
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed mb-3">{sampleContext.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/15">
                            <h4 className="text-[10px] font-semibold text-green-400 mb-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> What AR(2) actually measures here
                            </h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed">{sampleContext.whatItMeasures}</p>
                          </div>
                          <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/15">
                            <h4 className="text-[10px] font-semibold text-red-400 mb-1 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> What it does NOT measure
                            </h4>
                            <p className="text-[10px] text-slate-500 leading-relaxed">{sampleContext.whatItDoesNotMeasure}</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-slate-500 mt-2 italic">Source: {sampleContext.source}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Detection Summary */}
                  <Card className="bg-cyan-500/5 border-cyan-500/20" data-testid="card-detection-summary">
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                        <div>
                          <span className="text-slate-500 block">Signal Type</span>
                          <span className="font-semibold flex items-center gap-1.5 mt-0.5">
                            <Icon className={`w-3.5 h-3.5 ${info.color}`} /> {info.label}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Device Format</span>
                          <span className="font-semibold mt-0.5 capitalize">{uploadResult.deviceFormat.replace("_", " ")}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Raw Samples</span>
                          <span className="font-semibold mt-0.5">{uploadResult.sampleCount.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Hourly Points</span>
                          <span className="font-semibold mt-0.5">{uploadResult.hourlySampleCount}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Days of Data</span>
                          <span className="font-semibold mt-0.5">{uploadResult.daysOfData.toFixed(1)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Signal-Specific Guidance */}
                  {uploadResult.signalType === "ecg_waveform" && (
                    <Card className="bg-amber-500/5 border-amber-500/20" data-testid="card-ecg-warning">
                      <CardContent className="p-4 flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-300/80 space-y-2">
                          <p className="font-semibold text-amber-300">This is raw ECG waveform data — wrong timescale for circadian analysis</p>
                          <p>
                            Your file contains {uploadResult.sampleCount.toLocaleString()} high-frequency ECG samples
                            (individual heartbeats). PAR(2) works best on <strong>circadian-scale</strong> data —
                            measurements taken over days, not seconds.
                          </p>
                          <p>
                            The engine has resampled your data to {uploadResult.hourlySampleCount} hourly averages and
                            run AR(2) on that, but the results reflect heartbeat regularity, <strong>not circadian rhythm</strong>.
                          </p>
                          <p className="font-medium">
                            For meaningful circadian analysis, export <strong>hourly heart rate</strong> or{" "}
                            <strong>HRV per hour</strong> across 3+ days from your watch app.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {uploadResult.daysOfData < (SIGNAL_INFO[uploadResult.signalType].minDays || 1) && uploadResult.signalType !== "ecg_waveform" && (
                    <Card className="bg-amber-500/5 border-amber-500/20">
                      <CardContent className="p-4 flex gap-3">
                        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-300/80">
                          <p>
                            <strong>Limited data:</strong> Your file contains {uploadResult.daysOfData.toFixed(1)} days
                            of data. For reliable circadian analysis, {SIGNAL_INFO[uploadResult.signalType].minDays}+
                            days is recommended. Results should be interpreted with caution.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Main Results Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      {/* Circadian Score */}
                      <CircadianScoreCard score={uploadResult.circadianScore} circadianScore={uploadResult.circadianScore.score} />

                      {/* Hourly Time Series */}
                      <Card className="bg-white border-slate-200" data-testid="card-hourly-timeseries">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-400" />
                            {uploadResult.needsResampling ? "Hourly Resampled Data" : "Time Series"}
                          </CardTitle>
                          <CardDescription className="text-[10px]">
                            {uploadResult.needsResampling
                              ? `${uploadResult.sampleCount.toLocaleString()} raw samples → ${uploadResult.hourlySampleCount} hourly averages`
                              : `${uploadResult.sampleCount} data points`}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                            <AreaChart data={uploadHourlyChartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                              <defs>
                                <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                              <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }}
                                label={{ value: "Hour", position: "bottom", fill: "#64748b", fontSize: 10 }} />
                              <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }}
                                formatter={(v: number) => [v.toFixed(2), "Value"]} />
                              <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={1.5} fill="url(#uploadGrad)" dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      {/* Day-Over-Day Consistency */}
                      {uploadResult.dayConsistency.dayData.length >= 2 && (() => {
                        const totalDays = uploadResult.dayConsistency.dayData.length;
                        const corrs = uploadResult.dayConsistency.correlations;
                        const goodCorrs = corrs.filter(c => c > 0.8).length;
                        const okCorrs = corrs.filter(c => c > 0.5 && c <= 0.8).length;
                        const weakCorrs = corrs.filter(c => c <= 0.5).length;
                        return (
                        <Card className="bg-white border-slate-200" data-testid="card-day-consistency">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Clock className="w-4 h-4 text-purple-400" />
                              Day-Over-Day Consistency
                              <Badge variant="outline" className="text-[9px] text-slate-500 border-slate-300">{totalDays} days</Badge>
                            </CardTitle>
                            <CardDescription className="text-[10px]">
                              Mean daily pattern (bold line) with interquartile range (shaded). Mean correlation: {uploadResult.dayConsistency.meanCorrelation.toFixed(3)}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                              <AreaChart data={uploadDaySummaryData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }}
                                  label={{ value: "Hour of Day", position: "bottom", fill: "#64748b", fontSize: 10 }} />
                                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                                <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }}
                                  formatter={(value: number, name: string) => {
                                    const labels: Record<string, string> = { mean: "Mean", min: "Min", max: "Max", p25: "25th %ile", p75: "75th %ile" };
                                    return [typeof value === 'number' ? value.toFixed(1) : value, labels[name] || name];
                                  }} />
                                <Area type="monotone" dataKey="max" stroke="none" fill="#22d3ee" fillOpacity={0.05} name="max" />
                                <Area type="monotone" dataKey="p75" stroke="none" fill="#22d3ee" fillOpacity={0.12} name="p75" />
                                <Area type="monotone" dataKey="p25" stroke="none" fill="#0f172a" fillOpacity={1} name="p25" />
                                <Area type="monotone" dataKey="min" stroke="none" fill="#0f172a" fillOpacity={1} name="min" />
                                <Line type="monotone" dataKey="mean" stroke="#22d3ee" strokeWidth={2.5} dot={false} name="mean" />
                              </AreaChart>
                            </ResponsiveContainer>

                            <div className="mt-3 flex flex-wrap gap-3 text-[10px]">
                              {goodCorrs > 0 && (
                                <span className="text-green-400">{goodCorrs} strong (r&gt;0.8)</span>
                              )}
                              {okCorrs > 0 && (
                                <span className="text-yellow-400">{okCorrs} moderate (r 0.5–0.8)</span>
                              )}
                              {weakCorrs > 0 && (
                                <span className="text-red-400">{weakCorrs} weak (r&lt;0.5)</span>
                              )}
                            </div>

                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="mt-2 text-[10px] text-slate-500 hover:text-slate-800 p-1 h-auto" data-testid="btn-expand-individual-days">
                                  <Layers className="w-3 h-3 mr-1" /> Show individual days (first {Math.min(totalDays, MAX_INDIVIDUAL_DAYS)} of {totalDays})
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="mt-2">
                                  <ResponsiveContainer width="100%" height={180} minWidth={1} minHeight={1}>
                                    <LineChart data={uploadDayOverlayData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                      <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }}
                                        label={{ value: "Hour of Day", position: "bottom", fill: "#64748b", fontSize: 10 }} />
                                      <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                                      <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }} />
                                      {uploadResult.dayConsistency.dayData.slice(0, MAX_INDIVIDUAL_DAYS).map((_, i) => (
                                        <Line key={i} type="monotone" dataKey={`day${i + 1}`} stroke={dayColors[i % dayColors.length]}
                                          strokeWidth={1.5} dot={false} name={`Day ${i + 1}`} strokeOpacity={0.7} />
                                      ))}
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                                <Collapsible>
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="mt-1 text-[9px] text-slate-500 hover:text-slate-600 p-1 h-auto" data-testid="btn-expand-correlations">
                                      Show all {corrs.length} day-pair correlations
                                    </Button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="mt-2 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                                      {corrs.map((c, i) => (
                                        <Badge key={i} variant="outline" className={`text-[8px] ${c > 0.8 ? "text-green-400 border-green-500/30" : c > 0.5 ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30"}`}>
                                          D{i+1}→{i+2}: {c.toFixed(2)}
                                        </Badge>
                                      ))}
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              </CollapsibleContent>
                            </Collapsible>
                          </CardContent>
                        </Card>
                        );
                      })()}
                    </div>

                    {/* Right Column */}
                    <div className="space-y-4">
                      {/* Eigenvalue Gauge */}
                      <Card className="bg-white border-slate-200" data-testid="card-eigenvalue-result">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">AR(2) Eigenvalue (Hourly)</CardTitle>
                          <CardDescription className="text-[10px]">Persistence of circadian-scale signal</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center">
                          <EigenvalueGauge value={uploadResult.ar2Hourly.eigenvalue} label="Hourly |λ|" />
                          <div className="mt-3 w-full space-y-2 text-[10px] text-muted-foreground">
                            <div className="flex justify-between"><span>φ₁</span><span className="font-mono">{uploadResult.ar2Hourly.phi1.toFixed(4)}</span></div>
                            <div className="flex justify-between"><span>φ₂</span><span className="font-mono">{uploadResult.ar2Hourly.phi2.toFixed(4)}</span></div>
                            <div className="flex justify-between"><span>R²</span><span className="font-mono">{uploadResult.ar2Hourly.r2.toFixed(4)}</span></div>
                            <div className="flex justify-between"><span>|λ|</span><span className="font-mono font-bold">{uploadResult.ar2Hourly.eigenvalue.toFixed(4)}</span></div>
                            {uploadResult.ar2Hourly.impliedPeriod && (
                              <div className="flex justify-between"><span>Period</span><span className="font-mono">{uploadResult.ar2Hourly.impliedPeriod.toFixed(1)} hrs</span></div>
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Reference Ranges */}
                      <ReferenceRangeChart eigenvalue={uploadResult.ar2Hourly.eigenvalue} signalType={uploadResult.signalType} />

                      {/* What It Tells You */}
                      <Card className="bg-white border-slate-200" data-testid="card-interpretation">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-400" />
                            Interpretation for {info.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-[10px]">
                          <div className="p-2 rounded bg-green-500/5 border border-green-500/10">
                            <h5 className="font-semibold text-green-300 mb-1">This tells you:</h5>
                            <ul className="list-disc ml-3 space-y-0.5 text-muted-foreground">
                              {info.whatItTells.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                          <div className="p-2 rounded bg-red-500/5 border border-red-500/10">
                            <h5 className="font-semibold text-red-300 mb-1">This does NOT tell you:</h5>
                            <ul className="list-disc ml-3 space-y-0.5 text-muted-foreground">
                              {info.whatItDoesnt.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              );
            })()}
          </TabsContent>

          {/* DEMO TAB */}
          <TabsContent value="demo" className="space-y-6">
            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-3 flex gap-2">
                <FlaskConical className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80">
                  <strong>Synthetic data.</strong> The glucose profiles below are computer-generated simulations,
                  not real patient data. They demonstrate how circadian rhythm strength affects AR(2) eigenvalue.
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {([
                { key: "healthy" as const, label: "Healthy Rhythm", icon: Sun, color: "text-emerald-400", desc: "Strong circadian pattern, tight glucose control" },
                { key: "prediabetic" as const, label: "Pre-Diabetic", icon: AlertTriangle, color: "text-orange-400", desc: "Weakened rhythm, elevated baseline" },
                { key: "disrupted" as const, label: "Circadian Disrupted", icon: Moon, color: "text-red-400", desc: "Shift-work pattern, minimal structure" },
              ]).map(({ key, label, icon: Icon, color, desc }) => (
                <Card key={key}
                  className={`cursor-pointer transition-all ${selectedProfile === key ? "bg-slate-50 border-cyan-500/50 ring-1 ring-cyan-500/30" : "bg-white border-slate-200 hover:border-slate-200"}`}
                  onClick={() => setSelectedProfile(key)} data-testid={`card-profile-${key}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={`w-4 h-4 ${color}`} />
                      <span className="font-semibold text-sm">{label}</span>
                      {selectedProfile === key && <Badge variant="secondary" className="ml-auto text-[10px]">Selected</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-cyan-400" /> 72-Hour Glucose Trace (Simulated)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                        <defs>
                          <linearGradient id="glucoseGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }}
                          formatter={(v: number) => [`${v.toFixed(1)} mg/dL`, "Glucose"]} />
                        <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="3 3" />
                        <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="3 3" />
                        <Area type="monotone" dataKey="glucose" stroke="#06b6d4" strokeWidth={1.5} fill="url(#glucoseGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" /> Day-Over-Day Overlay
                    </CardTitle>
                    <CardDescription className="text-[10px]">Tighter overlap = stronger circadian persistence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180} minWidth={1} minHeight={1}>
                      <LineChart data={dayOverlayData} margin={{ top: 10, right: 10, bottom: 20, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={["auto", "auto"]} />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }} />
                        <Line type="monotone" dataKey="day1" stroke="#22d3ee" strokeWidth={2} dot={false} name="Day 1" />
                        <Line type="monotone" dataKey="day2" stroke="#a78bfa" strokeWidth={2} dot={false} name="Day 2" />
                        <Line type="monotone" dataKey="day3" stroke="#fb923c" strokeWidth={2} dot={false} name="Day 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">AR(2) Eigenvalue</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <EigenvalueGauge value={current.ar2.eigenvalue} label={selectedProfile === "healthy" ? "Healthy" : selectedProfile === "prediabetic" ? "Pre-Diabetic" : "Disrupted"} />
                    <div className="mt-3 w-full space-y-2 text-[10px] text-muted-foreground">
                      <div className="flex justify-between"><span>φ₁</span><span className="font-mono">{current.ar2.phi1.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>φ₂</span><span className="font-mono">{current.ar2.phi2.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>R²</span><span className="font-mono">{current.ar2.r2.toFixed(4)}</span></div>
                      <div className="flex justify-between"><span>|λ|</span><span className="font-mono font-bold">{current.ar2.eigenvalue.toFixed(4)}</span></div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Three-Profile Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={150} minWidth={1} minHeight={1}>
                      <BarChart data={comparisonData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 9 }} />
                        <YAxis domain={[0, 1]} tick={{ fill: "#64748b", fontSize: 9 }} />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px", color: "#475569" }} itemStyle={{ color: "#475569" }} labelStyle={{ color: "#334155" }}
                          formatter={(v: number) => [v.toFixed(4), "|λ|"]} />
                        <Bar dataKey="eigenvalue" radius={[4, 4, 0, 0]}>
                          {comparisonData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* SIGNAL GUIDE TAB */}
          <TabsContent value="guide" className="space-y-6">
            <Card className="bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-cyan-400" />
                  What This Engine Does
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-[11px] text-slate-600">
                <p>
                  The wearable engine takes a CSV of time-stamped physiological data, resamples it to hourly averages,
                  and fits an AR(2) autoregressive model. From this model it extracts the eigenvalue modulus |λ|,
                  which measures how persistently the signal repeats its pattern from one time step to the next.
                </p>
                <p>
                  For multi-day recordings, this captures <strong>circadian persistence</strong> — whether your
                  body's daily rhythm repeats consistently. For shorter recordings, it measures
                  within-session temporal regularity, which is a different (less informative) thing.
                </p>
              </CardContent>
            </Card>

            <h3 className="text-sm font-semibold text-slate-600">Signals with sample data available</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["heart_rate", "cgm"] as SignalType[]).map((type) => {
                const info = SIGNAL_INFO[type];
                const Icon = info.icon;
                return (
                  <Card key={info.type} className="bg-white border-cyan-500/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${info.color}`} />
                        {info.label}
                        <Badge variant="outline" className="ml-auto text-[9px] text-green-400">
                          sample data available
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-[10px] text-muted-foreground">
                      <p>{info.description}</p>
                      <div className="flex gap-4">
                        <div><span className="text-slate-500">Ideal sampling:</span> {info.idealSampling}</div>
                        <div><span className="text-slate-500">Min days:</span> {info.minDays}+</div>
                      </div>
                      <div className="p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <p className="font-semibold text-emerald-300 mb-1">Tells you:</p>
                        <ul className="list-disc ml-3 space-y-0.5">
                          {info.whatItTells.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <div className="p-2 rounded bg-red-500/5 border border-red-500/10">
                        <p className="font-semibold text-red-300 mb-1">Does NOT tell you:</p>
                        <ul className="list-disc ml-3 space-y-0.5">
                          {info.whatItDoesnt.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <p className="text-[9px] text-slate-500 italic">Strategy: {info.resampleStrategy}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <h3 className="text-sm font-semibold text-slate-600 mt-4">Other signals the engine can process</h3>
            <p className="text-[10px] text-slate-500 -mt-2">
              If you upload your own multi-day data in these formats, the engine will analyze it — but no sample datasets are provided.
              All require 3+ days of continuous recording for meaningful circadian analysis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(["hrv", "temperature", "activity", "spo2"] as SignalType[]).map((type) => {
                const info = SIGNAL_INFO[type];
                const Icon = info.icon;
                return (
                  <Card key={info.type} className="bg-white border-slate-200">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 ${info.color}`} />
                        <span className="text-[11px] font-medium text-slate-800">{info.label}</span>
                        <Badge variant="outline" className={`ml-auto text-[8px] ${info.circadianRelevance === "high" ? "text-green-400" : info.circadianRelevance === "medium" ? "text-yellow-400" : "text-orange-400"}`}>
                          {info.circadianRelevance}
                        </Badge>
                      </div>
                      <p className="text-[9px] text-slate-500">{info.description}</p>
                      <p className="text-[9px] text-slate-500">Min: {info.minDays}+ days, {info.idealSampling}</p>
                    </CardContent>
                  </Card>
                );
              })}
              <Card className="bg-white border-red-500/20">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[11px] font-medium text-slate-800">Raw ECG Waveform</span>
                    <Badge variant="outline" className="ml-auto text-[8px] text-red-400">
                      not suitable
                    </Badge>
                  </div>
                  <p className="text-[9px] text-slate-500">
                    Sub-second electrical signals. Wrong timescale for circadian analysis — the engine will flag this automatically.
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] font-medium text-slate-800">Any CSV Time Series</span>
                    <Badge variant="outline" className="ml-auto text-[8px] text-slate-500">
                      auto-detect
                    </Badge>
                  </div>
                  <p className="text-[9px] text-slate-500">
                    Upload any timestamped numeric data. The engine auto-detects the signal type, resamples to hourly, and runs AR(2).
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COMPARISON TAB */}
          <TabsContent value="comparison" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Cross-Signal Resilience Map
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Comparing AR(2) eigenvalue persistence across multiple physiological signals
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={() => setComparisonEntries([])}
                  data-testid="button-clear-comparison"
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Clear All
                </Button>
              </div>
            </div>

            {comparisonEntries.length >= 3 && (
              <CircadianFingerprint entries={comparisonEntries} />
            )}

            {comparisonEntries.length >= 2 && (
              <Card className="bg-gradient-to-br from-slate-900/80 to-cyan-900/10 border-cyan-500/25 opacity-75" data-testid="card-benchmark-locked">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Population Reference Benchmarks
                    <span className="ml-auto text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">Coming Soon</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Compare your eigenvalues against reference datasets from published wearable studies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-2">
                    <p className="text-xs text-amber-300/90 font-medium">Why is this locked?</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Our current reference data comes from single-participant sample files and illustrative estimates — not from validated population studies. Showing your eigenvalue "above" or "below" a single person's recording could be misleading. We're locking this panel until we have properly computed reference ranges from multi-participant datasets with known demographics.
                    </p>
                    <div className="flex items-start gap-2 mt-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500/70 mt-0.5 shrink-0" />
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        The AR(2) eigenvalue computation on <em>your</em> data is fully functional and mathematically sound. Only the population comparison is gated — it needs real population data to be meaningful.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Heart Rate", "Glucose (CGM)", "Steps"].map(sig => (
                      <div key={sig} className="bg-slate-100 border border-slate-200 rounded-md p-3 text-center">
                        <div className="h-8 bg-slate-100 rounded mb-2 flex items-center justify-center">
                          <Lock className="w-3 h-3 text-slate-500" />
                        </div>
                        <span className="text-[9px] text-slate-500">{sig}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {comparisonEntries.length >= 2 ? (
              <ResilienceMap entries={comparisonEntries} />
            ) : (
              <Card className="bg-white border-slate-200">
                <CardContent className="p-8 text-center">
                  <Layers className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Load at least 2 datasets to compare. Each analysis you run is automatically added here.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* LIMITATIONS TAB */}
          <TabsContent value="limitations" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-red-500/5 border-red-500/20">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    The Fundamental Gap
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <p>
                    PAR(2) was designed for <strong>gene expression time series</strong> — measurements of how
                    active specific genes are inside cells, sampled every 2-4 hours over 24-48 hours.
                  </p>
                  <p>
                    Wearable devices measure <strong>physiological signals</strong> (heart rate, glucose, temperature)
                    — these are downstream outputs of many biological systems, not direct readouts of clock gene activity.
                  </p>
                  <p className="font-semibold text-red-300">
                    The assumption that wearable-derived |λ| tracks tissue-level circadian clock health
                    has NOT been tested. No study has paired wearable data with tissue biopsies to validate
                    this connection.
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Key Confounders
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  {[
                    { factor: "Behavior", detail: "Exercise, meals, caffeine, alcohol all affect HR/glucose independently of circadian clock" },
                    { factor: "Sleep schedule", detail: "Social jetlag and alarm clocks mask endogenous circadian timing" },
                    { factor: "Stress", detail: "Acute stress alters HRV and heart rate regardless of circadian state" },
                    { factor: "Medication", detail: "Beta-blockers, insulin, stimulants directly affect measured signals" },
                    { factor: "Sensor noise", detail: "Wearable sensors have measurement error that can inflate or deflate |λ|" },
                    { factor: "Data gaps", detail: "Removing the watch, poor skin contact, or charging creates missing data" },
                  ].map(({ factor, detail }, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-semibold text-amber-300 w-24 shrink-0">{factor}:</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-blue-400" />
                    AR(2) Model Limitations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <p><strong>Linear model:</strong> AR(2) assumes linear dynamics. Biological rhythms often have nonlinear features (sharp spikes, asymmetric waveforms) that AR(2) cannot capture.</p>
                  <p><strong>Two-lag memory:</strong> Only looks two time steps back. If your circadian rhythm has longer-range dependencies, AR(2) may miss them.</p>
                  <p><strong>Stationarity assumed:</strong> AR(2) assumes the signal's statistical properties don't change over time. Jet lag, illness, or lifestyle changes violate this.</p>
                  <p><strong>No causation:</strong> A high |λ| means temporal persistence, not circadian health. Many non-circadian processes produce persistent signals.</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-slate-200">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-slate-500" />
                    Medical Disclaimer
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground/80">
                    This tool is NOT a medical device. It is NOT FDA-approved or CE-marked. It provides
                    NO medical diagnosis, prognosis, or treatment recommendations.
                  </p>
                  <p>
                    The Circadian Rhythm Score, reference ranges, and all interpretive text are
                    illustrative research outputs with NO clinical validation. They must not be used
                    to make decisions about your health, medication, or lifestyle.
                  </p>
                  <p>
                    If you have concerns about your circadian rhythm, sleep, heart, or metabolic health,
                    consult a qualified healthcare professional.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
