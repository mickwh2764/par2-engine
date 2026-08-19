import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'svg';
  scale: number;
  backgroundColor: string;
  filename: string;
}

const defaultOptions: ExportOptions = {
  format: 'png',
  scale: 3,
  backgroundColor: '#0a0a0f',
  filename: 'chart'
};

export async function exportChartAsImage(
  element: HTMLElement | null,
  options: Partial<ExportOptions> = {}
): Promise<void> {
  if (!element) {
    console.error('No element provided for export');
    return;
  }

  const opts = { ...defaultOptions, ...options };

  try {
    const canvas = await html2canvas(element, {
      scale: opts.scale,
      backgroundColor: opts.backgroundColor,
      useCORS: true,
      logging: false,
      allowTaint: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const mimeType = opts.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = opts.format === 'jpeg' ? 0.95 : 1;
    
    const dataUrl = canvas.toDataURL(mimeType, quality);
    
    const link = document.createElement('a');
    link.download = `${opts.filename}.${opts.format}`;
    link.href = dataUrl;
    link.click();
  } catch (error) {
    console.error('Error exporting chart:', error);
    throw error;
  }
}

export async function exportChartAsSVG(
  element: HTMLElement | null,
  filename: string = 'chart'
): Promise<void> {
  if (!element) {
    console.error('No element provided for export');
    return;
  }

  const svgElement = element.querySelector('svg');
  if (!svgElement) {
    console.error('No SVG element found in the chart container');
    return;
  }

  const clonedSvg = svgElement.cloneNode(true) as SVGElement;
  
  const computedStyle = window.getComputedStyle(element);
  clonedSvg.setAttribute('style', `background-color: ${computedStyle.backgroundColor || '#0a0a0f'}`);
  
  if (!clonedSvg.hasAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  
  const bbox = svgElement.getBoundingClientRect();
  clonedSvg.setAttribute('width', String(bbox.width));
  clonedSvg.setAttribute('height', String(bbox.height));
  
  const cssRules: string[] = [];
  Array.from(document.styleSheets).forEach(sheet => {
    try {
      if (sheet.cssRules) {
        Array.from(sheet.cssRules).forEach(rule => {
          if (rule.cssText.includes('recharts') || 
              rule.cssText.includes('stroke') || 
              rule.cssText.includes('fill')) {
            cssRules.push(rule.cssText);
          }
        });
      }
    } catch (e) {
    }
  });
  
  if (cssRules.length > 0) {
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = cssRules.join('\n');
    clonedSvg.insertBefore(styleElement, clonedSvg.firstChild);
  }
  
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(clonedSvg);
  
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.download = `${filename}.svg`;
  link.href = url;
  link.click();
  
  URL.revokeObjectURL(url);
}

export function getResolutionLabel(scale: number): string {
  const baseWidth = 800;
  const baseHeight = 400;
  const width = Math.round(baseWidth * scale);
  const height = Math.round(baseHeight * scale);
  const dpi = Math.round(72 * scale);
  
  return `${width}×${height}px (${dpi} DPI)`;
}

export const RESOLUTION_PRESETS = [
  { label: 'Web (1x)', scale: 1, description: '800×400px, 72 DPI' },
  { label: 'Retina (2x)', scale: 2, description: '1600×800px, 144 DPI' },
  { label: 'Print (3x)', scale: 3, description: '2400×1200px, 216 DPI' },
  { label: 'High-Res (4x)', scale: 4, description: '3200×1600px, 288 DPI' },
  { label: 'Publication (6x)', scale: 6, description: '4800×2400px, 432 DPI' },
];

export interface PDFExportOptions {
  filename: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
  includeTimestamp?: boolean;
}

const defaultPDFOptions: PDFExportOptions = {
  filename: 'analysis_report',
  title: 'PAR(2) Analysis Results',
  orientation: 'portrait',
  includeTimestamp: true,
};

export async function exportElementToPDF(
  element: HTMLElement | null,
  options: Partial<PDFExportOptions> = {}
): Promise<void> {
  if (!element) {
    console.error('No element provided for PDF export');
    return;
  }

  const opts = { ...defaultPDFOptions, ...options };

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#1a1a2e',
      useCORS: true,
      logging: false,
      allowTaint: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    const pdf = new jsPDF({
      orientation: opts.orientation,
      unit: 'px',
      format: [imgWidth + 40, imgHeight + 80],
    });

    pdf.setFillColor(26, 26, 46);
    pdf.rect(0, 0, imgWidth + 40, imgHeight + 80, 'F');

    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text(opts.title || 'Analysis Results', 20, 30);

    if (opts.includeTimestamp) {
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 20, 50);
    }

    pdf.addImage(imgData, 'PNG', 20, 60, imgWidth, imgHeight);

    pdf.save(`${opts.filename}.pdf`);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}

export async function printAnalysisResults(
  analysisData: {
    runName: string;
    datasetName: string;
    hypotheses: Array<{
      clockGene: string;
      targetGene: string;
      pValue: number | null;
      qValue: number | null;
      significant: boolean;
      eigenvalueModulus?: number | null;
    }>;
    summary: {
      totalPairs: number;
      significantPairs: number;
      meanEigenvalue?: number;
    };
  },
  options: Partial<PDFExportOptions> = {}
): Promise<void> {
  const opts = { ...defaultPDFOptions, ...options };

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = 20;

    pdf.setFillColor(26, 26, 46);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    pdf.setFontSize(20);
    pdf.setTextColor(139, 92, 246);
    pdf.text('PAR(2) Discovery Engine', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    pdf.setFontSize(14);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Circadian Clock-Target Dynamics Analysis', pageWidth / 2, yPos, { align: 'center' });
    yPos += 20;

    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Analysis Summary', 15, yPos);
    yPos += 10;

    pdf.setFontSize(11);
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Run: ${analysisData.runName}`, 15, yPos);
    yPos += 7;
    pdf.text(`Dataset: ${analysisData.datasetName}`, 15, yPos);
    yPos += 7;
    pdf.text(`Generated: ${new Date().toLocaleString()}`, 15, yPos);
    yPos += 12;

    pdf.setFillColor(240, 240, 245);
    pdf.roundedRect(15, yPos, pageWidth - 30, 25, 3, 3, 'F');
    yPos += 8;
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Total Gene Pairs: ${analysisData.summary.totalPairs}`, 20, yPos);
    yPos += 7;
    pdf.text(`Significant Pairs: ${analysisData.summary.significantPairs} (q < 0.10)`, 20, yPos);
    if (analysisData.summary.meanEigenvalue) {
      yPos += 7;
      pdf.text(`Mean Eigenvalue |lambda|: ${analysisData.summary.meanEigenvalue.toFixed(3)}`, 20, yPos);
    }
    yPos += 15;

    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Significant Results', 15, yPos);
    yPos += 8;

    const significantHypotheses = analysisData.hypotheses.filter(h => h.significant);

    if (significantHypotheses.length === 0) {
      pdf.setFontSize(11);
      pdf.setTextColor(100, 100, 100);
      pdf.text('No significant gene pairs found in this analysis.', 15, yPos);
    } else {
      pdf.setFillColor(139, 92, 246);
      pdf.rect(15, yPos, pageWidth - 30, 8, 'F');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Clock Gene', 20, yPos + 5.5);
      pdf.text('Target Gene', 55, yPos + 5.5);
      pdf.text('p-value', 100, yPos + 5.5);
      pdf.text('q-value', 130, yPos + 5.5);
      pdf.text('|lambda|', 160, yPos + 5.5);
      yPos += 10;

      pdf.setTextColor(0, 0, 0);
      significantHypotheses.slice(0, 25).forEach((h, i) => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }

        if (i % 2 === 0) {
          pdf.setFillColor(248, 248, 252);
          pdf.rect(15, yPos - 4, pageWidth - 30, 7, 'F');
        }

        pdf.setFontSize(9);
        pdf.text(h.clockGene, 20, yPos);
        pdf.text(h.targetGene, 55, yPos);
        pdf.text(h.pValue ? h.pValue.toExponential(2) : 'N/A', 100, yPos);
        pdf.text(h.qValue ? h.qValue.toFixed(4) : 'N/A', 130, yPos);
        pdf.text(h.eigenvalueModulus ? h.eigenvalueModulus.toFixed(3) : 'N/A', 160, yPos);
        yPos += 7;
      });

      if (significantHypotheses.length > 25) {
        yPos += 5;
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`... and ${significantHypotheses.length - 25} more significant pairs`, 15, yPos);
      }
    }

    const footerY = pdf.internal.pageSize.getHeight() - 10;
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text('PAR(2) Discovery Engine - Circadian Clock-Target Dynamics Analysis Platform', pageWidth / 2, footerY, { align: 'center' });

    pdf.save(`${opts.filename || analysisData.runName.replace(/\s+/g, '_')}_report.pdf`);
  } catch (error) {
    console.error('Error generating PDF report:', error);
    throw error;
  }
}
