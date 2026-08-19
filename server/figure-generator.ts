const MANUSCRIPT_DATA = {
  healthyTissues: [
    { tissue: "Liver", clock: 0.725, target: 0.479, gap: 0.245 },
    { tissue: "Heart", clock: 0.689, target: 0.356, gap: 0.333 },
    { tissue: "Kidney", clock: 0.777, target: 0.561, gap: 0.217 },
  ],
  cancer: [
    { condition: "MYC-ON\n(Cancer)", clock: 0.619, target: 0.705, gap: -0.086 },
    { condition: "MYC-OFF\n(Normal)", clock: 0.614, target: 0.488, gap: 0.127 },
  ],
  organoids: [
    { condition: "WT-WT\n(Healthy)", clock: 0.588, target: 0.556, gap: 0.033 },
    { condition: "ApcKO-WT\n(Cancer)", clock: 0.663, target: 0.790, gap: -0.127 },
    { condition: "WT-BmalKO", clock: 0.499, target: 0.594, gap: -0.095 },
    { condition: "ApcKO-BmalKO", clock: 0.583, target: 0.572, gap: 0.011 },
  ],
  baboon: [
    { tissue: "Lung", clock: 0.675, target: 0.525, gap: 0.150, preserved: true },
    { tissue: "Hippocampus", clock: 0.635, target: 0.532, gap: 0.103, preserved: true },
    { tissue: "White Adipose", clock: 0.562, target: 0.461, gap: 0.102, preserved: true },
    { tissue: "Thalamus", clock: 0.585, target: 0.521, gap: 0.065, preserved: true },
    { tissue: "Kidney Cortex", clock: 0.594, target: 0.554, gap: 0.040, preserved: true },
    { tissue: "Pancreas", clock: 0.583, target: 0.544, gap: 0.040, preserved: true },
    { tissue: "Adrenal Cortex", clock: 0.603, target: 0.583, gap: 0.020, preserved: true },
    { tissue: "SCN", clock: 0.476, target: 0.462, gap: 0.015, preserved: true },
    { tissue: "Heart", clock: 0.728, target: 0.767, gap: -0.040, preserved: false },
    { tissue: "Spleen", clock: 0.481, target: 0.533, gap: -0.052, preserved: false },
    { tissue: "Duodenum", clock: 0.480, target: 0.555, gap: -0.074, preserved: false },
    { tissue: "Liver", clock: 0.497, target: 0.594, gap: -0.096, preserved: false },
    { tissue: "Cerebellum", clock: 0.400, target: 0.510, gap: -0.111, preserved: false },
    { tissue: "Aorta", clock: 0.410, target: 0.552, gap: -0.142, preserved: false },
  ],
  p53: {
    healthy: { clock: 0.648, target: 0.478, p53: 0.452 },
    cancer: { clock: 0.639, target: 0.541, p53: 0.665 },
  },
  desynchrony: [
    { condition: "Liver", cv: 0.153, isHealthy: true },
    { condition: "Heart", cv: 0.149, isHealthy: true },
    { condition: "Kidney", cv: 0.154, isHealthy: true },
    { condition: "Lung", cv: 0.148, isHealthy: true },
    { condition: "Muscle", cv: 0.218, isHealthy: true },
    { condition: "Adrenal", cv: 0.178, isHealthy: true },
    { condition: "Hypothalamus", cv: 0.276, isHealthy: true },
    { condition: "MYC-ON\nNeuroblastoma", cv: 0.312, isHealthy: false },
  ],
  aging: [
    { condition: "Adult\nControl", eigenvalue: 0.824 },
    { condition: "Adult\nCR", eigenvalue: 0.843 },
    { condition: "Aged\nControl", eigenvalue: 0.754 },
    { condition: "Aged\nCR", eigenvalue: 0.808 },
  ],
  modelOrder: [
    { model: "AR(1)", lbPass: 67, clockMean: 0.726, targetMean: 0.302, gap: 0.424 },
    { model: "AR(2)", lbPass: 93, clockMean: 0.725, targetMean: 0.479, gap: 0.245 },
    { model: "AR(3)", lbPass: 87, clockMean: 0.553, targetMean: 0.565, gap: -0.012 },
  ],
};

const COLORS = {
  clock: "#3b82f6",
  target: "#ef4444",
  p53: "#f59e0b",
  preserved: "#22c55e",
  reversed: "#ef4444",
  healthy: "#3b82f6",
  cancer: "#ef4444",
  bg: "#ffffff",
  text: "#1a1a2e",
  textLight: "#6b7280",
  grid: "#e5e7eb",
  border: "#d1d5db",
};

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function svgHeader(width: number, height: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background:${COLORS.bg}">
<defs>
  <style>
    text { font-family: 'Helvetica Neue', 'Arial', sans-serif; }
    .title { font-size: 16px; font-weight: 700; fill: ${COLORS.text}; }
    .subtitle { font-size: 11px; fill: ${COLORS.textLight}; }
    .axis-label { font-size: 11px; fill: ${COLORS.text}; font-weight: 500; }
    .tick-label { font-size: 10px; fill: ${COLORS.textLight}; }
    .value-label { font-size: 9px; fill: ${COLORS.text}; font-weight: 600; }
    .legend-text { font-size: 10px; fill: ${COLORS.text}; }
    .annotation { font-size: 9px; fill: ${COLORS.textLight}; font-style: italic; }
  </style>
</defs>`;
}

function drawGrid(x: number, y: number, w: number, h: number, yMin: number, yMax: number, steps: number): string {
  let svg = '';
  for (let i = 0; i <= steps; i++) {
    const yPos = y + h - (i / steps) * h;
    const val = yMin + (i / steps) * (yMax - yMin);
    svg += `<line x1="${x}" y1="${yPos}" x2="${x + w}" y2="${yPos}" stroke="${COLORS.grid}" stroke-width="0.5" />`;
    svg += `<text x="${x - 8}" y="${yPos + 4}" class="tick-label" text-anchor="end">${val.toFixed(2)}</text>`;
  }
  svg += `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + h}" stroke="${COLORS.border}" stroke-width="1" />`;
  svg += `<line x1="${x}" y1="${y + h}" x2="${x + w}" y2="${y + h}" stroke="${COLORS.border}" stroke-width="1" />`;
  return svg;
}

function generateFigure1(): string {
  const W = 720, H = 420;
  const margin = { top: 55, right: 30, bottom: 70, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const data = MANUSCRIPT_DATA.healthyTissues;
  const barWidth = 50;
  const groupWidth = plotW / data.length;

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 1. Clock-Target Eigenvalue Hierarchy in Healthy Mouse Tissues</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">GSE54650 (Zhang/Hogenesch) | AR(2) eigenvalue modulus |λ| | 13 clock genes, 23 target genes</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0, 1.0, 5);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Eigenvalue Modulus |λ|</text>`;

  data.forEach((d, i) => {
    const cx = margin.left + groupWidth * i + groupWidth / 2;
    const clockH = (d.clock / 1.0) * plotH;
    const targetH = (d.target / 1.0) * plotH;

    svg += `<rect x="${cx - barWidth - 2}" y="${margin.top + plotH - clockH}" width="${barWidth}" height="${clockH}" fill="${COLORS.clock}" opacity="0.85" rx="2" />`;
    svg += `<rect x="${cx + 2}" y="${margin.top + plotH - targetH}" width="${barWidth}" height="${targetH}" fill="${COLORS.target}" opacity="0.85" rx="2" />`;

    svg += `<text x="${cx - barWidth / 2 - 2}" y="${margin.top + plotH - clockH - 5}" class="value-label" text-anchor="middle">${d.clock.toFixed(3)}</text>`;
    svg += `<text x="${cx + barWidth / 2 + 2}" y="${margin.top + plotH - targetH - 5}" class="value-label" text-anchor="middle">${d.target.toFixed(3)}</text>`;

    const gapY = margin.top + plotH - Math.max(clockH, targetH) - 22;
    svg += `<text x="${cx}" y="${gapY}" class="value-label" text-anchor="middle" fill="${COLORS.preserved}">Gap: +${d.gap.toFixed(3)}</text>`;

    svg += `<text x="${cx}" y="${margin.top + plotH + 18}" class="axis-label" text-anchor="middle">${d.tissue}</text>`;
  });

  svg += `<rect x="${W - 180}" y="${margin.top + 5}" width="12" height="12" fill="${COLORS.clock}" rx="2" />`;
  svg += `<text x="${W - 163}" y="${margin.top + 15}" class="legend-text">Clock genes (n=8)</text>`;
  svg += `<rect x="${W - 180}" y="${margin.top + 23}" width="12" height="12" fill="${COLORS.target}" rx="2" />`;
  svg += `<text x="${W - 163}" y="${margin.top + 33}" class="legend-text">Target genes (n=8)</text>`;

  svg += `<text x="${W / 2}" y="${H - 8}" class="annotation" text-anchor="middle">All three tissues from same cohort — not independent replicates (see Limitation #1)</text>`;
  svg += '</svg>';
  return svg;
}

function generateFigure2(): string {
  const W = 800, H = 440;
  const margin = { top: 55, right: 30, bottom: 80, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const allData = [
    ...MANUSCRIPT_DATA.cancer.map(d => ({ ...d, source: 'Neuroblastoma\n(GSE221103)' })),
    ...MANUSCRIPT_DATA.organoids.map(d => ({ ...d, source: 'Organoids\n(GSE157357)' })),
  ];
  const barWidth = 32;
  const groupWidth = plotW / allData.length;

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 2. Cancer Disrupts the Clock-Target Eigenvalue Hierarchy</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">MYC-activated neuroblastoma (GSE221103) and APC-mutant intestinal organoids (GSE157357)</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0, 1.0, 5);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Eigenvalue Modulus |λ|</text>`;

  const zeroLineY = margin.top + plotH;

  allData.forEach((d, i) => {
    const cx = margin.left + groupWidth * i + groupWidth / 2;
    const clockH = (d.clock / 1.0) * plotH;
    const targetH = (d.target / 1.0) * plotH;

    svg += `<rect x="${cx - barWidth - 2}" y="${zeroLineY - clockH}" width="${barWidth}" height="${clockH}" fill="${COLORS.clock}" opacity="0.85" rx="2" />`;
    svg += `<rect x="${cx + 2}" y="${zeroLineY - targetH}" width="${barWidth}" height="${targetH}" fill="${COLORS.target}" opacity="0.85" rx="2" />`;

    svg += `<text x="${cx - barWidth / 2 - 2}" y="${zeroLineY - clockH - 4}" class="value-label" text-anchor="middle">${d.clock.toFixed(3)}</text>`;
    svg += `<text x="${cx + barWidth / 2 + 2}" y="${zeroLineY - targetH - 4}" class="value-label" text-anchor="middle">${d.target.toFixed(3)}</text>`;

    const gapColor = d.gap >= 0 ? COLORS.preserved : COLORS.reversed;
    const gapLabel = d.gap >= 0 ? `+${d.gap.toFixed(3)}` : d.gap.toFixed(3);
    const gapY = zeroLineY - Math.max(clockH, targetH) - 18;
    svg += `<text x="${cx}" y="${gapY}" class="value-label" text-anchor="middle" fill="${gapColor}">${gapLabel}</text>`;

    const lines = d.condition.split('\n');
    lines.forEach((line, li) => {
      svg += `<text x="${cx}" y="${zeroLineY + 16 + li * 13}" class="tick-label" text-anchor="middle">${escapeXml(line)}</text>`;
    });
  });

  const divX = margin.left + groupWidth * 2;
  svg += `<line x1="${divX}" y1="${margin.top}" x2="${divX}" y2="${margin.top + plotH}" stroke="${COLORS.border}" stroke-width="1" stroke-dasharray="5,5" />`;

  svg += `<text x="${margin.left + groupWidth}" y="${H - 18}" class="axis-label" text-anchor="middle">Neuroblastoma (GSE221103)</text>`;
  svg += `<text x="${margin.left + groupWidth * 2 + (groupWidth * 2)}" y="${H - 18}" class="axis-label" text-anchor="middle">Intestinal Organoids (GSE157357)</text>`;

  svg += `<rect x="${W - 180}" y="${margin.top + 5}" width="12" height="12" fill="${COLORS.clock}" rx="2" />`;
  svg += `<text x="${W - 163}" y="${margin.top + 15}" class="legend-text">Clock genes</text>`;
  svg += `<rect x="${W - 180}" y="${margin.top + 23}" width="12" height="12" fill="${COLORS.target}" rx="2" />`;
  svg += `<text x="${W - 163}" y="${margin.top + 33}" class="legend-text">Target genes</text>`;

  svg += '</svg>';
  return svg;
}

function generateFigure3(): string {
  const W = 800, H = 480;
  const margin = { top: 55, right: 30, bottom: 75, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const data = MANUSCRIPT_DATA.baboon;
  const barWidth = Math.min(22, (plotW / data.length - 8) / 2);
  const groupWidth = plotW / data.length;

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 3. Cross-Species Validation: Baboon Multi-Tissue Atlas (GSE98965)</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">Papio anubis | Mure et al., Science 2018 | 14 tissues, 12 timepoints | Mann-Whitney p = 0.81</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0, 1.0, 5);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Eigenvalue Modulus |λ|</text>`;

  data.forEach((d, i) => {
    const cx = margin.left + groupWidth * i + groupWidth / 2;
    const clockH = (d.clock / 1.0) * plotH;
    const targetH = (d.target / 1.0) * plotH;
    const opacity = d.preserved ? 0.85 : 0.6;

    svg += `<rect x="${cx - barWidth - 1}" y="${margin.top + plotH - clockH}" width="${barWidth}" height="${clockH}" fill="${COLORS.clock}" opacity="${opacity}" rx="1" />`;
    svg += `<rect x="${cx + 1}" y="${margin.top + plotH - targetH}" width="${barWidth}" height="${targetH}" fill="${COLORS.target}" opacity="${opacity}" rx="1" />`;

    const gapColor = d.preserved ? COLORS.preserved : COLORS.reversed;
    const gapLabel = d.gap >= 0 ? `+${d.gap.toFixed(2)}` : d.gap.toFixed(2);
    svg += `<text x="${cx}" y="${margin.top + plotH - Math.max(clockH, targetH) - 5}" class="value-label" text-anchor="middle" fill="${gapColor}" style="font-size:8px">${gapLabel}</text>`;

    svg += `<text x="${cx}" y="${margin.top + plotH + 14}" class="tick-label" text-anchor="middle" style="font-size:8px" transform="rotate(-35,${cx},${margin.top + plotH + 14})">${d.tissue}</text>`;
  });

  const preservedCount = data.filter(d => d.preserved).length;
  const divX = margin.left + groupWidth * preservedCount;
  svg += `<line x1="${divX}" y1="${margin.top}" x2="${divX}" y2="${margin.top + plotH}" stroke="${COLORS.border}" stroke-width="1" stroke-dasharray="5,5" />`;
  svg += `<text x="${margin.left + (divX - margin.left) / 2}" y="${H - 12}" class="annotation" text-anchor="middle" fill="${COLORS.preserved}">Hierarchy Preserved (8/14 = 57%)</text>`;
  svg += `<text x="${divX + (margin.left + plotW - divX) / 2}" y="${H - 12}" class="annotation" text-anchor="middle" fill="${COLORS.reversed}">Hierarchy Reversed (6/14 = 43%)</text>`;

  svg += `<rect x="${W - 180}" y="${margin.top + 5}" width="12" height="12" fill="${COLORS.clock}" rx="2" />`;
  svg += `<text x="${W - 163}" y="${margin.top + 15}" class="legend-text">Clock genes (n=8)</text>`;
  svg += `<rect x="${W - 180}" y="${margin.top + 23}" width="12" height="12" fill="${COLORS.target}" rx="2" />`;
  svg += `<text x="${W - 163}" y="${margin.top + 33}" class="legend-text">Target genes (n=17-18)</text>`;

  svg += '</svg>';
  return svg;
}

function generateFigure4(): string {
  const W = 600, H = 400;
  const margin = { top: 55, right: 30, bottom: 65, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const { healthy, cancer } = MANUSCRIPT_DATA.p53;
  const barWidth = 40;
  const conditionWidth = plotW / 2;

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 4. p53 Pathway Eigenvalue Dynamics</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">DNA damage response shifts from target-like to clock-like persistence in cancer</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0, 0.8, 4);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Eigenvalue Modulus |λ|</text>`;

  const yScale = (v: number) => margin.top + plotH - (v / 0.8) * plotH;

  [{ label: "Healthy\n(n=8 tissues)", data: healthy, x: margin.left + conditionWidth * 0.5 },
   { label: "MYC-ON Cancer\n(n=1)", data: cancer, x: margin.left + conditionWidth * 1.5 }].forEach(({ label, data, x }) => {
    const vals = [
      { v: data.clock, color: COLORS.clock, lbl: "Clock" },
      { v: data.target, color: COLORS.target, lbl: "Target" },
      { v: data.p53, color: COLORS.p53, lbl: "p53" },
    ];
    const totalW = vals.length * barWidth + (vals.length - 1) * 6;
    const startX = x - totalW / 2;

    vals.forEach((bar, bi) => {
      const bx = startX + bi * (barWidth + 6);
      const h = (bar.v / 0.8) * plotH;
      svg += `<rect x="${bx}" y="${yScale(bar.v)}" width="${barWidth}" height="${h}" fill="${bar.color}" opacity="0.85" rx="2" />`;
      svg += `<text x="${bx + barWidth / 2}" y="${yScale(bar.v) - 5}" class="value-label" text-anchor="middle">${bar.v.toFixed(3)}</text>`;
    });

    const lines = label.split('\n');
    lines.forEach((line, li) => {
      svg += `<text x="${x}" y="${margin.top + plotH + 18 + li * 13}" class="axis-label" text-anchor="middle">${escapeXml(line)}</text>`;
    });
  });

  const divX = margin.left + conditionWidth;
  svg += `<line x1="${divX}" y1="${margin.top}" x2="${divX}" y2="${margin.top + plotH}" stroke="${COLORS.border}" stroke-width="1" stroke-dasharray="5,5" />`;

  const lx = W - 150;
  svg += `<rect x="${lx}" y="${margin.top + 5}" width="12" height="12" fill="${COLORS.clock}" rx="2" />`;
  svg += `<text x="${lx + 17}" y="${margin.top + 15}" class="legend-text">Clock</text>`;
  svg += `<rect x="${lx}" y="${margin.top + 23}" width="12" height="12" fill="${COLORS.target}" rx="2" />`;
  svg += `<text x="${lx + 17}" y="${margin.top + 33}" class="legend-text">Target</text>`;
  svg += `<rect x="${lx}" y="${margin.top + 41}" width="12" height="12" fill="${COLORS.p53}" rx="2" />`;
  svg += `<text x="${lx + 17}" y="${margin.top + 51}" class="legend-text">p53 pathway</text>`;

  svg += '</svg>';
  return svg;
}

function generateFigure5(): string {
  const W = 650, H = 400;
  const margin = { top: 55, right: 30, bottom: 60, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const data = MANUSCRIPT_DATA.desynchrony;
  const barWidth = Math.min(50, plotW / data.length - 10);

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 5. Clock Desynchrony Index Across Conditions</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">Coefficient of variation of clock gene eigenvalues | Higher CV = less coordinated dynamics</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0, 0.4, 4);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Clock Eigenvalue CV</text>`;

  const groupWidth = plotW / data.length;

  data.forEach((d, i) => {
    const cx = margin.left + groupWidth * i + groupWidth / 2;
    const h = (d.cv / 0.4) * plotH;
    const color = d.isHealthy ? COLORS.clock : COLORS.cancer;

    svg += `<rect x="${cx - barWidth / 2}" y="${margin.top + plotH - h}" width="${barWidth}" height="${h}" fill="${color}" opacity="0.85" rx="2" />`;
    svg += `<text x="${cx}" y="${margin.top + plotH - h - 5}" class="value-label" text-anchor="middle">${d.cv.toFixed(3)}</text>`;

    const lines = d.condition.split('\n');
    lines.forEach((line, li) => {
      svg += `<text x="${cx}" y="${margin.top + plotH + 14 + li * 11}" class="tick-label" text-anchor="middle" style="font-size:8px" transform="rotate(-25,${cx},${margin.top + plotH + 14 + li * 11})">${escapeXml(line)}</text>`;
    });
  });

  const healthyMean = data.filter(d => d.isHealthy).reduce((s, d) => s + d.cv, 0) / data.filter(d => d.isHealthy).length;
  const meanY = margin.top + plotH - (healthyMean / 0.4) * plotH;
  svg += `<line x1="${margin.left}" y1="${meanY}" x2="${margin.left + plotW}" y2="${meanY}" stroke="${COLORS.preserved}" stroke-width="1" stroke-dasharray="4,4" />`;
  svg += `<text x="${margin.left + plotW + 5}" y="${meanY + 4}" class="annotation" text-anchor="start" style="font-size:8px" fill="${COLORS.preserved}">Healthy mean</text>`;

  svg += `<rect x="${W - 165}" y="${margin.top + 5}" width="12" height="12" fill="${COLORS.healthy}" rx="2" />`;
  svg += `<text x="${W - 148}" y="${margin.top + 15}" class="legend-text">Healthy tissue</text>`;
  svg += `<rect x="${W - 165}" y="${margin.top + 23}" width="12" height="12" fill="${COLORS.cancer}" rx="2" />`;
  svg += `<text x="${W - 148}" y="${margin.top + 33}" class="legend-text">Cancer</text>`;

  svg += '</svg>';
  return svg;
}

function generateFigure6(): string {
  const W = 550, H = 380;
  const margin = { top: 55, right: 30, bottom: 65, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const data = MANUSCRIPT_DATA.modelOrder;
  const barWidth = 35;
  const groupWidth = plotW / data.length;

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 6. Model Order Selection: AR(1) vs AR(2) vs AR(3)</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">GSE54650 Liver | Ljung-Box residual whiteness + clock-target separation</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0, 1.0, 5);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Eigenvalue Modulus |λ|</text>`;

  data.forEach((d, i) => {
    const cx = margin.left + groupWidth * i + groupWidth / 2;
    const clockH = (d.clockMean / 1.0) * plotH;
    const targetH = (d.targetMean / 1.0) * plotH;

    svg += `<rect x="${cx - barWidth - 2}" y="${margin.top + plotH - clockH}" width="${barWidth}" height="${clockH}" fill="${COLORS.clock}" opacity="${d.model === 'AR(2)' ? 0.95 : 0.5}" rx="2" />`;
    svg += `<rect x="${cx + 2}" y="${margin.top + plotH - targetH}" width="${barWidth}" height="${targetH}" fill="${COLORS.target}" opacity="${d.model === 'AR(2)' ? 0.95 : 0.5}" rx="2" />`;

    svg += `<text x="${cx - barWidth / 2 - 2}" y="${margin.top + plotH - clockH - 4}" class="value-label" text-anchor="middle">${d.clockMean.toFixed(3)}</text>`;
    svg += `<text x="${cx + barWidth / 2 + 2}" y="${margin.top + plotH - targetH - 4}" class="value-label" text-anchor="middle">${d.targetMean.toFixed(3)}</text>`;

    const gapColor = d.gap >= 0 ? COLORS.preserved : COLORS.reversed;
    const gapLabel = d.gap >= 0 ? `+${d.gap.toFixed(3)}` : d.gap.toFixed(3);
    svg += `<text x="${cx}" y="${margin.top + plotH - Math.max(clockH, targetH) - 18}" class="value-label" text-anchor="middle" fill="${gapColor}">Gap: ${gapLabel}</text>`;

    svg += `<text x="${cx}" y="${margin.top + plotH + 18}" class="axis-label" text-anchor="middle" font-weight="${d.model === 'AR(2)' ? '700' : '400'}">${d.model}</text>`;
    svg += `<text x="${cx}" y="${margin.top + plotH + 33}" class="tick-label" text-anchor="middle">LB pass: ${d.lbPass}%</text>`;

    if (d.model === 'AR(2)') {
      svg += `<rect x="${cx - barWidth - 8}" y="${margin.top - 3}" width="${barWidth * 2 + 12}" height="${plotH + 6}" fill="none" stroke="${COLORS.preserved}" stroke-width="2" stroke-dasharray="6,3" rx="4" />`;
      svg += `<text x="${cx}" y="${margin.top + plotH + 50}" class="annotation" text-anchor="middle" fill="${COLORS.preserved}">Selected model</text>`;
    }
  });

  svg += '</svg>';
  return svg;
}

function generateFigure7(): string {
  const W = 550, H = 380;
  const margin = { top: 55, right: 30, bottom: 65, left: 65 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;
  const data = MANUSCRIPT_DATA.aging;
  const barWidth = 55;
  const groupWidth = plotW / data.length;

  let svg = svgHeader(W, H);
  svg += `<text x="${W / 2}" y="22" class="title" text-anchor="middle">Figure 7. Aging Effects on Eigenvalue Persistence</text>`;
  svg += `<text x="${W / 2}" y="40" class="subtitle" text-anchor="middle">GSE84521 | Epidermal stem cells | Caloric restriction (CR) partially preserves persistence</text>`;

  svg += drawGrid(margin.left, margin.top, plotW, plotH, 0.6, 0.9, 3);
  svg += `<text x="${margin.left - 45}" y="${margin.top + plotH / 2}" class="axis-label" text-anchor="middle" transform="rotate(-90,${margin.left - 45},${margin.top + plotH / 2})">Mean Eigenvalue |λ|</text>`;

  const yMin = 0.6, yMax = 0.9;
  const yScale = (v: number) => margin.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const agingColors = ["#3b82f6", "#60a5fa", "#ef4444", "#f87171"];

  data.forEach((d, i) => {
    const cx = margin.left + groupWidth * i + groupWidth / 2;
    const h = ((d.eigenvalue - yMin) / (yMax - yMin)) * plotH;
    const barY = yScale(d.eigenvalue);

    svg += `<rect x="${cx - barWidth / 2}" y="${barY}" width="${barWidth}" height="${h}" fill="${agingColors[i]}" opacity="0.85" rx="2" />`;
    svg += `<text x="${cx}" y="${barY - 5}" class="value-label" text-anchor="middle">${d.eigenvalue.toFixed(3)}</text>`;

    const lines = d.condition.split('\n');
    lines.forEach((line, li) => {
      svg += `<text x="${cx}" y="${margin.top + plotH + 18 + li * 13}" class="axis-label" text-anchor="middle">${escapeXml(line)}</text>`;
    });
  });

  const adultY = yScale(MANUSCRIPT_DATA.aging[0].eigenvalue);
  svg += `<line x1="${margin.left}" y1="${adultY}" x2="${margin.left + plotW}" y2="${adultY}" stroke="${COLORS.textLight}" stroke-width="0.5" stroke-dasharray="4,4" />`;

  svg += `<text x="${W / 2}" y="${H - 8}" class="annotation" text-anchor="middle">Aging decreases persistence (-0.070); CR partially restores it</text>`;

  svg += '</svg>';
  return svg;
}

export function generateAllFigures(): { name: string; svg: string; description: string }[] {
  return [
    { name: "Figure_1_Healthy_Tissue_Hierarchy.svg", svg: generateFigure1(), description: "Clock-target eigenvalue hierarchy in healthy mouse tissues (GSE54650)" },
    { name: "Figure_2_Cancer_Disruption.svg", svg: generateFigure2(), description: "Cancer disrupts clock-target hierarchy in neuroblastoma and organoids" },
    { name: "Figure_3_Baboon_Cross_Species.svg", svg: generateFigure3(), description: "Cross-species validation in baboon multi-tissue atlas (GSE98965)" },
    { name: "Figure_4_p53_Pathway.svg", svg: generateFigure4(), description: "p53 pathway eigenvalue dynamics shift in cancer" },
    { name: "Figure_5_Desynchrony_Index.svg", svg: generateFigure5(), description: "Clock desynchrony index across healthy tissues and cancer" },
    { name: "Figure_6_Model_Order_Selection.svg", svg: generateFigure6(), description: "AR(1) vs AR(2) vs AR(3) model order comparison" },
    { name: "Figure_7_Aging_Patterns.svg", svg: generateFigure7(), description: "Aging effects on eigenvalue persistence in epidermal stem cells" },
  ];
}
