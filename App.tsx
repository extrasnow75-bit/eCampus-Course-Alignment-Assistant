
import React, { useState, useEffect } from 'react';
import { initiateGoogleSignIn, signOutFromGoogle, getStoredAccessToken, onAuthStateChanged } from './services/firebaseService';
import {
  generateDesignMapWithProvider,
  analyzeCourseDocumentWithProvider,
  detectGeminiModels,
  detectOpenAIModels,
  LLMProvider,
  ModelConfig,
} from './services/llmRouter';
import { GEMINI_MODEL_LABELS, GEMINI_MODEL_TIERS } from './services/geminiService';
import { OPENAI_MODEL_LABELS, OPENAI_MODEL_TIERS } from './services/openaiService';
import { DesignMap, StoredModelConfig } from './types';
import { LoadingOverlay } from './components/LoadingOverlay';
import { MappingResult } from './components/MappingResult';
import { SettingsModal } from './components/SettingsModal';
import { Key, LogOut, ChevronDown, Settings2 } from 'lucide-react';

// External global variable types for Mammoth and PDF.js
declare const mammoth: any;
declare const pdfjsLib: any;

const MAX_CHARS = 300000;

// Strips HTML markup and collapses whitespace — DOM-based so it's safe and accurate.
// PDF.js and Mammoth already return plain text, but Drive downloads and pasted content
// can contain raw HTML from Canvas exports.
const stripHtml = (text: string): string => {
  if (!text.includes('<')) return text; // Fast-path: no tags, skip DOM entirely
  const div = document.createElement('div');
  div.innerHTML = text;
  const stripped = (div.innerText || div.textContent || '');
  return stripped
    .replace(/\n{3,}/g, '\n\n')   // collapse 3+ blank lines → 2
    .replace(/[ \t]{2,}/g, ' ')   // collapse multiple spaces/tabs → 1
    .trim();
};

// Converts a raw error string into a short, plain-English summary.
const getErrorSummary = (err: string, provider: LLMProvider = 'gemini'): string => {
  if (err.includes('429') || err.includes('RESOURCE_EXHAUSTED') || err.includes('quota') || err.includes('rate_limit') || err.includes('insufficient_quota')) {
    if (provider === 'openai') {
      return 'OpenAI API quota or rate limit exceeded. Please wait a moment and try again, or check your usage at platform.openai.com/usage.';
    }
    return 'Gemini API quota exceeded. Your daily or per-minute limit has been reached. Please wait a few minutes and try again, or check your usage at ai.dev/rate-limit.';
  }
  if (err.includes('401') || err.includes('403') || err.includes('API key') || err.includes('api_key') || err.includes('invalid_api_key')) {
    return `Invalid or missing API key. Please check your ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API key in the setup panel above.`;
  }
  if (err.includes('Failed to fetch') || err.includes('NetworkError') || err.includes('network')) {
    return 'Network error. Please check your internet connection and try again.';
  }
  if (err.includes('timeout') || err.includes('DEADLINE_EXCEEDED')) {
    return 'The request timed out. The document may be too large — try reducing its size and try again.';
  }
  if (err.includes('INVALID_ARGUMENT') || err.includes('invalid')) {
    return 'Invalid request. There may be an issue with the document format or content.';
  }
  return 'An unexpected error occurred. See the details below for more information.';
};

const App: React.FC = () => {
  const [clos, setClos] = useState('');
  const [plos, setPlos] = useState('');
  const [ulos, setUlos] = useState('');
  const [objectiveLocation, setObjectiveLocation] = useState('E.g. #1: This design document contains module objectives under section headers titled Module Introduction. \n\nOR E.g. #2: This design document does not contain module objectives');
  const [exclusions, setExclusions] = useState('Instructor Resources, Student Resources, and Getting Started modules. Also exclude any unpublished course content.');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [documentContent, setDocumentContent] = useState('');
  const [contextType, setContextType] = useState('Undergraduate');
  const [customContext, setCustomContext] = useState('');
  const [courseInfo, setCourseInfo] = useState('');
  const [courseLength, setCourseLength] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DesignMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUseCasesOpen, setIsUseCasesOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(
    !localStorage.getItem('gemini_api_key') && !localStorage.getItem('openai_api_key')
  );
  const [isDisclaimerChecked, setIsDisclaimerChecked] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [openaiKeyError, setOpenaiKeyError] = useState<string | null>(null);
  const [geminiKeyError, setGeminiKeyError] = useState<string | null>(null);
  const [selectedLLM, setSelectedLLM] = useState<LLMProvider>(() => {
    const stored = localStorage.getItem('selected_llm') as LLMProvider | null;
    if (stored === 'gemini' || stored === 'openai') return stored;
    // Default: openai if only openai key is present, otherwise gemini
    return localStorage.getItem('openai_api_key') && !localStorage.getItem('gemini_api_key') ? 'openai' : 'gemini';
  });
  const [modelConfig, setModelConfig] = useState<StoredModelConfig | null>(() => {
    const stored = localStorage.getItem('model_config');
    return stored ? JSON.parse(stored) : null;
  });
  const [availableModels, setAvailableModels] = useState<string[]>(() => {
    const stored = localStorage.getItem('available_models');
    return stored ? JSON.parse(stored) : [];
  });
  const [isDetecting, setIsDetecting] = useState(false);
  const [user, setUser] = useState<{ access_token: string; expires_at?: number } | null>(null);
  const [reportType, setReportType] = useState<'full' | 'partial'>('full');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [errorCopied, setErrorCopied] = useState(false);

  // Restore Google session on mount via Firebase auth state.
  // We use an `initialized` flag to avoid the race where Firebase fires
  // onAuthStateChanged with null *before* it has re-hydrated the session from
  // IndexedDB, which would wipe a perfectly valid stored access token.
  useEffect(() => {
    let initialized = false;
    const unsubscribe = onAuthStateChanged((firebaseUser) => {
      if (firebaseUser) {
        // Firebase confirmed the user is still signed in — restore access token.
        const stored = getStoredAccessToken();
        if (stored) {
          setUser({ access_token: stored.accessToken, expires_at: stored.expiresAt });
        }
      } else if (initialized) {
        // Firebase confirmed a real sign-out (not just the initial loading state).
        setUser(null);
      }
      initialized = true;
    });
    return unsubscribe;
  }, []);

  // ── Model display helpers ────────────────────────────────────────────────────
  const getModelLabel = (model: string): string => {
    const labels = selectedLLM === 'openai' ? OPENAI_MODEL_LABELS : GEMINI_MODEL_LABELS;
    return labels[model] || model;
  };

  const getModelTier = (model: string): 'low' | 'mid' | 'high' => {
    const tiers = selectedLLM === 'openai' ? OPENAI_MODEL_TIERS : GEMINI_MODEL_TIERS;
    return tiers[model] || 'low';
  };

  const isLowTierWarning = (stepKey: string, model: string): boolean => {
    const tier = getModelTier(model);
    if (stepKey === 'step2') return tier === 'low';
    if (stepKey === 'step3') return tier === 'low' || tier === 'mid';
    return false;
  };

  // ── Key detection ────────────────────────────────────────────────────────────
  const handleValidateKey = async (provider: LLMProvider, key: string) => {
    setIsDetecting(true);
    if (provider === 'gemini') setGeminiKeyError(null);
    else setOpenaiKeyError(null);
    try {
      let detected;
      if (provider === 'gemini') {
        detected = await detectGeminiModels(key);
        if (!detected.valid) { setGeminiKeyError('Invalid Gemini API key. Please check and try again.'); return; }
        setApiKey(key);
        localStorage.setItem('gemini_api_key', key);
        setGeminiKeyInput('');
        if (selectedLLM === 'gemini' || !openaiKey) {
          setSelectedLLM('gemini');
          localStorage.setItem('selected_llm', 'gemini');
          setAvailableModels(detected.availableModels);
          setModelConfig(detected.recommended);
          localStorage.setItem('available_models', JSON.stringify(detected.availableModels));
          localStorage.setItem('model_config', JSON.stringify(detected.recommended));
        }
      } else {
        detected = await detectOpenAIModels(key);
        if (!detected.valid) { setOpenaiKeyError('Key validation failed. Check that your key is correct and your OpenAI account has billing set up.'); return; }
        setOpenaiKey(key);
        localStorage.setItem('openai_api_key', key);
        setOpenaiKeyInput('');
        setOpenaiKeyError(null);
        if (selectedLLM === 'openai' || !apiKey) {
          setSelectedLLM('openai');
          localStorage.setItem('selected_llm', 'openai');
          setAvailableModels(detected.availableModels);
          setModelConfig(detected.recommended);
          localStorage.setItem('available_models', JSON.stringify(detected.availableModels));
          localStorage.setItem('model_config', JSON.stringify(detected.recommended));
        }
      }
    } catch (err: any) {
      if (provider === 'gemini') setGeminiKeyError(`Validation error: ${err.message}`);
      else setOpenaiKeyError(`Validation error: ${err.message}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSelectLLM = (provider: LLMProvider) => {
    setSelectedLLM(provider);
    localStorage.setItem('selected_llm', provider);
    // Re-detect to get fresh model list for selected provider
    const key = provider === 'openai' ? openaiKey : apiKey;
    if (key) handleValidateKey(provider, key);
  };

  const updateModelConfig = (stepKey: string, model: string) => {
    const updated = { ...(modelConfig ?? { step1: '', step2: '', step3: '', fallback: '' }), [stepKey]: model };
    setModelConfig(updated);
    localStorage.setItem('model_config', JSON.stringify(updated));
  };

  const handleLogin = async () => {
    try {
      const result = await initiateGoogleSignIn();
      setUser({ access_token: result.accessToken, expires_at: result.expiresAt });
    } catch (err: any) {
      // Ignore popup-closed / cancelled errors
      const code = err?.code || '';
      if (!code.includes('cancelled') && !code.includes('popup-closed')) {
        setError(`Google sign-in failed: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const handleLogout = async () => {
    await signOutFromGoogle();
    setUser(null);
  };

  const handleDrivePicker = () => {
    if (!user?.access_token) {
      handleLogin();
      return;
    }

    const pickerApiKey = (import.meta as any).env.VITE_GOOGLE_PICKER_API_KEY;
    if (!pickerApiKey) {
      setError('Google Picker API key is not configured. Please contact the app administrator.');
      return;
    }

    const gapiLib = (window as any).gapi;
    const googleLib = (window as any).google;
    if (!gapiLib) {
      setError('Google API not loaded. Please refresh the page.');
      return;
    }

    gapiLib.load('picker', {
      callback: () => {
        if (!googleLib?.picker) {
          setError('Google Picker failed to load. Please refresh and try again.');
          return;
        }

        const SUPPORTED_MIME_TYPES = [
          'application/vnd.google-apps.document',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/pdf',
          'text/plain',
        ].join(',');

        const myDriveView = new googleLib.picker.DocsView()
          .setIncludeFolders(false)
          .setMimeTypes(SUPPORTED_MIME_TYPES);

        const sharedView = new googleLib.picker.DocsView()
          .setOwnedByMe(false)
          .setIncludeFolders(false)
          .setMimeTypes(SUPPORTED_MIME_TYPES);

        const picker = new googleLib.picker.PickerBuilder()
          .addView(new googleLib.picker.View(googleLib.picker.ViewId.RECENTLY_PICKED))
          .addView(myDriveView)
          .addView(sharedView)
          .setOAuthToken(user.access_token)
          .setDeveloperKey(pickerApiKey)
          .setOrigin(window.location.protocol + '//' + window.location.host)
          .setCallback(async (data: any) => {
            if (data.action !== googleLib.picker.Action.PICKED) return;
            const doc = data.docs[0];
            setIsParsing(true);
            setError(null);
            try {
              let text = '';
              if (doc.mimeType === 'application/vnd.google-apps.document') {
                // Google Doc: use export API (alt=media returns raw bytes for native Docs)
                const res = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${doc.id}/export?mimeType=text/plain`,
                  { headers: { Authorization: `Bearer ${user.access_token}` } }
                );
                if (!res.ok) throw new Error(`Failed to download Google Doc (HTTP ${res.status})`);
                text = await res.text();
              } else if (doc.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                // Word .docx: download as binary, extract with mammoth
                const res = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                  { headers: { Authorization: `Bearer ${user.access_token}` } }
                );
                if (!res.ok) throw new Error(`Failed to download file (HTTP ${res.status})`);
                const arrayBuffer = await res.arrayBuffer();
                const extracted = await mammoth.extractRawText({ arrayBuffer });
                text = extracted.value;
              } else if (doc.mimeType === 'application/pdf') {
                // PDF: download as binary, extract with PDF.js
                const res = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                  { headers: { Authorization: `Bearer ${user.access_token}` } }
                );
                if (!res.ok) throw new Error(`Failed to download PDF (HTTP ${res.status})`);
                const arrayBuffer = await res.arrayBuffer();
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                  const page = await pdf.getPage(i);
                  const textContent = await page.getTextContent();
                  fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
                }
                text = fullText;
              } else {
                // Plain text or other
                const res = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
                  { headers: { Authorization: `Bearer ${user.access_token}` } }
                );
                if (!res.ok) throw new Error(`Failed to download file (HTTP ${res.status})`);
                text = await res.text();
              }
              setDocumentContent(stripHtml(text).slice(0, MAX_CHARS));
            } catch (err: any) {
              setError(err.message || 'Failed to download file from Google Drive.');
            } finally {
              setIsParsing(false);
            }
          })
          .build();

        picker.setVisible(true);
      },
      onerror: () => {
        setError('Failed to load Google Picker. Please refresh and try again.');
      },
    });
  };

  // Auto-fill logic when document content changes significantly
  useEffect(() => {
    const triggerAutoFill = async () => {
      if (documentContent.length > 500 && !isAutoFilling && !result) {
        setIsAutoFilling(true);
        try {
          const analysis = await analyzeCourseDocumentWithProvider(documentContent, apiKey, openaiKey, selectedLLM, modelConfig ?? undefined);
          if (analysis.courseContext) setContextType(analysis.courseContext);
          if (analysis.courseInfo) setCourseInfo(analysis.courseInfo);
          if (analysis.courseLength) setCourseLength(analysis.courseLength);
          if (analysis.clos) setClos(analysis.clos);
          if (analysis.plos) setPlos(analysis.plos);
          if (analysis.ulos) setUlos(analysis.ulos);
          if (analysis.objectiveLocation) setObjectiveLocation(analysis.objectiveLocation);
        } catch (err) {
          console.warn('Auto-fill analysis failed silently', err);
        } finally {
          setIsAutoFilling(false);
        }
      }
    };

    const timer = setTimeout(() => {
      if (documentContent.length > 500) {
        triggerAutoFill();
      }
    }, 2000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentContent, apiKey, openaiKey, selectedLLM, result]);

  const handleGenerate = async (type: 'full' | 'partial' = 'full') => {
    if (!clos.trim() || !documentContent.trim()) {
      setError('Please provide both Course Learning Objectives and the Design Document content.');
      return;
    }

    const finalContext = contextType === 'Other' ? customContext : contextType;
    if (contextType === 'Other' && !customContext.trim()) {
      setError('Please specify the custom course context.');
      return;
    }

    setReportType(type);
    setIsLoading(true);
    setError(null);
    setShowErrorDetails(false);
    const cleanedContent = stripHtml(documentContent);
    const activeKey = selectedLLM === 'openai' ? openaiKey : apiKey;
    try {
      const data = await generateDesignMapWithProvider(
        { clos, documentContent: cleanedContent, courseContext: finalContext, courseLength, plos, ulos, exclusions, objectiveLocation, courseInfo, additionalInfo },
        selectedLLM,
        activeKey,
        modelConfig ?? undefined
      );
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate design map. Please check your API key and input.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);

    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setDocumentContent(stripHtml(fullText).slice(0, MAX_CHARS));
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setDocumentContent(stripHtml(result.value).slice(0, MAX_CHARS));
      } else {
        const text = await file.text();
        setDocumentContent(stripHtml(text).slice(0, MAX_CHARS));
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setError('Failed to extract text from the file. Please try pasting the content directly.');
    } finally {
      setIsParsing(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <MappingResult data={result} onReset={() => setResult(null)} reportType={reportType} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {isLoading && <LoadingOverlay reportType={reportType} />}

      <header className="bg-[#0033A0] text-white pt-12 pb-14 px-4 relative shadow-md overflow-hidden">
        <div className="max-w-7xl mx-auto relative flex flex-col items-center">
          <div className="text-center w-full max-w-4xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              The eCampus Course Alignment Assistant
            </h1>
          </div>
          <div className="md:absolute md:right-0 md:bottom-0 mt-8 md:mt-0 text-xs md:text-sm font-black tracking-[0.2em] uppercase shrink-0 pb-1 opacity-90 text-center md:text-right">
            BOISE STATE ID TOOLKIT
          </div>
        </div>
      </header>

      {/* White Ribbon Bar */}
      <div className="bg-white border-b border-gray-200 py-3 px-8 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-gray-600 uppercase tracking-widest">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Course Alignment Report Generator
          </div>

          {/* Help Center Dropdown in Ribbon */}
          <div className="relative">
            <button
              onClick={() => setIsHelpOpen(!isHelpOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all font-bold text-sm border border-gray-200 active:scale-95"
            >
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>Help Center & More</span>
            </button>

            {/* Dropdown Menu */}
            {isHelpOpen && (
              <div className="absolute right-0 mt-1 w-[28rem] bg-white border border-slate-200 rounded-xl shadow-lg z-50 animate-in slide-in-from-top-2 duration-200 max-h-[85vh] overflow-y-auto">
                <div className="p-5 flex flex-col gap-6">

                  {/* AI Setup */}
                  <section>
                    <h3 className="text-xs font-black text-gray-600 uppercase tracking-[0.2em] mb-3">AI Setup</h3>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-2">
                      <p className="text-sm font-black text-gray-900">How To Get a Gemini API Key</p>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                        <li>Go to <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a>.</li>
                        <li>Sign in with your Google or SSO account, such as your Boise State University email.</li>
                        <li>
                          Create the key:
                          <ol className="list-[lower-alpha] list-inside space-y-1 mt-1 ml-4">
                            <li>Click <span className="font-bold">"Get API key"</span> on the left.</li>
                            <li>Click the <span className="font-bold">"Create API key"</span> button.</li>
                          </ol>
                        </li>
                        <li>Copy the string of letters and numbers that appears.</li>
                        <li>Paste it into the <span className="font-bold">Gemini API Key</span> field in the setup panel above.</li>
                      </ol>
                      <p className="text-xs text-gray-600">
                        Source:{' '}
                        <a href="https://docs.google.com/document/d/1Ce1gOTozOD3TGd8ntPz3oEWJjU-Y07K2akuIJHXnzHk/edit?tab=t.0#heading=h.xaazhwt982j4" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          What a Gemini API Key Is, and How and Why to Get One
                        </a>
                      </p>
                    </div>
                  </section>

                  {/* Resources & Training */}
                  <section>
                    <h3 className="text-xs font-black text-gray-600 uppercase tracking-[0.2em] mb-3">Resources & Training</h3>
                    <div className="flex flex-col gap-2">
                      <a href="https://docs.google.com/document/d/1g4WLYmFsdiXvBi0LPZPCMgv6SwnhTBxzh7dLmMt0O40/edit?tab=t.0" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl transition-all group">
                        <span className="text-sm font-bold text-gray-800 group-hover:text-blue-700">How to use this app</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                      <a href="https://drive.google.com/drive/folders/1FReC8oz-JKMDiI1HNwqKcFMfDektxsAw" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl transition-all group">
                        <span className="text-sm font-bold text-gray-800 group-hover:text-blue-700">Training Documents</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                      <a href="https://boisestateecampus.atlassian.net/wiki/spaces/EKB/pages/3503652868/The+eCampus+Content+Export+Tool+Canvas+to+Google+Doc" target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl transition-all group">
                        <span className="text-sm font-bold text-gray-800 group-hover:text-blue-700">Companion App</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                  </section>

                  {/* App Suggestions */}
                  <section>
                    <h3 className="text-xs font-black text-gray-600 uppercase tracking-[0.2em] mb-3">Find bugs? Have improvement requests?</h3>
                    <a href="https://docs.google.com/document/d/1GPIXFfo81JDEQQVh9m16iYgKK9vi9-ietIXzAYP6CVU/edit?usp=drivesdk" target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-xl transition-all group">
                      <span className="text-sm font-bold text-gray-800 group-hover:text-blue-700">App Suggestions Document</span>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                  </section>

                  {/* AI Models Used */}
                  <section>
                    <h3 className="text-xs font-black text-gray-600 uppercase tracking-[0.2em] mb-3">AI Models Used</h3>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                      <ul className="space-y-1.5 text-sm text-gray-600">
                        <li><span className="font-semibold text-gray-700">Document extraction:</span> gemini-3.1-flash-lite-preview</li>
                        <li><span className="font-semibold text-gray-700">MLO & QM feedback:</span> gemini-3.1-flash-lite-preview</li>
                        <li><span className="font-semibold text-gray-700">Alignment analysis:</span> gemini-3.1-flash-lite-preview</li>
                      </ul>
                    </div>
                  </section>

                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 mt-10">

        {/* Instruction Box */}
        <div className="mb-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <h2 className="text-2xl font-bold text-[#0033A0] mb-4">About This App</h2>
          <p className="text-xl font-medium text-slate-700">
            Fill out the form below to generate an objective alignment report for a specific course. The report will be based on Boise State University's QM+ Standards.
          </p>
        </div>

        {/* Initial Setup Panel */}
        <div className="mb-8 rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
          <button
            onClick={() => setIsSetupOpen(!isSetupOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#0033a0] text-white hover:bg-[#002580] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow flex-shrink-0">
                <Settings2 className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-black text-white text-lg">Initial Setup</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Status dots */}
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-400' : 'bg-white/30'}`} title={apiKey ? 'Gemini key active' : 'No Gemini key'} />
                <span className={`w-2 h-2 rounded-full ${openaiKey ? 'bg-green-400' : 'bg-white/30'}`} title={openaiKey ? 'OpenAI key active' : 'No OpenAI key'} />
                <span className={`w-2 h-2 rounded-full ${user ? 'bg-green-400' : 'bg-white/30'}`} title={user ? 'Google signed in' : 'Not signed in'} />
              </div>
              <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isSetupOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isSetupOpen && (
            <div className="bg-blue-50 p-5 grid grid-cols-1 gap-4">

              {/* Disclaimer Card */}
              <div className="bg-white border border-blue-200 rounded-xl p-5 shadow-sm space-y-3">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0 text-[#0033A0] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  <div className="flex-1">
                    <h3 className="font-bold text-[#0033A0] text-sm mb-2">Disclaimer: Alignment Needs To Be Verified</h3>
                    <div className="text-black text-xs leading-relaxed space-y-2">
                      <p>Treat the AI-generated report as a draft, not a final product. Course design maps and other types of alignment documents are usually the result of collaboration between an instructional design consultant and a faculty developer. This process is not meant to replace that; instead it should serve as a first draft or a next-best option.</p>
                      <p>After getting the draft design map, carefully check it yourself against the course content, use your best judgement to make edits, and then verify the alignment with the Faculty Developer (FD), Instructor of Record (IoR), or whomever has the qualifications or authority to approve the accuracy of the draft map.</p>
                      <p className="font-extrabold">Again, treat the AI-generated report as a draft, not a final product.</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none mt-3 pt-3 border-t border-blue-100">
                      <input
                        type="checkbox"
                        checked={isDisclaimerChecked}
                        onChange={(e) => setIsDisclaimerChecked(e.target.checked)}
                        className="w-4 h-4 accent-blue-600 cursor-pointer rounded"
                      />
                      <span className="text-xs font-bold text-[#0033A0]">I understand and agree — show me the form</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* API Keys Group */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

              {/* Gemini API Key Card */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#0033A0]" />
                  <h3 className="font-bold text-[#0033A0] text-base">Gemini API Key</h3>
                </div>
                {apiKey ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-semibold text-green-700">API key active</span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
                    </p>
                    <button
                      onClick={() => {
                        setApiKey('');
                        localStorage.removeItem('gemini_api_key');
                        if (selectedLLM === 'gemini') { setModelConfig(null); setAvailableModels([]); localStorage.removeItem('model_config'); localStorage.removeItem('available_models'); }
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Remove Key
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={geminiKeyInput}
                      onChange={(e) => setGeminiKeyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && geminiKeyInput.trim()) handleValidateKey('gemini', geminiKeyInput.trim()); }}
                      placeholder="Enter your Gemini API key..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (geminiKeyInput.trim()) handleValidateKey('gemini', geminiKeyInput.trim()); }}
                        disabled={!geminiKeyInput.trim() || isDetecting}
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                      >
                        {isDetecting ? 'Validating...' : 'Validate & Save'}
                      </button>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                        Get a free key ↗
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* OR divider */}
              <div className="flex items-center bg-blue-50 border-t border-b border-slate-200 px-5 py-2.5">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-4 text-xs font-bold text-slate-400 uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* OpenAI API Key Card */}
              <div className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-[#0033A0]" />
                  <h3 className="font-bold text-[#0033A0] text-base">ChatGPT API Key <span className="text-xs font-normal text-slate-600">(Optional)</span></h3>
                </div>
                {openaiKey ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-semibold text-green-700">API key active</span>
                    </div>
                    <p className="text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      {openaiKey.slice(0, 8)}...{openaiKey.slice(-4)}
                    </p>
                    <button
                      onClick={() => {
                        setOpenaiKey('');
                        localStorage.removeItem('openai_api_key');
                        if (selectedLLM === 'openai') {
                          setSelectedLLM('gemini');
                          localStorage.setItem('selected_llm', 'gemini');
                          setModelConfig(null); setAvailableModels([]);
                          localStorage.removeItem('model_config'); localStorage.removeItem('available_models');
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Remove Key
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="password"
                      value={openaiKeyInput}
                      onChange={(e) => setOpenaiKeyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && openaiKeyInput.trim()) handleValidateKey('openai', openaiKeyInput.trim()); }}
                      placeholder="Enter your OpenAI API key..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (openaiKeyInput.trim()) handleValidateKey('openai', openaiKeyInput.trim()); }}
                        disabled={!openaiKeyInput.trim() || isDetecting}
                        className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                      >
                        {isDetecting ? 'Validating...' : 'Validate & Save'}
                      </button>
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                        Get a key ↗
                      </a>
                    </div>
                    {openaiKeyError && (
                      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1">
                        <span className="text-red-500 text-sm mt-0.5">⚠</span>
                        <p className="text-sm text-red-700">{openaiKeyError}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>{/* end API Keys Group */}

              {/* LLM Selector — shown when both keys are present */}
              {apiKey && openaiKey && (
                <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-3 shadow-sm">
                  <h3 className="font-bold text-[#0033A0] text-base">Which AI would you like to use?</h3>
                  <div className="flex gap-3">
                    {[
                      { value: 'gemini' as LLMProvider, label: 'Google Gemini' },
                      { value: 'openai' as LLMProvider, label: 'ChatGPT (OpenAI)' },
                    ].map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => handleSelectLLM(value)}
                        className={`flex-1 py-2.5 px-4 rounded-lg border-2 text-sm font-bold transition-all ${
                          selectedLLM === value
                            ? 'border-[#0033A0] bg-blue-50 text-[#0033A0]'
                            : 'border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Model Assignment Panel — shown after key validation */}
              {isDetecting && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex items-center gap-3 text-sm font-semibold text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  Validating key and detecting available models...
                </div>
              )}
              {!isDetecting && modelConfig && availableModels.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  {/* Collapsible header */}
                  <button
                    onClick={() => setIsModelConfigOpen(!isModelConfigOpen)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <h3 className="font-bold text-[#0033A0] text-base">AI Model Configuration</h3>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Using {getModelLabel(modelConfig.step3)} for alignment analysis
                          {isLowTierWarning('step3', modelConfig.step3) && <span className="ml-1">⚠️</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-blue-600 font-medium">{isModelConfigOpen ? 'Hide' : 'Customize'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isModelConfigOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expandable content */}
                  {isModelConfigOpen && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-xs text-slate-600">⭐ = recommended for this step. ⚠️ = lower-tier model may reduce quality.</p>
                        <button
                          onClick={() => { const key = selectedLLM === 'openai' ? openaiKey : apiKey; if (key) handleValidateKey(selectedLLM, key); }}
                          className="text-xs text-blue-600 hover:underline font-medium shrink-0 ml-4"
                        >
                          Re-detect models
                        </button>
                      </div>
                      <div className="space-y-3">
                        {([
                          { key: 'step1', label: 'Step 1: Document Extraction', task: 'Reads and structures the design document' },
                          { key: 'step2', label: 'Step 2: MLO Generation', task: 'Extracts or generates module learning objectives' },
                          { key: 'step3', label: 'Step 3: Alignment Analysis', task: 'Creates full alignment mappings and report' },
                          { key: 'fallback', label: 'Fallback', task: 'Used if Step 3 fails due to quota' },
                        ] as const).map(({ key, label, task }) => {
                          const currentModel = (modelConfig as any)[key] as string;
                          const defaultModel = currentModel;
                          const warning = isLowTierWarning(key, currentModel);
                          return (
                            <div key={key} className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-700">{label}</p>
                                <p className="text-xs text-slate-600">{task}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <select
                                  value={currentModel}
                                  onChange={(e) => updateModelConfig(key, e.target.value)}
                                  className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none bg-white font-medium"
                                >
                                  {availableModels.map(m => (
                                    <option key={m} value={m}>
                                      {getModelLabel(m)}{m === defaultModel ? ' ⭐' : ''}
                                    </option>
                                  ))}
                                </select>
                                {warning && <span title="Lower-tier model selected — results may be less detailed for this step" className="text-amber-500 text-base">⚠️</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Google Sign In Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 shadow-sm">
                <h3 className="font-bold text-[#0033A0] text-base">Optional</h3>
                <p className="text-sm text-slate-600">Log in to load design documents directly from Google Drive. Otherwise, upload a file or paste content manually.</p>
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                      <span className="text-sm font-semibold text-green-700">Signed in to Google</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="flex items-center gap-2 px-5 py-2.5 border-2 border-slate-200 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-all shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign In
                  </button>
                )}
              </div>

            </div>
          )}
        </div>


        {!isDisclaimerChecked && (
          <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl text-black text-base font-medium flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Please read and acknowledge the <span className="font-bold">Disclaimer</span> above to unlock the form.
          </div>
        )}

        {isDisclaimerChecked && <div className="bg-white rounded-2xl shadow-xl p-10 border border-slate-200">
          <div className="space-y-12">
            {/* Essentials Section */}
            <section className="space-y-8">
              <h3 className="text-3xl font-extrabold text-[#0033A0] border-b-2 border-blue-100 pb-4">Essentials</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-4 space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase mb-3 tracking-wider">1. Course Context</label>
                    <select value={contextType} onChange={(e) => setContextType(e.target.value)} className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white mb-3 text-lg">
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Master's">Master's</option>
                      <option value="Doctoral">Doctoral</option>
                      <option value="Professional Development">Professional Development</option>
                      <option value="Other">Other</option>
                    </select>
                    {contextType === 'Other' && (
                      <input type="text" value={customContext} onChange={(e) => setCustomContext(e.target.value)} placeholder="Please specify context..." className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white animate-in slide-in-from-top-2 text-lg" />
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">2. Design Document Content <span className="text-red-500">*</span></label>
                    <div className="flex items-center gap-3">
                      {isParsing && <div className="flex items-center gap-2 text-xs font-medium text-blue-600 animate-pulse"><div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>Parsing...</div>}
                      <input type="file" id="file-upload" className="hidden" accept=".txt,.md,.docx,.pdf" onChange={handleFileUpload} />
                      <label htmlFor="file-upload" className="text-xs font-bold text-blue-600 cursor-pointer hover:bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 transition-all flex items-center gap-2 shadow-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        Upload
                      </label>
                      <button 
                        onClick={handleDrivePicker}
                        className="text-xs font-bold text-blue-600 cursor-pointer hover:bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 transition-all flex items-center gap-2 shadow-sm"
                      >
                        <svg className="w-4 h-4" viewBox="0 -960 960 960" fill="currentColor"><path d="M220-100q-17 0-34.5-10.5T160-135L60-310q-8-14-8-34.5t8-34.5l260-446q8-14 25.5-24.5T380-860h200q17 0 34.5 10.5T640-825l182 312q-23-6-47.5-8t-48.5 2L574-780H386L132-344l94 164h316q11 23 25.5 43t33.5 37H220Zm70-180-29-51 183-319h72l101 176q-17 13-31.5 28.5T560-413l-80-139-110 192h164q-7 19-10.5 39t-3.5 41H290Zm430 160v-120H600v-80h120v-120h80v120h120v80H800v120h-80Z"/></svg>
                        Drive
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={documentContent} 
                      onChange={(e) => setDocumentContent(e.target.value)} 
                      maxLength={MAX_CHARS}
                      placeholder="Paste content or upload file... AI will automatically detect course details." 
                      className="w-full h-80 px-6 py-5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-slate-50 resize-none font-mono text-base leading-relaxed" 
                    />
                    <div className="absolute bottom-4 right-6 text-xs font-bold text-slate-400 bg-slate-50/80 px-2 py-1 rounded">
                      {documentContent.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Auto-fill notification */}
            {isAutoFilling && (
              <div className="flex items-center gap-4 bg-[#0033A0] text-white px-6 py-4 rounded-xl shadow-md animate-pulse">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></div>
                <div>
                  <p className="font-bold text-sm">Auto-filling form fields…</p>
                  <p className="text-xs text-blue-200 mt-0.5">The AI is reading your document and populating the form below. This will only take a moment.</p>
                </div>
              </div>
            )}

            {/* Course Details Section */}
            <section className="space-y-8">
              <div className="space-y-2">
                <h3 className="text-3xl font-extrabold text-[#0033A0] border-b-2 border-blue-100 pb-4">Course Details</h3>
                <p className="text-lg text-slate-600">
                  This app will fill in the following information based on an analysis of your design document. Read the details in each section carefully and make any necessary edits before generating the Alignment Report.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase mb-3 tracking-wider">3. Course Dept, ###, & Title</label>
                    <input type="text" value={courseInfo} onChange={(e) => setCourseInfo(e.target.value)} placeholder="e.g. MATH 108: Intermediate Algebra" className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase mb-3 tracking-wider">4. Course Length</label>
                    <input type="text" value={courseLength} onChange={(e) => setCourseLength(e.target.value)} placeholder="e.g. 7 weeks, 15 weeks" className="w-full px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3 tracking-wider">5. COURSE LEARNING OBJECTIVES (CLOs) <span className="text-red-500">*</span></label>
                    <textarea value={clos} onChange={(e) => setClos(e.target.value)} placeholder="Paste your course-level learning objectives here..." className="w-full h-48 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white resize-none font-mono text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3 tracking-wider">6. PROGRAM LEARNING OBJECTIVES (PLOs) [OPTIONAL]</label>
                    <textarea value={plos} onChange={(e) => setPlos(e.target.value)} placeholder="Paste PLOs..." className="w-full h-48 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white resize-none text-lg" />
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-3 tracking-wider">7. UNIVERSITY LEARNING OBJECTIVES (ULOs) [OPTIONAL]</label>
                    <textarea value={ulos} onChange={(e) => setUlos(e.target.value)} placeholder="Paste ULOs..." className="w-full h-48 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white resize-none text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase mb-3 tracking-wider">8. Where are module objectives (MLOs) located?</label>
                    <textarea value={objectiveLocation} onChange={(e) => setObjectiveLocation(e.target.value)} placeholder="e.g. Describe location..." className="w-full h-28 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white text-lg italic text-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase mb-3 tracking-wider">9. Exclude content from the following:</label>
                    <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} placeholder="e.g. Instructor Resources..." className="w-full h-28 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white text-lg italic text-slate-600" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 uppercase mb-3 tracking-wider">10. Add other relevant info: [Optional]</label>
                    <textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} placeholder="e.g. Specific focus..." className="w-full h-28 px-5 py-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 transition-all outline-none bg-white text-lg italic text-slate-600" />
                  </div>
                </div>
              </div>
            </section>
          </div>
          {error && (
            <div className="mt-10 bg-red-50 border border-red-200 rounded-xl overflow-hidden">
              {/* Summary row */}
              <div className="p-5 flex items-start gap-4">
                <svg className="w-6 h-6 shrink-0 text-red-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-red-800 font-medium text-base flex-1">{getErrorSummary(error, selectedLLM)}</p>
              </div>
              {/* Action bar */}
              <div className="px-5 pb-4 flex items-center gap-3">
                <button
                  onClick={() => setShowErrorDetails(v => !v)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  <svg className={`w-4 h-4 transition-transform duration-200 ${showErrorDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                  {showErrorDetails ? 'Hide details' : 'Show details'}
                </button>
                <span className="text-red-300">|</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(error);
                    setErrorCopied(true);
                    setTimeout(() => setErrorCopied(false), 2000);
                  }}
                  className="flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
                  </svg>
                  {errorCopied ? 'Copied!' : 'Copy error'}
                </button>
              </div>
              {/* Collapsible full error */}
              {showErrorDetails && (
                <div className="border-t border-red-200 px-5 py-4">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2">Full error details</p>
                  <pre className="text-xs text-red-700 whitespace-pre-wrap break-all font-mono bg-red-100 rounded-lg p-3 max-h-48 overflow-y-auto">{error}</pre>
                </div>
              )}
            </div>
          )}
          <div className="mt-14 flex flex-col items-center gap-4">
            <button onClick={() => handleGenerate('partial')} disabled={isLoading || isParsing} className="group relative w-full md:w-auto px-20 py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50">
              <div className="flex items-center justify-center gap-4"><span className="text-2xl">Generate Complete List of Objectives</span><svg className="w-8 h-8 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg></div>
            </button>
            <button onClick={() => handleGenerate('full')} disabled={isLoading || isParsing} className="group relative w-full md:w-auto px-24 py-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50">
              <div className="flex items-center justify-center gap-4"><span className="text-2xl">Generate Full Alignment Report</span><svg className="w-8 h-8 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg></div>
            </button>
            <p className="mt-6 text-slate-500 text-sm text-center italic max-w-lg">AI maps content using Bloom's Taxonomy and Backward Design principles based on QM+ standards.</p>
          </div>
        </div>}
      </main>
    </div>
  );
};

export default App;
