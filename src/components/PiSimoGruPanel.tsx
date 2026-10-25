import React, { useState } from 'react';
import {
  Cpu,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Layers,
  Activity,
  Zap,
  Info,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { GruForecastResult } from '../types';
import { fmtPrice } from '../utils/math';

interface PiSimoGruPanelProps {
  forecast: GruForecastResult | null;
  targetPrice: number | null;
  currentPrice: number | null;
  decimals?: number;
  showTrajectoryOnChart: boolean;
  onToggleTrajectoryOnChart: () => void;
  coinName: string;
}

export const PiSimoGruPanel: React.FC<PiSimoGruPanelProps> = ({
  forecast,
  targetPrice,
  currentPrice,
  decimals = 2,
  showTrajectoryOnChart,
  onToggleTrajectoryOnChart,
  coinName,
}) => {
  const [showArchitectureDetails, setShowArchitectureDetails] = useState<boolean>(false);

  if (!forecast || targetPrice === null || currentPrice === null) {
    return (
      <div className="border border-[#202026] bg-[#0c0c0f] rounded-2xl p-4 mt-4 text-center">
        <div className="flex items-center justify-center gap-2 text-xs text-[#8b8b92] font-mono">
          <Activity className="w-3.5 h-3.5 animate-spin text-[#00e5ff]" />
          <span>Ingesting tick stream into PiSimo GRU recurrent pipeline…</span>
        </div>
      </div>
    );
  }

  const isUp = forecast.direction === 'UP';
  const pPct = Math.round(forecast.pUp * 100);
  const isAboveTarget = forecast.projectedPrice >= targetPrice;

  return (
    <div className="border border-[#00e5ff]/25 bg-gradient-to-b from-[#09151e] to-[#060b10] rounded-2xl p-4.5 mt-4 shadow-xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-44 h-44 bg-[#00e5ff]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header bar with PiSimo/BitcoinForecast attribution */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00e5ff]/15 border border-[#00e5ff]/35 flex items-center justify-center text-[#00e5ff]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-bold text-[12px] tracking-[0.12em] text-[#00e5ff] uppercase font-mono">
                PiSimo GRU-RNN Forecaster
              </h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#00e5ff]/15 text-[#00e5ff] font-mono border border-[#00e5ff]/30">
                DEEP SEQ
              </span>
            </div>
            <p className="text-[10px] text-[#78909c] font-mono">
              Gated Recurrent Unit · {forecast.modelMeta.hiddenUnits} Latent Neurons
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/PiSimo/BitcoinForecast"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-mono text-[#00e5ff]/80 hover:text-[#00e5ff] bg-[#00e5ff]/10 hover:bg-[#00e5ff]/20 px-2.5 py-1 rounded-full border border-[#00e5ff]/30 transition-all cursor-pointer"
            title="View original PiSimo/BitcoinForecast repo on GitHub"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Verdict & Trajectory projection */}
      <div className="bg-[#050d14]/80 border border-[#00e5ff]/20 rounded-xl p-3.5 mb-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-2xl font-black font-serif tracking-tight flex items-center gap-1.5 ${
                isUp ? 'text-[#5ee26a]' : 'text-[#ee3344]'
              }`}
            >
              {isUp ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
              <span>{isUp ? 'PREDICTED UP' : 'PREDICTED DOWN'}</span>
            </span>
            <span className="text-xl font-bold font-mono text-white tabular-nums">
              {pPct}%
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-[#78909c] block">
              Confidence
            </span>
            <span className="text-xs font-mono font-bold text-[#00e5ff]">
              {forecast.confidence}%
            </span>
          </div>
        </div>

        {/* Projected Price and Delta */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-[#00e5ff]/15 text-xs font-mono">
          <div>
            <span className="text-[10px] text-[#78909c] block">GRU Horizon Settlement:</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {fmtPrice(forecast.projectedPrice, decimals)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-[#78909c] block">Expected Δ from Strike:</span>
            <span
              className={`text-sm font-bold tabular-nums ${
                isAboveTarget ? 'text-[#5ee26a]' : 'text-[#ee3344]'
              }`}
            >
              {isAboveTarget ? '+' : ''}
              {forecast.deltaPct.toFixed(3)}% ({fmtPrice(Math.abs(forecast.deltaUsd), decimals)})
            </span>
          </div>
        </div>
      </div>

      {/* Gated Recurrent Unit (GRU) Internal Gate Activations */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[11px] font-mono text-[#78909c] mb-1.5">
          <span className="flex items-center gap-1">
            <Sliders className="w-3 h-3 text-[#00e5ff]" />
            <span>Recurrent Gate States (t={forecast.modelMeta.lookbackSteps})</span>
          </span>
          <span className="text-[10px] text-[#00e5ff]">Tanh &amp; Sigmoid Gating</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 font-mono text-center">
          {/* Reset Gate r_t */}
          <div className="bg-[#050d14] border border-[#142633] p-2 rounded-lg">
            <div className="text-[9px] text-[#78909c]">Reset (r_t)</div>
            <div className="text-xs font-bold text-white mt-0.5 tabular-nums">
              {forecast.gates.resetGate.toFixed(2)}
            </div>
            <div className="w-full bg-[#10202b] h-1 rounded-full mt-1 overflow-hidden">
              <div
                className="bg-[#00e5ff] h-full"
                style={{ width: `${Math.round(forecast.gates.resetGate * 100)}%` }}
              />
            </div>
          </div>

          {/* Update Gate z_t */}
          <div className="bg-[#050d14] border border-[#142633] p-2 rounded-lg">
            <div className="text-[9px] text-[#78909c]">Update (z_t)</div>
            <div className="text-xs font-bold text-white mt-0.5 tabular-nums">
              {forecast.gates.updateGate.toFixed(2)}
            </div>
            <div className="w-full bg-[#10202b] h-1 rounded-full mt-1 overflow-hidden">
              <div
                className="bg-[#5ee26a] h-full"
                style={{ width: `${Math.round(forecast.gates.updateGate * 100)}%` }}
              />
            </div>
          </div>

          {/* Candidate State h~_t */}
          <div className="bg-[#050d14] border border-[#142633] p-2 rounded-lg">
            <div className="text-[9px] text-[#78909c]">Candidate (h̃)</div>
            <div
              className={`text-xs font-bold mt-0.5 tabular-nums ${
                forecast.gates.candidateState >= 0 ? 'text-[#5ee26a]' : 'text-[#ee3344]'
              }`}
            >
              {forecast.gates.candidateState >= 0 ? '+' : ''}
              {forecast.gates.candidateState.toFixed(2)}
            </div>
            <div className="w-full bg-[#10202b] h-1 rounded-full mt-1 overflow-hidden">
              <div
                className={`h-full ${
                  forecast.gates.candidateState >= 0 ? 'bg-[#5ee26a]' : 'bg-[#ee3344]'
                }`}
                style={{
                  width: `${Math.min(100, Math.round(Math.abs(forecast.gates.candidateState) * 100))}%`,
                }}
              />
            </div>
          </div>

          {/* Hidden Vector Norm ||h_t|| */}
          <div className="bg-[#050d14] border border-[#142633] p-2 rounded-lg">
            <div className="text-[9px] text-[#78909c]">Norm ||h||</div>
            <div className="text-xs font-bold text-[#d4af37] mt-0.5 tabular-nums">
              {forecast.gates.hiddenNorm.toFixed(2)}
            </div>
            <div className="w-full bg-[#10202b] h-1 rounded-full mt-1 overflow-hidden">
              <div
                className="bg-[#d4af37] h-full"
                style={{
                  width: `${Math.min(100, Math.round((forecast.gates.hiddenNorm / 2) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trajectory on Main Chart Toggle Switch */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#00e5ff]/20">
        <button
          onClick={onToggleTrajectoryOnChart}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
            showTrajectoryOnChart
              ? 'bg-[#00e5ff]/20 border-[#00e5ff] text-[#00e5ff] shadow-[0_0_12px_rgba(0,229,255,0.25)]'
              : 'bg-[#050d14] border-[#142633] text-[#78909c] hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{showTrajectoryOnChart ? 'GRU Trajectory Visible on Chart' : 'Show GRU Path on Chart'}</span>
        </button>

        <button
          onClick={() => setShowArchitectureDetails((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-mono text-[#78909c] hover:text-[#00e5ff] transition-colors cursor-pointer"
        >
          <span>Architecture</span>
          {showArchitectureDetails ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Collapsible Architecture Details & PiSimo Model Explanation */}
      {showArchitectureDetails && (
        <div className="mt-3 pt-3 border-t border-[#00e5ff]/15 space-y-2 text-xs text-[#b0bec5] font-sans leading-relaxed animate-fade-in">
          <div className="p-3 bg-[#050d14] border border-[#142633] rounded-xl space-y-2 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#78909c]">Tensor Pipeline:</span>
              <span className="text-white font-semibold">
                [1, 30, 4] → GRU(64) → Dense(12)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#78909c]">Features (grabber.py):</span>
              <span className="text-[#00e5ff]">Δ Strike, Log Returns, Taker Flow, Vol Ratio</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#78909c]">Validation Loss (network.py):</span>
              <span className="text-[#5ee26a]">MSE: {forecast.modelMeta.valMse} · MAE: {forecast.modelMeta.valMae}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#78909c]">Optimizer:</span>
              <span className="text-white">Adam (lr=0.001, beta1=0.9, beta2=0.999)</span>
            </div>
          </div>

          <p className="text-[11.5px] text-[#90a4ae] leading-relaxed pt-1">
            <strong>Why GRU RNNs for Bitcoin:</strong> Traditional regression and Markovian models forget historical momentum sequences or suffer from vanishing gradients over sliding price steps. By dynamically learning when to reset memory (<code className="text-[#00e5ff] font-mono text-[11px]">r_t</code>) vs retain momentum (<code className="text-[#5ee26a] font-mono text-[11px]">z_t</code>), the PiSimo GRU architecture accurately projects non-linear drift into the round settlement horizon.
          </p>
        </div>
      )}
    </div>
  );
};
