import { useState, useEffect } from 'react';

const INTERVIEW_ROLES = [
  'Software Engineer (Backend)',
  'Frontend Engineer',
  'Full Stack Developer',
  'Data Engineer / Machine Learning',
  'DevOps & Cloud Engineer',
];

const SAMPLE_ANSWERS = {
  default:
    'In distributed systems, eventual consistency means that given no new updates, all replicas will eventually return the latest value. We trade strong consistency for higher availability and partition tolerance according to the CAP theorem. DynamoDB and Cassandra use this model by quorum reads and writes.',
};

export default function InterviewPanel({ onInterviewCompleted }) {
  const [role, setRole] = useState('Software Engineer (Backend)');
  const [sessionState, setSessionState] = useState('setup'); // 'setup' | 'loading_question' | 'answering' | 'evaluating' | 'reviewed' | 'finished'
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // 0 to 4 (5 questions)
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [currentEvaluation, setCurrentEvaluation] = useState(null);
  const [history, setHistory] = useState([]); // List of { question, answer, evaluation }
  const [error, setError] = useState(null);
  const [overallMeanScore, setOverallMeanScore] = useState(null);

  const fetchMeanScore = async () => {
    try {
      const resp = await fetch('/api/interview/progress');
      if (resp.ok) {
        const data = await resp.json();
        if (data.mean_interview_score !== null) {
          setOverallMeanScore(data.mean_interview_score);
        }
      }
    } catch (e) {
      console.warn('Could not fetch interview progress', e);
    }
  };

  useEffect(() => {
    fetchMeanScore();
  }, []);

  const startInterview = async () => {
    setHistory([]);
    setCurrentQuestionIndex(0);
    setCandidateAnswer('');
    setCurrentEvaluation(null);
    setError(null);
    await loadNextQuestion(0, []);
  };

  const loadNextQuestion = async (qIndex, existingHistory) => {
    setSessionState('loading_question');
    setError(null);
    setCandidateAnswer('');
    setCurrentEvaluation(null);

    // Build short history context for LLM prompt
    const historyContext = existingHistory
      .map((item, idx) => `Q${idx + 1}: ${item.question} -> A: ${item.answer.slice(0, 100)}...`)
      .join(' | ');

    try {
      const resp = await fetch('/api/interview/next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, history: historyContext }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${resp.status}`);
      }

      const data = await resp.json();
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(qIndex);
      setSessionState('answering');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load next interview question.');
      setSessionState(existingHistory.length > 0 ? 'reviewed' : 'setup');
    }
  };

  const submitAnswer = async () => {
    if (!candidateAnswer.trim()) {
      setError('Please provide an answer before submitting for evaluation.');
      return;
    }

    setSessionState('evaluating');
    setError(null);

    try {
      const resp = await fetch('/api/interview/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          question: currentQuestion,
          answer: candidateAnswer.trim(),
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned ${resp.status}`);
      }

      const evalData = await resp.json();
      setCurrentEvaluation(evalData);

      const updatedHistory = [
        ...history,
        {
          question: currentQuestion,
          answer: candidateAnswer.trim(),
          evaluation: evalData,
        },
      ];
      setHistory(updatedHistory);
      setSessionState('reviewed');

      // Refresh overall mean score from backend
      fetchMeanScore();

      if (onInterviewCompleted) {
        onInterviewCompleted(evalData);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to evaluate answer.');
      setSessionState('answering');
    }
  };

  const handleNextOrFinish = () => {
    if (currentQuestionIndex + 1 < 5) {
      loadNextQuestion(currentQuestionIndex + 1, history);
    } else {
      setSessionState('finished');
    }
  };

  const calculateSessionAverage = () => {
    if (history.length === 0) return 0;
    const sum = history.reduce((acc, h) => acc + h.evaluation.mean_score, 0);
    return (sum / history.length).toFixed(1);
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-pink-50 text-pink-700 border border-pink-200 flex items-center justify-center font-bold text-xs">
              3
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Mock Interview</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            5-question technical interview loop with instant correctness, clarity, and completeness scoring.
          </p>
        </div>

        {overallMeanScore !== null && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs">
            <span className="text-slate-500">Overall Mean:</span>
            <span className="font-bold text-pink-700">{overallMeanScore} / 10</span>
          </div>
        )}
      </div>

      {/* 1. Setup State */}
      {sessionState === 'setup' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="interview-role-select" className="text-xs font-semibold text-slate-700">
              Target Technical Role
            </label>
            <select
              id="interview-role-select"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:border-pink-600 transition"
            >
              {INTERVIEW_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-2">
            <h3 className="font-semibold text-pink-700">Session Structure (5 Questions):</h3>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>AI asks one targeted technical question at a time.</li>
              <li>You type your technical explanation and submit.</li>
              <li>AI scores Correctness (1-10), Clarity (1-10), and Completeness (1-10).</li>
              <li>Instant model answer (max 120 words) and constructive coaching tip provided.</li>
            </ul>
          </div>

          <button
            id="start-interview-btn"
            type="button"
            onClick={startInterview}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-md shadow-pink-500/25 transition flex items-center justify-center gap-2"
          >
            <span>Start 5-Question Mock Interview</span>
          </button>
        </div>
      )}

      {/* 2. Loading Next Question State */}
      {sessionState === 'loading_question' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <svg className="animate-spin h-8 w-8 text-pink-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium text-slate-800">
            Generating Question {currentQuestionIndex + 1} of 5 for {role}...
          </span>
          <span className="text-xs text-slate-500">Groq AI interviewer synthesizing role-relevant scenario</span>
        </div>
      )}

      {/* 3. Evaluating Answer State */}
      {sessionState === 'evaluating' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <svg className="animate-spin h-8 w-8 text-pink-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium text-slate-800">
            Evaluating your response against industry benchmarks...
          </span>
          <span className="text-xs text-slate-500">Scoring correctness, clarity, completeness &amp; generating model answer</span>
        </div>
      )}

      {/* 4. Active Answering View */}
      {sessionState === 'answering' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-200 pb-2">
            <span className="font-semibold text-slate-900">
              Question {currentQuestionIndex + 1} of 5
            </span>
            <span className="px-2 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 text-[10px] font-medium">
              {role}
            </span>
          </div>

          {/* Question Box */}
          <div className="p-4 rounded-xl border border-pink-200 bg-pink-50/60">
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              {currentQuestion}
            </p>
          </div>

          {/* Answer Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="interview-answer-textarea" className="text-xs font-semibold text-slate-700">
                Your Answer
              </label>
              <button
                type="button"
                onClick={() => setCandidateAnswer(SAMPLE_ANSWERS.default)}
                className="text-[11px] text-pink-600 hover:text-pink-800 font-medium transition"
              >
                Paste Sample Answer
              </button>
            </div>
            <textarea
              id="interview-answer-textarea"
              rows={5}
              value={candidateAnswer}
              onChange={(e) => setCandidateAnswer(e.target.value)}
              placeholder="Type your structured technical answer here..."
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600 transition resize-y"
            />
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-1">
            <button
              id="submit-interview-answer-btn"
              type="button"
              onClick={submitAnswer}
              disabled={!candidateAnswer.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-md shadow-pink-500/25 transition disabled:opacity-50"
            >
              Submit Answer for AI Evaluation
            </button>
            <button
              type="button"
              onClick={() => setSessionState('setup')}
              className="text-xs text-slate-500 hover:text-slate-800 transition"
            >
              End Session
            </button>
          </div>
        </div>
      )}

      {/* 5. Answer Evaluated & Feedback View */}
      {sessionState === 'reviewed' && currentEvaluation && (
        <div id="interview-eval-container" className="space-y-4 animate-fadeIn">
          {/* Question Recap */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-500">
              Question {currentQuestionIndex + 1} of 5:
            </span>
            <p className="font-semibold text-slate-900">{currentQuestion}</p>
          </div>

          {/* 3 Metric Scores + Mean Score Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Correctness</span>
              <div className="text-xl font-bold text-emerald-700 mt-0.5">
                {currentEvaluation.correctness}<span className="text-xs text-slate-400 font-normal">/10</span>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Clarity</span>
              <div className="text-xl font-bold text-indigo-700 mt-0.5">
                {currentEvaluation.clarity}<span className="text-xs text-slate-400 font-normal">/10</span>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Completeness</span>
              <div className="text-xl font-bold text-violet-700 mt-0.5">
                {currentEvaluation.completeness}<span className="text-xs text-slate-400 font-normal">/10</span>
              </div>
            </div>
            <div className="p-3 rounded-xl border border-pink-200 bg-pink-50">
              <span className="text-[10px] text-pink-700 uppercase font-bold">Mean Score</span>
              <div className="text-xl font-extrabold text-pink-700 mt-0.5">
                {currentEvaluation.mean_score}<span className="text-xs text-pink-600/70 font-normal">/10</span>
              </div>
            </div>
          </div>

          {/* Model Answer Callout */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Model Answer (Ideal Benchmark)
              </span>
              <span className="text-[10px] text-slate-500">Max 120 words</span>
            </div>
            <p className="text-xs text-slate-800 leading-relaxed font-sans">
              {currentEvaluation.model_answer}
            </p>
          </div>

          {/* Constructive Tip Callout */}
          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-1">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
              Interviewer Coaching Tip
            </span>
            <p className="text-xs text-slate-800 leading-relaxed">
              {currentEvaluation.tip}
            </p>
          </div>

          {/* Next Action Button */}
          <div className="flex items-center justify-between pt-2">
            <button
              id="next-interview-question-btn"
              type="button"
              onClick={handleNextOrFinish}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-md shadow-pink-500/25 transition"
            >
              {currentQuestionIndex + 1 < 5 ? (
                <span>Next Question ({currentQuestionIndex + 2} of 5) →</span>
              ) : (
                <span>Complete 5-Question Interview Session →</span>
              )}
            </button>
            <span className="text-xs text-slate-500">
              {5 - (currentQuestionIndex + 1)} questions remaining
            </span>
          </div>
        </div>
      )}

      {/* 6. Completed 5-Question Session Summary View */}
      {sessionState === 'finished' && (
        <div id="interview-session-summary" className="space-y-4 animate-fadeIn">
          {/* Summary Banner */}
          <div className="p-5 rounded-xl border border-pink-200 bg-pink-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-pink-100 border border-pink-300 flex flex-col items-center justify-center font-black text-pink-700">
                <span className="text-2xl">{calculateSessionAverage()}</span>
                <span className="text-[9px] uppercase font-bold">/ 10</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  5-Question Mock Interview Completed!
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Done
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Evaluated for <strong>{role}</strong>. Average score across 5 questions:{' '}
                  <strong className="text-pink-700">{calculateSessionAverage()} / 10</strong>.
                </p>
              </div>
            </div>

            <button
              id="start-new-interview-btn"
              type="button"
              onClick={() => setSessionState('setup')}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition"
            >
              Start New Interview
            </button>
          </div>

          {/* Breakdown of all 5 questions */}
          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              5-Question Evaluation History
            </h4>
            {history.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    Q{idx + 1}: {item.question}
                  </span>
                  <span className="px-2 py-0.5 rounded font-bold text-pink-700 bg-pink-50 border border-pink-200 text-[11px]">
                    {item.evaluation.mean_score} / 10
                  </span>
                </div>
                <div className="text-slate-700 text-[11px] bg-white border border-slate-200 p-2 rounded-lg shadow-2xs">
                  <span className="text-slate-900 font-medium">Model Answer: </span>
                  {item.evaluation.model_answer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div id="interview-error-banner" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
