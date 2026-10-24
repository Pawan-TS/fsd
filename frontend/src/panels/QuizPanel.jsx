import { useState, useEffect } from 'react';

const TOPICS = [
  { id: 'DBMS', name: 'DBMS', desc: 'Database Management & SQL' },
  { id: 'OS', name: 'Operating Systems', desc: 'Processes, Threads, Concurrency' },
  { id: 'DSA', name: 'Data Structures & Algo', desc: 'Arrays, Trees, Graphs, DP' },
  { id: 'CN', name: 'Computer Networks', desc: 'TCP/IP, HTTP, Protocols' },
  { id: 'OOP', name: 'OOP Concepts', desc: 'Inheritance, Polymorphism, Design' },
  { id: 'Aptitude', name: 'Quantitative & Logic', desc: 'Reasoning, Math & Placements' },
];

export default function QuizPanel({ activeTopicOverride, onQuizCompleted, resetTrigger }) {
  const [topic, setTopic] = useState('DBMS');
  const [count, setCount] = useState(5);
  const [status, setStatus] = useState('idle'); // 'idle' | 'generating' | 'active' | 'submitting' | 'completed'
  const [questions, setQuestions] = useState([]);
  const [userAnswers, setUserAnswers] = useState({}); // { questionIndex: selectedOptionIndex }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [topicAccuracies, setTopicAccuracies] = useState({});

  useEffect(() => {
    if (activeTopicOverride && TOPICS.some((t) => t.id === activeTopicOverride)) {
      setTopic(activeTopicOverride);
    }
  }, [activeTopicOverride]);

  // Step 7: Reset to clean initial state when reset is triggered
  useEffect(() => {
    if (resetTrigger) {
      resetQuiz();
    }
  }, [resetTrigger]);

  const fetchTopicStats = async () => {
    try {
      let resp;
      try {
        resp = await fetch('/api/quiz/progress');
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/quiz/progress');
      }
      if (resp.ok) {
        const data = await resp.json();
        setTopicAccuracies(data.topic_accuracies || {});
      }
    } catch (e) {
      console.warn('Could not fetch topic stats', e);
    }
  };

  useEffect(() => {
    fetchTopicStats();
  }, []);

  const handleGenerate = async () => {
    setStatus('generating');
    setError(null);
    setUserAnswers({});
    setResult(null);

    try {
      let resp;
      try {
        resp = await fetch('/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, count: Number(count) }),
        });
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, count: Number(count) }),
        });
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          throw new Error('Rate limit reached on Groq free-tier (token/min limit). Please wait a few seconds and retry.');
        }
        throw new Error(errData.detail || `Server returned status ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions returned by the AI. Please try again.');
      }

      setQuestions(data.questions);
      setStatus('active');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to generate quiz. Please retry in a few moments.');
      setStatus('idle');
    }
  };

  const handleSelectOption = (qIdx, optIdx) => {
    if (status !== 'active') return;
    setUserAnswers((prev) => ({
      ...prev,
      [qIdx]: optIdx,
    }));
  };

  const handleSubmit = async () => {
    // Check if at least one question is answered
    const answeredCount = Object.keys(userAnswers).length;
    if (answeredCount === 0) {
      setError('Please answer at least one question before submitting.');
      return;
    }

    setStatus('submitting');
    setError(null);

    try {
      const answersPayload = questions.map((q, idx) => ({
        selected_index: userAnswers[idx] !== undefined ? userAnswers[idx] : -1,
        correct_index: q.correct_index,
        question: q.question,
      }));

      let resp;
      try {
        resp = await fetch('/api/quiz/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            answers: answersPayload,
          }),
        });
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/quiz/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic,
            answers: answersPayload,
          }),
        });
      }

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `Server returned status ${resp.status}`);
      }

      const data = await resp.json();
      setResult(data);
      if (data.topic_accuracies) {
        setTopicAccuracies(data.topic_accuracies);
      }
      setStatus('completed');
      if (onQuizCompleted) {
        onQuizCompleted(data);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to submit quiz. Please try again.');
      setStatus('active');
    }
  };

  const resetQuiz = () => {
    setStatus('idle');
    setQuestions([]);
    setUserAnswers({});
    setResult(null);
    setError(null);
    fetchTopicStats();
  };

  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-violet-50 text-violet-700 border border-violet-200 flex items-center justify-center font-bold text-xs">
              2
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">AI Practice Test</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            AI-generated placement MCQs with instant scoring, explanations, and per-topic tracking.
          </p>
        </div>

        {/* Current Topic Accuracy Badge if available */}
        {topicAccuracies[topic]?.attempts > 0 && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs">
            <span className="text-slate-500">{topic} Accuracy:</span>
            <span className="font-bold text-emerald-700">{topicAccuracies[topic].accuracy}%</span>
            <span className="text-[10px] text-slate-400">({topicAccuracies[topic].attempts} tests)</span>
          </div>
        )}
      </div>

      {/* Setup / Config View */}
      {status === 'idle' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Topic Select */}
            <div className="space-y-1.5">
              <label htmlFor="quiz-topic-select" className="text-xs font-semibold text-slate-700">
                Placement Subject
              </label>
              <select
                id="quiz-topic-select"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:border-violet-600 transition"
              >
                {TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Question Count Select */}
            <div className="space-y-1.5">
              <label htmlFor="quiz-count-select" className="text-xs font-semibold text-slate-700">
                Number of MCQs (Batch limit: 5)
              </label>
              <select
                id="quiz-count-select"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:border-violet-600 transition"
              >
                <option value={3}>3 Questions (Fast test)</option>
                <option value={5}>5 Questions (Standard batch)</option>
              </select>
            </div>
          </div>

          {/* Generate Button */}
          <button
            id="generate-quiz-btn"
            type="button"
            onClick={handleGenerate}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-md shadow-violet-500/25 transition flex items-center justify-center gap-2"
          >
            <span>Generate {topic} Test (Groq gpt-oss-120b)</span>
          </button>
        </div>
      )}

      {/* Generating Spinner */}
      {status === 'generating' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <svg className="animate-spin h-8 w-8 text-violet-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium text-slate-800">
            Synthesizing {count} {topic} placement questions with Groq AI...
          </span>
          <span className="text-xs text-slate-500">Adhering to token budget and low latency mode</span>
        </div>
      )}

      {/* Active Test Taking View */}
      {(status === 'active' || status === 'submitting') && (
        <div className="space-y-5">
          {/* Progress Header */}
          <div className="flex items-center justify-between text-xs text-slate-500 border-b border-slate-200 pb-2">
            <span>
              Topic: <strong className="text-slate-900">{topic}</strong> ({questions.length} Questions)
            </span>
            <span>
              Progress:{' '}
              <strong className={answeredCount === questions.length ? 'text-emerald-700' : 'text-amber-700'}>
                {answeredCount}/{questions.length} answered
              </strong>
            </span>
          </div>

          {/* Question List */}
          <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
              >
                <div className="flex items-start gap-2.5">
                  <span className="h-5 w-5 rounded bg-violet-50 text-violet-700 border border-violet-200 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {qIdx + 1}
                  </span>
                  <p className="text-xs font-semibold text-slate-900 leading-relaxed">{q.question}</p>
                </div>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = userAnswers[qIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        id={`question-${qIdx}-option-${optIdx}`}
                        onClick={() => handleSelectOption(qIdx, optIdx)}
                        disabled={status === 'submitting'}
                        className={`text-left p-2.5 rounded-lg text-xs font-medium border transition ${
                          isSelected
                            ? 'bg-violet-50 border-violet-500 text-violet-900 ring-1 ring-violet-500 shadow-xs'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`h-4 w-4 rounded-full border flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5 ${
                              isSelected
                                ? 'border-violet-600 bg-violet-600 text-white'
                                : 'border-slate-300 text-slate-500 bg-slate-100'
                            }`}
                          >
                            {String.fromCharCode(65 + optIdx)}
                          </span>
                          <span className="leading-snug">{opt}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-2">
            <button
              id="submit-quiz-btn"
              type="button"
              onClick={handleSubmit}
              disabled={answeredCount === 0 || status === 'submitting'}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              {status === 'submitting' ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Scoring &amp; Saving Results...</span>
                </>
              ) : (
                <span>Submit Test &amp; Calculate Score</span>
              )}
            </button>
            <button
              type="button"
              onClick={resetQuiz}
              disabled={status === 'submitting'}
              className="text-xs text-slate-500 hover:text-slate-800 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Test Completed / Review View with Score & Explanations */}
      {status === 'completed' && result && (
        <div id="quiz-result-container" className="space-y-5 animate-fadeIn">
          {/* Score Header Banner */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                id="quiz-score-badge"
                className={`h-14 w-14 rounded-xl border flex flex-col items-center justify-center font-black ${
                  result.accuracy >= 70
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : result.accuracy >= 40
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <span className="text-sm">{result.accuracy}%</span>
                <span className="text-[9px] uppercase font-bold">Accuracy</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Test Complete: {result.topic}
                  <span className="text-xs font-normal text-slate-500">
                    ({result.correct_count} of {result.total_count} correct)
                  </span>
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Saved to database • Updated overall {result.topic} accuracy is{' '}
                  <strong className="text-emerald-700">
                    {result.topic_accuracies[result.topic]?.accuracy}%
                  </strong>
                </p>
              </div>
            </div>

            <button
              id="retake-quiz-btn"
              type="button"
              onClick={resetQuiz}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition"
            >
              Take Another Test
            </button>
          </div>

          {/* Questions Review with Explanations */}
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Answers &amp; AI Explanations
            </h4>
            {questions.map((q, qIdx) => {
              const selectedIdx = userAnswers[qIdx];
              const isCorrect = selectedIdx === q.correct_index;

              return (
                <div
                  key={qIdx}
                  className={`p-3.5 rounded-xl border ${
                    isCorrect
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'border-rose-200 bg-rose-50/50'
                  } space-y-2.5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-900">
                      <span className="font-bold mr-1.5">{qIdx + 1}.</span> {q.question}
                    </p>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex-shrink-0 ${
                        isCorrect
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </span>
                  </div>

                  {/* Options state */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    {q.options.map((opt, optIdx) => {
                      const isOptionCorrect = optIdx === q.correct_index;
                      const isOptionSelected = optIdx === selectedIdx;

                      let style = 'border-slate-200 bg-white text-slate-600';
                      if (isOptionCorrect) {
                        style = 'border-emerald-300 bg-emerald-100 text-emerald-900 font-semibold';
                      } else if (isOptionSelected && !isOptionCorrect) {
                        style = 'border-rose-300 bg-rose-100 text-rose-900 line-through';
                      }

                      return (
                        <div key={optIdx} className={`p-2 rounded-lg border ${style} flex items-center gap-1.5`}>
                          <span className="font-mono text-[10px] opacity-75">
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span>{opt}</span>
                          {isOptionCorrect && <span className="ml-auto text-emerald-700 font-bold">✓</span>}
                          {isOptionSelected && !isOptionCorrect && (
                            <span className="ml-auto text-rose-700 font-bold">✗</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Explanation Callout */}
                  <div
                    id={`quiz-explanation-${qIdx}`}
                    className="p-2.5 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 space-y-0.5 shadow-2xs"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700">
                      AI Explanation:
                    </span>
                    <p className="leading-relaxed">{q.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div id="quiz-error-banner" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
