import React from 'react';
import { AnalysisSignals } from '../types';
import { clamp } from '../utils/math';

interface SignalBarsProps {
  analysis: AnalysisSignals | null;
}

export const SignalBars: React.FC<SignalBarsProps> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="py-2 text-xs text-[#8b8b92] italic">
        Computing quantitative feature signals…
      </div>
    );
  }

  const signals: [string, number][] = [
    ['Distance', clamp(analysis.zd / 2, -1, 1)],
    ['Trend', clamp(analysis.trend, -1, 1)],
    ['Order flow', clamp(analysis.fl, -1, 1)],
    ['Momentum', clamp(analysis.mom, -1, 1)],
    ['RSI', clamp(analysis.rs, -1, 1)],
  ];

  return (
    <div className="space-y-2 mt-3 font-mono text-xs">
      {signals.map(([name, val]) => {
        const isPos = val >= 0;
        const widthPct = Math.min(50, Math.abs(val) * 50);

        return (
          <div key={name} className="grid grid-cols-[82px_1fr_48px] items-center gap-2.5 text-[#8b8b92]">
            <span className="font-sans font-medium text-[13px] text-[#b5b5be] truncate">{name}</span>
            <div className="relative h-2 bg-[#18181c] rounded-full overflow-hidden border border-[#24242a]">
              {/* Center dividing hash */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[#40404a] -translate-x-1/2 z-10" />

              {/* Directional fill bar */}
              <div
                className="absolute top-0 bottom-0 rounded-full transition-all duration-300"
                style={{
                  left: isPos ? '50%' : `${50 - widthPct}%`,
                  width: `${widthPct}%`,
                  backgroundColor: isPos ? '#5ee26a' : '#ee3344',
                }}
              />
            </div>
            <span
              className={`text-right font-semibold text-[12px] tabular-nums ${
                isPos ? 'text-[#5ee26a]' : 'text-[#ee3344]'
              }`}
            >
              {isPos ? '+' : ''}
              {val.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
