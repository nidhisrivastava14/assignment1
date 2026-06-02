import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Holding, CapitalGains } from '../types';
import { fetchHoldings, fetchCapitalGains } from '../hooks/useMockAPIs';
import CapitalGainsCard from './CapitalGainsCard';
import HoldingsTable from './HoldingsTable';
import {
  Sun,
  Moon,
  RefreshCw,
  AlertTriangle,
  Calculator,
  Zap,
  TrendingDown,
} from 'lucide-react';

export const App: React.FC = () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [capitalGains, setCapitalGains] = useState<CapitalGains | null>(null);
  const [selectedCoins, setSelectedCoins] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulateError, setSimulateError] = useState(false);
  const [taxRate, setTaxRate] = useState(30);

  // Dark mode: read from localStorage, fallback to system preference
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('koinx-dark-mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // ── Dark mode sync ─────────────────────────────────────────────────────────
  // We toggle the .dark class on <html> so Tailwind v4's @variant dark works
  useEffect(() => {
    const html = document.documentElement;
    if (darkMode) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    try {
      localStorage.setItem('koinx-dark-mode', String(darkMode));
    } catch { /* ignore storage errors */ }
  }, [darkMode]);

  // ── API calls ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (fail = false) => {
    setLoading(true);
    setError(null);
    try {
      const [holdingsData, gainsData] = await Promise.all([
        fetchHoldings(fail),
        fetchCapitalGains(fail),
      ]);
      setHoldings(holdingsData);
      setCapitalGains(gainsData);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(simulateError);
  }, [loadData, simulateError]);

  // ── Selection handlers ─────────────────────────────────────────────────────
  const handleToggleCoin = useCallback((symbol: string) => {
    setSelectedCoins(prev => {
      const next = new Set(prev);
      next.has(symbol) ? next.delete(symbol) : next.add(symbol);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((symbols: string[]) => {
    setSelectedCoins(new Set(symbols));
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedCoins(new Set());
  }, []);

  // ── Capital gains calculations ─────────────────────────────────────────────
  const preRealisedTotals = useMemo(() => {
    if (!capitalGains) return { stcgNet: 0, ltcgNet: 0, totalRealised: 0 };
    const stcgNet = capitalGains.stcg.profits - capitalGains.stcg.losses;
    const ltcgNet = capitalGains.ltcg.profits - capitalGains.ltcg.losses;
    return { stcgNet, ltcgNet, totalRealised: stcgNet + ltcgNet };
  }, [capitalGains]);

  // Core harvesting logic: build post-harvest gains object in real-time
  const afterHarvestingGains = useMemo<CapitalGains | null>(() => {
    if (!capitalGains) return null;

    const post: CapitalGains = {
      stcg: { ...capitalGains.stcg },
      ltcg: { ...capitalGains.ltcg },
    };

    selectedCoins.forEach(symbol => {
      const h = holdings.find(x => x.coin === symbol);
      if (!h) return;

      // STCG: gains add to profits, losses add to losses pool
      if (h.stcg.gain > 0) post.stcg.profits += h.stcg.gain;
      else if (h.stcg.gain < 0) post.stcg.losses += Math.abs(h.stcg.gain);

      // LTCG: same logic
      if (h.ltcg.gain > 0) post.ltcg.profits += h.ltcg.gain;
      else if (h.ltcg.gain < 0) post.ltcg.losses += Math.abs(h.ltcg.gain);
    });

    return post;
  }, [capitalGains, selectedCoins, holdings]);

  // Total losses being harvested (for the summary bar)
  const harvestedLosses = useMemo(() => {
    let total = 0;
    selectedCoins.forEach(symbol => {
      const h = holdings.find(x => x.coin === symbol);
      if (!h) return;
      if (h.stcg.gain < 0) total += Math.abs(h.stcg.gain);
      if (h.ltcg.gain < 0) total += Math.abs(h.ltcg.gain);
    });
    return total;
  }, [selectedCoins, holdings]);

  const fmtINR = (n: number) =>
    `₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] text-slate-900 dark:text-slate-100">

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800/80
                      bg-white/75 dark:bg-[#0f1117]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center
                            text-white font-black text-sm shadow-lg shadow-indigo-600/30">
              K
            </div>
            <span className="font-extrabold text-[17px] tracking-tight text-slate-900 dark:text-white">
              Koin<span className="text-indigo-500">X</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-widest
                             text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700
                             px-2 py-0.5 rounded-full ml-1">
              Tax Tool
            </span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-2">
            {/* Dark mode pill toggle */}
            <button
              onClick={() => setDarkMode(d => !d)}
              aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full
                         bg-slate-100 dark:bg-slate-800
                         border border-slate-200 dark:border-slate-700
                         text-slate-500 dark:text-slate-400
                         hover:border-indigo-400 dark:hover:border-indigo-500
                         hover:text-indigo-600 dark:hover:text-indigo-400
                         text-xs font-medium
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {darkMode ? (
                <><Sun className="w-3.5 h-3.5" /><span>Light</span></>
              ) : (
                <><Moon className="w-3.5 h-3.5" /><span>Dark</span></>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO BANNER ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800">
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14
                        flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          {/* Copy */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-4
                            bg-white/10 border border-white/20 rounded-full
                            text-white/80 text-[11px] font-semibold uppercase tracking-wider">
              <Zap className="w-3 h-3 fill-current" />
              Strategy Calculator
            </div>
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-white leading-tight tracking-tight">
              Tax Loss Harvesting <br className="hidden sm:block" />
              <span className="text-indigo-200">Calculator</span>
            </h1>
            <p className="mt-3 text-sm text-indigo-100/80 leading-relaxed max-w-lg">
              Strategically sell crypto assets sitting at a loss to offset your realized
              capital gains — reducing your taxable income legally. Check the impact in real time.
            </p>
          </div>

          {/* Controls panel */}
          <div className="w-full lg:w-72 bg-white/10 backdrop-blur-md rounded-2xl
                          border border-white/15 p-5 space-y-5 shrink-0">
            {/* Tax rate slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                  Tax Rate
                </label>
                <span className="text-white font-bold text-sm tabular-nums">{taxRate}%</span>
              </div>
              <input
                type="range" min="5" max="50" step="5"
                value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-indigo-200/70 mt-1.5">
                <span>5%</span>
                <span>30% India crypto</span>
                <span>50%</span>
              </div>
            </div>

            {/* Simulate errors toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <label htmlFor="sim-err" className="text-xs text-white/70 cursor-pointer select-none">
                Simulate API error
              </label>
              <button
                role="switch"
                aria-checked={simulateError}
                id="sim-err"
                onClick={() => setSimulateError(v => !v)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors
                            focus:outline-none focus-visible:ring-2 focus-visible:ring-white
                            ${simulateError ? 'bg-rose-500' : 'bg-white/20'}`}
              >
                <span className={`inline-block w-4 h-4 rounded-full bg-white shadow
                                  transform transition-transform mt-0.5
                                  ${simulateError ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Loading skeletons */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[0, 1].map(i => (
                <div key={i} className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="h-1.5 w-full skeleton" />
                  <div className="p-6 space-y-4">
                    <div className="skeleton h-5 w-40 rounded" />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="skeleton h-24 rounded-xl" />
                      <div className="skeleton h-24 rounded-xl" />
                    </div>
                    <div className="skeleton h-14 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
            <div className="skeleton rounded-2xl h-64" />
          </div>
        ) : error ? (
          /* Error state */
          <div className="max-w-md mx-auto mt-8 rounded-2xl border border-rose-200 dark:border-rose-900/50
                          bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center
                            justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-rose-500" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-rose-100 mb-1">Failed to load data</h3>
            <p className="text-sm text-slate-500 dark:text-rose-300/70 mb-5">{error}</p>
            <button
              onClick={() => loadData(simulateError)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600
                         hover:bg-rose-700 text-white text-sm font-semibold shadow-md
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        ) : (
          <>
            {/* ── CAPITAL GAINS CARDS ──────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {capitalGains && (
                <CapitalGainsCard
                  title="Pre-Harvesting"
                  subtitle="Your current realized gains & losses"
                  type="pre"
                  data={capitalGains}
                  taxRate={taxRate}
                />
              )}
              {afterHarvestingGains && (
                <CapitalGainsCard
                  title="After Harvesting"
                  subtitle="Projected outcome after selling selected assets"
                  type="post"
                  data={afterHarvestingGains}
                  preRealisedGains={preRealisedTotals.totalRealised}
                  taxRate={taxRate}
                />
              )}
            </div>

            {/* ── HARVEST SUMMARY BAR ──────────────────────────────── */}
            {selectedCoins.size > 0 && (
              <div className="animate-fade-slide-up flex flex-col sm:flex-row sm:items-center
                              justify-between gap-4 px-5 py-4 rounded-2xl
                              bg-white dark:bg-slate-900
                              border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40
                                  flex items-center justify-center shrink-0">
                    <Calculator className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {selectedCoins.size} asset{selectedCoins.size > 1 ? 's' : ''} selected for harvesting
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Total losses being realised:{' '}
                      <span className="font-semibold text-rose-500">
                        -{fmtINR(harvestedLosses)}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDeselectAll}
                  className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg
                             border border-slate-200 dark:border-slate-700
                             bg-slate-50 dark:bg-slate-800
                             text-slate-600 dark:text-slate-300
                             hover:bg-rose-50 dark:hover:bg-rose-950/30
                             hover:text-rose-600 dark:hover:text-rose-400
                             hover:border-rose-200 dark:hover:border-rose-800
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* ── HOLDINGS TABLE ───────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                    Your Holdings
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select positions to simulate selling.{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">Green</span> = profit,{' '}
                    <span className="text-rose-500 font-medium">Red</span> = harvestable loss.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] font-medium
                                text-indigo-600 dark:text-indigo-400
                                bg-indigo-50 dark:bg-indigo-950/40
                                border border-indigo-100 dark:border-indigo-900/60
                                px-2.5 py-1 rounded-lg">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Sorted: highest losses first
                </div>
              </div>

              <HoldingsTable
                holdings={holdings}
                selectedCoins={selectedCoins}
                onToggleCoin={handleToggleCoin}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />
            </div>
          </>
        )}
      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-slate-200 dark:border-slate-800
                         bg-white dark:bg-slate-900/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-1">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            © {new Date().getFullYear()} KoinX · This is a simulation tool for educational purposes only.
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-600">
            Indian tax law does not permit crypto loss offsets under the current 30% flat regime. Consult a CA before making decisions.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
