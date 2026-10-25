import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Flame,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  User,
  Cpu,
  Trophy,
  ArrowUpRight,
} from 'lucide-react';
import { RoundHistoryItem } from '../types';

interface CalendarHeatmapProps {
  history: RoundHistoryItem[];
  marketId: string;
  currentPrice?: number | null;
}

interface DayStats {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayName: string; // Mon, Tue...
  dayNum: number; // 24
  isToday: boolean;
  userWins: number;
  userLosses: number;
  userTotal: number;
  userWinRate: number | null; // null if 0 bets
  agentWins: number;
  agentLosses: number;
  agentTotal: number;
  agentWinRate: number | null;
  rounds: RoundHistoryItem[];
}

export const CalendarHeatmap: React.FC<CalendarHeatmapProps> = ({
  history,
  marketId,
  currentPrice,
}) => {
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(true);
  const [viewFilter, setViewFilter] = useState<'both' | 'user' | 'agent'>('both');

  // Generate the seven-day view from recorded backend settlements.
  const daysData: DayStats[] = useMemo(() => {
    const now = new Date();
    const days: DayStats[] = [];

    // Map existing history by YYYY-MM-DD
    const roundsByDate: Record<string, RoundHistoryItem[]> = {};

    history.forEach((h) => {
      const d = new Date(h.s);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      if (!roundsByDate[key]) roundsByDate[key] = [];
      roundsByDate[key].push(h);
    });

    // Generate last 7 days from persisted backend settlements only.

    // Generate last 7 days (day 6 down to day 0 = today)
    for (let i = 6; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      targetDate.setHours(0, 0, 0, 0);

      const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(targetDate.getDate()).padStart(2, '0')}`;
      const isToday = i === 0;

      let dayRounds = roundsByDate[dateKey] || [];

      // Sort rounds by timestamp descending
      dayRounds.sort((a, b) => b.s - a.s);

      // Compute stats
      let uWins = 0;
      let uLosses = 0;
      let aWins = 0;
      let aLosses = 0;

      dayRounds.forEach((r) => {
        if (r.u) {
          if (r.u === r.res) uWins++;
          else uLosses++;
        }
        if (r.ag) {
          if (r.ag === r.res) aWins++;
          else aLosses++;
        }
      });

      const uTotal = uWins + uLosses;
      const aTotal = aWins + aLosses;

      const uRate = uTotal > 0 ? Math.round((uWins / uTotal) * 100) : null;
      const aRate = aTotal > 0 ? Math.round((aWins / aTotal) * 100) : null;

      days.push({
        date: targetDate,
        dateKey,
        dayName: isToday ? 'Today' : targetDate.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: targetDate.getDate(),
        isToday,
        userWins: uWins,
        userLosses: uLosses,
        userTotal: uTotal,
        userWinRate: uRate,
        agentWins: aWins,
        agentLosses: aLosses,
        agentTotal: aTotal,
        agentWinRate: aRate,
        rounds: dayRounds,
      });
    }

    return days;
  }, [history, marketId, currentPrice]);

  // Default active selected day to Today
  const activeDayKey = selectedDayKey || daysData[daysData.length - 1]?.dateKey;
  const activeDay = daysData.find((d) => d.dateKey === activeDayKey) || daysData[daysData.length - 1];

  // Helper for heatmap background & text colors
  const getUserHeatColor = (rate: number | null) => {
    if (rate === null) return 'bg-[#141418] border-[#22222a] text-[#8b8b92]';
    if (rate >= 65) return 'bg-[#10381e] border-[#5ee26a]/50 text-[#5ee26a] shadow-[0_0_8px_rgba(94,226,106,0.15)]';
    if (rate >= 50) return 'bg-[#192b18] border-[#5ee26a]/30 text-[#86efac]';
    if (rate >= 40) return 'bg-[#29161a] border-[#ee3344]/30 text-[#fca5a5]';
    return 'bg-[#3b1217] border-[#ee3344]/50 text-[#ee3344] shadow-[0_0_8px_rgba(238,51,68,0.15)]';
  };

  const getAgentHeatColor = (rate: number | null) => {
    if (rate === null) return 'bg-[#141418] border-[#22222a] text-[#8b8b92]';
    if (rate >= 65) return 'bg-[#2b220d] border-[#d4af37]/50 text-[#d4af37] shadow-[0_0_8px_rgba(212,175,55,0.15)]';
    if (rate >= 50) return 'bg-[#211b0e] border-[#d4af37]/30 text-[#fde047]';
    return 'bg-[#29161a] border-[#ee3344]/30 text-[#fca5a5]';
  };

  // Weekly Overview Metrics
  const weeklyStats = useMemo(() => {
    let uWins = 0;
    let uTotal = 0;
    let aWins = 0;
    let aTotal = 0;
    let bestDay: DayStats | null = null;

    daysData.forEach((d) => {
      uWins += d.userWins;
      uTotal += d.userTotal;
      aWins += d.agentWins;
      aTotal += d.agentTotal;
      if (d.userWinRate !== null) {
        if (!bestDay || (bestDay && d.userWinRate > ((bestDay as DayStats).userWinRate ?? 0))) {
          bestDay = d;
        }
      }
    });

    const uRate = uTotal > 0 ? Math.round((uWins / uTotal) * 100) : 0;
    const aRate = aTotal > 0 ? Math.round((aWins / aTotal) * 100) : 0;

    return {
      uRate,
      aRate,
      uTotal,
      bestDayName: bestDay ? (bestDay as DayStats).dayName : null,
      bestDayRate: bestDay ? (bestDay as DayStats).userWinRate : null,
    };
  }, [daysData]);

  return (
    <div className="bg-[#0f0f12] border border-[#1d1d24] rounded-2xl p-4 mt-4 shadow-xl">
      {/* Heatmap Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#5ee26a]/15 border border-[#5ee26a]/30 flex items-center justify-center text-[#5ee26a]">
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5 font-sans">
              7-Day Win Rate Heatmap
            </h3>
            <p className="text-[11px] text-[#8b8b92] font-mono">Daily accuracy &amp; round settlements</p>
          </div>
        </div>

        {/* View Filter Pill */}
        <div className="flex items-center bg-[#16161c] border border-[#272733] rounded-xl p-0.5 text-[11px] font-mono">
          <button
            onClick={() => setViewFilter('both')}
            className={`px-2 py-1 rounded-lg transition-all ${
              viewFilter === 'both' ? 'bg-[#252530] text-white font-bold' : 'text-[#8b8b92] hover:text-white'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setViewFilter('user')}
            className={`px-2 py-1 rounded-lg transition-all ${
              viewFilter === 'user' ? 'bg-[#5ee26a]/20 text-[#5ee26a] font-bold' : 'text-[#8b8b92] hover:text-white'
            }`}
          >
            You
          </button>
          <button
            onClick={() => setViewFilter('agent')}
            className={`px-2 py-1 rounded-lg transition-all ${
              viewFilter === 'agent' ? 'bg-[#d4af37]/20 text-[#d4af37] font-bold' : 'text-[#8b8b92] hover:text-white'
            }`}
          >
            Agent
          </button>
        </div>
      </div>

      {/* 7-Day Performance KPI Strip */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center font-mono">
        <div className="bg-[#141418] border border-[#22222a] p-2 rounded-xl">
          <div className="text-[10px] text-[#8b8b92]">7-Day You</div>
          <div
            className={`text-base font-bold tabular-nums mt-0.5 ${
              weeklyStats.uRate >= 50 ? 'text-[#5ee26a]' : 'text-[#ee3344]'
            }`}
          >
            {weeklyStats.uRate}%
          </div>
        </div>

        <div className="bg-[#141418] border border-[#22222a] p-2 rounded-xl">
          <div className="text-[10px] text-[#8b8b92]">7-Day Agent</div>
          <div className="text-base font-bold tabular-nums mt-0.5 text-[#d4af37]">
            {weeklyStats.aRate}%
          </div>
        </div>

        <div className="bg-[#141418] border border-[#22222a] p-2 rounded-xl">
          <div className="text-[10px] text-[#8b8b92]">Best Day</div>
          <div className="text-base font-bold tabular-nums mt-0.5 text-white truncate px-1">
            {weeklyStats.bestDayName ? `${weeklyStats.bestDayName} (${weeklyStats.bestDayRate}%)` : '—'}
          </div>
        </div>
      </div>

      {/* 7-Day Heatmap Grid */}
      <div className="grid grid-cols-7 gap-1.5 my-3 font-mono">
        {daysData.map((d) => {
          const isSelected = d.dateKey === activeDayKey;

          return (
            <div
              key={d.dateKey}
              onClick={() => setSelectedDayKey(d.dateKey)}
              className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-white bg-[#181822] shadow-[0_0_12px_rgba(255,255,255,0.15)] ring-1 ring-white/30'
                  : 'border-[#22222a] bg-[#121217] hover:border-[#383846]'
              }`}
            >
              {/* Day Label Header */}
              <div className="pb-1 border-b border-[#202028]">
                <div
                  className={`text-[10px] font-bold ${
                    d.isToday ? 'text-[#5ee26a]' : isSelected ? 'text-white' : 'text-[#8b8b92]'
                  }`}
                >
                  {d.dayName}
                </div>
                <div className="text-[9px] text-[#6b6b75]">{d.dayNum}</div>
              </div>

              {/* Heat Cells */}
              <div className="py-1 space-y-1">
                {/* User Heat Cell */}
                {(viewFilter === 'both' || viewFilter === 'user') && (
                  <div
                    className={`py-1 rounded-lg border text-[11px] font-bold tabular-nums transition-colors ${getUserHeatColor(
                      d.userWinRate
                    )}`}
                    title={`You: ${d.userWins}W - ${d.userLosses}L`}
                  >
                    {d.userWinRate !== null ? `${d.userWinRate}%` : '—'}
                    <div className="text-[8px] font-normal opacity-80 leading-none mt-0.5">
                      {d.userTotal > 0 ? `${d.userWins}W` : '0'}
                    </div>
                  </div>
                )}

                {/* Agent Heat Cell */}
                {(viewFilter === 'both' || viewFilter === 'agent') && (
                  <div
                    className={`py-1 rounded-lg border text-[11px] font-bold tabular-nums transition-colors ${getAgentHeatColor(
                      d.agentWinRate
                    )}`}
                    title={`Agent: ${d.agentWins}W - ${d.agentLosses}L`}
                  >
                    {d.agentWinRate !== null ? `${d.agentWinRate}%` : '—'}
                    <div className="text-[8px] font-normal opacity-80 leading-none mt-0.5">
                      {d.agentTotal > 0 ? `${d.agentWins}W` : '0'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#8b8b92] pt-1 pb-2 border-b border-[#1d1d24]">
        <div className="flex items-center gap-2">
          <span>Heat:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-[#3b1217] border border-[#ee3344]/50" />
            <span>&lt;40%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-[#192b18] border border-[#5ee26a]/30" />
            <span>50-64%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded bg-[#10381e] border border-[#5ee26a]" />
            <span>65%+</span>
          </span>
        </div>
        <span className="text-[#6b6b75]">Tap day to inspect</span>
      </div>

      {/* Selected Day Inspector & Settle History */}
      {activeDay && (
        <div className="mt-3">
          <div
            onClick={() => setIsDetailOpen(!isDetailOpen)}
            className="flex items-center justify-between p-2 rounded-xl bg-[#14141a] border border-[#23232e] cursor-pointer hover:bg-[#181820] transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="font-bold text-white">
                {activeDay.dayName} ({activeDay.date.toLocaleDateString()})
              </span>
              <span className="text-[#8b8b92]">·</span>
              <span className="text-[#5ee26a]">You: {activeDay.userWins}W–{activeDay.userLosses}L ({activeDay.userWinRate ?? 0}%)</span>
              <span className="text-[#8b8b92]">·</span>
              <span className="text-[#d4af37]">Agent: {activeDay.agentWins}W–{activeDay.agentLosses}L</span>
            </div>
            {isDetailOpen ? (
              <ChevronUp className="w-4 h-4 text-[#8b8b92]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#8b8b92]" />
            )}
          </div>

          {/* Collapsible Rounds List for Active Day */}
          {isDetailOpen && (
            <div className="mt-2 divide-y divide-[#1c1c24] font-mono text-xs max-h-56 overflow-y-auto border border-[#1e1e28] rounded-xl bg-[#0b0b0e] p-2">
              {activeDay.rounds.length > 0 ? (
                activeDay.rounds.map((h, i) => {
                  const date = new Date(h.s);
                  const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(
                    date.getMinutes()
                  ).padStart(2, '0')}`;
                  const isUp = h.res === 'up';

                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[56px_1fr_1fr_1fr] items-center gap-1.5 py-2 px-1 hover:bg-[#14141a] transition-colors rounded-lg"
                    >
                      <span className="text-[#8b8b92] text-[11px]">{timeStr}</span>
                      <span
                        className={`font-semibold tabular-nums text-[12px] ${
                          isUp ? 'text-[#5ee26a]' : 'text-[#ee3344]'
                        }`}
                      >
                        {h.res.toUpperCase()} {h.f >= 1000 ? h.f.toFixed(1) : h.f.toFixed(2)}
                      </span>
                      <span className="text-[#a0a0ab] flex items-center gap-1 text-[11px]">
                        AI{' '}
                        {h.ag ? (
                          h.ag === h.res ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#5ee26a]" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#ee3344]" />
                          )
                        ) : (
                          '–'
                        )}
                      </span>
                      <span className="text-[#a0a0ab] flex items-center gap-1 text-[11px]">
                        You{' '}
                        {h.u ? (
                          h.u === h.res ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#5ee26a]" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-[#ee3344]" />
                          )
                        ) : (
                          '–'
                        )}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="py-3 text-center text-xs text-[#8b8b92] italic">
                  No rounds recorded on this day.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
