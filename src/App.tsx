import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Cpu,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { initAuth, getAccessToken } from './services/googleAuth';
import { appendRoundsToSheet, CreatedSheetInfo } from './services/googleSheets';
import {
  MarketId,
  MarketConfig,
  TradeFlow,
  AnalysisSignals,
  RoundHistoryItem,
  BackendResponse,
  GruForecastResult,
} from './types';
import { clamp, Phi, ema, sd, fmtPrice, generateWhyExplanation } from './utils/math';
import { playChime, toggleSound, isSoundEnabled } from './utils/audio';
import { runGruForecaster } from './services/gruForecaster';
import { CanvasChart } from './components/CanvasChart';
import { SignalBars } from './components/SignalBars';
import { ModelInsightsModal } from './components/ModelInsightsModal';
import { WinRateTrendChart } from './components/WinRateTrendChart';
import { ReasoningAgentPanel } from './components/ReasoningAgentPanel';
import { GoogleSheetsModal } from './components/GoogleSheetsModal';
import { CalendarHeatmap } from './components/CalendarHeatmap';
import { PiSimoGruPanel } from './components/PiSimoGruPanel';
import { PaperModePanel } from './components/PaperModePanel';

const MARKETS: Record<MarketId, MarketConfig> = {
  'BTC-5m': {
    id: 'BTC-5m',
    coin: 'BTC',
    interval: '5m',
    label: 'BTC 5min',
    coinName: 'Bitcoin',
    product: 'BTC-USD',
    durationMs: 300_000,
    lockBeforeMs: 15_000,
    icon: 'btc',
    color: '#f7931a',
    decimals: 2,
  },
  'BTC-1h': {
    id: 'BTC-1h',
    coin: 'BTC',
    interval: '1h',
    label: 'BTC 1h',
    coinName: 'Bitcoin',
    product: 'BTC-USD',
    durationMs: 3_600_000,
    lockBeforeMs: 120_000,
    icon: 'btc',
    color: '#f7931a',
    decimals: 2,
  },
  'SOL-5m': {
    id: 'SOL-5m',
    coin: 'SOL',
    interval: '5m',
    label: 'SOL 5min',
    coinName: 'Solana',
    product: 'SOL-USD',
    durationMs: 300_000,
    lockBeforeMs: 15_000,
    icon: 'sol',
    color: '#9945ff',
    decimals: 2,
  },
  'SOL-1h': {
    id: 'SOL-1h',
    coin: 'SOL',
    interval: '1h',
    label: 'SOL 1h',
    coinName: 'Solana',
    product: 'SOL-USD',
    durationMs: 3_600_000,
    lockBeforeMs: 120_000,
    icon: 'sol',
    color: '#9945ff',
    decimals: 2,
  },
};

export default function App() {
  // Current Market Selection (default to BTC-5m or hash)
  const [selectedMarketId, setSelectedMarketId] = useState<MarketId>(() => {
    const hash = window.location.hash.slice(1);
    return hash in MARKETS ? (hash as MarketId) : 'BTC-5m';
  });

  const activeMarket = MARKETS[selectedMarketId];

  // Core Price and Round State
  const [price, setPrice] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [rStart, setRStart] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(activeMarket.durationMs);

  // Live real-time prices for both Bitcoin & Solana simultaneously
  const [livePrices, setLivePrices] = useState<{ BTC: number | null; SOL: number | null }>({
    BTC: null,
    SOL: null,
  });

  const handleSelectCoin = (coin: 'BTC' | 'SOL') => {
    const newMarketId = `${coin}-${activeMarket.interval}` as MarketId;
    handleMarketChange(newMarketId);
  };

  const handleSelectInterval = (interval: '5m' | '1h') => {
    const newMarketId = `${activeMarket.coin}-${interval}` as MarketId;
    handleMarketChange(newMarketId);
  };

  // Connection & Feeds
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('connecting…');
  const [lastFeedAt, setLastFeedAt] = useState<number | null>(null);

  // Analysis & Signals
  const [analysis, setAnalysis] = useState<AnalysisSignals | null>(null);
  const [gruForecast, setGruForecast] = useState<GruForecastResult | null>(null);
  const [showGruTrajectory, setShowGruTrajectory] = useState<boolean>(true);
  const [agentLockedCall, setAgentLockedCall] = useState<{
    dir: 'up' | 'down';
    p: number;
    a: AnalysisSignals;
  } | null>(null);

  // User Betting & Virtual Ledger
  const [userPick, setUserPick] = useState<'up' | 'down' | null>(null);
  const [stakeAmount, setStakeAmount] = useState<number>(10);
  const [userBalance, setUserBalance] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('ud_user_balance');
      return stored ? parseFloat(stored) : 1000.0;
    } catch {
      return 1000.0;
    }
  });

  // Track Record History
  const [history, setHistory] = useState<RoundHistoryItem[]>(() => {
    try {
      const stored = localStorage.getItem(`ud_${selectedMarketId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // AI Analyst Commentary (Gemini 2.5 Flash)
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // Backend Machine Learning Model State (/predict)
  const [backendData, setBackendData] = useState<BackendResponse | null>(null);
  const [isModelModalOpen, setIsModelModalOpen] = useState<boolean>(false);
  const [soundOn, setSoundOn] = useState<boolean>(true);

  // Google Sheets Integration State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isSheetsModalOpen, setIsSheetsModalOpen] = useState<boolean>(false);
  const [activeSheet, setActiveSheet] = useState<CreatedSheetInfo | null>(() => {
    try {
      const stored = localStorage.getItem('ud_active_sheet');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ud_auto_sync') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetActiveSheet = (sheet: CreatedSheetInfo | null) => {
    setActiveSheet(sheet);
    try {
      if (sheet) localStorage.setItem('ud_active_sheet', JSON.stringify(sheet));
      else localStorage.removeItem('ud_active_sheet');
    } catch {
      // Ignore
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSyncEnabled(enabled);
    try {
      localStorage.setItem('ud_auto_sync', enabled ? 'true' : 'false');
    } catch {
      // Ignore
    }
  };

  // Listen to Google Auth state
  useEffect(() => {
    const unsub = initAuth(
      (user) => setGoogleUser(user),
      () => setGoogleUser(null)
    );
    return () => unsub();
  }, []);

  // Data Buffers
  const rSecsRef = useRef<{ t: number; p: number }[]>([]);
  const secsRef = useRef<{ t: number; p: number }[]>([]);
  const flowRef = useRef<TradeFlow[]>([]);
  const closesRef = useRef<number[]>([]);
  const vol1mRef = useRef<number>(0.001);
  const lastTickTimeRef = useRef<number>(0);
  const targetFromCandleRef = useRef<boolean>(false);

  // Sound Toggle handler
  const handleToggleSound = () => {
    const s = toggleSound();
    setSoundOn(s);
  };

  // Sync Hash on Market Change
  const handleMarketChange = (newMarketId: MarketId) => {
    window.location.hash = newMarketId;
    setSelectedMarketId(newMarketId);
    setPrice(null);
    setTarget(null);
    setRStart(0);
    rSecsRef.current = [];
    secsRef.current = [];
    flowRef.current = [];
    closesRef.current = [];
    setUserPick(null);
    setAgentLockedCall(null);
    setAiAnalysis(null);
    setGruForecast(null);

    try {
      const stored = localStorage.getItem(`ud_${newMarketId}`);
      setHistory(stored ? JSON.parse(stored) : []);
    } catch {
      setHistory([]);
    }
  };

  // Save balance to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ud_user_balance', userBalance.toFixed(2));
    } catch {
      // Storage unavailable
    }
  }, [userBalance]);

  // Save history to localStorage
  const saveHistory = (newHist: RoundHistoryItem[]) => {
    setHistory(newHist);
    try {
      localStorage.setItem(`ud_${selectedMarketId}`, JSON.stringify(newHist.slice(0, 40)));
    } catch {
      // Storage unavailable
    }
  };

  // Handle Incoming Price Tick for both BTC and SOL
  const onPriceTick = useCallback((p: number, t?: number, side?: string, size?: number, product?: string) => {
    if (!p || p <= 0) return;
    const now = Date.now();
    lastTickTimeRef.current = now;
    setLastFeedAt(t || now);

    // Update live prices for both coins
    if (product === 'BTC-USD' || (!product && activeMarket.product === 'BTC-USD')) {
      setLivePrices((prev) => ({ ...prev, BTC: p }));
    }
    if (product === 'SOL-USD' || (!product && activeMarket.product === 'SOL-USD')) {
      setLivePrices((prev) => ({ ...prev, SOL: p }));
    }

    // Only update active round trajectory if it matches the current active market product
    if (!product || product === activeMarket.product) {
      setPrice(p);

      if (side && size) {
        // Coinbase matches: maker 'sell' = taker buy
        flowRef.current.push({
          t: t || now,
          v: size,
          buy: side === 'sell',
        });
      }
    }
  }, [activeMarket.product]);

  // Compute Signal Analysis
  const runAnalysis = useCallback(
    (now: number, currentPrice: number, currentTarget: number, roundStart: number): AnalysisSignals => {
      const N = activeMarket.durationMs;
      const tau = Math.max(1, (roundStart + N - now) / 1000);
      const ps = secsRef.current.slice(-300).map((x) => x.p);
      const r: number[] = [];
      for (let i = 1; i < ps.length; i++) {
        r.push(Math.log(ps[i] / ps[i - 1]));
      }

      let sig = ps.length >= 60 ? sd(r) : vol1mRef.current / Math.sqrt(60);
      sig = Math.max(sig || 0, 5e-5);

      const d = Math.log(currentPrice / currentTarget);
      const zd = d / (sig * Math.sqrt(tau));
      const unit = sig * Math.sqrt(60);

      const trend = clamp((ema(ps.slice(-60), 15) - ema(ps.slice(-180), 90)) / currentPrice / unit, -2, 2) / 2;
      const p30 = ps.length > 30 ? ps[ps.length - 31] : ps[0] || currentPrice;
      const mom = clamp(Math.log(currentPrice / p30) / (sig * Math.sqrt(30)), -2.5, 2.5) / 2.5;

      // Filter 60s flow
      flowRef.current = flowRef.current.filter((f) => now - f.t < 60000);
      let tb = 0;
      let ts = 0;
      flowRef.current.forEach((f) => (f.buy ? (tb += f.v) : (ts += f.v)));
      const fl = tb + ts > 0 ? (tb - ts) / (tb + ts) : 0;

      // RSI
      const cl = closesRef.current.slice(-15).concat(currentPrice);
      let g = 0;
      let l = 0;
      for (let i = 1; i < cl.length; i++) {
        const diff = cl[i] - cl[i - 1];
        if (diff > 0) g += diff;
        else l -= diff;
      }
      const rsi = l === 0 ? (g === 0 ? 50 : 100) : 100 - 100 / (1 + g / l);
      const rs = clamp((50 - rsi) / 50, -1, 1) * (Math.abs(rsi - 50) > 15 ? 1 : 0.4);

      // Blended Model Probability
      const tilt = 0.35 * trend + 0.25 * fl + 0.2 * mom + 0.2 * rs;
      const z = zd + 0.35 * tilt * Math.sqrt(tau / (N / 1000));
      const p = clamp(Phi(z), 0.01, 0.99);

      return { p, tau, sig, d, zd, trend, mom, fl, rs, rsi, tilt, tb, ts };
    },
    [activeMarket.durationMs]
  );

  // Settle Round
  const settleRound = useCallback(
    (finalPrice: number, currentTarget: number, roundStart: number, lockedAgent: typeof agentLockedCall, currentPick: typeof userPick) => {
      const outcome: 'up' | 'down' = finalPrice >= currentTarget ? 'up' : 'down';

      // Settle User Bet
      if (currentPick) {
        if (currentPick === outcome) {
          const payout = stakeAmount * 1.9;
          setUserBalance((b) => b + payout);
          playChime('win');
        } else {
          playChime('loss');
        }
      }

      const item: RoundHistoryItem = {
        s: roundStart,
        tg: currentTarget,
        f: finalPrice,
        res: outcome,
        ag: lockedAgent ? lockedAgent.dir : null,
        ap: lockedAgent ? lockedAgent.p : null,
        u: currentPick,
        stake: currentPick ? stakeAmount : undefined,
        payout: currentPick && currentPick === outcome ? stakeAmount * 1.9 : 0,
      };

        setHistory((prev) => {
          const next = [item, ...prev];
          try {
            localStorage.setItem(`ud_${selectedMarketId}`, JSON.stringify(next.slice(0, 40)));
          } catch {
            // Ignore
          }
          return next;
        });

        // Auto-Sync to Google Sheets if connected
        if (autoSyncEnabled && activeSheet) {
          getAccessToken().then((tok) => {
            if (tok) {
              appendRoundsToSheet(
                tok,
                activeSheet.spreadsheetId,
                activeSheet.firstSheetName || 'Prediction History',
                selectedMarketId,
                [item]
              ).catch((err) => console.error('Auto-sync to Google Sheets error:', err));
            }
          });
        }
      },
      [activeSheet, autoSyncEnabled, selectedMarketId, stakeAmount]
    );

  // New Round Start
  const startNewRound = useCallback((newStart: number, currentPrice: number) => {
    setRStart(newStart);
    setTarget(currentPrice);
    setUserPick(null);
    setAgentLockedCall(null);
    setAiAnalysis(null);
    setGruForecast(null);
    targetFromCandleRef.current = false;
    rSecsRef.current = [{ t: newStart, p: currentPrice }];
    secsRef.current = secsRef.current.slice(-300);
  }, []);

  // Fetch Candles (Coinbase REST)
  const fetchCandles = useCallback(async () => {
    try {
      const res = await fetch(`https://api.exchange.coinbase.com/products/${activeMarket.product}/candles?granularity=60`);
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) return;

      rows.sort((a, b) => a[0] - b[0]);
      closesRef.current = rows.map((x) => x[4]);

      const rets: number[] = [];
      for (let i = 1; i < closesRef.current.length; i++) {
        rets.push(Math.log(closesRef.current[i] / closesRef.current[i - 1]));
      }
      vol1mRef.current = sd(rets.slice(-60)) || 0.001;

      // Target sync from candle if missing
      if (price === null && rows.length) {
        onPriceTick(rows[rows.length - 1][4]);
      }
    } catch {
      // Ignore network errors
    }
  }, [activeMarket.product, onPriceTick, price]);

  // REST Fallback Polling (polls both Bitcoin & Solana)
  const pollTicker = useCallback(async () => {
    try {
      const [btcRes, solRes] = await Promise.allSettled([
        fetch('https://api.exchange.coinbase.com/products/BTC-USD/ticker'),
        fetch('https://api.exchange.coinbase.com/products/SOL-USD/ticker'),
      ]);

      if (btcRes.status === 'fulfilled' && btcRes.value.ok) {
        const j = await btcRes.value.json();
        const p = parseFloat(j.price);
        if (p > 0) onPriceTick(p, undefined, undefined, undefined, 'BTC-USD');
      }

      if (solRes.status === 'fulfilled' && solRes.value.ok) {
        const j = await solRes.value.json();
        const p = parseFloat(j.price);
        if (p > 0) onPriceTick(p, undefined, undefined, undefined, 'SOL-USD');
      }
      setStatusText(wsConnected ? 'LIVE · Coinbase' : 'polling · Coinbase');
    } catch {
      // Ignore
    }
  }, [onPriceTick, wsConnected]);

  // Query Backend Next-Move Model (/predict?market=...)
  const fetchBackendModel = useCallback(async () => {
    try {
      const res = await fetch(`/predict?market=${selectedMarketId}`);
      if (!res.ok) return;
      const data: BackendResponse = await res.json();
      setBackendData(data);
    } catch {
      // Ignore
    }
  }, [selectedMarketId]);

  // Ask Gemini AI for a Market Read
  const handleAskAi = async () => {
    if (!analysis || price === null || target === null || isAiLoading) return;
    setIsAiLoading(true);
    setAiAnalysis(null);
    playChime('click');

    try {
      const payload = {
        market: selectedMarketId,
        product: activeMarket.product,
        price,
        target,
        secondsLeft: Math.round(analysis.tau),
        pUp: analysis.p,
        perSecVol: analysis.sig,
        trend: analysis.trend,
        orderFlow: analysis.fl,
        momentum: analysis.mom,
        rsi: analysis.rsi,
        takerBuyVol: analysis.tb,
        takerSellVol: analysis.ts,
      };

      const res = await fetch('/api/ai/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      setAiAnalysis(data.commentary || 'Analysis generated based on current parameters.');
    } catch {
      setAiAnalysis('Statistical edge currently favors distance to strike. Heavy order-flow shifts before lock remain the key variable.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Main 1-Second Clock Step Loop
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const N = activeMarket.durationMs;
      const rs = Math.floor(now / N) * N;
      const left = Math.max(0, rs + N - now);
      setTimeRemaining(left);

      if (price === null) return;

      // Check if new round started
      if (!rStart) {
        startNewRound(rs, price);
        fetchCandles();
      } else if (rs > rStart) {
        if (target !== null) {
          settleRound(price, target, rStart, agentLockedCall, userPick);
        }
        startNewRound(rs, price);
        fetchCandles();
      }

      // Record trajectory points
      secsRef.current.push({ t: now, p: price });
      rSecsRef.current.push({ t: now, p: price });

      // Run Quantitative Analysis
      if (target !== null) {
        const an = runAnalysis(now, price, target, rStart || rs);
        setAnalysis(an);

        // Run PiSimo GRU-RNN Forecaster (PiSimo/BitcoinForecast sequential deep learning)
        const gru = runGruForecaster(
          rSecsRef.current,
          price,
          target,
          rStart || rs,
          activeMarket.durationMs,
          an.sig,
          an.fl
        );
        setGruForecast(gru);

        // Lock agent 10s into round
        if (!agentLockedCall && now - (rStart || rs) >= 10000) {
          setAgentLockedCall({
            dir: an.p >= 0.5 ? 'up' : 'down',
            p: an.p,
            a: { ...an },
          });
          playChime('lock');
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    activeMarket.durationMs,
    agentLockedCall,
    fetchCandles,
    price,
    rStart,
    runAnalysis,
    settleRound,
    startNewRound,
    target,
    userPick,
  ]);

  // Connect Coinbase WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let isDisposed = false;

    function connect() {
      try {
        ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');

        ws.onopen = () => {
          if (isDisposed) return;
          setWsConnected(true);
          setStatusText('LIVE · Coinbase');
          ws?.send(
            JSON.stringify({
              type: 'subscribe',
              product_ids: ['BTC-USD', 'SOL-USD'],
              channels: ['matches', 'ticker'],
            })
          );
        };

        ws.onmessage = (ev) => {
          if (isDisposed) return;
          try {
            const m = JSON.parse(ev.data);
            const prod = m.product_id;
            const p = parseFloat(m.price);
            if (p > 0) {
              if (m.type === 'match' || m.type === 'last_match') {
                onPriceTick(p, Date.parse(m.time), m.side, parseFloat(m.size), prod);
              } else if (m.type === 'ticker' && !m.trade_id) {
                onPriceTick(p, undefined, undefined, undefined, prod);
              }
            }
          } catch {
            // Ignore parse errors
          }
        };

        ws.onclose = ws.onerror = () => {
          if (isDisposed) return;
          setWsConnected(false);
          setStatusText('reconnecting…');
          retryTimeout = setTimeout(connect, 3000);
        };
      } catch {
        retryTimeout = setTimeout(connect, 3000);
      }
    }

    connect();
    fetchCandles();
    fetchBackendModel();

    const candleInterval = setInterval(fetchCandles, 60_000);
    const pollInterval = setInterval(pollTicker, 3000);
    const backendInterval = setInterval(fetchBackendModel, 15_000);

    return () => {
      isDisposed = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      clearInterval(candleInterval);
      clearInterval(pollInterval);
      clearInterval(backendInterval);
      if (ws) {
        ws.close();
      }
    };
  }, [activeMarket.product, fetchBackendModel, fetchCandles, onPriceTick, pollTicker]);

  // User Bet Placement
  const handleUserPick = (choice: 'up' | 'down') => {
    if (timeRemaining < activeMarket.lockBeforeMs) return; // Locked window

    if (userPick === choice) {
      // Deselect and refund stake
      setUserBalance((b) => b + stakeAmount);
      setUserPick(null);
      playChime('click');
    } else {
      // If switching or picking new
      if (userPick === null) {
        if (userBalance < stakeAmount) return;
        setUserBalance((b) => b - stakeAmount);
      }
      setUserPick(choice);
      playChime('pick');
    }
  };

  // Stats Counters
  const agentScore = history.reduce(
    (acc, h) => {
      if (h.ag) {
        if (h.ag === h.res) acc.wins++;
        else acc.losses++;
      }
      return acc;
    },
    { wins: 0, losses: 0 }
  );

  const userScore = history.reduce(
    (acc, h) => {
      if (h.u) {
        if (h.u === h.res) acc.wins++;
        else acc.losses++;
      }
      return acc;
    },
    { wins: 0, losses: 0 }
  );

  // Formatted countdown timer MM:SS
  const mins = Math.floor(timeRemaining / 60000);
  const secs = Math.floor((timeRemaining % 60000) / 1000);
  const timeString = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  // Implied Odds and Multipliers
  const pUp = analysis ? analysis.p : 0.5;
  const pDn = 1 - pUp;
  const upPct = Math.round(pUp * 100);
  const dnPct = 100 - upPct;
  const upMult = (1 / Math.max(0.01, pUp)).toFixed(1) + 'x';
  const dnMult = (1 / Math.max(0.01, pDn)).toFixed(1) + 'x';

  // Delta percentage above or below target
  const isAbove = price !== null && target !== null ? price >= target : false;
  const deltaPct =
    price !== null && target !== null && target > 0 ? ((price / target - 1) * 100).toFixed(2) : '0.00';

  const isLocked = timeRemaining < activeMarket.lockBeforeMs;

  return (
    <div className="min-h-screen bg-black text-[#f2f2f2] font-sans selection:bg-[#5ee26a]/30">
      {/* Mobile Top Grab Bar */}
      <div className="w-11 h-1.5 rounded-full bg-[#333] mx-auto pt-3 mb-2" />

      <main className="max-w-[480px] mx-auto px-4.5 pt-2 pb-36">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between">
          <div className="w-11 h-11 rounded-full bg-[#0b0b10] border border-[#1d1d22] flex items-center justify-center shadow-lg transition-transform hover:scale-105">
            {activeMarket.icon === 'sol' ? (
              <svg width="26" height="26" viewBox="0 0 26 26">
                <defs>
                  <linearGradient id="solGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="#19fb9b" />
                    <stop offset="100%" stopColor="#9945ff" />
                  </linearGradient>
                </defs>
                <path d="M5 18h14l2-3H7zM5 8h14l2-3H7zM7 13h14l-2-3H5z" fill="url(#solGrad)" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 46 46">
                <circle cx="23" cy="23" r="23" fill="#f7931a" />
                <text
                  x="23"
                  y="31"
                  textAnchor="middle"
                  fontSize="26"
                  fontWeight="700"
                  fill="#fff"
                  fontFamily="Arial, sans-serif"
                >
                  ₿
                </text>
              </svg>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Google Sheets Sync Button */}
            <button
              onClick={() => setIsSheetsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-mono transition-all cursor-pointer ${
                googleUser
                  ? 'bg-[#0f9d58]/15 border-[#0f9d58]/40 text-[#5ee26a]'
                  : 'bg-[#111] border-[#202026] text-[#8b8b92] hover:text-white'
              }`}
              title={googleUser ? `Connected as ${googleUser.email}` : 'Connect Google Sheets'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0f9d58]" />
              <span className="hidden sm:inline">{googleUser ? 'Sheets Synced' : 'Sync Sheets'}</span>
              {autoSyncEnabled && <span className="w-1.5 h-1.5 rounded-full bg-[#5ee26a] animate-pulse" />}
            </button>

            {/* Audio Toggle */}
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-full bg-[#111] border border-[#202026] text-[#8b8b92] hover:text-white transition-colors"
              title={soundOn ? 'Sound On' : 'Sound Muted'}
            >
              {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Connection Status Indicator */}
            <div className="flex items-center gap-1.5 text-xs text-[#8b8b92] font-mono">
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  wsConnected ? 'bg-[#5ee26a] shadow-[0_0_8px_#5ee26a]' : 'bg-[#555]'
                }`}
              />
              <span className="truncate max-w-[180px]">{statusText}{lastFeedAt ? ` · ${new Date(lastFeedAt).toLocaleTimeString()}` : ''}</span>
            </div>
          </div>
        </div>

        {/* Dual Asset Switcher (Bitcoin & Solana) */}
        <div className="grid grid-cols-2 gap-2 mt-3.5 mb-2">
          {/* Bitcoin Card */}
          <button
            onClick={() => handleSelectCoin('BTC')}
            className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              activeMarket.coin === 'BTC'
                ? 'bg-[#1a140b] border-[#f7931a] shadow-[0_0_12px_rgba(247,147,26,0.2)]'
                : 'bg-[#0f0f12] border-[#22222a] hover:border-[#3a3a46]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#f7931a] flex items-center justify-center font-bold text-white text-xs">
                ₿
              </div>
              <div>
                <div className="font-bold text-xs text-white">Bitcoin</div>
                <div className="text-[10px] text-[#8b8b92] font-mono">BTC-USD</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold font-mono tabular-nums text-white">
                {livePrices.BTC ? fmtPrice(livePrices.BTC, 2) : '—'}
              </div>
              <div className="text-[9px] text-[#f7931a] font-mono">
                {activeMarket.coin === 'BTC' ? '● Active' : 'Select'}
              </div>
            </div>
          </button>

          {/* Solana Card */}
          <button
            onClick={() => handleSelectCoin('SOL')}
            className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
              activeMarket.coin === 'SOL'
                ? 'bg-[#140e1d] border-[#9945ff] shadow-[0_0_12px_rgba(153,69,255,0.2)]'
                : 'bg-[#0f0f12] border-[#22222a] hover:border-[#3a3a46]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#0b0b10] border border-[#262633] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 26 26">
                  <path d="M5 18h14l2-3H7zM5 8h14l2-3H7zM7 13h14l-2-3H5z" fill="url(#solGrad)" />
                </svg>
              </div>
              <div>
                <div className="font-bold text-xs text-white">Solana</div>
                <div className="text-[10px] text-[#8b8b92] font-mono">SOL-USD</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold font-mono tabular-nums text-white">
                {livePrices.SOL ? fmtPrice(livePrices.SOL, 2) : '—'}
              </div>
              <div className="text-[9px] text-[#9945ff] font-mono">
                {activeMarket.coin === 'SOL' ? '● Active' : 'Select'}
              </div>
            </div>
          </button>
        </div>

        {/* Round Horizon Pills (5m vs 1h) & Quick Dropdown */}
        <div className="flex items-center justify-between mt-1 mb-2 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-[#8b8b92] text-[11px]">Horizon:</span>
            <div className="flex gap-1 bg-[#121216] border border-[#22222a] p-0.5 rounded-xl">
              <button
                onClick={() => handleSelectInterval('5m')}
                className={`px-2.5 py-0.5 rounded-lg transition-all text-xs cursor-pointer ${
                  activeMarket.interval === '5m'
                    ? 'bg-[#252530] text-white font-bold'
                    : 'text-[#8b8b92] hover:text-white'
                }`}
              >
                5 min
              </button>
              <button
                onClick={() => handleSelectInterval('1h')}
                className={`px-2.5 py-0.5 rounded-lg transition-all text-xs cursor-pointer ${
                  activeMarket.interval === '1h'
                    ? 'bg-[#252530] text-white font-bold'
                    : 'text-[#8b8b92] hover:text-white'
                }`}
              >
                1 hour
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-[#8b8b92]">
            <select
              id="mk"
              value={selectedMarketId}
              onChange={(e) => handleMarketChange(e.target.value as MarketId)}
              className="bg-[#141418] text-white border border-[#262633] rounded-lg px-2 py-0.5 text-xs font-mono cursor-pointer"
            >
              <option value="BTC-5m">BTC 5min</option>
              <option value="BTC-1h">BTC 1h</option>
              <option value="SOL-5m">SOL 5min</option>
              <option value="SOL-1h">SOL 1h</option>
            </select>
          </div>
        </div>

        {/* Market Title Heading */}
        <div className="mt-2 mb-1">
          <h1 className="text-3xl font-bold font-serif tracking-tight text-white flex items-center gap-2">
            <span>{activeMarket.coinName}</span>
            <span className="text-xl font-mono text-[#8b8b92] font-normal">
              {activeMarket.interval === '5m' ? '5-Min' : '1-Hour'}
            </span>
          </h1>
        </div>

        {/* Price and Delta Display */}
        <div className="flex items-baseline justify-between mt-1">
          <div>
            <div className="text-[38px] leading-tight font-bold tracking-tight text-white tabular-nums">
              {fmtPrice(price, activeMarket.decimals)}
            </div>
            <div
              className={`text-lg font-semibold tabular-nums mt-0.5 ${
                price === null
                  ? 'text-[#8b8b92]'
                  : isAbove
                  ? 'text-[#5ee26a]'
                  : 'text-[#ee3344]'
              }`}
            >
              {price === null
                ? 'waiting for price…'
                : `${isAbove ? '+' : ''}${deltaPct}% ${isAbove ? 'above' : 'below'} target`}
            </div>
          </div>

          {/* Time Remaining Pill */}
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold tabular-nums font-mono transition-colors ${
              isLocked
                ? 'bg-[#ee3344]/15 border-[#ee3344]/40 text-[#ee3344]'
                : 'bg-[#111] border-[#1d1d20] text-white'
            }`}
          >
            <span>⧖</span>
            <span>{timeString}</span>
            {isLocked && <span className="text-[10px] uppercase font-bold tracking-wider ml-1">LOCKED</span>}
          </div>
        </div>

        {/* Real-time Interactive Canvas Chart */}
        <CanvasChart
          rSecs={rSecsRef.current}
          target={target}
          price={price}
          rStart={rStart}
          durationMs={activeMarket.durationMs}
          lockBeforeMs={activeMarket.lockBeforeMs}
          decimals={activeMarket.decimals}
          gruPoints={gruForecast?.trajectory}
          showGruTrajectory={showGruTrajectory}
          onToggleGruTrajectory={() => setShowGruTrajectory((v) => !v)}
          gruPUp={gruForecast?.pUp}
        />

        {/* Make a Prediction Section */}
        <div className="flex items-center justify-between mt-5 mb-2">
          <h2 className="text-2xl font-bold font-serif text-white">Make a Prediction</h2>
          <div className="flex items-center gap-1.5 text-xs text-[#8b8b92]">
            <span>Virtual Balance:</span>
            <span className="font-mono font-bold text-white">${userBalance.toFixed(1)}</span>
          </div>
        </div>

        {/* Up Probability Row */}
        <div className="flex items-center gap-3 my-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#151517] border border-[#222228] flex items-center justify-center text-xs font-bold text-[#5ee26a]">
            ▲
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-bold text-white">Up</div>
            <div className="h-1 bg-[#1a1a1f] rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-[#5ee26a] rounded-full transition-all duration-300"
                style={{ width: `${upPct}%` }}
              />
            </div>
          </div>
          <div className="text-[16px] font-mono font-bold tabular-nums text-right w-14 text-[#cfcfd4]">
            {upMult}
          </div>
          <div className="min-w-[62px] text-center py-2 rounded-2xl bg-[#111] border border-[#1d1d20] text-[#5ee26a] font-bold text-[16px] tabular-nums font-mono">
            {upPct}%
          </div>
        </div>

        {/* Down Probability Row */}
        <div className="flex items-center gap-3 my-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#151517] border border-[#222228] flex items-center justify-center text-xs font-bold text-[#ee3344]">
            ▼
          </div>
          <div className="flex-1">
            <div className="text-[16px] font-bold text-white">Down</div>
            <div className="h-1 bg-[#1a1a1f] rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-[#ee3344] rounded-full transition-all duration-300"
                style={{ width: `${dnPct}%` }}
              />
            </div>
          </div>
          <div className="text-[16px] font-mono font-bold tabular-nums text-right w-14 text-[#cfcfd4]">
            {dnMult}
          </div>
          <div className="min-w-[62px] text-center py-2 rounded-2xl bg-[#111] border border-[#1d1d20] text-[#ee3344] font-bold text-[16px] tabular-nums font-mono">
            {dnPct}%
          </div>
        </div>

        {/* Stake Size Picker */}
        <div className="flex items-center justify-between bg-[#0e0e11] border border-[#1c1c22] rounded-xl px-3 py-2 mt-3 text-xs">
          <span className="text-[#8b8b92]">Stake per round:</span>
          <div className="flex gap-1.5 font-mono">
            {[10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                onClick={() => setStakeAmount(amt)}
                className={`px-2.5 py-1 rounded-lg border font-bold transition-all ${
                  stakeAmount === amt
                    ? 'bg-[#d4af37]/20 border-[#d4af37] text-[#d4af37]'
                    : 'bg-[#15151a] border-[#25252e] text-[#8b8b92] hover:text-white'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* AI Agent Locked Call Card */}
        <div className="border border-[#3a3017] bg-gradient-to-b from-[#14110a] to-[#0b0a07] rounded-2xl p-4.5 mt-5 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-[12px] tracking-[0.14em] text-[#d4af37] uppercase font-mono flex items-center gap-1.5">
              <span>◆ AI AGENT · LOCKED CALL</span>
            </h3>
            <button
              onClick={() => setIsModelModalOpen(true)}
              className="flex items-center gap-1 text-[11px] font-mono text-[#d4af37]/80 hover:text-[#d4af37] bg-[#3a3017]/30 hover:bg-[#3a3017]/60 px-2.5 py-1 rounded-full border border-[#4a3d16] transition-colors"
            >
              <Cpu className="w-3 h-3" />
              <span>Model Matrix</span>
            </button>
          </div>

          {/* Locked Call Banner */}
          <div className="text-[34px] leading-tight font-serif font-bold tracking-tight text-white mt-1">
            {agentLockedCall ? (
              <span className="flex items-center gap-2">
                <span className={agentLockedCall.dir === 'up' ? 'text-[#5ee26a]' : 'text-[#ee3344]'}>
                  {agentLockedCall.dir.toUpperCase()}
                </span>
                <span className="text-white text-2xl font-mono font-semibold">
                  {Math.round(
                    (agentLockedCall.dir === 'up' ? agentLockedCall.p : 1 - agentLockedCall.p) * 100
                  )}
                  %
                </span>
              </span>
            ) : (
              <span className="text-[#8b8b92] text-2xl italic">Analyzing…</span>
            )}
          </div>

          <div className="text-xs text-[#8b8b92] mt-1 font-mono">
            {agentLockedCall
              ? `Confidence ${Math.round(Math.abs(agentLockedCall.p - 0.5) * 200)}% · Live reading: ${upPct}% Up`
              : 'Locks 10s into the round'}
          </div>

          {/* Signal Indicator Breakdown Bars */}
          <SignalBars analysis={analysis} />

          {/* "Why" statistical explanation */}
          <div className="text-[13.5px] leading-relaxed text-[#cfcfd4] mt-3 pt-3 border-t border-[#3a3017]/60">
            {analysis ? generateWhyExplanation(analysis) : 'Collecting signals…'}
          </div>

          {/* Backend Model Next-Move Banner */}
          {backendData && (
            <div className="mt-3 pt-2.5 border-t border-[#3a3017]/60 text-xs leading-relaxed">
              <div className="text-[#e6e0cc]">
                {backendData.latest?.validated ? (
                  <span>
                    <strong className="text-[#d4af37]">
                      Backend Model ({backendData.validated_model || 'validated'}):
                    </strong>{' '}
                    Decision: <strong>{backendData.latest.decision}</strong> · P(up):{' '}
                    <strong>{(backendData.latest.p_up * 100).toFixed(1)}%</strong>
                    {backendData.live_stats && backendData.live_stats.settled > 0 && (
                      <span className="text-[#5ee26a] ml-1">
                        · Live record: {backendData.live_stats.lean_accuracy_pct}% over{' '}
                        {backendData.live_stats.settled} rounds
                      </span>
                    )}
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#8b8b92]">Backend Lean (unvalidated):</strong>{' '}
                    {backendData.latest?.lean_dir ||
                      (backendData.latest && backendData.latest.lean_p >= 0.5 ? 'UP' : 'DOWN')}{' '}
                    {backendData.latest ? Math.round(backendData.latest.lean_p * 100) : 50}% — treat as a coin
                    flip until model passes its walk-forward test
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Ask AI for a Read (Gemini 2.5 Flash) */}
          <div className="mt-3.5 pt-3 border-t border-[#3a3017]/60">
            <button
              onClick={handleAskAi}
              disabled={isAiLoading || !analysis}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#4a3d16] text-[#d4af37] text-xs font-semibold hover:bg-[#d4af37]/10 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAiLoading ? 'Synthesizing with Gemini…' : 'Ask Gemini for a read'}</span>
            </button>

            {aiAnalysis && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#1b170d]/80 border border-[#4a3d16]/70 text-[13px] leading-relaxed text-[#e6e0cc] animate-fade-in font-serif italic">
                "{aiAnalysis}"
              </div>
            )}
          </div>
        </div>

        {/* PiSimo GRU-RNN Neural Forecaster Panel (PiSimo/BitcoinForecast) */}
        <PiSimoGruPanel
          forecast={gruForecast}
          targetPrice={target}
          currentPrice={price}
          decimals={activeMarket.decimals}
          showTrajectoryOnChart={showGruTrajectory}
          onToggleTrajectoryOnChart={() => setShowGruTrajectory((v) => !v)}
          coinName={activeMarket.coinName}
        />

        <PaperModePanel market={selectedMarketId} />

        {/* Cognitive Reasoning Agent Component */}
        <ReasoningAgentPanel
          marketId={selectedMarketId}
          product={activeMarket.product}
          price={price}
          target={target}
          analysis={analysis}
          timeRemaining={timeRemaining}
          decimals={activeMarket.decimals}
        />

        {/* Track Record Section */}
        <div className="flex items-center justify-between mt-6 mb-3">
          <h2 className="text-2xl font-bold font-serif text-white">Track Record</h2>
          <button
            onClick={() => setIsSheetsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f9d58]/15 hover:bg-[#0f9d58]/25 border border-[#0f9d58]/35 text-[#5ee26a] text-xs font-mono font-semibold transition-all cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{activeSheet ? 'Google Sheets' : 'Export to Sheets'}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 font-mono">
          <div className="bg-[#0f0f10] border border-[#1d1d20] rounded-xl p-3.5 shadow-sm">
            <small className="text-xs text-[#8b8b92] block">Agent</small>
            <b className="text-xl font-bold text-white mt-0.5 block">
              {agentScore.wins}–{agentScore.losses}
            </b>
            <span className="text-[11px] text-[#5ee26a]">
              {agentScore.wins + agentScore.losses > 0
                ? `${Math.round((agentScore.wins / (agentScore.wins + agentScore.losses)) * 100)}% win rate`
                : 'Awaiting settled'}
            </span>
          </div>

          <div className="bg-[#0f0f10] border border-[#1d1d20] rounded-xl p-3.5 shadow-sm">
            <small className="text-xs text-[#8b8b92] block">You</small>
            <b className="text-xl font-bold text-white mt-0.5 block">
              {userScore.wins}–{userScore.losses}
            </b>
            <span className="text-[11px] text-[#d4af37]">
              {userScore.wins + userScore.losses > 0
                ? `${Math.round((userScore.wins / (userScore.wins + userScore.losses)) * 100)}% accuracy`
                : 'Place a prediction'}
            </span>
          </div>
        </div>

        {/* Win Rate Trend Recharts Line Chart */}
        <WinRateTrendChart
          history={history}
          userBalance={userBalance}
          marketId={selectedMarketId}
          currentPrice={price}
        />

        {/* 7-Day Calendar Heatmap showing daily win rates for agent and user */}
        <CalendarHeatmap
          history={history}
          marketId={selectedMarketId}
          currentPrice={price}
        />

        {/* Disclaimer Note */}
        <div className="text-[11.5px] text-[#8b8b92] mt-5 leading-relaxed border-t border-[#1a1a20] pt-4">
          Live prices from Coinbase Exchange (pick a market at the top). Target = price at the start of each
          window (aligned to the clock); the round settles Up if the final price is at or above target. Agent
          probabilities come from a volatility-scaled distance-to-target model tilted by trend, order flow,
          momentum and RSI. It is a statistical estimate, not a guarantee or financial advice, and no real funds
          are involved.
        </div>
      </main>

      {/* Fixed Bottom Prediction Action Bar */}
      <aside aria-label="Prediction Controls" className="fixed left-0 right-0 bottom-0 p-3 pb-[calc(14px+env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-black via-black/95 to-transparent z-40">
        <div className="max-w-[480px] mx-auto flex gap-3">
          {/* UP Button */}
          <button
            onClick={() => handleUserPick('up')}
            disabled={isLocked}
            className={`flex-1 py-4 px-2 rounded-2xl border-2 font-sans font-bold text-lg transition-all flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${
              userPick === 'up'
                ? 'border-[#5ee26a] bg-[#0d1f10] text-[#5ee26a] shadow-[0_0_15px_rgba(94,226,106,0.3)]'
                : 'border-[#1d1d20] bg-[#111] text-white hover:border-[#5ee26a]/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>Up</span>
              <span className="text-[#5ee26a] text-sm font-mono">{upPct}%</span>
            </div>
            <span className="text-xs font-mono text-[#8b8b92] mt-0.5">{upMult} payout</span>
          </button>

          {/* DOWN Button */}
          <button
            onClick={() => handleUserPick('down')}
            disabled={isLocked}
            className={`flex-1 py-4 px-2 rounded-2xl border-2 font-sans font-bold text-lg transition-all flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 ${
              userPick === 'down'
                ? 'border-[#ee3344] bg-[#220c0f] text-[#ee3344] shadow-[0_0_15px_rgba(238,51,68,0.3)]'
                : 'border-[#1d1d20] bg-[#111] text-white hover:border-[#ee3344]/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span>Down</span>
              <span className="text-[#ee3344] text-sm font-mono">{dnPct}%</span>
            </div>
            <span className="text-xs font-mono text-[#8b8b92] mt-0.5">{dnMult} payout</span>
          </button>
        </div>
      </aside>

      {/* Model Insights & Weights Inspector Modal */}
      <ModelInsightsModal
        isOpen={isModelModalOpen}
        onClose={() => setIsModelModalOpen(false)}
        backendData={backendData}
        marketId={selectedMarketId}
      />

      {/* Google Sheets Sync & Export Modal */}
      <GoogleSheetsModal
        isOpen={isSheetsModalOpen}
        onClose={() => setIsSheetsModalOpen(false)}
        user={googleUser}
        onUserChange={setGoogleUser}
        history={history}
        marketId={selectedMarketId}
        autoSyncEnabled={autoSyncEnabled}
        onToggleAutoSync={handleToggleAutoSync}
        activeSheet={activeSheet}
        onSetActiveSheet={handleSetActiveSheet}
      />
    </div>
  );
}
