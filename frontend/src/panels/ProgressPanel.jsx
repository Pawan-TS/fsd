import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function ProgressPanel({ onSelectPracticeTopic, refreshTrigger }) {
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState(null);
  const [error, setError] = useState(null);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      let resp;
      try {
        resp = await fetch('/api/progress');
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/progress');
      }
      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }
      const data = await resp.json();
      setProgressData(data);
    } catch (err) {
      console.error('Failed to load progress data:', err);
      setError('Could not load aggregated progress. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [refreshTrigger]);

  // Format topic data for Recharts BarChart
  const chartData = progressData?.topic_accuracies
    ? Object.entries(progressData.topic_accuracies).map(([topic, stats]) => ({
        topic,
        accuracy: stats.attempts > 0 ? stats.accuracy : 0,
        attempts: stats.attempts,
      }))
    : [];

  const getCategoryBadgeColor = (category) => {
    switch (category) {
      case 'Ready':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Moderately ready':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Not ready':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getBarColor = (accuracy, attempts) => {
    if (attempts === 0) return '#cbd5e1'; // Slate-300 for unattempted
    if (accuracy >= 70) return '#10b981'; // Emerald
    if (accuracy >= 40) return '#f59e0b'; // Amber
    return '#f43f5e'; // Rose
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs">
              4
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Progress &amp; Readiness</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent rule-based readiness formula (D10) and weakest topic recommendations (D11).
          </p>
        </div>

        <button
          id="refresh-progress-btn"
          type="button"
          onClick={fetchProgress}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 shadow-xs transition"
        >
          {loading ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {loading && !progressData && (
        <div className="py-12 flex flex-col items-center justify-center space-y-2">
          <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-xs text-slate-500">Loading readiness metrics...</span>
        </div>
      )}

      {error && (
        <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
          {error}
        </div>
      )}

      {progressData && (
        <div className="space-y-5">
          {/* Top Readiness Score Display */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                id="readiness-score-display"
                className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-emerald-100 via-teal-100 to-indigo-100 border border-emerald-300 flex flex-col items-center justify-center font-black text-slate-900 shadow-sm"
              >
                {progressData.readiness.score !== null ? (
                  <>
                    <span className="text-2xl text-emerald-800">{progressData.readiness.score}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-500">/ 100</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500 font-semibold">N/A</span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Placement Readiness Score</h3>
                  <span
                    id="readiness-category-badge"
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getCategoryBadgeColor(
                      progressData.readiness.category
                    )}`}
                  >
                    {progressData.readiness.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 italic">
                  &ldquo;{progressData.readiness.label}&rdquo;
                </p>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="grid grid-cols-3 gap-2 w-full sm:w-auto text-center font-mono text-xs">
              <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 block font-sans">ATS Score</span>
                <span className="text-indigo-700 font-bold">
                  {progressData.ats_score !== null ? `${progressData.ats_score}%` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 block font-sans">Topic Avg</span>
                <span className="text-emerald-700 font-bold">
                  {progressData.avg_topic_accuracy !== null ? `${progressData.avg_topic_accuracy}%` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-500 block font-sans">Interview</span>
                <span className="text-pink-700 font-bold">
                  {progressData.mean_interview_score !== null ? `${progressData.mean_interview_score}/10` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Recharts BarChart for Per-Topic Accuracy */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Per-Topic Practice Accuracy
              </h4>
              <span className="text-[11px] text-slate-500">6 Core Placement Subjects</span>
            </div>

            <div
              id="topic-accuracy-barchart"
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 h-52 w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis
                    dataKey="topic"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={{ stroke: '#cbd5e1' }}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#0f172a',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    }}
                    formatter={(val, name, item) => [
                      `${val}% (${item.payload.attempts} attempts)`,
                      'Accuracy',
                    ]}
                  />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.accuracy, entry.attempts)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weakest 3 Topics: Recommended Next */}
          <div id="weakest-topics-container" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                <span>Recommended Next Practice</span>
                <span className="text-[10px] text-slate-500 font-normal">(3 Weakest Topics • D11)</span>
              </h4>
              <span className="text-[11px] text-slate-500">Click topic to practice</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {progressData.recommendations.map((rec, idx) => (
                <button
                  key={rec.topic}
                  id={`recommendation-topic-${rec.topic}`}
                  type="button"
                  onClick={() => onSelectPracticeTopic && onSelectPracticeTopic(rec.topic)}
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:bg-amber-50/60 hover:border-amber-300 text-left transition active:scale-95 group space-y-1 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 group-hover:text-amber-900 transition">
                      {idx + 1}. {rec.topic}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {rec.attempts} tests
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between items-center">
                    <span>Accuracy:</span>
                    <span className={rec.attempts > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                      {rec.attempts > 0 ? `${rec.accuracy}%` : 'Not tested (0%)'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
