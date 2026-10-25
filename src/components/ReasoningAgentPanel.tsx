import React, { useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ShieldAlert,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  CornerDownRight,
  RefreshCw,
} from 'lucide-react';
import { ReasoningResult, AnalysisSignals } from '../types';

interface ReasoningAgentPanelProps {
  marketId: string;
  product: string;
  price: number | null;
  target: number | null;
  analysis: AnalysisSignals | null;
  timeRemaining: number;
  decimals?: number;
}

export const ReasoningAgentPanel: React.FC<ReasoningAgentPanelProps> = ({
  marketId,
  product,
  price,
  target,
  analysis,
  timeRemaining,
  decimals = 2,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [reasoningData, setReasoningData] = useState<ReasoningResult | null>(null);
  const [userQuery, setUserQuery] = useState<string>('');
  const [lastAnalyzedTime, setLastAnalyzedTime] = useState<string | null>(null);

  const fetchReasoning = async (queryText?: string) => {
    if (!price || !target || !analysis || loading) return;

    setLoading(true);
    try {
      const payload = {
        market: marketId,
        product,
        price,
        target,
        secondsLeft: Math.round(timeRemaining / 1000),
        pUp: analysis.p,
        perSecVol: analysis.sig,
        trend: analysis.trend,
        orderFlow: analysis.fl,
        momentum: analysis.mom,
        rsi: analysis.rsi,
        takerBuyVol: analysis.tb,
        takerSellVol: analysis.ts,
        userQuery: queryText || userQuery || undefined,
      };

      const res = await fetch('/api/ai/reasoning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Reasoning request failed');
      const data = await res.json();
      if (data.ok && data.data) {
        setReasoningData(data.data);
        const now = new Date();
        setLastAnalyzedTime(
          `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(
            2,
            '0'
          )}:${String(now.getSeconds()).padStart(2, '0')}`
        );
      }
    } catch (err) {
      console.error('Reasoning agent failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    setUserQuery(q);
    fetchReasoning(q);
  };

  const getRecommendationBadge = (rec: ReasoningResult['recommendation']) => {
    switch (rec) {
      case 'STRONG_UP':
        return <span className="bg-[#5ee26a]/20 text-[#5ee26a] border border-[#5ee26a]/40 px-2 py-0.5 rounded text-[11px] font-bold font-mono">STRONG UP</span>;
      case 'LEAN_UP':
        return <span className="bg-[#5ee26a]/15 text-[#5ee26a] border border-[#5ee26a]/30 px-2 py-0.5 rounded text-[11px] font-semibold font-mono">LEAN UP</span>;
      case 'STRONG_DOWN':
        return <span className="bg-[#ee3344]/20 text-[#ee3344] border border-[#ee3344]/40 px-2 py-0.5 rounded text-[11px] font-bold font-mono">STRONG DOWN</span>;
      case 'LEAN_DOWN':
        return <span className="bg-[#ee3344]/15 text-[#ee3344] border border-[#ee3344]/30 px-2 py-0.5 rounded text-[11px] font-semibold font-mono">LEAN DOWN</span>;
      default:
        return <span className="bg-[#8b8b92]/20 text-[#8b8b92] border border-[#8b8b92]/30 px-2 py-0.5 rounded text-[11px] font-mono">NO TRADE / NEUTRAL</span>;
    }
  };

  return (
    <div className="border border-[#382b4a] bg-gradient-to-b from-[#130d1d] via-[#0d0914] to-[#07050a] rounded-2xl p-4 mt-5 shadow-2xl transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#b57bff]/20 border border-[#b57bff]/40 flex items-center justify-center text-[#d0a7ff]">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-[12px] tracking-[0.14em] text-[#d0a7ff] uppercase font-mono flex items-center gap-1.5">
              <span>◆ REASONING AGENT</span>
              {loading && <span className="text-[10px] text-[#b57bff] animate-pulse">thinking…</span>}
            </h3>
            <p className="text-[11px] text-[#8b8b92] font-mono">Chain-of-thought microstructure inference</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReasoning()}
            disabled={loading || !analysis}
            className="p-1.5 rounded-lg bg-[#211633] border border-[#3b2759] text-[#d0a7ff] hover:bg-[#2d1e45] transition-all disabled:opacity-40"
            title="Evaluate Chain of Thought"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-[#8b8b92] hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3.5 space-y-3.5">
          {/* Quick Trigger if not yet run */}
          {!reasoningData && !loading && (
            <div className="p-4 rounded-xl bg-[#191024]/60 border border-[#2e1d44] text-center space-y-2">
              <p className="text-xs text-[#cfcfd4]">
                Activate the deep reasoning agent to evaluate volatility diffusion, order flow sweeps, and tail-risk invalidation boundaries for this round.
              </p>
              <button
                onClick={() => fetchReasoning()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8c4be6] hover:bg-[#9d60f5] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Chain-of-Thought Reasoning</span>
              </button>
            </div>
          )}

          {/* Active Reasoning Data */}
          {reasoningData && (
            <div className="space-y-3">
              {/* Verdict Summary Strip */}
              <div className="p-3 rounded-xl bg-[#1a1226] border border-[#331f4a] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8b8b92] font-mono">Inference:</span>
                  {getRecommendationBadge(reasoningData.recommendation)}
                </div>

                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1 text-[#d4af37]">
                    <span className="text-[#8b8b92]">Confidence:</span>
                    <span className="font-bold">{reasoningData.confidenceScore}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[#ff8080]">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="text-[#8b8b92]">Invalidates at:</span>
                    <span className="font-bold tabular-nums">${reasoningData.invalidationLevel.toFixed(decimals)}</span>
                  </div>
                </div>
              </div>

              {/* Regime Tag */}
              <div className="flex items-center justify-between text-[11px] font-mono px-1">
                <span className="text-[#8b8b92]">Detected Market Regime:</span>
                <span className="text-[#d0a7ff] font-semibold">{reasoningData.regime}</span>
              </div>

              {/* Step-by-Step Chain-of-Thought Trace */}
              <div className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#b57bff] font-semibold">
                  Chain-of-Thought Steps
                </div>
                {reasoningData.steps.map((st) => {
                  const isBull = st.status === 'bullish';
                  const isBear = st.status === 'bearish';

                  return (
                    <div
                      key={st.step}
                      className="p-2.5 rounded-xl bg-[#140e1f] border border-[#271838] space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between font-mono">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-[#271838] text-[#d0a7ff] text-[10px] flex items-center justify-center">
                            {st.step}
                          </span>
                          {st.title}
                        </span>
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            isBull
                              ? 'text-[#5ee26a] bg-[#5ee26a]/10'
                              : isBear
                              ? 'text-[#ee3344] bg-[#ee3344]/10'
                              : 'text-[#8b8b92] bg-[#8b8b92]/10'
                          }`}
                        >
                          {st.status}
                        </span>
                      </div>
                      <p className="text-[#cfcfd4] text-[12px] leading-relaxed pl-5.5 font-sans">
                        {st.deduction}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Synthesis Verdict */}
              <div className="p-3 rounded-xl bg-[#1c122b] border border-[#3b2359] text-xs text-[#e6e0cc] leading-relaxed font-serif italic">
                "{reasoningData.synthesis}"
              </div>

              {/* User Answer if query provided */}
              {reasoningData.userAnswer && (
                <div className="p-3 rounded-xl bg-[#231536] border border-[#4d2d75] text-xs text-[#f3ebff] leading-relaxed font-sans flex items-start gap-2">
                  <CornerDownRight className="w-4 h-4 text-[#d0a7ff] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-[#d0a7ff] block mb-0.5">Direct Inquiry Answer:</span>
                    <span>{reasoningData.userAnswer}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ask the Reasoning Agent Input & Quick Prompts */}
          <div className="pt-2 border-t border-[#291a3d] space-y-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchReasoning(userQuery)}
                placeholder="Ask reasoning agent a question..."
                className="flex-1 bg-[#130d1c] border border-[#2b1b40] rounded-xl px-3 py-1.5 text-xs text-white placeholder-[#776c88] focus:outline-none focus:border-[#8c4be6]"
              />
              <button
                onClick={() => fetchReasoning(userQuery)}
                disabled={loading || !userQuery.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#8c4be6] hover:bg-[#9d60f5] text-white text-xs font-semibold flex items-center justify-center disabled:opacity-40 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Prompt Pills */}
            <div className="flex flex-wrap gap-1.5">
              {[
                'What invalidates this thesis?',
                'Should I increase stake?',
                'Is taker order flow fading?',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  disabled={loading}
                  className="text-[10px] font-mono text-[#b57bff] bg-[#211633] hover:bg-[#2b1d42] border border-[#372352] px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>

            {lastAnalyzedTime && (
              <div className="text-[10px] font-mono text-[#6e5d85] text-right">
                Evaluated at {lastAnalyzedTime}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
