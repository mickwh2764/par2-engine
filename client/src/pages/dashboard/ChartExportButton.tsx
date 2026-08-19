import { useState } from "react";
import { Loader2, FileImage, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportChartAsImage, exportChartAsSVG, RESOLUTION_PRESETS } from "@/lib/export-chart";

export function ChartExportButton({ 
  chartRef, 
  filename,
  "data-testid": dataTestId
}: { 
  chartRef: React.RefObject<HTMLDivElement | null>;
  filename: string;
  "data-testid"?: string;
}) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'png' | 'svg', scale: number = 3) => {
    if (!chartRef.current) return;
    
    setIsExporting(true);
    try {
      if (format === 'svg') {
        await exportChartAsSVG(chartRef.current, filename);
      } else {
        await exportChartAsImage(chartRef.current, {
          format: 'png',
          scale,
          filename,
          backgroundColor: '#0a0a0f'
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2" 
          disabled={isExporting}
          data-testid={dataTestId}
        >
          {isExporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <FileImage size={14} />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('svg')}>
          <Image size={14} className="mr-2" />
          SVG (Vector)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">PNG Resolution</DropdownMenuLabel>
        {RESOLUTION_PRESETS.map((preset) => (
          <DropdownMenuItem 
            key={preset.scale} 
            onClick={() => handleExport('png', preset.scale)}
          >
            <FileImage size={14} className="mr-2" />
            <div className="flex flex-col">
              <span>{preset.label}</span>
              <span className="text-[10px] text-muted-foreground">{preset.description}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
