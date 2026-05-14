'use client';

import React, { useState } from 'react';
import { PlusIcon, EyeIcon, PencilIcon, TrashIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { dkInput, dkSelect, dkLabel } from './shared';

export default function ContentSection({ educationalContent, user, loadAdminData, showToast }: { educationalContent: any[]; user: any; loadAdminData: () => void; showToast: (msg: string, type?: any) => void }) {
  const [showContentForm, setShowContentForm] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [viewingContent, setViewingContent] = useState<any>(null);
  const [managingLessons, setManagingLessons] = useState<any>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonForm, setLessonForm] = useState({ language: 'sw', title: '', content: '', duration_minutes: 15, lesson_type: 'text', video_url: '' });
  const [showAiLessonGenerator, setShowAiLessonGenerator] = useState(false);
  const [aiLanguage, setAiLanguage] = useState<'sw' | 'en'>('sw');
  const [aiLessonCount, setAiLessonCount] = useState(6);
  const [aiDifficulty, setAiDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [aiTopicPrompt, setAiTopicPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGeneratedLessons, setAiGeneratedLessons] = useState<any[] | null>(null);
  const [aiCoursePrompt, setAiCoursePrompt] = useState('');
  const [aiCourseLang, setAiCourseLang] = useState<'sw' | 'en'>('sw');
  const [aiCourseDiff, setAiCourseDiff] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [aiCourseLessonCount, setAiCourseLessonCount] = useState(6);
  const [aiCourseCategory, setAiCourseCategory] = useState('Biashara');
  const [aiCourseGenerating, setAiCourseGenerating] = useState(false);
  const [aiCourseSaving, setAiCourseSaving] = useState(false);
  const [aiCourseError, setAiCourseError] = useState<string | null>(null);
  const [aiCoursePreview, setAiCoursePreview] = useState<any | null>(null);
  const [contentFormTab, setContentFormTab] = useState<'ai' | 'manual'>('ai');
  const [contentForm, setContentForm] = useState({ title: '', description: '', content: '', category: '', duration: '', difficulty_level: 'beginner', image_url: '', is_published: false, certificates_enabled: false, pass_threshold: 100 });

  const resetContentForm = () => ({ title: '', description: '', content: '', category: '', duration: '', difficulty_level: 'beginner', image_url: '', is_published: false, certificates_enabled: false, pass_threshold: 100 });

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingContent ? `/api/educational-content/${editingContent.id}` : '/api/educational-content';
      const method = editingContent ? 'PUT' : 'POST';
      const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...contentForm, author_id: user?.id || 1 }) });
      if (response.ok) {
        setShowContentForm(false); setEditingContent(null); setContentForm(resetContentForm());
        loadAdminData(); showToast(editingContent ? 'Mafunzo yamebadilishwa kwa mafanikio!' : 'Mafunzo yameongezwa kwa mafanikio!', 'success');
      }
    } catch { showToast('Hitilafu imetokea. Jaribu tena.', 'error'); }
  };

  const handleEditContent = (content: any) => {
    setEditingContent(content);
    setContentForm({ title: content.title, description: content.description, content: content.content, category: content.category, duration: content.duration, difficulty_level: content.difficulty_level, image_url: content.image_url || '', is_published: content.is_published, certificates_enabled: content.certificates_enabled ?? false, pass_threshold: content.pass_threshold ?? 100 });
    setShowContentForm(true);
  };

  const handleDeleteContent = async (contentId: number) => {
    try {
      const r = await fetch(`/api/educational-content/${contentId}`, { method: 'DELETE' });
      if (r.ok) { loadAdminData(); showToast('Mafunzo yamefutwa kwa mafanikio!', 'success'); }
      else { const d = await r.json(); showToast(`Hitilafu: ${d.error || 'Imeshindwa kufuta'}`, 'error'); }
    } catch { showToast('Hitilafu imetokea wakati wa kufuta.', 'error'); }
  };

  const handleTogglePublish = async (contentId: number, currentStatus: boolean) => {
    try {
      const r = await fetch('/api/admin/content', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: contentId, is_published: !currentStatus }) });
      if (r.ok) { loadAdminData(); showToast(currentStatus ? 'Mafunzo yamefichwa!' : 'Mafunzo yamechapishwa!', 'success'); }
    } catch { showToast('Hitilafu imetokea.', 'error'); }
  };

  const handleManageLessons = async (content: any) => {
    setManagingLessons(content);
    try {
      const r = await fetch(`/api/admin/educational-content/${content.id}/lessons`);
      if (r.ok) setLessons(await r.json());
    } catch { console.error('Error loading lessons'); }
  };

  const handleAiGenerateCourse = async (saveNow: boolean) => {
    if (!aiCoursePrompt.trim()) { showToast('Tafadhali andika mada ya kozi.', 'error'); return; }
    if (saveNow && !aiCoursePreview) { showToast('Tengeneza preview kwanza.', 'error'); return; }
    setAiCourseError(null);
    saveNow ? setAiCourseSaving(true) : setAiCourseGenerating(true);
    try {
      const res = await fetch('/api/admin/ai/generate-course', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topicPrompt: aiCoursePrompt, language: aiCourseLang, difficulty: aiCourseDiff, lessonCount: aiCourseLessonCount, category: aiCourseCategory, authorId: user?.id, publishImmediately: saveNow }) });
      const data = await res.json();
      if (!res.ok) { setAiCourseError(data?.error || 'Imeshindikana.'); return; }
      if (saveNow) { setShowContentForm(false); setAiCoursePreview(null); setAiCoursePrompt(''); loadAdminData(); showToast(`Kozi "${data.course?.title}" imeundwa na masomo ${data.course?.lesson_count}!`, 'success'); }
      else setAiCoursePreview(data.course);
    } catch { setAiCourseError('Hitilafu ya mtandao.'); }
    finally { setAiCourseGenerating(false); setAiCourseSaving(false); }
  };

  const handleGenerateLessonsWithAI = async (saveToCourse: boolean) => {
    if (!managingLessons) return;
    if (!aiTopicPrompt.trim()) { showToast('Tafadhali andika maelezo ya mada.', 'error'); return; }
    if (saveToCourse && (!aiGeneratedLessons || aiGeneratedLessons.length === 0)) { showToast('Hakuna masomo ya kuhifadhi.', 'error'); return; }
    setAiError(null);
    saveToCourse ? setAiSaving(true) : setAiGenerating(true);
    try {
      const response = await fetch('/api/admin/ai/generate-lessons-anthropic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: managingLessons.id, language: aiLanguage, lessonCount: aiLessonCount, difficulty: aiDifficulty, topicPrompt: aiTopicPrompt, lessonType: 'course_lesson', saveToCourse }) });
      const data = await response.json();
      if (!response.ok) { setAiError(data?.error || 'Imeshindikana.'); return; }
      if (saveToCourse) { setAiGeneratedLessons(null); setShowAiLessonGenerator(false); setAiTopicPrompt(''); await handleManageLessons(managingLessons); showToast('Masomo yamehifadhiwa kwa mafanikio!', 'success'); return; }
      setAiGeneratedLessons(Array.isArray(data?.lessons) ? data.lessons : []);
    } catch { setAiError('Hitilafu imetokea wakati wa kutengeneza masomo.'); }
    finally { setAiGenerating(false); setAiSaving(false); }
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingLesson ? `/api/admin/educational-content/${managingLessons.id}/lessons/${editingLesson.id}` : `/api/admin/educational-content/${managingLessons.id}/lessons`;
      const r = await fetch(url, { method: editingLesson ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lessonForm) });
      if (r.ok) { setShowLessonForm(false); setEditingLesson(null); setLessonForm({ language: 'sw', title: '', content: '', duration_minutes: 15, lesson_type: 'text', video_url: '' }); handleManageLessons(managingLessons); showToast(editingLesson ? 'Somo limebadilishwa!' : 'Somo limeongezwa!', 'success'); }
    } catch { showToast('Hitilafu imetokea wakati wa kuhifadhi somo.', 'error'); }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    try {
      const r = await fetch(`/api/admin/educational-content/${managingLessons.id}/lessons/${lessonId}`, { method: 'DELETE' });
      if (r.ok) { handleManageLessons(managingLessons); showToast('Somo limefutwa!', 'success'); }
    } catch { showToast('Hitilafu imetokea wakati wa kufuta somo.', 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Mafunzo na Elimu</h2>
        <button onClick={() => { setEditingContent(null); setContentFormTab('ai'); setAiCoursePreview(null); setAiCourseError(null); setAiCoursePrompt(''); setContentForm(resetContentForm()); setShowContentForm(true); }} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">
          <PlusIcon className="h-4 w-4" /> Mafunzo Mapya
        </button>
      </div>

      {showContentForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-overlay border border-border max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-foreground">{editingContent ? 'Hariri Mafunzo' : 'Mafunzo Mapya'}</h3>
                <button onClick={() => { setShowContentForm(false); setEditingContent(null); setAiCoursePreview(null); }} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>

              {!editingContent && (
                <div className="flex gap-1 p-1 rounded-xl bg-foreground/[0.04] border border-border mb-5">
                  <button onClick={() => { setContentFormTab('ai'); setAiCoursePreview(null); setAiCourseError(null); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${contentFormTab === 'ai' ? 'bg-orange-500 text-white shadow' : 'text-muted-foreground hover:text-foreground'}`}>✦ AI Generate</button>
                  <button onClick={() => setContentFormTab('manual')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${contentFormTab === 'manual' ? 'bg-foreground/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Manual</button>
                </div>
              )}

              {(contentFormTab === 'ai' && !editingContent) && (
                <div className="space-y-4">
                  {!aiCoursePreview ? (
                    <>
                      <div><label className={dkLabel}>Elezea kozi unayotaka AI itengeneze *</label><textarea value={aiCoursePrompt} onChange={e => setAiCoursePrompt(e.target.value)} className={`${dkInput} resize-none`} rows={3} placeholder="Mfano: Jinsi ya kuanzisha na kukuza biashara ndogo Tanzania..." /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={dkLabel}>Lugha</label><select value={aiCourseLang} onChange={e => setAiCourseLang(e.target.value as 'sw'|'en')} className={dkSelect}><option value="sw">Swahili</option><option value="en">English</option></select></div>
                        <div><label className={dkLabel}>Kiwango</label><select value={aiCourseDiff} onChange={e => setAiCourseDiff(e.target.value as any)} className={dkSelect}><option value="beginner">Mwanzo</option><option value="intermediate">Kati</option><option value="advanced">Juu</option></select></div>
                        <div><label className={dkLabel}>Kategoria</label><select value={aiCourseCategory} onChange={e => setAiCourseCategory(e.target.value)} className={dkSelect}><option value="Biashara">Biashara</option><option value="Fedha">Fedha</option><option value="Uongozi">Uongozi</option><option value="Akiba">Akiba</option><option value="Teknolojia">Teknolojia</option></select></div>
                        <div><label className={dkLabel}>Idadi ya Masomo</label><input type="number" min={1} max={20} value={aiCourseLessonCount} onChange={e => setAiCourseLessonCount(parseInt(e.target.value||'1'))} className={dkInput} /></div>
                      </div>
                      {aiCourseError && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">{aiCourseError}</div>}
                      <div className="flex gap-2 pt-1">
                        <button type="button" onClick={() => { setShowContentForm(false); setEditingContent(null); }} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
                        <button onClick={() => handleAiGenerateCourse(false)} disabled={aiCourseGenerating || !aiCoursePrompt.trim()} className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">{aiCourseGenerating ? 'Inatengeneza...' : '✦ Tengeneza na AI'}</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4">
                        <p className="text-xs text-orange-500 font-semibold mb-3">✦ Preview ya Kozi Iliyotengenezwa na AI</p>
                        <h4 className="text-base font-bold text-foreground mb-1">{aiCoursePreview.title}</h4>
                        <p className="text-xs text-foreground/50 mb-3">{aiCoursePreview.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span>{aiCoursePreview.category}</span><span>·</span><span>{aiCoursePreview.difficulty_level}</span><span>·</span><span>{aiCoursePreview.duration}</span></div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Masomo ({aiCoursePreview.lessons?.length})</p>
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                          {aiCoursePreview.lessons?.map((l: any, i: number) => (
                            <div key={i} className="rounded-lg bg-foreground/[0.03] border border-border p-3">
                              <div className="flex items-center justify-between"><p className="text-xs font-semibold text-foreground">{i+1}. {l.title}</p><p className="text-[10px] text-muted-foreground">{l.duration_minutes} min</p></div>
                              <p className="text-[10px] text-foreground/40 mt-1 line-clamp-2">{String(l.content||'').slice(0, 140)}...</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      {aiCourseError && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">{aiCourseError}</div>}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setAiCoursePreview(null); setAiCourseError(null); }} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">← Rudi</button>
                        <button onClick={() => handleAiGenerateCourse(true)} disabled={aiCourseSaving} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 transition-colors">{aiCourseSaving ? 'Inahifadhi...' : '✓ Hifadhi Kozi na Masomo Yote'}</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {(contentFormTab === 'manual' || editingContent) && (
                <form onSubmit={handleContentSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div><label className={dkLabel}>Kichwa cha Habari *</label><input type="text" value={contentForm.title} onChange={e => setContentForm({...contentForm, title: e.target.value})} className={dkInput} required /></div>
                    <div><label className={dkLabel}>Kategoria *</label><select value={contentForm.category} onChange={e => setContentForm({...contentForm, category: e.target.value})} className={dkSelect} required><option value="">Chagua Kategoria</option><option value="Biashara">Biashara</option><option value="Uongozi">Uongozi</option><option value="Fedha">Fedha</option><option value="Teknolojia">Teknolojia</option></select></div>
                  </div>
                  <div><label className={dkLabel}>Maelezo Mafupi *</label><textarea value={contentForm.description} onChange={e => setContentForm({...contentForm, description: e.target.value})} className={`${dkInput} resize-none`} rows={3} required /></div>
                  <div><label className={dkLabel}>Maudhui Kamili *</label><textarea value={contentForm.content} onChange={e => setContentForm({...contentForm, content: e.target.value})} className={`${dkInput} resize-none`} rows={6} required /></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div><label className={dkLabel}>Muda</label><input type="text" value={contentForm.duration} onChange={e => setContentForm({...contentForm, duration: e.target.value})} className={dkInput} placeholder="2 masaa" /></div>
                    <div><label className={dkLabel}>Kiwango</label><select value={contentForm.difficulty_level} onChange={e => setContentForm({...contentForm, difficulty_level: e.target.value})} className={dkSelect}><option value="beginner">Mwanzo</option><option value="intermediate">Kati</option><option value="advanced">Juu</option></select></div>
                    <div><label className={dkLabel}>URL ya Picha</label><input type="url" value={contentForm.image_url} onChange={e => setContentForm({...contentForm, image_url: e.target.value})} className={dkInput} /></div>
                  </div>
                  <div className="rounded-xl bg-foreground/[0.03] border border-border p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chaguo za Kozi</p>
                    <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={contentForm.is_published} onChange={e => setContentForm({...contentForm, is_published: e.target.checked})} className="accent-orange-500 w-4 h-4" /><span className="text-sm text-foreground/60">Chapisha mara moja</span></label>
                    <label className="flex items-center gap-2.5 cursor-pointer"><input type="checkbox" checked={contentForm.certificates_enabled} onChange={e => setContentForm({...contentForm, certificates_enabled: e.target.checked})} className="accent-orange-500 w-4 h-4" /><div><span className="text-sm text-foreground/60">Toa Cheti cha Kukamilisha</span><p className="text-xs text-foreground/30 mt-0.5">Wanachama watapata cheti baada ya kukamilisha kozi</p></div></label>
                    {contentForm.certificates_enabled && (
                      <div className="pl-6"><label className={dkLabel}>Kiwango cha Kupita (% ya masomo)</label><div className="flex items-center gap-3"><input type="range" min={50} max={100} step={5} value={contentForm.pass_threshold} onChange={e => setContentForm({...contentForm, pass_threshold: parseInt(e.target.value)})} className="flex-1 accent-orange-500" /><span className="text-sm font-semibold text-orange-500 w-12 text-right">{contentForm.pass_threshold}%</span></div></div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button type="button" onClick={() => { setShowContentForm(false); setEditingContent(null); }} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">{editingContent ? 'Hifadhi Mabadiliko' : 'Hifadhi'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingContent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-overlay border border-border max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div><h2 className="text-lg font-bold text-foreground">{viewingContent.title}</h2><p className="text-xs text-muted-foreground mt-1">{viewingContent.category} · {viewingContent.difficulty_level} · {viewingContent.duration} dakika</p></div>
                <button onClick={() => setViewingContent(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
              </div>
              <div className="mb-4"><p className="text-xs font-semibold text-muted-foreground mb-2">Maelezo</p><p className="text-sm text-foreground/60">{viewingContent.description}</p></div>
              <div className="mb-5"><p className="text-xs font-semibold text-muted-foreground mb-2">Maudhui</p><div className="text-sm text-foreground/50 whitespace-pre-wrap leading-relaxed">{viewingContent.content}</div></div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">Imeandikwa na {viewingContent.author_name} · {new Date(viewingContent.created_at).toLocaleDateString('sw-TZ')}</p>
                <div className="flex gap-2">
                  <button onClick={() => { setViewingContent(null); handleEditContent(viewingContent); }} className="px-3.5 py-2 rounded-xl bg-foreground/5 hover:bg-foreground/10 text-foreground/50 text-sm transition-colors">Hariri</button>
                  <button onClick={() => handleTogglePublish(viewingContent.id, viewingContent.is_published)} className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${viewingContent.is_published ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600'}`}>{viewingContent.is_published ? 'Ficha' : 'Chapisha'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {managingLessons && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-overlay border border-border max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div><h3 className="text-base font-semibold text-foreground">Dhibiti Masomo</h3><p className="text-xs text-muted-foreground mt-0.5">{managingLessons.title}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setShowAiLessonGenerator(s => !s); setAiError(null); setAiGeneratedLessons(null); }} className="px-3 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 text-xs font-semibold border border-orange-500/20 transition-colors">AI Generate</button>
                  <button onClick={() => { setEditingLesson(null); setLessonForm({ language: 'sw', title: '', content: '', duration_minutes: 15, lesson_type: 'text', video_url: '' }); setShowLessonForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 text-xs font-semibold border border-blue-500/20 transition-colors"><PlusIcon className="h-3.5 w-3.5" /> Somo Jipya</button>
                  <button onClick={() => setManagingLessons(null)} className="text-muted-foreground hover:text-foreground text-2xl leading-none">×</button>
                </div>
              </div>

              {showAiLessonGenerator && (
                <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 p-4 mb-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 space-y-3">
                      <p className="text-sm font-semibold text-orange-500">AI Lesson Generator</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><label className={dkLabel}>Lugha</label><select value={aiLanguage} onChange={e => setAiLanguage(e.target.value as 'sw'|'en')} className={dkSelect}><option value="sw">Swahili</option><option value="en">English</option></select></div>
                        <div><label className={dkLabel}>Kiwango</label><select value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value as any)} className={dkSelect}><option value="beginner">Mwanzo</option><option value="intermediate">Kati</option><option value="advanced">Juu</option></select></div>
                        <div><label className={dkLabel}>Idadi ya Masomo</label><input type="number" min={1} max={20} value={aiLessonCount} onChange={e => setAiLessonCount(parseInt(e.target.value||'1'))} className={dkInput} /></div>
                        <div className="flex items-end"><button onClick={() => handleGenerateLessonsWithAI(false)} disabled={aiGenerating||aiSaving} className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold disabled:opacity-40 transition-colors">{aiGenerating ? 'Inatengeneza...' : 'Preview'}</button></div>
                      </div>
                      <div><label className={dkLabel}>Mada ya Masomo</label><textarea value={aiTopicPrompt} onChange={e => setAiTopicPrompt(e.target.value)} className={`${dkInput} resize-none`} rows={2} placeholder="Mfano: Financial Basics — budgeting, saving..." /></div>
                      {aiError && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-600">{aiError}</div>}
                      {aiGeneratedLessons && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground">Preview ({aiGeneratedLessons.length} masomo)</p>
                            <button onClick={() => handleGenerateLessonsWithAI(true)} disabled={aiSaving||aiGenerating} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 text-xs font-semibold border border-emerald-500/20 disabled:opacity-40">{aiSaving ? 'Inahifadhi...' : 'Hifadhi Kwa Kozi'}</button>
                          </div>
                          <div className="space-y-2">
                            {aiGeneratedLessons.map((l: any, i: number) => (
                              <div key={i} className="rounded-xl bg-foreground/[0.03] border border-border p-3">
                                <div className="flex items-center justify-between mb-1"><p className="text-xs font-semibold text-foreground">{l.title}</p><p className="text-[10px] text-muted-foreground">{l.duration_minutes} min · {aiLanguage.toUpperCase()}</p></div>
                                <p className="text-[10px] text-foreground/40 whitespace-pre-wrap">{String(l.content||'').slice(0,300)}{String(l.content||'').length>300?'...':''}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={() => { setShowAiLessonGenerator(false); setAiError(null); setAiGeneratedLessons(null); }} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                  </div>
                </div>
              )}

              {showLessonForm && (
                <div className="rounded-xl bg-foreground/[0.03] border border-border p-4 mb-5">
                  <p className="text-sm font-semibold text-foreground mb-3">{editingLesson ? 'Hariri Somo' : 'Somo Jipya'}</p>
                  <form onSubmit={handleLessonSubmit} className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div><label className={dkLabel}>Kichwa cha Somo *</label><input type="text" value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} className={dkInput} required /></div>
                      <div><label className={dkLabel}>Muda (Dakika) *</label><input type="number" value={lessonForm.duration_minutes} onChange={e => setLessonForm({...lessonForm, duration_minutes: parseInt(e.target.value)})} className={dkInput} min="1" required /></div>
                    </div>
                    <div><label className={dkLabel}>Lugha</label><select value={(lessonForm as any).language||'sw'} onChange={e => setLessonForm({...(lessonForm as any), language: e.target.value})} className={dkSelect}><option value="sw">Swahili</option><option value="en">English</option></select></div>
                    <div><label className={dkLabel}>Maudhui ya Somo *</label><textarea value={lessonForm.content} onChange={e => setLessonForm({...lessonForm, content: e.target.value})} className={`${dkInput} resize-none`} rows={6} placeholder="Andika maudhui ya somo hapa..." required /></div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setShowLessonForm(false); setEditingLesson(null); }} className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-sm hover:bg-foreground/5 transition-colors">Ghairi</button>
                      <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors">{editingLesson ? 'Hifadhi Mabadiliko' : 'Hifadhi Somo'}</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">Masomo ({lessons.length})</p>
                {lessons.length > 0 ? lessons.map(lesson => (
                  <div key={lesson.id} className="rounded-xl bg-foreground/[0.03] border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-semibold">#{lesson.lesson_order}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-foreground/40 font-semibold">{(lesson.language||'sw').toUpperCase()}</span>
                          <span className="text-[10px] text-muted-foreground">{lesson.duration_minutes} dakika</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-1">{lesson.title}</p>
                        <p className="text-xs text-foreground/40 line-clamp-2">{lesson.content.substring(0,200)}...</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setEditingLesson(lesson); setLessonForm({ language: lesson.language||'sw', title: lesson.title, content: lesson.content, duration_minutes: lesson.duration_minutes, lesson_type: lesson.lesson_type, video_url: lesson.video_url||'' }); setShowLessonForm(true); }} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-emerald-500/10 text-foreground/30 hover:text-emerald-600 transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleDeleteLesson(lesson.id)} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-red-500/10 text-foreground/30 hover:text-red-600 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <BookOpenIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" />
                    <p className="text-sm text-muted-foreground">Hakuna masomo bado</p>
                    <p className="text-xs text-foreground/20 mt-1">Bonyeza &ldquo;Somo Jipya&rdquo; kuanza</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-card border border-border overflow-hidden shadow-sm">
        <table className="min-w-full">
          <thead><tr className="border-b border-border">
            {['Mafunzo','Hali','Mwandishi','Tarehe','Vitendo'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody className="divide-y divide-border">
            {educationalContent.length > 0 ? educationalContent.map(c => (
              <tr key={c.id} className="hover:bg-foreground/[0.02]">
                <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{c.title}</p><p className="text-[10px] text-muted-foreground mt-0.5">{c.category} · {c.difficulty_level} · {c.duration} dakika</p></td>
                <td className="px-4 py-3"><span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${c.is_published ? 'bg-emerald-500/10 text-emerald-600' : 'bg-foreground/5 text-foreground/40'}`}>{c.is_published ? 'Imechapishwa' : 'Rasimu'}</span></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{c.author_name}</td>
                <td className="px-4 py-3 text-xs text-foreground/30">{new Date(c.created_at).toLocaleDateString('sw-TZ')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setViewingContent(c)} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-blue-500/10 text-foreground/30 hover:text-blue-600 transition-colors"><EyeIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleEditContent(c)} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-emerald-500/10 text-foreground/30 hover:text-emerald-600 transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleManageLessons(c)} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-purple-500/10 text-foreground/30 hover:text-purple-600 transition-colors"><BookOpenIcon className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeleteContent(c.id)} className="p-1.5 rounded-lg bg-foreground/5 hover:bg-red-500/10 text-foreground/30 hover:text-red-600 transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-12 text-center"><BookOpenIcon className="h-8 w-8 mx-auto text-foreground/10 mb-3" /><p className="text-sm text-muted-foreground">Hakuna mafunzo bado</p></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
