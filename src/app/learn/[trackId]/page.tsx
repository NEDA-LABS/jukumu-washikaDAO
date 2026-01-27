'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  SparklesIcon,
  PlayCircleIcon,
  CheckCircleIcon,
  LockClosedIcon,
  ChatBubbleLeftRightIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline';
import Toast from '@/components/Toast';

export default function LearningTrackPage({ params }: { params: Promise<{ trackId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [language, setLanguage] = useState<'sw' | 'en'>('en');
  const [aiMessage, setAiMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'ai'; message: string }>>([]);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPlan, setAiPlan] = useState<{ title: string; steps: Array<{ title: string; description: string }> } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleData, setModuleData] = useState<any | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setModuleData(null);
      setLessons([]);
      try {
        const id = resolvedParams.trackId;
        const res = await fetch(`/api/public/training/${encodeURIComponent(id)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load training');
        if (cancelled) return;
        setModuleData(data?.module || null);
        setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load training');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedParams.trackId]);

  const filteredLessons = lessons.filter((l) => (l.language || 'sw') === language);

  const callLearningAI = async (payload: { message: string; action: 'chat' | 'tip' | 'goal' | 'plan' | 'progress' }) => {
    setAiLoading(true);

    const requestBody = {
      language,
      moduleId: resolvedParams.trackId,
      moduleTitle: moduleData?.title,
      moduleDescription: moduleData?.description,
      lessons: filteredLessons.map((l) => ({
        id: l.id,
        title: l.title,
        preview: l.preview,
        duration_minutes: l.duration_minutes,
        lesson_type: l.lesson_type,
        language: l.language
      })),
      message: payload.message,
      history: chatHistory.slice(-20),
      action: payload.action
    };

    try {
      // Plan stays JSON (structured)
      if (payload.action === 'plan') {
        const res = await fetch('/api/ai/learning', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            setToast({
              message: language === 'en' ? 'Please log in to continue.' : 'Tafadhali ingia ili kuendelea.',
              type: 'info'
            });
            return;
          }
          throw new Error(data?.error || 'AI request failed');
        }

        const reply = typeof data?.reply === 'string' ? data.reply : '';
        const plan = data?.plan && typeof data.plan === 'object' ? data.plan : null;

        if (reply) setChatHistory((prev) => [...prev, { role: 'ai', message: reply }]);
        if (plan) setAiPlan(plan);
        return;
      }

      // Stream response for chat/tip/goal/progress
      setChatHistory((prev) => [...prev, { role: 'ai', message: '' }]);

      const res = await fetch('/api/ai/learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!res.ok) {
        if (res.status === 401) {
          setToast({
            message: language === 'en' ? 'Please log in to continue.' : 'Tafadhali ingia ili kuendelea.',
            type: 'info'
          });
          return;
        }
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'AI request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');
      const decoder = new TextDecoder('utf-8');
      let buf = '';

      const appendDelta = (delta: string) => {
        setChatHistory((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].role === 'ai') {
              next[i] = { ...next[i], message: (next[i].message || '') + delta };
              break;
            }
          }
          return next;
        });
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const chunks = buf.split('\n\n');
        buf = chunks.pop() || '';

        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice('data:'.length).trim();
          try {
            const evt = JSON.parse(jsonStr) as any;
            if (evt?.type === 'delta' && typeof evt.delta === 'string') {
              appendDelta(evt.delta);
            }
            if (evt?.type === 'error' && typeof evt.error === 'string') {
              setToast({ message: evt.error, type: 'error' });
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : (language === 'en' ? 'AI request failed' : 'Ombi la AI limeshindwa'),
        type: 'error'
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAIChat = async () => {
    if (!aiMessage.trim()) return;
    const userMsg = aiMessage;
    setAiMessage('');
    setChatHistory((prev) => [...prev, { role: 'user', message: userMsg }]);
    await callLearningAI({ message: userMsg, action: 'chat' });
  };

  const handleQuickAction = async (action: 'tip' | 'goal' | 'plan' | 'progress') => {
    const msg =
      action === 'tip'
        ? (language === 'en' ? 'Give me a personalized tip for this module.' : 'Nipe ushauri binafsi kwa moduli hii.')
        : action === 'goal'
          ? (language === 'en' ? 'Help me set a learning goal for the next 7 days.' : 'Nisaidie kuweka lengo la kujifunza kwa siku 7 zijazo.')
          : action === 'plan'
            ? (language === 'en' ? 'Create a learning plan for this module.' : 'Tengeneza mpango wa kujifunza kwa moduli hii.')
            : (language === 'en' ? 'Analyze my progress and tell me what to do next.' : 'Changanua maendeleo yangu na uniambie nifanye nini next.');

    setChatHistory((prev) => [...prev, { role: 'user', message: msg }]);
    await callLearningAI({ message: msg, action });
  };

  const startModule = (moduleId: number) => {
    setSelectedModule(moduleId);
    // In production, this would navigate to the actual module content
    setToast({
      message: language === 'en' 
        ? `Starting module ${moduleId}...`
        : `Kuanza moduli ${moduleId}...`,
      type: 'info'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/learn')}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              {language === 'en' ? 'Back to Learning' : 'Rudi kwenye Kujifunza'}
            </button>
            <button
              onClick={() => setLanguage(language === 'en' ? 'sw' : 'en')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              {language === 'en' ? 'Swahili' : 'English'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Track Header */}
        <div className="bg-white border-2 border-orange-200 rounded-lg p-8 mb-8">
          <h1 className="text-3xl font-bold mb-2 text-gray-900">{moduleData?.title || (loading ? (language === 'en' ? 'Loading...' : 'Inapakia...') : '')}</h1>
          <p className="text-gray-600 text-lg mb-4">{moduleData?.description || ''}</p>
          <div className="flex items-center space-x-6 text-gray-700">
            <span className="flex items-center">
              <PlayCircleIcon className="h-5 w-5 mr-2 text-orange-600" />
              {filteredLessons.length} {language === 'en' ? 'Lessons' : 'Masomo'}
            </span>
            <span className="flex items-center">
              <span className="text-gray-600 mr-2">{language === 'en' ? 'Progress:' : 'Maendeleo:'}</span>
              <span className="font-semibold text-orange-600">0%</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-white border border-red-200 rounded-lg p-6 text-sm text-red-700 mb-8">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Modules List */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {language === 'en' ? 'Course Modules' : 'Moduli za Kozi'}
            </h2>
            <div className="space-y-4">
              {loading ? (
                <div className="bg-white rounded-lg p-6 border border-gray-200 text-sm text-gray-700">
                  {language === 'en' ? 'Loading lessons...' : 'Inapakia masomo...'}
                </div>
              ) : filteredLessons.length === 0 ? (
                <div className="bg-white rounded-lg p-6 border border-gray-200 text-sm text-gray-700">
                  {language === 'en' ? 'No lessons found for this language.' : 'Hakuna masomo kwa lugha hii.'}
                </div>
              ) : filteredLessons.map((module: any, index: number) => (
                <div
                  key={module.id}
                  className="bg-white rounded-lg p-6 border-2 transition-all border-gray-200 hover:border-orange-400 cursor-pointer hover:shadow-sm"
                  onClick={() => startModule(module.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                        'bg-orange-50 border-2 border-orange-200'
                      }`}>
                        <span className="text-orange-600 font-bold text-lg">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">
                          {module.title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <span className="text-gray-500 mr-1">⏱</span> {module.duration_minutes} min
                          </span>
                          <span className="capitalize px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {module.type}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button className="bg-orange-600 text-white px-5 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium">
                      {language === 'en' ? 'Start' : 'Anza'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Assistant Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-6 sticky top-4">
              <div className="flex items-center mb-4">
                <SparklesIcon className="h-5 w-5 text-orange-600 mr-2" />
                <h3 className="text-lg font-bold text-gray-900">
                  {language === 'en' ? 'AI Learning Assistant' : 'Msaidizi wa AI'}
                </h3>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {language === 'en'
                  ? 'Ask questions about your learning journey or share your financial situation for personalized guidance.'
                  : 'Uliza maswali kuhusu safari yako ya kujifunza au shiriki hali yako ya kifedha kupata mwongozo binafsi.'
                }
              </p>

              {/* Chat History */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto border border-gray-200">
                {chatHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">
                    {language === 'en'
                      ? 'Start a conversation with your AI assistant...'
                      : 'Anza mazungumzo na msaidizi wako wa AI...'
                    }
                  </p>
                ) : (
                  <div className="space-y-3">
                    {chatHistory.map((chat, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          chat.role === 'user'
                            ? 'bg-orange-50 border border-orange-200 ml-4'
                            : 'bg-white border border-gray-200 mr-4'
                        }`}
                      >
                        <p className="text-sm text-gray-900">{chat.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="space-y-3">
                <textarea
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  placeholder={
                    language === 'en'
                      ? 'Type your question or describe your situation...'
                      : 'Andika swali lako au eleza hali yako...'
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none text-gray-900 placeholder-gray-500"
                  rows={3}
                />
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleAIChat}
                    disabled={aiLoading}
                    className="flex-1 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
                    {aiLoading ? (language === 'en' ? 'Thinking...' : 'Inafikiria...') : (language === 'en' ? 'Send' : 'Tuma')}
                  </button>
                  <button className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <MicrophoneIcon className="h-5 w-5 text-gray-600" />
                  </button>
                  <button className="p-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <SpeakerWaveIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {aiPlan && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    {language === 'en' ? 'Your Learning Plan' : 'Mpango Wako wa Kujifunza'}
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="font-semibold text-gray-900 mb-3">{aiPlan.title}</div>
                    <div className="space-y-3">
                      {aiPlan.steps.map((s, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="text-sm font-semibold text-gray-900">{idx + 1}. {s.title}</div>
                          <div className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{s.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  {language === 'en' ? 'Quick Actions' : 'Vitendo vya Haraka'}
                </h4>
                <div className="space-y-2">
                  <button
                    onClick={() => handleQuickAction('tip')}
                    disabled={aiLoading}
                    className="w-full text-left px-4 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg text-sm transition-colors text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'en' ? '💡 Get a personalized tip' : '💡 Pata ushauri binafsi'}
                  </button>
                  <button
                    onClick={() => handleQuickAction('progress')}
                    disabled={aiLoading}
                    className="w-full text-left px-4 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg text-sm transition-colors text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'en' ? '📊 Analyze my progress' : '📊 Changanua maendeleo yangu'}
                  </button>
                  <button
                    onClick={() => handleQuickAction('goal')}
                    disabled={aiLoading}
                    className="w-full text-left px-4 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg text-sm transition-colors text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'en' ? '🎯 Set a learning goal' : '🎯 Weka lengo la kujifunza'}
                  </button>
                  <button
                    onClick={() => handleQuickAction('plan')}
                    disabled={aiLoading}
                    className="w-full text-left px-4 py-2 bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-lg text-sm transition-colors text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {language === 'en' ? '🗺️ Generate a learning plan' : '🗺️ Tengeneza mpango wa kujifunza'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
