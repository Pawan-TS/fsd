import { useState, useEffect } from 'react';
import ResumePanel from './panels/ResumePanel';
import QuizPanel from './panels/QuizPanel';
import InterviewPanel from './panels/InterviewPanel';
import ProgressPanel from './panels/ProgressPanel';

function App() {
  const [healthStatus, setHealthStatus] = useState('checking'); // 'checking' | 'healthy' | 'error'
  const [healthData, setHealthData] = useState(null);
  const [latency, setLatency] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastAts, setLastAts] = useState(null);
  const [lastQuizResult, setLastQuizResult] = useState(null);
  const [activeQuizTopic, setActiveQuizTopic] = useState('DBMS');
  const [progressVersion, setProgressVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [resetTriggerCount, setResetTriggerCount] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  const triggerProgressRefresh = () => {
    setProgressVersion((v) => v + 1);
  };

  const handleSelectPracticeTopic = (selectedTopic) => {
    setActiveQuizTopic(selectedTopic);
    const quizElem = document.getElementById('panel-quiz-container');
    if (quizElem) {
      quizElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const checkHealth = async () => {
    setHealthStatus('checking');
    setErrorMessage('');
    const startTime = performance.now();
    try {
      let response;
      try {
        response = await fetch('/api/health');
      } catch (e) {
        response = await fetch('http://127.0.0.1:8000/api/health');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const elapsed = Math.round(performance.now() - startTime);
      setHealthData(data);
      setLatency(elapsed);
      setHealthStatus('healthy');
    } catch (err) {
      console.error('Health check failed:', err);
      setHealthStatus('error');
      setErrorMessage(err.message || 'Failed to connect to backend');
    }
  };

  const handleResetDemo = async () => {
    if (resetting) return;
    setResetting(true);
    setToastMessage('');
    try {
      let resp;
      try {
        resp = await fetch('/api/reset', { method: 'POST' });
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/reset', { method: 'POST' });
      }
      if (!resp.ok) {
        throw new Error(`Reset failed with status ${resp.status}`);
      }
      setLastAts(null);
      setLastQuizResult(null);
      setResetTriggerCount((c) => c + 1);
      triggerProgressRefresh();
      setToastMessage('Demo data reset to clean starting baseline');
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('Reset demo error:', err);
      setToastMessage('Error resetting demo: ' + (err.message || 'Unknown error'));
      setTimeout(() => setToastMessage(''), 5000);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          id="toast-notification"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-xl border border-slate-700"
        >
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage('')}
            className="ml-2 text-slate-400 hover:text-white font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Navbar */}
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20 font-bold text-lg text-white">
              AI
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Placement-Prep Portal
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Demo
                </span>
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Barebones 4-Panel AI Placement Prototype (Groq openai/gpt-oss-120b)
              </p>
            </div>
          </div>

          {/* Backend Status Badge, Reset Button & Re-check Button */}
          <div className="flex items-center gap-3">
            <div
              id="backend-health-indicator"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                healthStatus === 'healthy'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : healthStatus === 'checking'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  healthStatus === 'healthy'
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                    : healthStatus === 'checking'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              <span>
                {healthStatus === 'healthy' && `Backend Connected (${latency}ms)`}
                {healthStatus === 'checking' && 'Checking /api/health...'}
                {healthStatus === 'error' && 'Backend Disconnected'}
              </span>
            </div>

            <button
              id="reset-demo-button"
              type="button"
              onClick={handleResetDemo}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 active:scale-95 transition rounded-lg border border-rose-200 shadow-xs disabled:opacity-50"
              title="Clear SQLite database and restore clean demo state"
            >
              {resetting ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-rose-600" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Resetting...</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Reset Demo Data</span>
                </>
              )}
            </button>

            <button
              id="refresh-health-button"
              type="button"
              onClick={checkHealth}
              disabled={healthStatus === 'checking'}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 active:scale-95 transition rounded-lg border border-slate-300 shadow-xs disabled:opacity-50"
            >
              Re-check API
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Diagnostic Banner */}
        <section
          id="scaffold-status-card"
          className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-indigo-700">
                  Step 7 • Complete AI Placement Portal Demo
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  All 4 Panels Operational
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                AI Placement Preparation &amp; Readiness Command Center
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                MiniLM resume ATS scoring, Groq `openai/gpt-oss-120b` practice tests, 5-question mock interviews, and rule-based readiness calculation (§10).
              </p>
            </div>

            <div className="w-full sm:w-auto min-w-[240px] bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs font-mono">
              <div className="text-slate-500 text-[11px] mb-1 flex justify-between font-sans">
                <span>System Health</span>
                <span className={healthStatus === 'healthy' ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                  {healthStatus === 'healthy' ? 'Active' : healthStatus}
                </span>
              </div>
              <div className="text-slate-700 text-[11px] space-y-0.5">
                <div><span className="text-slate-400">Model:</span> openai/gpt-oss-120b</div>
                <div><span className="text-slate-400">Storage:</span> placement_demo.sqlite3</div>
                <div><span className="text-slate-400">Last ATS Score:</span> <span className="font-semibold text-indigo-600">{lastAts !== null ? `${lastAts}%` : 'Loaded from DB'}</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Dashboard Panels Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div id="panel-resume-container">
            <ResumePanel
              resetTrigger={resetTriggerCount}
              onAtsCalculated={(score) => {
                setLastAts(score);
                triggerProgressRefresh();
              }}
            />
          </div>
          <div id="panel-quiz-container">
            <QuizPanel
              resetTrigger={resetTriggerCount}
              activeTopicOverride={activeQuizTopic}
              onQuizCompleted={(res) => {
                setLastQuizResult(res);
                triggerProgressRefresh();
              }}
            />
          </div>
          <div id="panel-interview-container">
            <InterviewPanel
              resetTrigger={resetTriggerCount}
              onInterviewCompleted={() => {
                triggerProgressRefresh();
              }}
            />
          </div>
          <div id="panel-progress-container">
            <ProgressPanel
              refreshTrigger={progressVersion}
              onSelectPracticeTopic={handleSelectPracticeTopic}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        AI Placement-Prep Portal • Demo Prototype • Step 7 Polish &amp; Verification Complete
      </footer>
    </div>
  );
}

export default App;
