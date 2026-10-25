import { AnalysisSignals } from '../types';

export const clamp = (x: number, a: number, b: number): number => {
  return Math.max(a, Math.min(b, x));
};

export function Phi(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t *
        (-0.3565638 +
          t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export const ema = (a: number[], n: number): number => {
  if (!a.length) return 0;
  const k = 2 / (n + 1);
  let e = a[0];
  for (const v of a) {
    e = v * k + e * (1 - k);
  }
  return e;
};

export const sd = (a: number[]): number => {
  if (a.length < 3) return 0;
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + Math.pow(y - m, 2), 0) / (a.length - 1));
};

export const fmtPrice = (p: number | null, decimals = 2): string => {
  if (p === null || isNaN(p)) return '—';
  if (p >= 1000) {
    return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + p.toFixed(decimals);
};

export function generateWhyExplanation(a: AnalysisSignals): string {
  const bits: string[] = [];
  const dist = (a.d * 100).toFixed(3);
  bits.push(
    `Price is ${Math.abs(Number(dist))}% ${a.d >= 0 ? 'above' : 'below'} target with ${Math.round(
      a.tau
    )}s left; expected move over that time is ±${(a.sig * Math.sqrt(a.tau) * 100).toFixed(3)}%.`
  );

  const signals: [string, number, string][] = [
    ['trend', a.trend, 'EMA trend'],
    ['flow', a.fl, 'order flow'],
    ['mom', a.mom, '30s momentum'],
    ['rsi', a.rs, `RSI ${a.rsi.toFixed(0)}`],
  ];

  signals.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));
  const lead = signals[0];

  if (Math.abs(lead[1]) > 0.15) {
    bits.push(`Strongest tilt: ${lead[2]} leaning ${lead[1] > 0 ? 'up' : 'down'}.`);
  } else {
    bits.push('Secondary signals are mixed, so distance to target dominates.');
  }

  return bits.join(' ');
}
