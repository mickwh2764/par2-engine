import * as fs from 'fs';
import * as crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { ENSEMBL_TO_SYMBOL } from './gene-categories';

interface DatasetMetadata {
  filename: string;
  geoAccession: string;
  geoUrl: string;
  description: string;
  organism: string;
  expectedRows: number;
  expectedColumns: number;
  keyGenes: string[];
  publication?: string;
}

const DATASET_REGISTRY: DatasetMetadata[] = [
  {
    filename: 'GSE157357_Organoid_WT-WT_circadian.csv',
    geoAccession: 'GSE157357',
    geoUrl: 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE157357',
    description: 'Mouse intestinal organoids, wild-type BMAL1, wild-type APC',
    organism: 'Mus musculus',
    expectedRows: 15000,
    expectedColumns: 10,
    keyGenes: ['ENSMUSG00000055866', 'ENSMUSG00000020038'],
    publication: 'Stokes et al. 2021 Genes Dev'
  },
  {
    filename: 'GSE157357_Organoid_ApcKO-WT_circadian.csv',
    geoAccession: 'GSE157357',
    geoUrl: 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE157357',
    description: 'Mouse intestinal organoids, APC knockout, wild-type BMAL1',
    organism: 'Mus musculus',
    expectedRows: 15000,
    expectedColumns: 10,
    keyGenes: ['ENSMUSG00000055866', 'ENSMUSG00000020038'],
    publication: 'Stokes et al. 2021 Genes Dev'
  },
  {
    filename: 'GSE11923_Liver_1h_48h_genes.csv',
    geoAccession: 'GSE11923',
    geoUrl: 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE11923',
    description: 'Mouse liver, 1-hour resolution, 48 timepoints (CT18-CT65)',
    organism: 'Mus musculus',
    expectedRows: 20000,
    expectedColumns: 48,
    keyGenes: ['Per2', 'Arntl', 'Sirt1', 'Clock'],
    publication: 'Hughes et al. 2009 PLoS Genet'
  },
  {
    filename: 'GSE133342_Liver_ConstantDarkness.csv',
    geoAccession: 'GSE133342',
    geoUrl: 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE133342',
    description: 'Mouse liver in constant darkness (DD), rules out light artifacts',
    organism: 'Mus musculus',
    expectedRows: 15000,
    expectedColumns: 6,
    keyGenes: ['Per2', 'Cry1'],
  },
  {
    filename: 'GSE48113_Human_Blood_ClockGenes.csv',
    geoAccession: 'GSE48113',
    geoUrl: 'https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE48113',
    description: 'Human peripheral blood, forced desynchrony protocol',
    organism: 'Homo sapiens',
    expectedRows: 30,
    expectedColumns: 200,
    keyGenes: ['PER1', 'PER2', 'CRY1', 'ARNTL'],
    publication: 'Archer et al. 2014 PNAS'
  }
];

interface IntegrityResult {
  filename: string;
  exists: boolean;
  fileSize: number;
  sha256: string;
  rowCount: number;
  columnCount: number;
  keyGenesPresent: string[];
  keyGenesMissing: string[];
  geoAccession: string;
  geoUrl: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  issues: string[];
}

function computeSHA256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function checkDataset(meta: DatasetMetadata): IntegrityResult {
  const filePath = `datasets/${meta.filename}`;
  const issues: string[] = [];
  
  if (!fs.existsSync(filePath)) {
    return {
      filename: meta.filename,
      exists: false,
      fileSize: 0,
      sha256: '',
      rowCount: 0,
      columnCount: 0,
      keyGenesPresent: [],
      keyGenesMissing: meta.keyGenes,
      geoAccession: meta.geoAccession,
      geoUrl: meta.geoUrl,
      status: 'FAIL',
      issues: ['File does not exist']
    };
  }
  
  const stats = fs.statSync(filePath);
  const sha256 = computeSHA256(filePath);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  let records: any[] = [];
  let columnCount = 0;
  
  try {
    records = parse(content, { columns: true, skip_empty_lines: true });
    if (records.length > 0) {
      columnCount = Object.keys(records[0]).length;
    }
  } catch (e: any) {
    issues.push(`CSV parse error: ${e.message}`);
  }
  
  const rowCount = records.length;
  
  if (rowCount < meta.expectedRows * 0.5) {
    issues.push(`Row count (${rowCount}) is less than 50% of expected (${meta.expectedRows})`);
  }
  
  if (columnCount < meta.expectedColumns * 0.5) {
    issues.push(`Column count (${columnCount}) is less than 50% of expected (${meta.expectedColumns})`);
  }
  
  const geneColumn = records.length > 0 ? (records[0].Gene || records[0].gene || records[0].target_id) : null;
  const allGenes = new Set<string>();
  
  for (const record of records) {
    const gene = record.Gene || record.gene || record.target_id || '';
    if (gene) allGenes.add(gene.toString());
  }
  
  const keyGenesPresent: string[] = [];
  const keyGenesMissing: string[] = [];
  
  for (const kg of meta.keyGenes) {
    const found = Array.from(allGenes).some(g => 
      g.toLowerCase() === kg.toLowerCase() || 
      g.toLowerCase().includes(kg.toLowerCase())
    );
    if (found) {
      keyGenesPresent.push(kg);
    } else {
      keyGenesMissing.push(kg);
      issues.push(`Key gene ${kg} not found in dataset`);
    }
  }
  
  let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  if (issues.length > 0 && issues.some(i => i.includes('not found') || i.includes('less than'))) {
    status = 'WARN';
  }
  if (issues.some(i => i.includes('parse error') || i.includes('does not exist'))) {
    status = 'FAIL';
  }
  
  return {
    filename: meta.filename,
    exists: true,
    fileSize: stats.size,
    sha256,
    rowCount,
    columnCount,
    keyGenesPresent,
    keyGenesMissing,
    geoAccession: meta.geoAccession,
    geoUrl: meta.geoUrl,
    status,
    issues
  };
}

function discoverUnregisteredDatasets(): string[] {
  const registered = new Set(DATASET_REGISTRY.map(d => d.filename));
  const allFiles = fs.readdirSync('datasets').filter(f => f.endsWith('.csv'));
  return allFiles.filter(f => !registered.has(f));
}

export interface FullIntegrityReport {
  timestamp: string;
  registeredDatasets: IntegrityResult[];
  unregisteredDatasets: string[];
  summary: {
    total: number;
    passed: number;
    warned: number;
    failed: number;
    unregistered: number;
  };
  geoVerificationUrls: { accession: string; url: string }[];
}

export function runFullIntegrityCheck(): FullIntegrityReport {
  const results = DATASET_REGISTRY.map(checkDataset);
  const unregistered = discoverUnregisteredDatasets();
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  
  const geoAccessions = new Map<string, string>();
  for (const meta of DATASET_REGISTRY) {
    geoAccessions.set(meta.geoAccession, meta.geoUrl);
  }
  
  return {
    timestamp: new Date().toISOString(),
    registeredDatasets: results,
    unregisteredDatasets: unregistered,
    summary: {
      total: results.length,
      passed,
      warned,
      failed,
      unregistered: unregistered.length
    },
    geoVerificationUrls: Array.from(geoAccessions.entries()).map(([accession, url]) => ({ accession, url }))
  };
}

export function printIntegrityReport(report: FullIntegrityReport): void {
  console.log('\n========================================');
  console.log('   PAR(2) DATA INTEGRITY CHECK REPORT');
  console.log('========================================\n');
  console.log(`Timestamp: ${report.timestamp}\n`);
  
  console.log('SUMMARY:');
  console.log(`  Total registered datasets: ${report.summary.total}`);
  console.log(`  ✓ Passed: ${report.summary.passed}`);
  console.log(`  ⚠ Warned: ${report.summary.warned}`);
  console.log(`  ✗ Failed: ${report.summary.failed}`);
  console.log(`  ? Unregistered files: ${report.summary.unregistered}`);
  
  console.log('\n----------------------------------------');
  console.log('DATASET VERIFICATION RESULTS:');
  console.log('----------------------------------------\n');
  
  for (const r of report.registeredDatasets) {
    const icon = r.status === 'PASS' ? '✓' : r.status === 'WARN' ? '⚠' : '✗';
    console.log(`${icon} ${r.filename}`);
    console.log(`  GEO: ${r.geoAccession} → ${r.geoUrl}`);
    console.log(`  Size: ${(r.fileSize / 1024).toFixed(1)} KB | Rows: ${r.rowCount} | Cols: ${r.columnCount}`);
    console.log(`  SHA256: ${r.sha256.substring(0, 16)}...`);
    console.log(`  Key genes present: ${r.keyGenesPresent.join(', ') || 'none'}`);
    if (r.keyGenesMissing.length > 0) {
      console.log(`  Key genes MISSING: ${r.keyGenesMissing.join(', ')}`);
    }
    if (r.issues.length > 0) {
      console.log(`  Issues: ${r.issues.join('; ')}`);
    }
    console.log('');
  }
  
  if (report.unregisteredDatasets.length > 0) {
    console.log('----------------------------------------');
    console.log('UNREGISTERED DATASETS (not in registry):');
    console.log('----------------------------------------');
    for (const f of report.unregisteredDatasets) {
      console.log(`  ? ${f}`);
    }
    console.log('');
  }
  
  console.log('----------------------------------------');
  console.log('GEO VERIFICATION LINKS:');
  console.log('----------------------------------------');
  console.log('Visit these URLs to verify dataset provenance:\n');
  for (const geo of report.geoVerificationUrls) {
    console.log(`  ${geo.accession}: ${geo.url}`);
  }
  
  console.log('\n========================================');
  console.log('          END OF INTEGRITY REPORT');
  console.log('========================================\n');
}

// CLI entry point - only runs when this specific file is executed directly
// Guards against bundled CJS where require.main === module is always true
const isDirectCLI = typeof require !== 'undefined' 
  && require.main === module 
  && process.argv[1]?.includes('integrity-check');
if (isDirectCLI) {
  const report = runFullIntegrityCheck();
  printIntegrityReport(report);
  
  const outputPath = 'INTEGRITY_CHECK_REPORT.json';
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(`Full report saved to: ${outputPath}`);
}
