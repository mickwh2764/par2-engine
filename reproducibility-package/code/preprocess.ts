import * as fs from "fs";
import * as path from "path";

export interface GeneTimeSeries {
  gene: string;
  values: number[];
}

export function loadCSV(filePath: string): GeneTimeSeries[] {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");
  const results: GeneTimeSeries[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const gene = cols[0].trim().replace(/"/g, "");
    const values = cols.slice(1).map((v) => parseFloat(v)).filter((v) => !isNaN(v));
    if (values.length >= 5) {
      results.push({ gene, values });
    }
  }
  return results;
}

const ENSEMBL_TO_SYMBOL: Record<string, string> = {
  ENSMUSG00000020893: "Per1",
  ENSMUSG00000055866: "Per2",
  ENSMUSG00000028957: "Per3",
  ENSMUSG00000020038: "Cry1",
  ENSMUSG00000068742: "Cry2",
  ENSMUSG00000029238: "Clock",
  ENSMUSG00000055116: "Arntl",
  ENSMUSG00000020889: "Nr1d1",
  ENSMUSG00000021775: "Nr1d2",
  ENSMUSG00000032238: "Rora",
  ENSMUSG00000028150: "Rorc",
  ENSMUSG00000059824: "Dbp",
  ENSMUSG00000022389: "Tef",
  ENSMUSG00000003949: "Hlf",
  ENSMUSG00000056749: "Nfil3",
  ENSMUSG00000022346: "Myc",
  ENSMUSG00000070348: "Ccnd1",
  ENSMUSG00000041431: "Ccnb1",
  ENSMUSG00000019942: "Cdk1",
  ENSMUSG00000031016: "Wee1",
  ENSMUSG00000023067: "Cdkn1a",
  ENSMUSG00000020140: "Lgr5",
  ENSMUSG00000000142: "Axin2",
  ENSMUSG00000006932: "Ctnnb1",
  ENSMUSG00000005871: "Apc",
  ENSMUSG00000059552: "Trp53",
  ENSMUSG00000020184: "Mdm2",
  ENSMUSG00000028530: "Gapdh",
  ENSMUSG00000029580: "Actb",
  ENSMUSG00000026077: "Npas2",
};

export function resolveGeneName(id: string): string {
  return ENSEMBL_TO_SYMBOL[id] || id;
}

export function meanCenter(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.map((v) => v - mean);
}

export function zScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
  return sd > 0 ? values.map((v) => (v - mean) / sd) : values.map(() => 0);
}

export function linearDetrend(values: number[]): number[] {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  return values.map((v, i) => v - (slope * i + intercept));
}
