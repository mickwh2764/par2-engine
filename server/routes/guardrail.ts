/**
 * Guardrail routes — scale detection, fingerprinting, harmonisation.
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { logger } from '../logger';
import {
  detectScale,
  harmonizeTransform,
  checkScaleMixing,
  compareToRegistry,
  getReferenceFingerprints,
  getReferenceAtlas,
  matchDatasetFingerprint,
} from '../scaleGuardrail';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get('/fingerprints', (req: Request, res: Response) => {
  try {
    const fingerprints = getReferenceFingerprints();
    res.json({
      count: fingerprints.length,
      fingerprints: fingerprints.map(fp => ({
        tissue: fp.tissue,
        organism: fp.organism,
        platform: fp.platform,
        datasetId: fp.datasetId,
        nGenes: fp.nGenes,
        lambdaMean: fp.lambdaMean,
        lambdaStd: fp.lambdaStd,
        lambdaRange: fp.lambdaRange,
      })),
    });
  } catch (error) {
    logger.error('Error fetching fingerprints', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch fingerprints' });
  }
});

router.post('/detect-scale', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.trim().split('\n');
    const values: number[][] = lines.slice(1).map(line =>
      line.split(',').slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v)),
    );

    const detection = detectScale(values);

    res.json({
      fileName: req.file.originalname,
      detection: {
        scale: detection.detectedScale,
        confidence: detection.confidence,
        evidence: detection.evidence,
        warnings: detection.warnings,
        stats: detection.stats,
      },
      recommendation:
        detection.detectedScale === 'log2'
          ? 'Data appears to be log2-transformed. No additional transform needed.'
          : `Data appears to be ${detection.detectedScale}. Apply log2 transform for valid AR(2) comparison.`,
    });
  } catch (error) {
    logger.error('Error detecting scale', { error: String(error) });
    res.status(500).json({ error: 'Failed to detect scale' });
  }
});

router.post('/harmonize', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const content = req.file.buffer.toString('utf-8');
    const lines = content.trim().split('\n');
    const values: number[][] = lines.slice(1).map(line =>
      line.split(',').slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v)),
    );

    const forceTransform = req.body.forceTransform as 'log2' | 'none' | undefined;
    const result = harmonizeTransform(values, req.file.originalname, forceTransform);

    res.json({
      fileName: req.file.originalname,
      report: result.report,
      transformApplied: result.appliedTransform !== 'none',
    });
  } catch (error) {
    logger.error('Error harmonizing data', { error: String(error) });
    res.status(500).json({ error: 'Failed to harmonize data' });
  }
});

router.post('/compare-fingerprint', (req: Request, res: Response) => {
  try {
    const { lambdaValues, tissue } = req.body;

    if (!lambdaValues || typeof lambdaValues !== 'object') {
      return res.status(400).json({ error: 'lambdaValues object required' });
    }

    const comparison = compareToRegistry(lambdaValues, tissue);

    res.json({
      inputMean: Object.values(lambdaValues as Record<string, number>)
        .filter((v): v is number => !isNaN(v))
        .reduce((a, b) => a + b, 0) / Object.values(lambdaValues).length,
      closestMatch: comparison.closestMatch
        ? {
            tissue: comparison.closestMatch.tissue,
            organism: comparison.closestMatch.organism,
            datasetId: comparison.closestMatch.datasetId,
            lambdaMean: comparison.closestMatch.lambdaMean,
          }
        : null,
      similarity: comparison.similarity,
      interpretation:
        comparison.similarity > 0.7
          ? `Strong match to ${comparison.closestMatch?.tissue} reference (${(comparison.similarity * 100).toFixed(0)}% similarity)`
          : comparison.similarity > 0.5
            ? `Moderate match to ${comparison.closestMatch?.tissue} reference (${(comparison.similarity * 100).toFixed(0)}% similarity)`
            : 'Weak match - may represent novel tissue/condition',
      allComparisons: comparison.allComparisons.map(c => ({
        tissue: c.fingerprint.tissue,
        organism: c.fingerprint.organism,
        datasetId: c.fingerprint.datasetId,
        ksStatistic: c.ksStatistic,
        meanDiff: c.meanDiff,
      })),
    });
  } catch (error) {
    logger.error('Error comparing fingerprint', { error: String(error) });
    res.status(500).json({ error: 'Failed to compare fingerprint' });
  }
});

router.post('/check-mixing', upload.array('files', 10), (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 2) {
      return res.status(400).json({ error: 'At least 2 files required for mixing check' });
    }

    const datasets = files.map(file => {
      const content = file.buffer.toString('utf-8');
      const lines = content.trim().split('\n');
      const values: number[][] = lines.slice(1).map(line =>
        line.split(',').slice(1).map(v => parseFloat(v)).filter(v => !isNaN(v)),
      );
      return { name: file.originalname, values };
    });

    const result = checkScaleMixing(datasets);

    res.json({
      compatible: result.compatible,
      warnings: result.warnings,
      datasets: result.details.map((d, i) => ({
        name: datasets[i].name,
        scale: d.detectedScale,
        confidence: d.confidence,
      })),
      recommendation: result.compatible
        ? 'All datasets on same scale - safe for cross-dataset comparison'
        : 'SCALE MIXING DETECTED - Apply harmonized transforms before comparison',
    });
  } catch (error) {
    logger.error('Error checking scale mixing', { error: String(error) });
    res.status(500).json({ error: 'Failed to check scale mixing' });
  }
});

router.get('/atlas', (req: Request, res: Response) => {
  try {
    const tier = req.query.tier as 'tier1' | 'tier2' | 'all' | undefined;
    const atlas = getReferenceAtlas(tier);

    res.json({
      tier1: {
        tissues: atlas.tier1.map(fp => fp.tissue),
        count: atlas.tier1.length,
        fingerprints: atlas.tier1.map(fp => ({
          tissue: fp.tissue,
          lambdaMean: fp.lambdaMean,
          lambdaStd: fp.lambdaStd,
          lambdaRange: fp.lambdaRange,
          clockGeneLambdas: fp.clockGeneLambdas,
        })),
      },
      tier2: {
        tissues: atlas.tier2.map(fp => fp.tissue),
        count: atlas.tier2.length,
        fingerprints: atlas.tier2.map(fp => ({
          tissue: fp.tissue,
          lambdaMean: fp.lambdaMean,
          lambdaStd: fp.lambdaStd,
          lambdaRange: fp.lambdaRange,
          clockGeneLambdas: fp.clockGeneLambdas,
        })),
      },
      summary: atlas.summary,
      methodology: {
        preprocessing: 'Standardized log2 transformation',
        source: 'GSE54650 Hughes Circadian Atlas (Mouse)',
        platform: 'Affymetrix RNA-seq normalized to log2',
        clockGenes: [
          'Per1', 'Per2', 'Per3', 'Arntl', 'Clock', 'Cry1', 'Cry2',
          'Nr1d1', 'Nr1d2', 'Rorc', 'Dbp', 'Tef', 'Npas2',
        ],
      },
    });
  } catch (error) {
    logger.error('Error fetching reference atlas', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch reference atlas' });
  }
});

router.post('/match-fingerprint', (req: Request, res: Response) => {
  try {
    const { lambdaValues, datasetName } = req.body;

    if (!lambdaValues || typeof lambdaValues !== 'object') {
      return res.status(400).json({ error: 'lambdaValues object required with gene:lambda pairs' });
    }

    const result = matchDatasetFingerprint(lambdaValues, datasetName || 'unknown');

    res.json({
      datasetName: datasetName || 'unknown',
      bestMatch: result.bestMatch,
      allMatches: result.allMatches.slice(0, 6),
      qualityFlags: result.qualityFlags,
      recommendation: result.recommendation,
      visualization: {
        inputMean: Object.values(lambdaValues as Record<string, number>)
          .filter((v): v is number => !isNaN(v))
          .reduce((a, b) => a + b, 0) / Object.values(lambdaValues).filter(v => !isNaN(v as number)).length,
        referenceRange: {
          liver: 0.717,
          kidney: 0.889,
          heart: 0.689,
          lung: 0.782,
          muscle: 0.70,
          adrenal: 0.75,
        },
      },
    });
  } catch (error) {
    logger.error('Error matching fingerprint', { error: String(error) });
    res.status(500).json({ error: 'Failed to match fingerprint' });
  }
});

export default router;
