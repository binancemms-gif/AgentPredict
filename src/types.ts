export type CoinId = 'BTC' | 'SOL';
export type IntervalId = '5m' | '1h';
export type MarketId = 'BTC-5m' | 'BTC-1h' | 'SOL-5m' | 'SOL-1h';

export interface MarketConfig {
  id: MarketId;
  coin: CoinId;
  interval: IntervalId;
  label: string;
  coinName: string;
  product: string;
  durationMs: number;
  lockBeforeMs: number;
  icon: 'sol' | 'btc';
  color: string;
  decimals: number;
}

export interface TradeFlow {
  t: number;
  v: number;
  buy: boolean;
}

export interface AnalysisSignals {
  p: number;
  tau: number;
  sig: number;
  d: number;
  zd: number;
  trend: number;
  mom: number;
  fl: number;
  rs: number;
  rsi: number;
  tilt: number;
  tb: number;
  ts: number;
}

export interface RoundHistoryItem {
  s: number; // start ts
  tg: number; // target price
  f: number; // final price
  res: 'up' | 'down';
  ag: 'up' | 'down' | null;
  ap: number | null;
  u: 'up' | 'down' | null;
  stake?: number;
  payout?: number;
}

export interface BackendModelPrediction {
  made_ts: number;
  target_ts: number;
  ref_price: number;
  p_up: number;
  lean_p: number;
  lean_dir?: 'UP' | 'DOWN';
  decision: 'UP' | 'DOWN' | 'NO_TRADE';
  version: string;
  validated: number;
  close_price: number | null;
  outcome: 'UP' | 'DOWN' | 'TIE' | null;
  settled: number;
}

export interface BackendResponse {
  market: string;
  latest: BackendModelPrediction | null;
  live_stats: {
    settled: number;
    lean_accuracy_pct: number;
    lean_brier: number;
    baseline_brier: number;
  } | null;
  validated_model: string | null;
  lean_model: string | null;
}

export interface ReasoningStep {
  step: number;
  title: string;
  deduction: string;
  status: 'bullish' | 'bearish' | 'neutral';
}

export interface ReasoningResult {
  regime: string;
  recommendation: 'STRONG_UP' | 'LEAN_UP' | 'NO_TRADE' | 'LEAN_DOWN' | 'STRONG_DOWN';
  confidenceScore: number;
  invalidationLevel: number;
  steps: ReasoningStep[];
  synthesis: string;
  userAnswer?: string;
}

export interface GruPoint {
  t: number;
  p: number;
  upper: number;
  lower: number;
}

export interface GruForecastResult {
  pUp: number;
  direction: 'UP' | 'DOWN';
  confidence: number;
  projectedPrice: number;
  deltaUsd: number;
  deltaPct: number;
  trajectory: GruPoint[];
  gates: {
    resetGate: number;
    updateGate: number;
    candidateState: number;
    hiddenNorm: number;
  };
  modelMeta: {
    architecture: string;
    repo: string;
    hiddenUnits: number;
    lookbackSteps: number;
    activation: string;
    valMse: number;
    valMae: number;
    features: string[];
  };
}

