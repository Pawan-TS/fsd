import { useState, useEffect } from 'react';

const SAMPLE_MATCHING_RESUME = `Alex Chen - Software Engineer
Email: alex.chen@example.com | GitHub: github.com/alexchen

SUMMARY:
Backend Engineer with 3+ years experience building high-throughput microservices using Python, FastAPI, and PostgreSQL. Proficient with Docker, Redis, CI/CD, and AWS cloud deployments.

TECHNICAL SKILLS:
- Languages: Python, SQL, JavaScript
- Frameworks: FastAPI, Django, Flask, React
- Databases: PostgreSQL, Redis, MySQL
- DevOps & Cloud: Docker, Kubernetes, AWS (EC2, S3), CI/CD, Git, Linux
- Core CS: Data Structures, Algorithms, REST API, System Design

EXPERIENCE:
Software Engineer | CloudScale Labs (2023 - Present)
- Designed and maintained 12+ RESTful microservices using FastAPI and PostgreSQL handling 2M+ requests/day.
- Integrated Redis caching layer reducing database query latency by 45%.
- Containerized applications using Docker and automated CI/CD pipelines via GitHub Actions.`;

const SAMPLE_MATCHING_JD = `Role: Senior Backend Engineer (Python / FastAPI)
Company: TechVentures Inc.

REQUIREMENTS:
- 3+ years experience developing backend web services with Python and FastAPI.
- Strong hands-on database experience with PostgreSQL and Redis.
- Solid understanding of Docker containerization and CI/CD pipelines.
- Experience deploying and managing workloads on AWS cloud infrastructure.
- Solid foundations in REST API design, Data Structures, and System Design.`;

const SAMPLE_UNRELATED_JD = `Role: Senior Graphic Designer & Visual Artist
Company: Creative Studio Co.

REQUIREMENTS:
- 4+ years of professional experience in graphic design and visual brand identity.
- Mastery of Adobe Creative Suite: Photoshop, Illustrator, InDesign, and Figma.
- Strong typography, color theory, and print production expertise.
- Experience conducting photoshoot art direction and storyboard illustration.
- Portfolio demonstrating creative branding, editorial layouts, and vector artwork.`;

export default function ResumePanel({ onAtsCalculated, resetTrigger }) {
  const [resumeText, setResumeText] = useState(SAMPLE_MATCHING_RESUME);
  const [jdText, setJdText] = useState(SAMPLE_MATCHING_JD);
  const [loading, setLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Step 7: Reset to clean pre-filled sample state when reset is triggered
  useEffect(() => {
    if (resetTrigger) {
      setResumeText(SAMPLE_MATCHING_RESUME);
      setJdText(SAMPLE_MATCHING_JD);
      setResult(null);
      setError(null);
    }
  }, [resetTrigger]);

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Please upload a valid .pdf file.');
      return;
    }

    setUploadingPdf(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      let resp;
      try {
        resp = await fetch('/api/extract-pdf', {
          method: 'POST',
          body: formData,
        });
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/extract-pdf', {
          method: 'POST',
          body: formData,
        });
      }

      if (!resp.ok) {
        throw new Error(`PDF upload failed with status ${resp.status}`);
      }

      const data = await resp.json();
      if (data.text) {
        setResumeText(data.text);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to extract text from PDF. You can paste the resume text directly.');
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleAnalyze = async () => {
    if (!resumeText.trim() || !jdText.trim()) {
      setError('Please provide both resume text and job description.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let resp;
      try {
        resp = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: resumeText, jd: jdText }),
        });
      } catch (e) {
        resp = await fetch('http://127.0.0.1:8000/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume: resumeText, jd: jdText }),
        });
      }

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        if (resp.status === 429) {
          throw new Error('Rate limit reached on Groq free-tier (token/min limit). Please wait a few seconds and retry.');
        }
        throw new Error(errorData.detail || `Server returned status ${resp.status}. Please check your connection or Groq API key.`);
      }

      const data = await resp.json();
      setResult(data);
      if (onAtsCalculated) {
        onAtsCalculated(data.ats_score);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Analysis failed. Please check your connection or Groq API key in .env and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return 'text-emerald-700 border-emerald-200 bg-emerald-50';
    if (score >= 50) return 'text-amber-700 border-amber-200 bg-amber-50';
    return 'text-rose-700 border-rose-200 bg-rose-50';
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs">
              1
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Resume vs Job Description</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Embeddings cosine match + skill coverage ATS scoring and Groq AI improvement suggestions.
          </p>
        </div>

        {/* Quick Sample Fill Buttons */}
        <div className="flex items-center gap-2">
          <button
            id="load-matching-sample-btn"
            type="button"
            onClick={() => {
              setResumeText(SAMPLE_MATCHING_RESUME);
              setJdText(SAMPLE_MATCHING_JD);
              setResult(null);
              setError(null);
            }}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition shadow-xs"
          >
            Sample Match
          </button>
          <button
            id="load-unrelated-sample-btn"
            type="button"
            onClick={() => {
              setResumeText(SAMPLE_MATCHING_RESUME);
              setJdText(SAMPLE_UNRELATED_JD);
              setResult(null);
              setError(null);
            }}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium transition shadow-xs"
          >
            Sample Mismatch
          </button>
        </div>
      </div>

      {/* Input Textareas Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Resume Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="resume-textarea" className="text-xs font-semibold text-slate-700">
              Resume Text
            </label>
            <label
              htmlFor="resume-pdf-upload"
              className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1"
            >
              <input
                id="resume-pdf-upload"
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
                disabled={uploadingPdf}
              />
              <span>{uploadingPdf ? 'Extracting PDF...' : 'Upload PDF (PyMuPDF)'}</span>
            </label>
          </div>
          <textarea
            id="resume-textarea"
            rows={7}
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste candidate resume text or upload PDF..."
            className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-y"
          />
        </div>

        {/* Job Description Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="jd-textarea" className="text-xs font-semibold text-slate-700">
              Target Job Description
            </label>
            <span className="text-[11px] text-slate-500">Paste job requirements</span>
          </div>
          <textarea
            id="jd-textarea"
            rows={7}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste target job description and required qualifications..."
            className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-y"
          />
        </div>
      </div>

      {/* Action Button & Error State */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <button
          id="analyze-resume-button"
          type="button"
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-95 text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Analyzing with MiniLM &amp; Groq...</span>
            </>
          ) : (
            <span>Analyze Resume vs JD</span>
          )}
        </button>

        {error && (
          <div id="analyze-error-banner" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg w-full sm:w-auto">
            {error}
          </div>
        )}
      </div>

      {/* Analysis Results Display */}
      {result && (
        <div id="ats-results-container" className="pt-4 border-t border-slate-200 space-y-4 animate-fadeIn">
          {/* Top Score Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* ATS Score Box */}
            <div
              id="ats-score-display"
              className={`p-4 rounded-xl border flex flex-col items-center justify-center ${getScoreColor(result.ats_score)}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider">ATS Score</span>
              <span className="text-3xl font-extrabold mt-0.5">{result.ats_score}%</span>
              <span className="text-[10px] opacity-80 mt-1">D9 Locked Formula</span>
            </div>

            {/* Semantic Similarity */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Semantic Match</span>
              <span className="text-2xl font-bold text-indigo-700 mt-0.5">
                {(result.cosine_similarity * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 mt-1">MiniLM-L6-v2 Cosine</span>
            </div>

            {/* Skill Match Ratio */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">JD Skill Coverage</span>
              <span className="text-2xl font-bold text-emerald-700 mt-0.5">
                {result.all_jd_skills.length > 0
                  ? `${Math.round((result.matched_skills.length / result.all_jd_skills.length) * 100)}%`
                  : 'N/A'}
              </span>
              <span className="text-[10px] text-slate-500 mt-1">
                {result.matched_skills.length} of {result.all_jd_skills.length} JD Skills
              </span>
            </div>
          </div>

          {/* Matched vs Missing Skills Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Matched Skills */}
            <div id="matched-skills-container" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Matched Skills ({result.matched_skills.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.matched_skills.length > 0 ? (
                  result.matched_skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      ✓ {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No matching skills detected</span>
                )}
              </div>
            </div>

            {/* Missing Skills */}
            <div id="missing-skills-container" className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Missing Skills from JD ({result.missing_skills.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.missing_skills.length > 0 ? (
                  result.missing_skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                    >
                      ! {skill}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-emerald-700 font-medium">All JD skills matched!</span>
                )}
              </div>
            </div>
          </div>

          {/* 5 AI Concrete Suggestions */}
          <div id="suggestions-list-container" className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                <span>AI Resume Suggestions</span>
                <span className="text-[10px] font-normal text-slate-500 lowercase">(Groq gpt-oss-120b)</span>
              </h3>
              <span className="text-[11px] text-slate-500">5 Concrete Improvements</span>
            </div>
            <ul id="suggestions-list" className="space-y-1.5">
              {result.suggestions && result.suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="text-xs text-slate-700 flex items-start gap-2.5 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs"
                >
                  <span className="h-5 w-5 flex-shrink-0 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-[10px]">
                    {index + 1}
                  </span>
                  <span className="leading-relaxed">{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
