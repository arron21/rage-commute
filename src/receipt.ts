import { SwearLogItem } from './types';

export interface ReceiptStats {
  score: number;
  highScore: number;
  totalSwears: number;
  totalFine: number;
  peakCombo: number;
  peakBloodPressure: string;
  coffeeCollected: number;
  killerObstacle: string;
  swearLog: SwearLogItem[];
  commuterName: string;
}

export function renderReceiptToCanvas(canvas: HTMLCanvasElement, stats: ReceiptStats): void {
  const ctx = canvas.getContext('2d')!;
  const w = 440;
  const h = 620;
  canvas.width = w;
  canvas.height = h;

  // Paper Background
  ctx.fillStyle = '#fdfbf7';
  ctx.fillRect(0, 0, w, h);

  // Subtle receipt texture stripes
  ctx.fillStyle = 'rgba(0,0,0,0.025)';
  for (let y = 0; y < h; y += 6) {
    ctx.fillRect(0, y, w, 2);
  }

  // Top & Bottom Jagged Tear Edges
  ctx.fillStyle = '#18181b';
  for (let x = 0; x < w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 8, 10);
    ctx.lineTo(x + 16, 0);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + 8, h - 10);
    ctx.lineTo(x + 16, h);
    ctx.fill();
  }

  // Border
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 16, w - 20, h - 32);

  // Header
  ctx.fillStyle = '#18181b';
  ctx.textAlign = 'center';
  ctx.font = '900 24px "Courier New", monospace';
  ctx.fillText('DEPT. OF HUMAN RESOURCES', w / 2, 54);

  ctx.font = '700 14px "Courier New", monospace';
  ctx.fillStyle = '#dc2626';
  ctx.fillText('OFFICIAL SWEAR JAR CITATION RECEIPT', w / 2, 76);

  ctx.fillStyle = '#52525b';
  ctx.font = '600 12px "Courier New", monospace';
  const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  ctx.fillText(`OFFENDER: ${stats.commuterName.toUpperCase()} | TIME: ${dateStr}`, w / 2, 96);

  // Dashed Divider
  drawDashedLine(ctx, 26, 110, w - 26, 110);

  // Itemized Swear Log
  ctx.textAlign = 'left';
  ctx.font = '700 13px "Courier New", monospace';
  ctx.fillStyle = '#18181b';
  ctx.fillText('OBSTACLE / OUTBURST', 28, 132);
  ctx.textAlign = 'right';
  ctx.fillText('FINE', w - 28, 132);

  drawDashedLine(ctx, 26, 142, w - 26, 142);

  const recentLogs = stats.swearLog.slice(-7);
  let y = 166;
  ctx.font = '600 12px "Courier New", monospace';

  if (recentLogs.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#71717a';
    ctx.fillText('(0 OBSTACLES CLEARED — INSTANT WIPEOUT!)', w / 2, y + 20);
    y += 50;
  } else {
    for (const item of recentLogs) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#18181b';
      const lineTitle = `${item.obstacleName.slice(0, 20)} ("${item.wordUsed.slice(0, 14)}")`;
      ctx.fillText(lineTitle, 28, y);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#dc2626';
      ctx.fillText(`$${item.fine.toLocaleString()}`, w - 28, y);
      y += 24;
    }
    if (stats.swearLog.length > 7) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#71717a';
      ctx.fillText(`+ ${stats.swearLog.length - 7} more profanity citations...`, 28, y);
      y += 22;
    }
  }

  const summaryTop = Math.max(y + 10, 355);
  drawDashedLine(ctx, 26, summaryTop, w - 26, summaryTop);

  // Summary Stats
  const rows = [
    ['CAUSE OF TERMINATION:', stats.killerObstacle.toUpperCase()],
    ['TOTAL SWEARS YELLED:', `${stats.totalSwears}`],
    ['MAX RAGE COMBO:', `x${stats.peakCombo}`],
    ['PEAK BLOOD PRESSURE:', stats.peakBloodPressure],
    ['DISTANCE / SCORE:', `${Math.floor(stats.score).toLocaleString()} PTS`],
  ];

  let sy = summaryTop + 26;
  ctx.font = '700 13px "Courier New", monospace';
  for (const [label, val] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3f3f46';
    ctx.fillText(label, 28, sy);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#18181b';
    ctx.fillText(val, w - 28, sy);
    sy += 24;
  }

  drawDashedLine(ctx, 26, sy - 6, w - 26, sy - 6);

  // Total Fine Box
  sy += 24;
  ctx.font = '900 20px "Courier New", monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#18181b';
  ctx.fillText('TOTAL HR FINE DUE:', 28, sy);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#dc2626';
  ctx.fillText(`$${stats.totalFine.toLocaleString()}`, w - 28, sy);

  // Red "FIRED / CITED" Stamp
  ctx.save();
  ctx.translate(w - 115, sy - 75);
  ctx.rotate(-0.22);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.82)';
  ctx.lineWidth = 4;
  ctx.strokeRect(-70, -22, 140, 44);
  ctx.font = '900 20px Impact, sans-serif';
  ctx.fillStyle = 'rgba(220, 38, 38, 0.82)';
  ctx.textAlign = 'center';
  ctx.fillText('HR CITED!', 0, 7);
  ctx.restore();

  // Barcode at bottom
  const barY = h - 68;
  ctx.fillStyle = '#18181b';
  for (let bx = 46; bx < w - 46; bx += 6) {
    const bw = (bx * 7) % 3 === 0 ? 4 : 2;
    ctx.fillRect(bx, barY, bw, 28);
  }
  ctx.font = '700 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PLAY RAGE COMMUTE — SWEAR TO SURVIVE', w / 2, h - 24);
}

function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): void {
  ctx.save();
  ctx.strokeStyle = '#71717a';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}
