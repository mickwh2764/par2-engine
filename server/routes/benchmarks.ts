/**
 * Benchmark routes — master auditor, Monte Carlo, Turing, Fisher, etc.
 */
import { Router, type Request, type Response } from 'express';
import {
  runMasterAuditor,
  runSpatialSymmetryTest,
  runTuringBenchmark,
  runFisherBenchmark,
  runNetworkBenchmark,
  runUedaBenchmark,
  analyzeTuringStability,
  analyzeInformationFidelity,
} from '../benchmarks/master-auditor';
import { runMonteCarloSimulation } from '../benchmarks/monte-carlo-simulation';
import { runHeadToHeadComparison } from '../benchmarks/head-to-head-comparison';
import { runDataSparsityBenchmark, analyzeSparsityAtLevel } from '../benchmarks/data-sparsity';
import { runPhaseShiftBenchmark, analyzePhaseShift } from '../benchmarks/phase-shift';
import { computeTuringDeepDive } from '../turing-deep-dive';
import {
  getMethodsPaperBenchmark,
  isComputing,
  computeMethodsPaperBenchmark,
  warmUpMethodsBenchmark,
} from '../benchmarks/methods-paper-benchmark';

// Kick off background computation at module load
warmUpMethodsBenchmark();

const router = Router();

router.get('/master-auditor', (req: Request, res: Response) => {
  try {
    const result = runMasterAuditor();
    res.json(result);
  } catch (error) {
    console.error('Error running Master Auditor:', error);
    res.status(500).json({ error: 'Failed to run Master Auditor benchmark suite' });
  }
});

router.get('/monte-carlo-simulation', (req: Request, res: Response) => {
  try {
    const quick = req.query.quick === 'true';
    const result = runMonteCarloSimulation(quick);
    res.json(result);
  } catch (error) {
    console.error('Error running Monte Carlo simulation:', error);
    res.status(500).json({ error: 'Failed to run Monte Carlo simulation' });
  }
});

router.get('/head-to-head', (req: Request, res: Response) => {
  try {
    const result = runHeadToHeadComparison();
    res.json(result);
  } catch (error) {
    console.error('Error running head-to-head comparison:', error);
    res.status(500).json({ error: 'Failed to run head-to-head comparison' });
  }
});

router.get('/turing', (req: Request, res: Response) => {
  try {
    const result = runTuringBenchmark();
    res.json(result);
  } catch (error) {
    console.error('Error running Turing benchmark:', error);
    res.status(500).json({ error: 'Failed to run Turing benchmark' });
  }
});

router.get('/turing/test/:eigenvalue', (req: Request, res: Response) => {
  try {
    const eigenvalue = parseFloat(req.params.eigenvalue);
    if (isNaN(eigenvalue) || eigenvalue < 0 || eigenvalue > 1) {
      return res.status(400).json({ error: 'Invalid eigenvalue. Must be between 0 and 1.' });
    }
    const result = runSpatialSymmetryTest(eigenvalue);
    res.json(result);
  } catch (error) {
    console.error('Error running spatial symmetry test:', error);
    res.status(500).json({ error: 'Failed to run spatial symmetry test' });
  }
});

router.get('/fisher', (req: Request, res: Response) => {
  try {
    const result = runFisherBenchmark();
    res.json(result);
  } catch (error) {
    console.error('Error running Fisher benchmark:', error);
    res.status(500).json({ error: 'Failed to run Fisher Information benchmark' });
  }
});

router.post('/turing/analyze', (req: Request, res: Response) => {
  try {
    const { eigenvalue, tissue, condition } = req.body;
    if (typeof eigenvalue !== 'number') {
      return res.status(400).json({ error: 'Eigenvalue required' });
    }
    const result = analyzeTuringStability(eigenvalue, tissue || 'Unknown', condition || 'Unknown');
    res.json(result);
  } catch (error) {
    console.error('Error analyzing Turing stability:', error);
    res.status(500).json({ error: 'Failed to analyze Turing stability' });
  }
});

router.post('/fisher/analyze', (req: Request, res: Response) => {
  try {
    const { eigenvalue, tissue, condition } = req.body;
    if (typeof eigenvalue !== 'number') {
      return res.status(400).json({ error: 'Eigenvalue required' });
    }
    const result = analyzeInformationFidelity(eigenvalue, tissue || 'Unknown', condition || 'Unknown');
    res.json(result);
  } catch (error) {
    console.error('Error analyzing information fidelity:', error);
    res.status(500).json({ error: 'Failed to analyze information fidelity' });
  }
});

router.get('/network', async (req: Request, res: Response) => {
  try {
    const { computeRealEigenvalueData } = await import('../benchmarks/real-eigenvalue-data');
    const realData = computeRealEigenvalueData();
    const eigenvalueData = realData.map((d: any) => ({ gene: d.gene, eigenvalue: d.eigenvalue }));
    const result = runNetworkBenchmark(
      eigenvalueData.length > 0
        ? eigenvalueData
        : [
            { gene: 'Arntl', eigenvalue: 0.79 },
            { gene: 'Per1', eigenvalue: 0.71 },
          ],
    );
    res.json(result);
  } catch (error) {
    console.error('Error running Network benchmark:', error);
    res.status(500).json({ error: 'Failed to run STRING Network benchmark' });
  }
});

router.get('/ueda', async (req: Request, res: Response) => {
  try {
    const { computeRealTimeSeriesData } = await import('../benchmarks/real-eigenvalue-data');
    const realData = computeRealTimeSeriesData();
    const uedaInput = realData.map((d: any) => ({
      gene: d.gene,
      timeSeries: d.timeSeries,
      timepoints: d.timepoints,
      eigenvalue: d.eigenvalue,
    }));
    const result = runUedaBenchmark(
      uedaInput.length > 0
        ? uedaInput
        : [{ gene: 'Per1', timeSeries: [5, 8, 6, 3, 5, 8], timepoints: [0, 4, 8, 12, 16, 20], eigenvalue: 0.71 }],
    );
    res.json(result);
  } catch (error) {
    console.error('Error running Ueda benchmark:', error);
    res.status(500).json({ error: 'Failed to run Ueda Timetable benchmark' });
  }
});

router.get('/data-sparsity', (req: Request, res: Response) => {
  try {
    const numTrials = parseInt(req.query.trials as string) || 100;
    const result = runDataSparsityBenchmark(numTrials);
    res.json(result);
  } catch (error) {
    console.error('Error running Data Sparsity benchmark:', error);
    res.status(500).json({ error: 'Failed to run Data Sparsity benchmark' });
  }
});

router.get('/data-sparsity/:level', (req: Request, res: Response) => {
  try {
    const level = parseFloat(req.params.level);
    const numTrials = parseInt(req.query.trials as string) || 50;
    if (isNaN(level) || level < 0 || level > 0.9) {
      return res.status(400).json({ error: 'Sparsity level must be between 0 and 0.9' });
    }
    const result = analyzeSparsityAtLevel(level, numTrials);
    res.json(result);
  } catch (error) {
    console.error('Error running Sparsity analysis:', error);
    res.status(500).json({ error: 'Failed to analyze sparsity level' });
  }
});

router.get('/phase-shift', (req: Request, res: Response) => {
  try {
    const numTrials = parseInt(req.query.trials as string) || 100;
    const result = runPhaseShiftBenchmark(numTrials);
    res.json(result);
  } catch (error) {
    console.error('Error running Phase Shift benchmark:', error);
    res.status(500).json({ error: 'Failed to run Phase Shift benchmark' });
  }
});

router.get('/phase-shift/:hours', (req: Request, res: Response) => {
  try {
    const hours = parseFloat(req.params.hours);
    const numTrials = parseInt(req.query.trials as string) || 50;
    if (isNaN(hours)) {
      return res.status(400).json({ error: 'Shift hours must be a number' });
    }
    const result = analyzePhaseShift(hours, numTrials);
    res.json(result);
  } catch (error) {
    console.error('Error running Phase Shift analysis:', error);
    res.status(500).json({ error: 'Failed to analyze phase shift' });
  }
});

router.get('/methods-paper', async (req: Request, res: Response) => {
  try {
    const cached = getMethodsPaperBenchmark();
    if (cached) return res.json(cached);
    if (isComputing()) {
      return res.status(202).json({ status: 'computing', message: 'Benchmark running — retry in a few seconds' });
    }
    const result = await computeMethodsPaperBenchmark();
    res.json(result);
  } catch (error) {
    console.error('Error running methods paper benchmark:', error);
    res.status(500).json({ error: 'Failed to run methods paper benchmark' });
  }
});

export default router;
