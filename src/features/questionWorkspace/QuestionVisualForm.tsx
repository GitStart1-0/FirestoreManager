import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle,
  Copy,
  Image,
  Layers,
  Music,
  Plus,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { normalizeApostrophes } from '../../shared/text/slugify';
import {
  QUESTION_TEMPLATES,
  detectQuestionTemplate,
  getQuestionTypeColors
} from './questionTemplates';
export function QuestionVisualForm({
  fields,
  setFields,
  isNew,
  onApplyTemplate
}: {
  fields: { key: string; value: string; type: string }[];
  setFields: React.Dispatch<React.SetStateAction<{ key: string; value: string; type: string }[]>>;
  isNew?: boolean;
  onApplyTemplate?: (templateFields: { key: string; value: string; type: string }[]) => void;
}) {
  const [newSynonym, setNewSynonym] = useState('');
  const [activePreviewTab, setActivePreviewTab] = useState<'editor' | 'sandbox'>('editor');
  
  // Local states for Sandbox runtime testing game
  const [userSelectedIdx, setUserSelectedIdx] = useState<number | null>(null);
  const [userSelectedIndices, setUserSelectedIndices] = useState<number[]>([]);
  const [userTrueFalseVal, setUserTrueFalseVal] = useState<boolean | null>(null);
  const [userTextAnswer, setUserTextAnswer] = useState('');
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [userSortingItems, setUserSortingItems] = useState<string[]>([]);
  const [userNumericVal, setUserNumericVal] = useState('');
  const [userMatrixAnswers, setUserMatrixAnswers] = useState<Record<string, string>>({});
  const [sandboxResult, setSandboxResult] = useState<{ isCorrect: boolean; feedback: string } | null>(null);

  const typeField = fields.find(i => i.key === 'type');
  const activeType = typeField ? typeField.value : null;

  // Sync sandbox objects
  useEffect(() => {
    setSandboxResult(null);
    setUserSelectedIdx(null);
    setUserSelectedIndices([]);
    setUserTrueFalseVal(null);
    setUserTextAnswer('');
    setUserMatches({});
    setUserNumericVal('');
    setUserMatrixAnswers({});
    
    // For sorting, populate the starting state
    try {
      const itemsRaw = fields.find(i => i.key === 'items' || i.key === 'options')?.value || '[]';
      const parsed = JSON.parse(itemsRaw);
      if (Array.isArray(parsed)) {
        // shuffle them slightly for testing fun
        setUserSortingItems([...parsed].sort(() => Math.random() - 0.5));
      }
    } catch {
      setUserSortingItems([]);
    }
  }, [activeType, fields]);

  // Read utilities
  const getVal = (keyStr: string, defaultVal: string = '') => {
    const f = fields.find(item => item.key === keyStr);
    return f ? f.value : defaultVal;
  };

  const setVal = (keyStr: string, newVal: string, typeStr: string = 'string') => {
    setFields(prev => {
      const exists = prev.some(item => item.key === keyStr);
      if (exists) {
        return prev.map(item => item.key === keyStr ? { ...item, value: newVal, type: typeStr } : item);
      } else {
        return [...prev, { key: keyStr, value: newVal, type: typeStr }];
      }
    });
  };

  const removeKey = (keyStr: string) => {
    setFields(prev => prev.filter(item => item.key !== keyStr));
  };

  // Common parsed arrays
  let optionsList: string[] = [];
  try {
    const parsed = JSON.parse(getVal('options', '[]'));
    if (Array.isArray(parsed)) optionsList = parsed;
  } catch {}

  // Audio elements helper
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);

  const testAudio = (url: string) => {
    if (!url) return;
    if (playingAudio) {
      audioRef?.pause();
      setPlayingAudio(false);
    } else {
      const a = new Audio(url);
      a.play();
      setAudioRef(a);
      setPlayingAudio(true);
      a.onended = () => setPlayingAudio(false);
    }
  };

  // Evaluate sandbox simulation
  const handleCheckAnswer = () => {
    if (!activeType) return;
    
    let isCorrect = false;
    let feedback = '';

    if (activeType === 'single_choice') {
      const correctIdx = Number(getVal('correctAnswerIndex', '0'));
      if (userSelectedIdx === correctIdx) {
        isCorrect = true;
        feedback = `🎉 Прекрасно! Ваша відповідь правильна: "${optionsList[correctIdx]}". +${getVal('points', '10')} балів!`;
      } else {
        feedback = `❌ Неправильно. Правильна відповідь: "${optionsList[correctIdx]}". Спробуйте ще раз!`;
      }
    } 
    else if (activeType === 'multiple_choice') {
      let correctIndices: number[] = [];
      try {
        correctIndices = JSON.parse(getVal('correctAnswerIndices', '[]'));
      } catch {}
      
      const isMatch = correctIndices.length === userSelectedIndices.length &&
                      correctIndices.every(val => userSelectedIndices.includes(val));
                      
      if (isMatch) {
         isCorrect = true;
         feedback = `🎉 Супер! Ви обрали всі правильні варіанти: ${correctIndices.map(i => `"${optionsList[i]}"`).join(', ')}. +${getVal('points', '10')} балів!`;
      } else {
         feedback = `❌ На жаль, не всі обрані варіанти правильні. Правильні індекси: ${correctIndices.join(', ')}.`;
      }
    }
    else if (activeType === 'true_false') {
      const correct = getVal('correctBool', 'true') === 'true';
      if (userTrueFalseVal === correct) {
        isCorrect = true;
        feedback = `🎉 Абсолютно вірно! Твердження є ${correct ? 'Правдою' : 'Неправдою'}. ${getVal('explanation')}`;
      } else {
        feedback = `❌ Неправильно. Насправді це твердження є ${correct ? 'Правдою' : 'Неправдою'}.`;
      }
    }
    else if (activeType === 'open_text') {
      let list: string[] = [];
      try { synonyms = JSON.parse(getVal('acceptedAnswers', '[]')); } catch {}
      const text = userTextAnswer.trim();
      const isCase = getVal('caseSensitive', 'false') === 'true';
      
      const matched = synonyms.some(syn => {
        const normSyn = normalizeApostrophes(syn);
        const normText = normalizeApostrophes(text);
        return isCase ? normSyn === normText : normSyn.toLowerCase() === normText.toLowerCase();
      });
      
      if (matched) {
        isCorrect = true;
        feedback = `🎉 Правильно заповнено! Варіант "${text}" є серед затверджених відповідей.`;
      } else {
        feedback = `❌ Не знайдено збігів. Допустимі відповіді: ${synonyms.map(s => `"${s}"`).join(', ')}`;
      }
    }
    else if (activeType === 'sorting') {
      let correctSeq: string[] = [];
      try { correctSeq = JSON.parse(getVal('correctSequence', '[]')); } catch {}
      
      const isSorted = correctSeq.length === userSortingItems.length &&
                       correctSeq.every((val, i) => userSortingItems[i] === val);
                       
      if (isSorted) {
        isCorrect = true;
        feedback = `🎉 Приголомшливо! Порядок абсолютно правильний. Хронологія встановлена вірно!`;
      } else {
        feedback = `❌ Порядок невірний. Правильна послідовність: ${correctSeq.map((v, i) => `${i+1}. ${v}`).join(' ➔ ')}`;
      }
    }
    else if (activeType === 'numeric') {
      const correctNum = Number(getVal('correctNumber', '0'));
      const tolerance = Number(getVal('tolerance', '0'));
      const ans = Number(userNumericVal);
      
      if (!isNaN(ans) && Math.abs(ans - correctNum) <= tolerance) {
        isCorrect = true;
        feedback = `🎉 Точно в ціль! Введена відповідь ${ans} знаходиться в межах дозволеного відхилення.`;
      } else {
        feedback = `❌ Помилка. Правильна відповідь: ${correctNum} (допуск ±${tolerance}).`;
      }
    }
    else if (activeType === 'audio_question') {
      const correctIdx = Number(getVal('correctOptionIndex', '0'));
      if (userSelectedIdx === correctIdx) {
        isCorrect = true;
        feedback = `🎉 Правильно! Аудіофрагмент успішно розпізнано: "${optionsList[correctIdx]}".`;
      } else {
        feedback = `❌ Спробуйте прослухати уважніше. Правильний варіант: "${optionsList[correctIdx]}".`;
      }
    }
    else if (activeType === 'find_odd') {
      const oddCorrect = getVal('correctAnswer', '');
      const studentAnsInput = optionsList[userSelectedIdx ?? -1];
      if (studentAnsInput === oddCorrect) {
        isCorrect = true;
        feedback = `🎉 Вірно! Це дійсно зайвий елемент. Пояснення: ${getVal('explanation')}`;
      } else {
        feedback = `❌ Неправильно. Зайвий елемент: "${oddCorrect}".`;
      }
    }
    else if (activeType === 'matching') {
      let originalPairs: Record<string, string> = {};
      try { originalPairs = JSON.parse(getVal('pairs', '{}')); } catch {}
      
      const totalPairsCount = Object.keys(originalPairs).length;
      let correctMatches = 0;
      for (const [leftSide, rightSide] of Object.entries(originalPairs)) {
         if (userMatches[leftSide] === rightSide) correctMatches++;
      }
      
      if (correctMatches === totalPairsCount) {
        isCorrect = true;
        feedback = `🎉 Ідеально! Усі пари знайдено правильно (${correctMatches}/${totalPairsCount}).`;
      } else {
        feedback = `⚠️ Частково вірно: зіставлено ${correctMatches} з ${totalPairsCount} можливих зв'язків.`;
      }
    }
    else if (activeType === 'matrix') {
      let correctAnsObj: Record<string, string> = {};
      try { correctAnsObj = JSON.parse(getVal('answers', '{}')); } catch {}
      
      let matchedCells = 0;
      const keys = Object.keys(correctAnsObj);
      keys.forEach(k => {
        if (userMatrixAnswers[k] === correctAnsObj[k]) matchedCells++;
      });
      
      if (matchedCells === keys.length) {
        isCorrect = true;
        feedback = `🎉 Прекрасно! Матриця відповідей заповнена на 100% вірно! +${getVal('points', '25')} балів.`;
      } else {
        feedback = `❌ Помилка в таблиці. Правильно заповнено тільки ${matchedCells} з ${keys.length} рядів.`;
      }
    }
    else if (activeType === 'cloze') {
      let correctBlanksObj: Record<string, string> = {};
      try { correctBlanksObj = JSON.parse(getVal('correctBlanks', '{}')); } catch {}
      
      let blankSuccess = 0;
      const keys = Object.keys(correctBlanksObj);
      keys.forEach(k => {
        const normUser = normalizeApostrophes(String(userMatches[k] || '').trim().toLowerCase());
        const normCorrect = normalizeApostrophes(String(correctBlanksObj[k]).trim().toLowerCase());
        if (normUser === normCorrect) {
          blankSuccess++;
        }
      });
      
      if (blankSuccess === keys.length) {
        isCorrect = true;
        feedback = `🎉 Вітаємо! Текст заповнено абсолютно правильно.`;
      } else {
        feedback = `❌ Помилка. Зіставлено правильних пропусків: ${blankSuccess}/${keys.length}.`;
      }
    }
    else if (activeType === 'image_choice') {
      const correctId = getVal('correctHotspotId', '');
      if (userSelectedIdx !== null && correctId) {
        isCorrect = true;
        feedback = `🎉 Гаряча точка активована! Область розпізнано: "${correctId}". +${getVal('points', '20')} балів.`;
      } else {
        feedback = `❌ Ви схибили або клікнули за межами правильної гарячої зони. Спробуйте іншу точку!`;
      }
    }

    setSandboxResult({ isCorrect, feedback });
  };

  // Extract open synonyms helper
  let synonyms: string[] = [];
  try {
    const parsed = JSON.parse(getVal('acceptedAnswers', '[]'));
    if (Array.isArray(parsed)) synonyms = parsed;
  } catch {}

  const handleAddSynonym = () => {
    if (!newSynonym.trim()) return;
    const updated = Array.from(new Set([...synonyms, newSynonym.trim()]));
    setVal('acceptedAnswers', JSON.stringify(updated), 'array');
    setNewSynonym('');
  };

  // Save option changes
  const handleOptionTextUpdate = (idx: number, stringVal: string) => {
    const clone = [...optionsList];
    clone[idx] = stringVal;
    setVal('options', JSON.stringify(clone), 'array');
  };

  const handleAddNewOptionRow = () => {
    const clone = [...optionsList, `Новий варіант ${optionsList.length + 1}`];
    setVal('options', JSON.stringify(clone), 'array');
  };

  const handleRemoveOptionRow = (idx: number) => {
    const clone = optionsList.filter((_, i) => i !== idx);
    setVal('options', JSON.stringify(clone), 'array');
  };

  // Heuristic function to find matching template based on fields:
  const detectedType = detectQuestionTemplate(fields)?.id || null;

  const handleApplyTemplate = (templateFields: { key: string; value: string; type: string }[], merge: boolean) => {
    if (merge) {
      const merged = [...fields];
      templateFields.forEach(tf => {
        const existingIdx = merged.findIndex(f => f.key === tf.key);
        if (existingIdx === -1) {
          merged.push({ ...tf });
        } else {
          // Replace critical type key only, keep existing values for shared schema properties
          if (tf.key === 'type') {
            merged[existingIdx] = { ...tf };
          }
        }
      });
      if (onApplyTemplate) {
        onApplyTemplate(merged);
      } else {
        setFields(merged);
      }
    } else {
      if (onApplyTemplate) {
        onApplyTemplate(templateFields);
      } else {
        setFields(templateFields);
      }
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 12-Type Brand Grid (Always Visible) */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            Схеми та типи питань Noesis (Schema & Type Selector)
          </span>
          {activeType && (
            <button
              type="button"
              onClick={() => removeKey('type')}
              className="text-[9.5px] font-black text-rose-600 hover:text-rose-800 hover:underline cursor-pointer transition"
              title="Click to clear the selected active type field"
            >
              [Очистити тип]
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1">
          {QUESTION_TEMPLATES.map(t => {
            const isCurrentActive = t.id === activeType;
            const isDbDetected = t.id === detectedType;
            const isHighlighted = isCurrentActive || (activeType === null && isDbDetected);
            const colors = getQuestionTypeColors(t.id);

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  handleApplyTemplate(t.fields, true);
                }}
                className={`p-2.5 text-left rounded-lg transition cursor-pointer flex flex-col gap-0.5 relative border transition-all duration-200 ${
                  isCurrentActive
                    ? `${colors.bg} ${colors.border} border-2 ${colors.text} font-bold ring-2 ${colors.ring} scale-[1.015] shadow-xs`
                    : isDbDetected
                    ? `${colors.bg} border-2 border-dashed border-emerald-500/55 ${colors.text} font-semibold scale-[1.01] shadow-3xs`
                    : `bg-white border-slate-200 ${colors.hover} text-slate-705 hover:text-slate-950`
                }`}
              >
                {isCurrentActive && isDbDetected && (
                  <span className={`absolute top-1 px-1 py-0.5 rounded text-[7px] font-black bg-emerald-500 text-white uppercase tracking-wider right-1 select-none shadow-3xs`}>
                    ✓ АКТИВНО (БД)
                  </span>
                )}
                {isCurrentActive && !isDbDetected && (
                  <span className={`absolute top-1 px-1 py-0.5 rounded text-[7px] font-black ${colors.badge} uppercase tracking-wider right-1 select-none`}>
                    ✓ МОДИФІКОВАНО
                  </span>
                )}
                {!isCurrentActive && isDbDetected && (
                  <span className={`absolute top-1 px-1 py-0.5 rounded text-[7.5px] font-black bg-emerald-50 border border-emerald-300 text-emerald-800 uppercase tracking-wider right-1 select-none animate-pulse`}>
                    📂 ТИП У БД
                  </span>
                )}
                <span className="font-extrabold text-xs">{t.nameUk.split('(')[0].trim()}</span>
                <span className={`text-[9px] font-normal block truncate ${isHighlighted ? colors.subtext : 'text-slate-400'} pr-16`}>
                  {t.descriptionUk}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Workspace Tab Picker */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          {(() => {
            const t = QUESTION_TEMPLATES.find(t => t.id === activeType);
            const colors = t ? getQuestionTypeColors(t.id) : null;
            return (
              <span className={`text-[10px] uppercase font-extrabold tracking-wider flex items-center gap-1.5 font-mono px-2 py-0.5 rounded border ${
                colors ? colors.badge : 'text-slate-600 bg-slate-100 border-slate-200'
              }`}>
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                {t ? t.nameUk.split('(')[0].trim() : 'Тип не обрано'}
              </span>
            );
          })()}
          {activeType ? (
            <span className="text-[9.5px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 tracking-wide select-none">
              ✓ Задано в БД
            </span>
          ) : (
            <span className="text-[9.5px] font-extrabold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 tracking-wide select-none">
              ⚠ Оберіть тип вище
            </span>
          )}
        </div>
        
        <div className="bg-slate-100 p-0.5 rounded-lg flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActivePreviewTab('editor')}
            className={`px-3 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
              activePreviewTab === 'editor' 
                ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Конструктор (Form Designer)
          </button>
          <button
            type="button"
            onClick={() => setActivePreviewTab('sandbox')}
            disabled={!activeType}
            className={`px-3 py-1 rounded text-[10px] font-bold transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
              activePreviewTab === 'sandbox' 
                ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Тестувати (Sandbox Test)
          </button>
        </div>
      </div>

      {/* RENDER TAB 1: VISUAL FORM DATA CONTROLS */}
      {activePreviewTab === 'editor' && (
        <div className="flex flex-col gap-4.5">
          
          {/* Main Question Text Block */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">📝 Текст Питання (Question Prompt)</label>
            <textarea
              value={getVal('question')}
              onChange={e => setVal('question', e.target.value)}
              placeholder="Введіть текст вашого запитання..."
              rows={3}
              className="bg-slate-50 border border-slate-200 text-xs rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium text-slate-800 leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">⭐ Бали за відповідь (Points)</label>
              <input
                type="number"
                value={getVal('points', '10')}
                onChange={e => setVal('points', e.target.value, 'number')}
                className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg font-mono"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🏷️ Категорія/Тема (Category)</label>
              <input
                type="text"
                value={getVal('category', 'Загальне')}
                onChange={e => setVal('category', e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
              />
            </div>
          </div>

          {/* DYNAMIC FIELD DESIGNERS BASED ON 12 TYPES */}
          <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
            
            {/* TYPE 1: SINGLE CHOICE DESIGNER */}
            {activeType === 'single_choice' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Варіанти відповідей та вибір правильного:</span>
                  <button
                    type="button"
                    onClick={handleAddNewOptionRow}
                    className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded transition flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> Варіант (Add Option)
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {optionsList.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <input
                        type="radio"
                        name="correct-radio-design"
                        checked={Number(getVal('correctAnswerIndex', '0')) === oIdx}
                        onChange={() => setVal('correctAnswerIndex', String(oIdx), 'number')}
                        title="Позначити цей варіант як правильний"
                        className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => handleOptionTextUpdate(oIdx, e.target.value)}
                        placeholder={`Варіант ${oIdx + 1}`}
                        className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded focus:bg-white focus:ring-1 focus:ring-amber-400 text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveOptionRow(oIdx)}
                        disabled={optionsList.length <= 2}
                        className="p-1 hover:text-red-500 rounded disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TYPE 2: MULTIPLE CHOICE DESIGNER */}
            {activeType === 'multiple_choice' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Варіанти відповідей (кілька правильних):</span>
                  <button
                    type="button"
                    onClick={handleAddNewOptionRow}
                    className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded flex items-center gap-0.5 font-bold"
                  >
                    <Plus className="h-3 w-3" /> Додати варіант
                  </button>
                </div>

                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {optionsList.map((opt, oIdx) => {
                    let correctArray: number[] = [];
                    try { correctArray = JSON.parse(getVal('correctAnswerIndices', '[]')); } catch {}
                    const isChecked = correctArray.includes(oIdx);

                    return (
                      <div key={oIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            let nextArr = [...correctArray];
                            if (e.target.checked) {
                              nextArr = Array.from(new Set([...nextArr, oIdx])).sort((a,b)=>a-b);
                            } else {
                              nextArr = nextArr.filter(i => i !== oIdx);
                            }
                            setVal('correctAnswerIndices', JSON.stringify(nextArr), 'array');
                          }}
                          className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={e => handleOptionTextUpdate(oIdx, e.target.value)}
                          className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionRow(oIdx)}
                          disabled={optionsList.length <= 2}
                          className="text-slate-400 hover:text-red-500 disabled:opacity-30 p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TYPE 3: TRUE / FALSE DESIGNER */}
            {activeType === 'true_false' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Виберіть правильне твердження:</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVal('correctBool', 'true', 'boolean')}
                    className={`p-4 rounded-xl border-2 text-xs font-bold transition flex flex-col items-center gap-1.5 cursor-pointer ${
                      getVal('correctBool', 'true') === 'true'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-extrabold shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <span>ІСТИНА (TRUE / ПРАВДА)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVal('correctBool', 'false', 'boolean')}
                    className={`p-4 rounded-xl border-2 text-xs font-bold transition flex flex-col items-center gap-1.5 cursor-pointer ${
                      getVal('correctBool', 'true') === 'false'
                        ? 'border-red-500 bg-red-50 text-red-900 font-extrabold shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700 font-medium'
                    }`}
                  >
                    <X className="h-5 w-5 text-red-600" />
                    <span>ХИБНІСТЬ (FALSE / НЕПРАВДА)</span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">📝 Пояснення помилки/твердження</label>
                  <input
                    type="text"
                    value={getVal('explanation')}
                    onChange={e => setVal('explanation', e.target.value)}
                    placeholder="Наприклад: Земля робить повний оберт за 24 години..."
                    className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* TYPE 4: OPEN TEXT DESIGNER */}
            {activeType === 'open_text' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Затверджені правильні відповіді та синоніми:</span>
                
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  {synonyms.map((s, sIdx) => (
                    <span key={sIdx} className="bg-amber-100 text-amber-950 border border-amber-200 text-[10px] font-bold font-semibold px-2 py-1 rounded inline-flex items-center gap-1">
                      {s}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = synonyms.filter((_, i) => i !== sIdx);
                          setVal('acceptedAnswers', JSON.stringify(updated), 'array');
                        }}
                        className="hover:bg-amber-200 rounded p-0.5 text-amber-900 transition"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  {synonyms.length === 0 && <span className="text-slate-400 italic text-[11px]">Немає схвалених відповідей</span>}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Впишіть новий варіант..."
                    value={newSynonym}
                    onChange={e => setNewSynonym(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddSynonym(); } }}
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSynonym.trim()) return;
                      const updated = Array.from(new Set([...synonyms, newSynonym.trim()]));
                      setVal('acceptedAnswers', JSON.stringify(updated), 'array');
                      setNewSynonym('');
                    }}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-3 py-2 rounded-lg cursor-pointer"
                  >
                    Додати
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="case-sensitive-cb"
                    checked={getVal('caseSensitive', 'false') === 'true'}
                    onChange={e => setVal('caseSensitive', String(e.target.checked), 'boolean')}
                    className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                  />
                  <label htmlFor="case-sensitive-cb" className="text-xs text-slate-650 cursor-pointer">
                    Чутливість до регістру великих/малих літер (Case Sensitive)
                  </label>
                </div>
              </div>
            )}

            {/* TYPE 5: MATCHING DESIGNER */}
            {activeType === 'matching' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Узгоджені асоціативні пари:</span>
                
                {(() => {
                  let leftArr: string[] = [];
                  let rightArr: string[] = [];
                  let pairsObj: Record<string, string> = {};

                  try { leftArr = JSON.parse(getVal('leftSides', '[]')); } catch {}
                  try { rightArr = JSON.parse(getVal('rightSides', '[]')); } catch {}
                  try { pairsObj = JSON.parse(getVal('pairs', '{}')); } catch {}

                  return (
                    <div className="space-y-2">
                      <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                        {leftArr.map((lv, lIdx) => (
                          <div key={lIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <input
                              type="text"
                              value={lv}
                              onChange={e => {
                                const oldL = lv;
                                const newL = e.target.value.trim();
                                if (!newL) return;
                                
                                const updatedL = [...leftArr];
                                updatedL[lIdx] = newL;
                                
                                const updatedP = { ...pairsObj };
                                const rv = updatedP[oldL];
                                delete updatedP[oldL];
                                updatedP[newL] = rv;

                                setVal('leftSides', JSON.stringify(updatedL), 'array');
                                setVal('pairs', JSON.stringify(updatedP), 'object');
                              }}
                              placeholder="Ліва сторона"
                              className="w-1/2 bg-white border border-slate-200 text-xs px-2.5 py-1 rounded text-slate-800 font-medium"
                            />
                            <span className="text-slate-400 font-bold text-[13px]">&#8644;</span>
                            <input
                              type="text"
                              value={pairsObj[lv] || ''}
                              onChange={e => {
                                const rv = e.target.value;
                                const updatedP = { ...pairsObj, [lv]: rv };
                                const updatedR = Array.from(new Set(Object.values(updatedP)));

                                setVal('pairs', JSON.stringify(updatedP), 'object');
                                setVal('rightSides', JSON.stringify(updatedR), 'array');
                              }}
                              placeholder="Права сторона"
                              className="w-1/2 bg-white border border-slate-200 text-xs px-2.5 py-1 rounded text-slate-800 font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updatedL = leftArr.filter((_, i) => i !== lIdx);
                                const updatedP = { ...pairsObj };
                                delete updatedP[lv];
                                const updatedR = Array.from(new Set(Object.values(updatedP)));

                                setVal('leftSides', JSON.stringify(updatedL), 'array');
                                setVal('rightSides', JSON.stringify(updatedR), 'array');
                                setVal('pairs', JSON.stringify(updatedP), 'object');
                              }}
                              className="text-slate-400 hover:text-red-500 p-0.5 rounded"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const indexLabel = leftArr.length + 1;
                          const freshL = `Ключ ${indexLabel}`;
                          const freshR = `Значення ${indexLabel}`;
                          
                          const l = [...leftArr, freshL];
                          const r = [...rightArr, freshR];
                          const p = { ...pairsObj, [freshL]: freshR };

                          setVal('leftSides', JSON.stringify(l), 'array');
                          setVal('rightSides', JSON.stringify(r), 'array');
                          setVal('pairs', JSON.stringify(p), 'object');
                        }}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-[10px] border border-amber-200 px-3 py-1 rounded transition flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Додати рядок відповідності (Add Pair)
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TYPE 6: CHRONOLOGICAL SORTING DESIGNER */}
            {activeType === 'sorting' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Елементи у правильному порядку (користувач побачить випадковий):</span>
                  <button
                    type="button"
                    onClick={() => {
                      let parsedSeq: string[] = [];
                      try { parsedSeq = JSON.parse(getVal('correctSequence', '[]')); } catch {}
                      const updated = [...parsedSeq, `Елемент ${parsedSeq.length + 1}`];
                      setVal('correctSequence', JSON.stringify(updated), 'array');
                      setVal('items', JSON.stringify(updated), 'array');
                    }}
                    className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded transition flex items-center gap-0.5 font-bold"
                  >
                    <Plus className="h-3 w-3" /> Додати елемент
                  </button>
                </div>

                {(() => {
                  let seq: string[] = [];
                  try { seq = JSON.parse(getVal('correctSequence', '[]')); } catch {}

                  return (
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                      {seq.map((itemValue, index) => (
                        <div key={index} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100 select-all">
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-200 px-2 py-0.5 rounded">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={itemValue}
                            onChange={(e) => {
                              const updated = [...seq];
                              updated[index] = e.target.value;
                              setVal('correctSequence', JSON.stringify(updated), 'array');
                              setVal('items', JSON.stringify(updated), 'array');
                            }}
                            className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1 rounded text-slate-850"
                          />
                          <div className="flex items-center gap-0.5 px-1 bg-white border border-slate-200 rounded">
                            <button
                              type="button"
                              onClick={() => {
                                if (index === 0) return;
                                const updated = [...seq];
                                const tmp = updated[index];
                                updated[index] = updated[index - 1];
                                updated[index - 1] = tmp;
                                setVal('correctSequence', JSON.stringify(updated), 'array');
                              }}
                              disabled={index === 0}
                              className="p-1 hover:text-amber-600 disabled:opacity-35"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (index === seq.length - 1) return;
                                const updated = [...seq];
                                const tmp = updated[index];
                                updated[index] = updated[index + 1];
                                updated[index + 1] = tmp;
                                setVal('correctSequence', JSON.stringify(updated), 'array');
                              }}
                              disabled={index === seq.length - 1}
                              className="p-1 hover:text-amber-600 disabled:opacity-35"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = seq.filter((_, i) => i !== index);
                              setVal('correctSequence', JSON.stringify(updated), 'array');
                              setVal('items', JSON.stringify(updated), 'array');
                            }}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TYPE 7: FIND ODD DESIGNER */}
            {activeType === 'find_odd' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Варіанти відповідей (визначте зайве слово та пояснення):</span>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Зайве слово (Правильна відповідь):</label>
                    <input
                      type="text"
                      value={getVal('correctAnswer')}
                      onChange={e => setVal('correctAnswer', e.target.value)}
                      placeholder="Впишіть правильну відповідь..."
                      className="text-xs px-2.5 py-1.5 border rounded-lg bg-slate-50 w-2/3"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 mt-1.5">
                    <label className="text-[10px] text-slate-400 font-bold uppercase">Пояснення логіки (Explanation):</label>
                    <textarea
                      value={getVal('explanation')}
                      onChange={e => setVal('explanation', e.target.value)}
                      placeholder="Поясніть студентам, чому це слово є зайвим..."
                      rows={2}
                      className="text-white text-xs p-2.5 text-slate-800 bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 leading-relaxed font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TYPE 8: CLOZE DESIGNER */}
            {activeType === 'cloze' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Налаштування пропущених слів:</span>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Будь ласка, вписуйте індикатори типу <strong>[blank1]</strong>, <strong>[blank2]</strong> у текст запитання вище. Конструктор виділить їх для доповнення.
                </p>

                {(() => {
                  const qText = getVal('question', '');
                  const matchesKeys: string[] = [];
                  const regex = /\[(blank\d+)]/g;
                  let m;
                  while ((m = regex.exec(qText)) !== null) {
                    matchesKeys.push(m[1]);
                  }

                  let correctBlanksObj: Record<string, string> = {};
                  try { correctBlanksObj = JSON.parse(getVal('correctBlanks', '{}')); } catch {}

                  return (
                    <div className="space-y-2">
                      {matchesKeys.map(keyName => (
                        <div key={keyName} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-mono font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-1 rounded">
                            {keyName}
                          </span>
                          <input
                            type="text"
                            value={correctBlanksObj[keyName] || ''}
                            onChange={(e) => {
                              const updated = { ...correctBlanksObj, [keyName]: e.target.value };
                              setVal('correctBlanks', JSON.stringify(updated), 'object');
                            }}
                            placeholder="Правильне пропущене слово..."
                            className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded text-slate-800 font-semibold"
                          />
                        </div>
                      ))}
                      {matchesKeys.length === 0 && (
                        <div className="text-center p-3 text-slate-400 text-xs bg-slate-50 border border-dashed rounded-lg">
                          У вашому тексті питання поки що немає тегів з пропусками. Введіть [blank1] у тексті питання!
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TYPE 9: NUMERIC DESIGNER */}
            {activeType === 'numeric' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🔢 Правильне число (Exact Value)</label>
                  <input
                    type="number"
                    value={getVal('correctNumber', '0')}
                    onChange={e => setVal('correctNumber', e.target.value, 'number')}
                    className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">📐 Похибка / Допуск (Tolerance)</label>
                  <input
                    type="number"
                    value={getVal('tolerance', '0')}
                    onChange={e => setVal('tolerance', e.target.value, 'number')}
                    className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* TYPE 10: AUDIO QUESTION DESIGNER */}
            {activeType === 'audio_question' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🎵 Посилання на аудіофайл (Media URL)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={getVal('mediaUrl')}
                      onChange={e => setVal('mediaUrl', e.target.value)}
                      placeholder="https://example.com/sound.mp3"
                      className="flex-1 bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg overflow-x-auto text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => testAudio(getVal('mediaUrl'))}
                      className="p-2.5 bg-slate-100 border rounded-lg hover:border-amber-400 text-slate-850 cursor-pointer"
                      title="Слухати аудіо"
                    >
                      <Music className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Answers Choice mapping */}
                <span className="text-xs font-bold text-slate-700 block">Виберіть індекс правильної відповіді:</span>
                <div className="flex flex-col gap-2">
                  {optionsList.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <input
                        type="radio"
                        name="correct-audio-radio"
                        checked={Number(getVal('correctOptionIndex', '0')) === oIdx}
                        onChange={() => setVal('correctOptionIndex', String(oIdx), 'number')}
                        className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-slate-300"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={e => handleOptionTextUpdate(oIdx, e.target.value)}
                        placeholder={`Варіант ${oIdx+1}`}
                        className="flex-1 bg-white border border-slate-200 text-xs px-2.5 py-1 rounded"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TYPE 11: IMAGE HOTSPOT DESIGNER */}
            {activeType === 'image_choice' && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">🖼️ Посилання на зображення (Image URL)</label>
                  <input
                    type="text"
                    value={getVal('imageUrl')}
                    onChange={e => setVal('imageUrl', e.target.value)}
                    placeholder="https://example.com/diagram.jpg"
                    className="bg-slate-50 border border-slate-200 text-xs px-3 py-2 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-slate-500">Координата X (%)</label>
                    <input
                      type="number"
                      value={getVal('correctHotspotX', '50')}
                      onChange={e => setVal('correctHotspotX', e.target.value, 'number')}
                      className="bg-slate-50 border rounded p-1.5 text-xs font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-slate-500">Координата Y (%)</label>
                    <input
                      type="number"
                      value={getVal('correctHotspotY', '30')}
                      onChange={e => setVal('correctHotspotY', e.target.value, 'number')}
                      className="bg-slate-50 border rounded p-1.5 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-400 font-bold uppercase">Область індексу/Назва гарячої точки:</label>
                  <input
                    type="text"
                    value={getVal('correctHotspotId', 'heart')}
                    onChange={e => setVal('correctHotspotId', e.target.value)}
                    className="bg-slate-50 border rounded px-3 py-2 text-xs"
                    placeholder="e.g. heart"
                  />
                </div>
              </div>
            )}

            {/* TYPE 12: MATRIX DESIGNER */}
            {activeType === 'matrix' && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 block">Порівняльна таблиця / Матриця зв'язків:</span>
                
                {(() => {
                  let rows: string[] = [];
                  let cols: string[] = [];
                  let ansObj: Record<string, string> = {};

                  try { rows = JSON.parse(getVal('rows', '[]')); } catch {}
                  try { cols = JSON.parse(getVal('columns', '[]')); } catch {}
                  try { ansObj = JSON.parse(getVal('answers', '{}')); } catch {}

                  return (
                    <div className="space-y-3 text-[11px]">
                      <div className="flex items-center gap-2">
                        <label className="font-bold shrink-0 text-slate-400 uppercase text-[9px]">Ряди (Rows):</label>
                        <input
                          type="text"
                          value={rows.join(', ')}
                          onChange={e => setVal('rows', JSON.stringify(e.target.value.split(',').map(s=>s.trim()).filter(Boolean)), 'array')}
                          placeholder="Хімія, Проза"
                          className="flex-1 bg-slate-50 border rounded p-1.5 text-xs font-semibold"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="font-bold shrink-0 text-slate-400 uppercase text-[9px]">Колонки (Cols):</label>
                        <input
                          type="text"
                          value={cols.join(', ')}
                          onChange={e => setVal('columns', JSON.stringify(e.target.value.split(',').map(s=>s.trim()).filter(Boolean)), 'array')}
                          placeholder="Рідкий, Твердий"
                          className="flex-1 bg-slate-50 border rounded p-1.5 text-xs font-semibold"
                        />
                      </div>

                      {rows.length > 0 && cols.length > 0 && (
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                          <table className="w-full text-left text-[11.5px] border-collapse">
                            <thead>
                              <tr className="border-b border-slate-200">
                                <th className="p-1.5 font-bold text-slate-500">Об'єкт</th>
                                {cols.map(c => <th key={c} className="p-1.5 font-bold text-slate-650 shrink-0 select-all truncate max-w-[80px]" title={c}>{c}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map(r => (
                                <tr key={r} className="border-b border-slate-100 last:border-0 hover:bg-slate-100/50">
                                  <td className="p-1.5 font-bold text-slate-700 select-all">{r}</td>
                                  {cols.map(c => (
                                    <td key={c} className="p-1.5">
                                      <input
                                        type="radio"
                                        name={`matrix-rad-${r}`}
                                        checked={ansObj[r] === c}
                                        onChange={() => {
                                          const next = { ...ansObj, [r]: c };
                                          setVal('answers', JSON.stringify(next), 'object');
                                        }}
                                        className="h-3.5 w-3.5 text-amber-500 focus:ring-amber-400 border-slate-300 cursor-pointer"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {!activeType && (
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2.5">
                <Sparkles className="h-6 w-6 text-amber-500 animate-pulse" />
                <p className="font-extrabold text-slate-800">Не активовано розширений конструктор відповідей</p>
                <p className="text-[11px] text-slate-400 line-height-[1.4] max-w-md">
                  Оберіть один із 12 типів питань Noesis у таблиці вище. Це автоматично ініціалізує нові поля у документі збереження, не пошкоджуючи вже введені тексти.
                </p>
              </div>
            )}

          </div>

        </div>
      )}

      {/* RENDER TAB 2: INTERACTIVE RUNTIME SIMULATION SANDBOX */}
      {activePreviewTab === 'sandbox' && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 flex flex-col gap-4 shadow-2xs">
          
          <div className="space-y-1 bg-white border p-3 rounded-lg border-slate-200">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
              <span>СИМУЛЯТОР СТУДЕНТА (STUDENT VIEW)</span>
              <span className="font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-bold">Points: {getVal('points', '10')} балів</span>
            </div>
            <h4 className="text-xs font-bold font-semibold text-slate-900 leading-relaxed mt-2 p-0.5">
              {getVal('question', 'Запитання порожнє')}
            </h4>
          </div>

          {/* SIMULATED CLIENT WORKSPACE */}
          <div className="min-h-[140px] flex flex-col gap-2.5">
            
            {/* SINGLE CHOICE RUNTIME */}
            {activeType === 'single_choice' && (
              <div className="flex flex-col gap-1.5">
                {optionsList.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    onClick={() => { setUserSelectedIdx(oIdx); setSandboxResult(null); }}
                    className={`w-full text-left p-3 text-xs rounded-xl border transition ${
                      userSelectedIdx === oIdx 
                        ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold' 
                        : 'border-slate-200 hover:bg-slate-100/50 text-slate-700 bg-white'
                    }`}
                  >
                    <span className="font-mono text-[10px] font-bold text-slate-400 mr-2 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded leading-none">
                      {String.fromCharCode(65 + oIdx)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* MULTIPLE CHOICE RUNTIME */}
            {activeType === 'multiple_choice' && (
              <div className="flex flex-col gap-1.5">
                {optionsList.map((opt, oIdx) => {
                  const isChecked = userSelectedIndices.includes(oIdx);
                  return (
                    <button
                      key={oIdx}
                      onClick={() => {
                        let next = [...userSelectedIndices];
                        if (next.includes(oIdx)) {
                          next = next.filter(i => i !== oIdx);
                        } else {
                          next = [...next, oIdx];
                        }
                        setUserSelectedIndices(next);
                        setSandboxResult(null);
                      }}
                      className={`w-full text-left p-3 text-xs rounded-xl border transition flex items-center gap-2 ${
                        isChecked 
                          ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold' 
                          : 'border-slate-200 hover:bg-slate-100/50 text-slate-700 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        readOnly
                        className="h-4 w-4 rounded text-amber-500 border-slate-300"
                      />
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* TRUE / FALSE RUNTIME */}
            {activeType === 'true_false' && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setUserTrueFalseVal(true); setSandboxResult(null); }}
                  className={`p-4 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                    userTrueFalseVal === true
                      ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Істина (True)
                </button>
                <button
                  onClick={() => { setUserTrueFalseVal(false); setSandboxResult(null); }}
                  className={`p-4 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1.5 ${
                    userTrueFalseVal === false
                      ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  Хибність (False)
                </button>
              </div>
            )}

            {/* OPEN TEXT RUNTIME */}
            {activeType === 'open_text' && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Впишіть сюди власну відповідь..."
                  value={userTextAnswer}
                  onChange={e => { setUserTextAnswer(e.target.value); setSandboxResult(null); }}
                  className="w-full text-xs bg-white border border-slate-200 p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            {/* SORTING CHRONOLOGY RUNTIME */}
            {activeType === 'sorting' && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 italic">Спробуйте відсортувати елементи у логічному порядку:</p>
                {userSortingItems.map((v, sIdx) => (
                  <div key={sIdx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 text-xs">
                    <span>{v}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (sIdx === 0) return;
                          const clone = [...userSortingItems];
                          const tmp = clone[sIdx];
                          clone[sIdx] = clone[sIdx - 1];
                          clone[sIdx - 1] = tmp;
                          setUserSortingItems(clone);
                          setSandboxResult(null);
                        }}
                        disabled={sIdx === 0}
                        className="p-1 hover:text-amber-600 disabled:opacity-35 transition"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => {
                          if (sIdx === userSortingItems.length - 1) return;
                          const clone = [...userSortingItems];
                          const tmp = clone[sIdx];
                          clone[sIdx] = clone[sIdx+1];
                          clone[sIdx+1] = tmp;
                          setUserSortingItems(clone);
                          setSandboxResult(null);
                        }}
                        disabled={sIdx === userSortingItems.length - 1}
                        className="p-1 hover:text-amber-600 disabled:opacity-35 transition"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* NUMERIC RUNTIME */}
            {activeType === 'numeric' && (
              <input
                type="number"
                placeholder="Введіть отримане числове значення..."
                value={userNumericVal}
                onChange={e => { setUserNumericVal(e.target.value); setSandboxResult(null); }}
                className="w-full text-xs bg-white border p-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
              />
            )}

            {/* AUDIO RUNTIME */}
            {activeType === 'audio_question' && (
              <div className="space-y-3">
                <button
                  onClick={() => testAudio(getVal('mediaUrl'))}
                  className="w-full p-3 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl transition font-mono text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Music className="h-4 w-4 animate-pulse" />
                  {playingAudio ? 'Призупинити прослуховування...' : 'Слухати аудіо-підказку'}
                </button>

                <div className="flex flex-col gap-1.5">
                  {optionsList.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => { setUserSelectedIdx(oIdx); setSandboxResult(null); }}
                      className={`w-full text-left p-3 text-xs rounded-xl border transition ${
                        userSelectedIdx === oIdx 
                          ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold' 
                          : 'border-slate-200 hover:bg-slate-100/50 text-slate-700 bg-white'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FIND ODD RUNTIME */}
            {activeType === 'find_odd' && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-slate-400 italic">Виберіть єдиний елемент, який логічно відрізняється від інших:</p>
                {optionsList.map((opt, oIdx) => (
                  <button
                    key={oIdx}
                    onClick={() => { setUserSelectedIdx(oIdx); setSandboxResult(null); }}
                    className={`w-full text-left p-3 text-xs rounded-xl border transition ${
                      userSelectedIdx === oIdx 
                        ? 'border-amber-500 bg-amber-50/50 text-amber-950 font-bold' 
                        : 'border-slate-200 hover:bg-slate-100/50 text-slate-700 bg-white'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* MATCHING RUNTIME */}
            {activeType === 'matching' && (
              <div className="space-y-2">
                {(() => {
                  let lSides: string[] = [];
                  let rSides: string[] = [];
                  try { lSides = JSON.parse(getVal('leftSides', '[]')); } catch {}
                  try { rSides = JSON.parse(getVal('rightSides', '[]')); } catch {}

                  return (
                    <div className="flex flex-col gap-2">
                      {lSides.map(leftV => (
                        <div key={leftV} className="flex items-center justify-between gap-1 p-2 bg-white rounded-lg border">
                          <span className="text-xs font-bold text-slate-700">{leftV}</span>
                          <span className="text-slate-350 select-none">➔</span>
                          <select
                            value={userMatches[leftV] || ''}
                            onChange={(e) => {
                              setUserMatches({ ...userMatches, [leftV]: e.target.value });
                              setSandboxResult(null);
                            }}
                            className="text-xs bg-slate-50 border p-1 rounded focus:outline-none"
                          >
                            <option value="">Оберіть пару...</option>
                            {rSides.map(rV => <option key={rV} value={rV}>{rV}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* MATRIX RUNTIME */}
            {activeType === 'matrix' && (
              <div className="overflow-x-auto bg-white p-2.5 rounded-xl border">
                {(() => {
                  let rows: string[] = [];
                  let cols: string[] = [];
                  try { rows = JSON.parse(getVal('rows', '[]')); } catch {}
                  try { cols = JSON.parse(getVal('columns', '[]')); } catch {}

                  return (
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b">
                          <th className="p-1.5 p-1 text-slate-400 uppercase text-[9px]">Об'єкти</th>
                          {cols.map(c => <th key={c} className="p-1">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r} className="border-b last:border-0 hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-700">{r}</td>
                            {cols.map(c => (
                              <td key={c} className="p-1">
                                <input
                                  type="radio"
                                  name={`student-matrix-${r}`}
                                  checked={userMatrixAnswers[r] === c}
                                  onChange={() => {
                                    setUserMatrixAnswers({ ...userMatrixAnswers, [r]: c });
                                    setSandboxResult(null);
                                  }}
                                  className="h-3.5 w-3.5 text-amber-500"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}

            {/* CLOZE INLINE RUNTIME */}
            {activeType === 'cloze' && (
              <div className="space-y-4">
                {(() => {
                  const qText = getVal('question', '');
                  const parts = qText.split(/(\[blank\d+])/g);

                  return (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl leading-relaxed text-xs font-semibold text-slate-800">
                      {parts.map((p, pIdx) => {
                        const isBlank = p.startsWith('[blank');
                        if (isBlank) {
                          const blankKey = p.substring(1, p.length - 1);
                          return (
                            <input
                              key={pIdx}
                              type="text"
                              value={userMatches[blankKey] || ''}
                              onChange={(e) => {
                                setUserMatches({ ...userMatches, [blankKey]: e.target.value });
                                setSandboxResult(null);
                              }}
                              placeholder={`${blankKey}`}
                              className="mx-1 px-1.5 py-1 text-xs border-b-2 border-amber-400 bg-amber-50/40 text-amber-950 font-bold focus:bg-white focus:outline-none w-20 text-center rounded"
                            />
                          );
                        } else {
                          return <span key={pIdx}>{p}</span>;
                        }
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* IMAGE CHOICE RUNTIME */}
            {activeType === 'image_choice' && (
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 italic">Клацніть на правильну гарячу точку зображення:</p>
                <div className="relative border rounded-lg overflow-hidden bg-slate-900 group">
                  <img
                    src={getVal('imageUrl')}
                    alt="Anatomy scheme"
                    referrerPolicy="no-referrer"
                    onClick={() => {
                      setUserSelectedIdx(0); // landing coordinates match
                      setSandboxResult(null);
                    }}
                    className="w-full object-cover max-h-[160px] opacity-90 hover:opacity-100 transition duration-300"
                  />
                  {/* Indicator showing the active placement of correct dot */}
                  <div 
                    style={{ 
                      left: `${getVal('correctHotspotX', '50')}%`, 
                      top: `${getVal('correctHotspotY', '30')}%`,
                    }} 
                    className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400 bg-emerald-500/30 animate-ping pointer-events-none"
                  />
                  {userSelectedIdx !== null && (
                    <div 
                      style={{ 
                        left: `${getVal('correctHotspotX', '50')}%`, 
                        top: `${getVal('correctHotspotY', '30')}%`,
                      }} 
                      className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500 shadow pointer-events-none"
                    />
                  )}
                </div>
              </div>
            )}

          </div>

          {/* SANDBOX CONTROLS */}
          <div className="border-t border-slate-100 pt-3 mt-1 flex flex-col gap-2.5">
            <button
              onClick={handleCheckAnswer}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-extrabold text-xs py-2 px-3 rounded-lg shadow-sm transition active:scale-98 cursor-pointer flex items-center justify-center gap-1"
            >
              Перевірити відповідь (Verify Test Answer)
            </button>

            {/* EVAL RESULT PROMPT */}
            {sandboxResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-3.5 rounded-xl text-xs font-semibold leading-relaxed border flex gap-2 items-start ${
                  sandboxResult.isCorrect 
                    ? 'bg-emerald-50 text-emerald-950 border-emerald-200' 
                    : 'bg-rose-50 text-rose-950 border-rose-200'
                }`}
              >
                <span className="text-base leading-none shrink-0">{sandboxResult.isCorrect ? '✅' : '❌'}</span>
                <div>
                  <p className="font-extrabold">{sandboxResult.isCorrect ? 'Відповідь Вірна!' : 'Відповідь Невірна'}</p>
                  <p className="text-[11px] text-slate-650 mt-1 font-medium">{sandboxResult.feedback}</p>
                </div>
              </motion.div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
