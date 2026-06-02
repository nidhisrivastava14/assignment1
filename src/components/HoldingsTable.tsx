import React, { useState, useMemo } from 'react';
import type { Holding } from '../types';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, X } from 'lucide-react';

// ─── types ─────────────────────────────────────────────────────────────────────
type SortField = 'coin' | 'currentPrice' | 'stcg' | 'ltcg';
type SortDir   = 'asc' | 'desc';

interface Props {
  holdings: Holding[];
  selectedCoins: Set<string>;
  onToggleCoin: (symbol: string) => void;
  onSelectAll: (symbols: string[]) => void;
  onDeselectAll: () => void;
}

// ─── helpers ───────────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
  const abs = Math.abs(n);
  const f   = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}₹${f}`;
}

function fmtQty(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// ─── component ─────────────────────────────────────────────────────────────────
export const HoldingsTable: React.FC<Props> = ({
  holdings,
  selectedCoins,
  onToggleCoin,
  onSelectAll,
  onDeselectAll,
}) => {
  const [sortField, setSortField] = useState<SortField>('stcg');
  const [sortDir,   setSortDir]   = useState<SortDir>('asc');   // asc = biggest loss first
  const [query,     setQuery]     = useState('');

  // ── sort handler ───────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // Gain columns: ascending puts biggest losses at the top (most useful for harvesting)
      setSortDir(field === 'stcg' || field === 'ltcg' ? 'asc' : 'desc');
    }
  };

  // ── filtered + sorted list ─────────────────────────────────────────────────
  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = holdings.filter(
      h =>
        h.coin.toLowerCase().includes(q) ||
        h.coinName.toLowerCase().includes(q)
    );

    return [...filtered].sort((a, b) => {
      let va: string | number;
      let vb: string | number;

      if (sortField === 'stcg') { va = a.stcg.gain; vb = b.stcg.gain; }
      else if (sortField === 'ltcg') { va = a.ltcg.gain; vb = b.ltcg.gain; }
      else if (sortField === 'currentPrice') { va = a.currentPrice; vb = b.currentPrice; }
      else { va = a.coin; vb = b.coin; }

      if (typeof va === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [holdings, query, sortField, sortDir]);

  const allSymbols    = useMemo(() => holdings.map(h => h.coin), [holdings]);
  const isAllSelected = useMemo(
    () => holdings.length > 0 && holdings.every(h => selectedCoins.has(h.coin)),
    [holdings, selectedCoins]
  );

  // ── sort icon helper ───────────────────────────────────────────────────────
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-slate-300 dark:text-slate-600 group-hover:text-slate-400" />;
    return sortDir === 'asc'
      ? <ArrowUp   className="w-3 h-3 ml-1 text-indigo-500" />
      : <ArrowDown className="w-3 h-3 ml-1 text-indigo-500" />;
  };

  // ── gain cell ─────────────────────────────────────────────────────────────
  const GainCell = ({ gain, balance, symbol }: { gain: number; balance: number; symbol: string }) => (
    <td className="px-4 py-3.5 text-right">
      <div className={`text-sm font-semibold tabular-nums ${gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
        {fmtINR(gain)}
      </div>
      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
        {fmtQty(balance)} {symbol}
      </div>
    </td>
  );

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800
                    bg-white dark:bg-slate-900 overflow-hidden shadow-sm">

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3
                      border-b border-slate-100 dark:border-slate-800
                      bg-slate-50/60 dark:bg-slate-900/60">

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search coin…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg
                       bg-white dark:bg-slate-800
                       border border-slate-200 dark:border-slate-700
                       text-slate-900 dark:text-slate-100
                       placeholder:text-slate-400 dark:placeholder:text-slate-500
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Selection info + clear */}
        <div className="flex items-center gap-3 sm:ml-auto">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {selectedCoins.size} / {holdings.length} selected
          </span>
          {selectedCoins.size > 0 && (
            <button
              onClick={onDeselectAll}
              className="text-xs font-medium px-2.5 py-1 rounded-lg
                         border border-slate-200 dark:border-slate-700
                         bg-white dark:bg-slate-800
                         text-slate-600 dark:text-slate-300
                         hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-800
                         focus:outline-none"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {rows.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No holdings found</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {query ? `Nothing matched "${query}"` : 'Your portfolio is empty.'}
          </p>
        </div>
      )}

      {/* ── Desktop Table ────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800
                             text-[11px] font-semibold uppercase tracking-wider
                             text-slate-400 dark:text-slate-500">
                {/* Select all */}
                <th className="pl-5 pr-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={e => e.target.checked ? onSelectAll(allSymbols) : onDeselectAll()}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                  />
                </th>

                {/* Asset */}
                <th
                  onClick={() => handleSort('coin')}
                  className="px-4 py-3 cursor-pointer select-none group"
                >
                  <div className="flex items-center">
                    Asset <SortIcon field="coin" />
                  </div>
                </th>

                {/* Holdings */}
                <th className="px-4 py-3">Holdings / Avg</th>

                {/* Current price */}
                <th
                  onClick={() => handleSort('currentPrice')}
                  className="px-4 py-3 text-right cursor-pointer select-none group"
                >
                  <div className="flex items-center justify-end">
                    Price <SortIcon field="currentPrice" />
                  </div>
                </th>

                {/* STCG */}
                <th
                  onClick={() => handleSort('stcg')}
                  className="px-4 py-3 text-right cursor-pointer select-none group"
                >
                  <div className="flex items-center justify-end">
                    STCG Gain <SortIcon field="stcg" />
                  </div>
                </th>

                {/* LTCG */}
                <th
                  onClick={() => handleSort('ltcg')}
                  className="px-4 py-3 text-right cursor-pointer select-none group"
                >
                  <div className="flex items-center justify-end">
                    LTCG Gain <SortIcon field="ltcg" />
                  </div>
                </th>

                {/* Amount to sell */}
                <th className="px-5 py-3 text-right">Amount to Sell</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {rows.map(h => {
                const sel = selectedCoins.has(h.coin);
                return (
                  <tr
                    key={h.coin}
                    onClick={() => onToggleCoin(h.coin)}
                    className={`cursor-pointer transition-colors
                                ${sel
                                  ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                                }`}
                  >
                    {/* Checkbox */}
                    <td className="pl-5 pr-3 py-3.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => onToggleCoin(h.coin)}
                        className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                      />
                    </td>

                    {/* Asset */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={h.logo}
                          alt={h.coinName}
                          className="w-8 h-8 rounded-full border border-slate-100 dark:border-slate-700 flex-shrink-0"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {h.coinName}
                          </div>
                          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            {h.coin}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Holdings */}
                    <td className="px-4 py-3.5">
                      <div className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {fmtQty(h.totalHolding)} {h.coin}
                      </div>
                      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        Avg {fmtINR(h.averageBuyPrice)}
                      </div>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
                        {fmtINR(h.currentPrice)}
                      </span>
                    </td>

                    {/* STCG */}
                    <GainCell gain={h.stcg.gain} balance={h.stcg.balance} symbol={h.coin} />

                    {/* LTCG */}
                    <GainCell gain={h.ltcg.gain} balance={h.ltcg.balance} symbol={h.coin} />

                    {/* Amount to sell */}
                    <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <span
                        className={`inline-block text-xs font-semibold tabular-nums px-2.5 py-1 rounded-lg
                                    border transition-colors
                                    ${sel
                                      ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                                    }`}
                      >
                        {sel ? `${fmtQty(h.totalHolding)} ${h.coin}` : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile Card List ─────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map(h => {
            const sel = selectedCoins.has(h.coin);
            return (
              <div
                key={h.coin}
                onClick={() => onToggleCoin(h.coin)}
                className={`p-4 cursor-pointer transition-colors
                            ${sel
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-l-2 border-l-indigo-500'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                            }`}
              >
                {/* Row 1: coin + price */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() => onToggleCoin(h.coin)}
                      onClick={e => e.stopPropagation()}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <img src={h.logo} alt={h.coinName} className="w-8 h-8 rounded-full" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{h.coinName}</p>
                      <p className="text-[11px] text-slate-400 font-medium">{h.coin}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      {fmtINR(h.currentPrice)}
                    </p>
                    <p className="text-[10px] text-slate-400">current price</p>
                  </div>
                </div>

                {/* Row 2: holdings info */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2.5">
                  <div>
                    <p className="text-slate-400 mb-0.5">Holdings</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {fmtQty(h.totalHolding)} {h.coin}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">Avg buy</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-300">{fmtINR(h.averageBuyPrice)}</p>
                  </div>
                </div>

                {/* Row 3: gains */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">STCG</p>
                    <p className={`text-sm font-bold ${h.stcg.gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {fmtINR(h.stcg.gain)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">LTCG</p>
                    <p className={`text-sm font-bold ${h.ltcg.gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {fmtINR(h.ltcg.gain)}
                    </p>
                  </div>
                </div>

                {/* Row 4: amount to sell */}
                {sel && (
                  <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <span className="text-xs text-slate-500">Amount to sell</span>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                      {fmtQty(h.totalHolding)} {h.coin}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HoldingsTable;
