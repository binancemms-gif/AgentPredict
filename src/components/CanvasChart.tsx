import React, { useEffect, useRef } from 'react';
import { GruPoint } from '../types';
import { Sparkles, Activity } from 'lucide-react';

interface Point {
  t: number;
  p: number;
}

interface CanvasChartProps {
  rSecs: Point[];
  target: number | null;
  price: number | null;
  rStart: number;
  durationMs: number;
  lockBeforeMs: number;
  decimals?: number;
  gruPoints?: GruPoint[];
  showGruTrajectory?: boolean;
  onToggleGruTrajectory?: () => void;
  gruPUp?: number;
}

export const CanvasChart: React.FC<CanvasChartProps> = ({
  rSecs,
  target,
  price,
  rStart,
  durationMs,
  lockBeforeMs,
  decimals = 2,
  gruPoints,
  showGruTrajectory = true,
  onToggleGruTrajectory,
  gruPUp,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    if (rSecs.length < 1 || target === null || price === null) {
      // Empty placeholder
      ctx.fillStyle = '#8b8b92';
      ctx.font = '13px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Awaiting real-time price ticks…', w / 2, h / 2);
      ctx.restore();
      return;
    }

    // Min and max bounds calculation including GRU envelope if enabled
    const prices = rSecs.map((q) => q.p);
    let lo = Math.min(target, ...prices);
    let hi = Math.max(target, ...prices);

    if (showGruTrajectory && gruPoints && gruPoints.length > 0) {
      const gruPrices = gruPoints.map((g) => g.p);
      const gruUppers = gruPoints.map((g) => g.upper);
      const gruLowers = gruPoints.map((g) => g.lower);
      lo = Math.min(lo, ...gruPrices, ...gruLowers);
      hi = Math.max(hi, ...gruPrices, ...gruUppers);
    }

    const range = hi - lo;
    const pad = Math.max(range * 0.25, price * 0.0002);
    lo -= pad;
    hi += pad;

    const R = 72; // right margin for price scale
    const W = w - R;

    // Coordinate mapping functions
    const X = (t: number) => {
      const frac = (t - rStart) / durationMs;
      return Math.max(0, Math.min(W, frac * W));
    };

    const Y = (p: number) => {
      return h - 16 - ((p - lo) / (hi - lo)) * (h - 32);
    };

    // Draw Lock Zone (e.g. final 15s or lock window)
    const lockX = X(rStart + durationMs - lockBeforeMs);
    if (lockX < W) {
      ctx.fillStyle = 'rgba(238, 51, 68, 0.04)';
      ctx.fillRect(lockX, 4, W - lockX, h - 8);
      ctx.strokeStyle = 'rgba(238, 51, 68, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lockX, 4);
      ctx.lineTo(lockX, h - 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Subtle Grid lines
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = '#6b6b72';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i++) {
      const p = lo + ((hi - lo) * i) / 4;
      const yPos = Y(p);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(W, yPos);
      ctx.stroke();

      const pLabel = p >= 1000 ? p.toFixed(1) : p.toFixed(decimals);
      ctx.fillText('$' + pLabel, w - 8, yPos + 4);
    }

    const isAbove = price >= target;
    const lineColor = isAbove ? '#5ee26a' : '#ee3344';

    // Target reference horizontal line
    const targetY = Y(target);
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(180, 180, 190, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, targetY);
    ctx.lineTo(W + 8, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Target badge on the right
    const targetText = target >= 1000 ? target.toFixed(1) : target.toFixed(decimals);
    const badgeText = targetText;
    ctx.font = '600 11px -apple-system, sans-serif';
    const textWidth = ctx.measureText(badgeText).width;
    const badgeW = textWidth + 16;
    const badgeH = 20;
    const badgeX = w - badgeW - 4;
    const badgeY = targetY - badgeH / 2;

    ctx.fillStyle = '#222226';
    ctx.strokeStyle = '#44444c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
    } else {
      ctx.rect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e5e5ea';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, badgeX + badgeW / 2, targetY + 4);

    // PiSimo GRU Projected Trajectory & Uncertainty Envelope Overlay
    if (showGruTrajectory && gruPoints && gruPoints.length > 0) {
      const lastRealPt = rSecs[rSecs.length - 1];
      const startX = X(lastRealPt.t);
      const startY = Y(lastRealPt.p);

      // Draw GRU Confidence Cone (Funnel)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      gruPoints.forEach((pt) => {
        ctx.lineTo(X(pt.t), Y(pt.upper));
      });
      for (let i = gruPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(X(gruPoints[i].t), Y(gruPoints[i].lower));
      }
      ctx.closePath();

      const coneGrad = ctx.createLinearGradient(startX, 0, W, 0);
      coneGrad.addColorStop(0, 'rgba(0, 229, 255, 0.12)');
      coneGrad.addColorStop(1, 'rgba(0, 229, 255, 0.02)');
      ctx.fillStyle = coneGrad;
      ctx.fill();

      // Border bounds of confidence funnel
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Draw GRU Neural Forward Trajectory Curve
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 3]);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      gruPoints.forEach((pt) => {
        ctx.lineTo(X(pt.t), Y(pt.p));
      });
      ctx.stroke();
      ctx.restore();

      // Draw GRU End-Point Terminal Forecast Dot & Badge
      const endPt = gruPoints[gruPoints.length - 1];
      const endX = X(endPt.t);
      const endY = Y(endPt.p);

      ctx.save();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(endX, endY, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(endX, endY, 2, 0, Math.PI * 2);
      ctx.fill();

      // Forecast label tooltip on chart
      const gruLabel = `GRU: $${endPt.p >= 1000 ? endPt.p.toFixed(1) : endPt.p.toFixed(decimals)}`;
      ctx.font = '600 10px monospace';
      const labelW = ctx.measureText(gruLabel).width + 12;
      const labelX = Math.max(10, Math.min(W - labelW - 4, endX - labelW / 2));
      const labelY = Math.max(14, Math.min(h - 26, endY - 14));

      ctx.fillStyle = 'rgba(10, 20, 28, 0.85)';
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(labelX, labelY, labelW, 18, 4);
      } else {
        ctx.rect(labelX, labelY, labelW, 18);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'center';
      ctx.fillText(gruLabel, labelX + labelW / 2, labelY + 12);
      ctx.restore();
    }

    // Subtle area gradient fill under real price line
    const areaGradient = ctx.createLinearGradient(0, Y(hi), 0, h);
    if (isAbove) {
      areaGradient.addColorStop(0, 'rgba(94, 226, 106, 0.16)');
      areaGradient.addColorStop(1, 'rgba(94, 226, 106, 0.00)');
    } else {
      areaGradient.addColorStop(0, 'rgba(238, 51, 68, 0.16)');
      areaGradient.addColorStop(1, 'rgba(238, 51, 68, 0.00)');
    }

    ctx.beginPath();
    rSecs.forEach((q, i) => {
      const qx = X(q.t);
      const qy = Y(q.p);
      if (i === 0) {
        ctx.moveTo(qx, h - 8);
        ctx.lineTo(qx, qy);
      } else {
        ctx.lineTo(qx, qy);
      }
    });
    const lastPt = rSecs[rSecs.length - 1];
    ctx.lineTo(X(lastPt.t), h - 8);
    ctx.closePath();
    ctx.fillStyle = areaGradient;
    ctx.fill();

    // Real Price trajectory line
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    rSecs.forEach((q, i) => {
      const qx = X(q.t);
      const qy = Y(q.p);
      if (i === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    });
    ctx.stroke();

    // Pulsing current price point
    const lx = X(lastPt.t);
    const ly = Y(lastPt.p);

    ctx.save();
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = lineColor;
    ctx.beginPath();
    ctx.arc(lx, ly, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }, [rSecs, target, price, rStart, durationMs, lockBeforeMs, decimals, gruPoints, showGruTrajectory]);

  return (
    <div className="relative w-full h-[280px] bg-[#08080a] rounded-xl border border-[#1a1a1f] p-1 my-3 overflow-hidden shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Top Left Horizon Badge */}
      <div className="absolute top-2 left-3 flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded bg-black/60 border border-[#2a2a30] text-[#a0a0ab]">
          Round Horizon
        </span>
      </div>

      {/* Top Right PiSimo GRU Overlay Toggle Button */}
      {onToggleGruTrajectory && (
        <button
          onClick={onToggleGruTrajectory}
          className={`absolute top-2 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold transition-all shadow-md cursor-pointer ${
            showGruTrajectory
              ? 'bg-[#00e5ff]/15 border border-[#00e5ff]/40 text-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.2)]'
              : 'bg-[#15151a]/80 border border-[#2a2a33] text-[#71717a] hover:text-[#a1a1aa]'
          }`}
          title="Toggle PiSimo GRU Recurrent Neural Forecast Trajectory"
        >
          <Activity className="w-3 h-3" />
          <span>PiSimo GRU</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              showGruTrajectory ? 'bg-[#00e5ff] animate-pulse' : 'bg-[#555]'
            }`}
          />
          {showGruTrajectory && gruPUp !== undefined && (
            <span className="tabular-nums font-bold text-white ml-0.5">
              {Math.round(gruPUp * 100)}%
            </span>
          )}
        </button>
      )}
    </div>
  );
};
