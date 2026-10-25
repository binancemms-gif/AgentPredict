import React, { useState } from 'react';
import { Activity, CheckCircle2, FlaskConical, RefreshCw } from 'lucide-react';

interface PaperModePanelProps {
  market: string;
}

interface BacktestResult {
  market: string;
  product: string;
  feed: string;
  generatedAt: number;
  candles: number;
  holdoutCandles: number;
  horizon: string;
  metrics: {
    accuracyPct: number;
    brierScore: number;
    baselineBrier: number;
    trades: number;
    upPredictions: number;
  };
  verdict: 'PASS' | 'HOLD';
}

export const PaperModePanel: React.FC<PaperModePanelProps> = ({ market }) => {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/paper/backtest?market=${encodeURIComponent(market)}`);
      if (!response.ok) throw new Error('Historical feed unavailable');
      setResult(await response.json());
    } catch {
      setError('Could not load the timestamped Coinbase history. Try again when the feed is available.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-[#26352b] bg-[#0b110e] p-4" aria-labelledby="paper-mode-title">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#5ee26a]/30 bg-[#5ee26a]/10 text-[#5ee26a]">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div>
            <h2 id="paper-mode-title" className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#d7f5dc]">LEXI Oracle · paper gate</h2>
            <p className="mt-1 text-[11px] leading-relaxed text-[#8fa795]">Unseen, timestamped candles are held out before any forecast is shown to the dashboard.</p>
          </div>
        </div>
        <button onClick={runTest} disabled={loading} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#5ee26a]/35 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#5ee26a] transition hover:bg-[#5ee26a]/10 disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Testing' : 'Run test'}
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-[#ff8a8a]">{error}</p>}
      {result && (
        <div className="mt-3 border-t border-[#26352b] pt-3">
          <div className="mb-2 flex items-center justify-between text-[10px] font-mono text-[#8fa795]">
            <span>{result.feed} · {result.holdoutCandles} holdout candles · {result.horizon}</span>
            <span className="flex items-center gap-1 text-[#5ee26a]"><CheckCircle2 className="h-3 w-3" /> {new Date(result.generatedAt).toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
            <Metric label="Accuracy" value={`${result.metrics.accuracyPct}%`} />
            <Metric label="Brier" value={result.metrics.brierScore.toFixed(3)} />
            <Metric label="Baseline" value={result.metrics.baselineBrier.toFixed(3)} />
            <Metric label="Paper calls" value={String(result.metrics.trades)} />
          </div>
          <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-semibold ${result.verdict === 'PASS' ? 'text-[#5ee26a]' : 'text-[#d4af37]'}`}>
            <Activity className="h-3.5 w-3.5" /> {result.verdict === 'PASS' ? 'Holdout edge detected — forecasts remain paper-only.' : 'No validated edge yet — forecasts stay disconnected.'}
          </div>
        </div>
      )}
    </section>
  );
};

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#1e2b22] bg-[#0e1711] px-1 py-2"><div className="text-[9px] text-[#78909c]">{label}</div><div className="mt-0.5 text-xs font-bold text-white">{value}</div></div>;
}
