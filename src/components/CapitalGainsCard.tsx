import React from 'react';
import type { CapitalGains } from '../types';
import { TrendingUp, TrendingDown, ArrowDown, ShieldCheck } from 'lucide-react';

// ─── helpers ───────────────────────────────────────────────────────────────────
function fmtINR(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  return `${n < 0 ? '-' : ''}₹${formatted}`;
}

// ─── types ─────────────────────────────────────────────────────────────────────
interface Props {
  title: string;
  subtitle: string;
  type: 'pre' | 'post';
  data: CapitalGains;
  preRealisedGains?: number;
  taxRate: number;
}

// ─── component ─────────────────────────────────────────────────────────────────
export const CapitalGainsCard: React.FC<Props> = ({
  title,
  subtitle,
  type,
  data,
  preRealisedGains = 0,
  taxRate,
}) => {
  const isPost = type === 'post';

  const stcgNet = data.stcg.profits - data.stcg.losses;
  const ltcgNet = data.ltcg.profits - data.ltcg.losses;
  const realisedGains = stcgNet + ltcgNet;

  const gainsDiff = preRealisedGains - realisedGains;
  const taxSavings = gainsDiff > 0 ? gainsDiff * (taxRate / 100) : 0;
  const showSavings = isPost && gainsDiff > 0;

  // ── Row helper ──────────────────────────────────────────────────────────────
  const Row = ({
    label,
    value,
    color,
  }: {
    label: string;
    value: number;
    color: 'green' | 'red' | 'neutral';
  }) => {
    const valueClass =
      color === 'green'
        ? 'text-emerald-500 dark:text-emerald-400'
        : color === 'red'
        ? 'text-rose-500 dark:text-rose-400'
        : isPost
        ? 'text-slate-200'
        : 'text-slate-800 dark:text-slate-200';

    return (
      <div className="flex items-center justify-between py-2">
        <span
          className={`text-sm ${
            isPost ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {label}
        </span>
        <span className={`text-sm font-semibold tabular-nums ${valueClass}`}>
          {fmtINR(value)}
        </span>
      </div>
    );
  };

  // ── Section helper (STCG / LTCG block) ────────────────────────────────────
  const GainSection = ({
    tag,
    profits,
    losses,
    net,
    badge,
  }: {
    tag: string;
    profits: number;
    losses: number;
    net: number;
    badge: string;
  }) => (
    <div
      className={`rounded-xl p-4 space-y-1 ${
        isPost
          ? 'bg-white/5 border border-white/8'
          : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[11px] font-bold uppercase tracking-wider ${
            isPost ? 'text-slate-400' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {tag}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            isPost
              ? 'bg-white/10 text-slate-300'
              : 'bg-slate-200/70 dark:bg-slate-700/70 text-slate-500 dark:text-slate-400'
          }`}
        >
          {badge}
        </span>
      </div>

      <Row label="Profits" value={profits} color="green" />
      <Row label="Losses" value={losses} color="red" />

      <div
        className={`mt-1 pt-2 flex items-center justify-between border-t ${
          isPost ? 'border-white/10' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <span
          className={`text-xs font-semibold ${
            isPost ? 'text-slate-300' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          Net {tag}
        </span>
        <span
          className={`text-sm font-bold tabular-nums ${
            net >= 0
              ? 'text-emerald-500 dark:text-emerald-400'
              : 'text-rose-500 dark:text-rose-400'
          }`}
        >
          {fmtINR(net)}
        </span>
      </div>
    </div>
  );

  // ── Card wrapper styles ────────────────────────────────────────────────────
  const cardClass = isPost
    ? 'relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-indigo-700 via-indigo-800 to-violet-900 border border-indigo-600/40 shadow-xl shadow-indigo-900/30 text-white'
    : 'relative overflow-hidden rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm';

  return (
    <div className={cardClass}>
      {/* Decorative glow for post card */}
      {isPost && (
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5 relative">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3
              className={`font-bold text-[15px] tracking-tight ${
                isPost ? 'text-white' : 'text-slate-900 dark:text-white'
              }`}
            >
              {title}
            </h3>
            {isPost && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full
                               bg-indigo-500/30 border border-indigo-400/30 text-indigo-200">
                Live
              </span>
            )}
          </div>
          <p className={`text-xs ${isPost ? 'text-indigo-200/70' : 'text-slate-400 dark:text-slate-500'}`}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* ── STCG / LTCG blocks ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 relative">
        <GainSection
          tag="STCG"
          profits={data.stcg.profits}
          losses={data.stcg.losses}
          net={stcgNet}
          badge="< 1 yr"
        />
        <GainSection
          tag="LTCG"
          profits={data.ltcg.profits}
          losses={data.ltcg.losses}
          net={ltcgNet}
          badge="> 1 yr"
        />
      </div>

      {/* ── Realised gains total ─────────────────────────────────────────── */}
      <div
        className={`relative flex items-center justify-between rounded-xl px-5 py-4 mb-4 ${
          isPost
            ? 'bg-white/8 border border-white/10'
            : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50'
        }`}
      >
        <div>
          <p
            className={`text-[11px] font-semibold uppercase tracking-widest mb-0.5 ${
              isPost ? 'text-slate-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            Realised Gains
          </p>
          <p
            className={`text-2xl font-extrabold tabular-nums tracking-tight ${
              isPost
                ? 'text-white'
                : realisedGains >= 0
                ? 'text-slate-900 dark:text-white'
                : 'text-rose-500'
            }`}
          >
            {fmtINR(realisedGains)}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            realisedGains >= 0
              ? isPost
                ? 'bg-emerald-500/20'
                : 'bg-emerald-100 dark:bg-emerald-950/40'
              : isPost
              ? 'bg-rose-500/20'
              : 'bg-rose-100 dark:bg-rose-950/40'
          }`}
        >
          {realisedGains >= 0 ? (
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          ) : (
            <TrendingDown className="w-5 h-5 text-rose-500" />
          )}
        </div>
      </div>

      {/* ── Savings banner ──────────────────────────────────────────────── */}
      {showSavings ? (
        <div className="animate-fade-slide-up rounded-xl p-4 flex gap-3 items-start
                        bg-emerald-500/15 border border-emerald-400/25">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-200 mb-0.5">
              You're going to save {fmtINR(taxSavings)} 🎉
            </p>
            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              Harvesting selected losses reduces your taxable gains by{' '}
              <strong className="text-emerald-200">{fmtINR(gainsDiff)}</strong>,
              saving you <strong className="text-white">{fmtINR(taxSavings)}</strong> at
              your {taxRate}% tax rate.
            </p>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400/80 font-medium">
              <ArrowDown className="w-3 h-3" />
              Gains reduced from {fmtINR(preRealisedGains)} → {fmtINR(realisedGains)}
            </div>
          </div>
        </div>
      ) : isPost ? (
        <div className={`text-center py-4 rounded-xl border border-dashed text-xs
                        ${isPost
                          ? 'border-indigo-500/30 text-indigo-300/60'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400'}`}>
          Select loss-making holdings below to see your tax savings.
        </div>
      ) : null}
    </div>
  );
};

export default CapitalGainsCard;
