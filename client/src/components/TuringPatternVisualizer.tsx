import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface TuringPatternVisualizerProps {
  initialEigenvalue?: number;
  onEigenvalueChange?: (value: number) => void;
}

const GRID_SIZE = 100;
const CELL_SIZE = 3;
const BIFURCATION_POINT = 0.618;

export function TuringPatternVisualizer({ 
  initialEigenvalue = 0.537,  // Updated: Target gene baseline from Jan 2026 audit
  onEigenvalueChange 
}: TuringPatternVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const gridRef = useRef<Float32Array | null>(null);
  const nextGridRef = useRef<Float32Array | null>(null);
  const frameRef = useRef(0);
  const eigenvalueRef = useRef(initialEigenvalue);
  
  const [eigenvalue, setEigenvalue] = useState(initialEigenvalue);
  const [isRunning, setIsRunning] = useState(true);
  
  useEffect(() => {
    eigenvalueRef.current = eigenvalue;
  }, [eigenvalue]);
  
  const initializeGrid = useCallback(() => {
    if (!gridRef.current) {
      gridRef.current = new Float32Array(GRID_SIZE * GRID_SIZE);
    }
    if (!nextGridRef.current) {
      nextGridRef.current = new Float32Array(GRID_SIZE * GRID_SIZE);
    }
    const grid = gridRef.current;
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const x = i % GRID_SIZE;
      const y = Math.floor(i / GRID_SIZE);
      grid[i] = Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.5 + 0.5 + (Math.random() - 0.5) * 0.1;
    }
  }, []);
  
  useEffect(() => {
    initializeGrid();
  }, [initializeGrid]);
  
  const getStabilityFactor = (lambda: number): number => {
    if (lambda < BIFURCATION_POINT) {
      return 1.0 - (lambda / BIFURCATION_POINT) * 0.3;
    } else {
      const excess = (lambda - BIFURCATION_POINT) / (1 - BIFURCATION_POINT);
      return 0.7 - excess * 0.7;
    }
  };
  
  const getDiffusionRatio = (lambda: number): number => {
    if (lambda < BIFURCATION_POINT) {
      return 0.5;
    } else {
      return 0.5 + (lambda - BIFURCATION_POINT) * 2;
    }
  };
  
  useEffect(() => {
    if (!isRunning) return;
    
    const animate = () => {
      const grid = gridRef.current;
      const nextGrid = nextGridRef.current;
      if (!grid || !nextGrid) return;
      
      const currentEigenvalue = eigenvalueRef.current;
      const stability = getStabilityFactor(currentEigenvalue);
      const diffusionRatio = getDiffusionRatio(currentEigenvalue);
      const noiseLevel = currentEigenvalue > BIFURCATION_POINT ? (currentEigenvalue - BIFURCATION_POINT) * 0.5 : 0.01;
      const frame = frameRef.current;
      
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
          const idx = y * GRID_SIZE + x;
          const current = grid[idx];
          
          const left = grid[y * GRID_SIZE + ((x - 1 + GRID_SIZE) % GRID_SIZE)];
          const right = grid[y * GRID_SIZE + ((x + 1) % GRID_SIZE)];
          const up = grid[((y - 1 + GRID_SIZE) % GRID_SIZE) * GRID_SIZE + x];
          const down = grid[((y + 1) % GRID_SIZE) * GRID_SIZE + x];
          
          const laplacian = (left + right + up + down - 4 * current) * diffusionRatio * 0.1;
          
          const patternForce = currentEigenvalue < BIFURCATION_POINT 
            ? Math.sin(x * 0.2 + frame * 0.02) * Math.cos(y * 0.2 - frame * 0.01) * stability * 0.02
            : 0;
          
          const reaction = current * (1 - current) * (current - 0.3) * stability;
          const noise = (Math.random() - 0.5) * noiseLevel;
          
          let newValue = current + laplacian + reaction * 0.1 + patternForce + noise;
          newValue = Math.max(0, Math.min(1, newValue));
          
          nextGrid[idx] = newValue;
        }
      }
      
      const temp = gridRef.current;
      gridRef.current = nextGridRef.current;
      nextGridRef.current = temp;
      frameRef.current++;
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const renderGrid = gridRef.current!;
          
          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              const value = renderGrid[y * GRID_SIZE + x];
              
              let r, g, b;
              if (currentEigenvalue < BIFURCATION_POINT) {
                r = Math.floor(20 + value * 60);
                g = Math.floor(80 + value * 120);
                b = Math.floor(100 + value * 155);
              } else if (currentEigenvalue < 0.80) {
                const transition = (currentEigenvalue - BIFURCATION_POINT) / (0.80 - BIFURCATION_POINT);
                r = Math.floor(20 + value * 60 + transition * 100 * value);
                g = Math.floor(80 + value * 120 - transition * 40);
                b = Math.floor(100 + value * 155 - transition * 100);
              } else {
                r = Math.floor(80 + value * 175);
                g = Math.floor(30 + value * 50);
                b = Math.floor(30 + value * 50);
              }
              
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
          }
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.font = 'bold 14px monospace';
          ctx.fillText(`|λ| = ${currentEigenvalue.toFixed(3)}`, 10, 20);
          
          if (currentEigenvalue < BIFURCATION_POINT) {
            ctx.fillStyle = '#4ade80';
            ctx.fillText('STABLE PATTERN', 10, 40);
          } else if (currentEigenvalue < 0.80) {
            ctx.fillStyle = '#facc15';
            ctx.fillText('TRANSITIONAL', 10, 40);
          } else {
            ctx.fillStyle = '#ef4444';
            ctx.fillText('PATTERN COLLAPSE', 10, 40);
          }
        }
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRunning]);
  
  const handleEigenvalueChange = (value: number[]) => {
    setEigenvalue(value[0]);
    onEigenvalueChange?.(value[0]);
  };
  
  const handleReset = () => {
    initializeGrid();
    frameRef.current = 0;
  };
  
  const getStatusBadge = () => {
    if (eigenvalue < BIFURCATION_POINT) {
      return <Badge className="bg-green-600 text-white">Low Persistence (Stable)</Badge>;
    } else if (eigenvalue < 0.80) {
      return <Badge className="bg-yellow-600 text-white">Moderate Persistence (Transitional)</Badge>;
    } else {
      return <Badge className="bg-red-600 text-white">High Persistence (Near Unit Root)</Badge>;
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Turing Pattern Simulation</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsRunning(!isRunning)}
            data-testid="button-toggle-simulation"
          >
            {isRunning ? <Pause size={14} /> : <Play size={14} />}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
            data-testid="button-reset-simulation"
          >
            <RotateCcw size={14} />
          </Button>
        </div>
      </div>
      
      <canvas 
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="rounded-lg border border-border mx-auto block"
        style={{ imageRendering: 'pixelated' }}
        data-testid="canvas-turing-pattern"
      />
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-green-400">Low |λ| (0.537)</span>
          <span className="text-yellow-400">φ = 0.618</span>
          <span className="text-red-400">High |λ| (0.80+)</span>
        </div>
        <Slider
          value={[eigenvalue]}
          onValueChange={handleEigenvalueChange}
          min={0.3}
          max={0.9}
          step={0.01}
          className="w-full"
          data-testid="slider-eigenvalue"
        />
        <div className="text-center text-sm text-muted-foreground">
          Drag slider to see pattern transition at bifurcation point (φ = 0.618)
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Button 
          variant="outline" 
          size="sm"
          className="border-green-500/30 hover:bg-green-500/10"
          onClick={() => setEigenvalue(0.537)}
          data-testid="button-preset-low"
        >
          Low |λ| (0.537)
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          className="border-yellow-500/30 hover:bg-yellow-500/10"
          onClick={() => setEigenvalue(0.618)}
          data-testid="button-preset-bifurcation"
        >
          Bifurcation (φ)
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          className="border-red-500/30 hover:bg-red-500/10"
          onClick={() => setEigenvalue(0.75)}
          data-testid="button-preset-high"
        >
          High |λ| (0.75)
        </Button>
      </div>
      
      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <strong>What you're seeing:</strong> A reaction-diffusion system simulating tissue morphogen patterns. 
        Below φ = 0.618, stable stripes/spots form (ordered spatial structure). 
        Above this threshold, patterns dissolve into chaos — illustrating how increasing persistence destabilizes spatial organization.
      </div>
    </div>
  );
}
