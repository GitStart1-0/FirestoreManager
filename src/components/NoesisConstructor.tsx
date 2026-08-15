import React, { lazy, Suspense, useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  doc, 
  runTransaction, 
  increment, 
  Firestore,
  setDoc,
  getDoc,
  writeBatch,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { SavedConnection } from '../types';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  BookOpen, 
  HelpCircle, 
  Check, 
  X, 
  RefreshCw, 
  Copy, 
  ExternalLink,
  Layers,
  Flame,
  FileCheck,
  ToggleLeft,
  ChevronRight,
  Info,
  ChevronDown,
  Search,
  Pencil,
  Users,
  Eye,
  EyeOff,
  Database,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { LevelPublishPanel } from './LevelPublishPanel';
import {
  isNativeTournamentQuestionType,
  resolveTournamentQuestionType,
  adaptMainToTournamentSingleChoice,
  validateTournamentIndices,
  sanitizeTournamentIndices
} from '../services/tournamentQuestionAdapter';
import { normalizeApostrophes, slugify } from '../shared/text/slugify';
import { LazyPanelFallback } from '../shared/ui/LazyPanelFallback';
import {
  publishTournamentQuestion,
  TournamentQuestionPayload
} from '../features/tournaments/publishTournamentQuestion';
import { DISCIPLINARY_GROUPS, DISCIPLINE_MAP } from '../domain/content/disciplines';
import { ConstructorMode, ConstructorModeTabs } from './ConstructorModeTabs';
import { ContentPolicyFields } from './ContentPolicyFields';
import { DEFAULT_CONTENT_POLICY, normalizeContentPolicy } from '../types/contentPolicy';

const CausalGraphConstructor = lazy(async () => {
  const module = await import('./CausalGraphConstructor');
  return { default: module.CausalGraphConstructor };
});

const LogicConstructorWorkspace = lazy(async () => {
  const module = await import('../features/logic/LogicConstructorWorkspace');
  return { default: module.LogicConstructorWorkspace };
});

interface NoesisConstructorProps {
  dbInstance: Firestore | null;
  authInstance: Auth | null;
  bypassAuth?: boolean;
  activeConn?: SavedConnection;
  onOpenCredentials?: () => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshExplorer: () => void;
  loadRequest?: {
    category: string;
    level: number;
    lang: string;
    questionId: string;
    questionData: any;
  } | null;
  clearLoadRequest?: () => void;
  sharedLang?: string;
  setSharedLang?: (val: string) => void;
  sharedCategory?: string;
  setSharedCategory?: (val: string) => void;
  sharedLevel?: number;
  setSharedLevel?: (val: number) => void;
  sharedQuestionNumber?: string;
  setSharedQuestionNumber?: (val: string) => void;
  sharedBlockIdentifier?: string;
  setSharedBlockIdentifier?: (val: string) => void;
}

interface LiteratureSource {
  name: string;
  link: string;
}

const MAX_LEVEL_LITERATURE_SOURCES = 4;

const parseLiteratureSources = (value: unknown): LiteratureSource[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(item => ({
      name: typeof item.name === 'string' ? item.name : '',
      link: typeof item.link === 'string' ? item.link : ''
    }))
    .slice(0, MAX_LEVEL_LITERATURE_SOURCES);
};

export default function NoesisConstructor({
  dbInstance,
  authInstance,
  bypassAuth,
  activeConn,
  onOpenCredentials,
  triggerToast,
  onRefreshExplorer,
  loadRequest,
  clearLoadRequest,
  sharedLang,
  setSharedLang,
  sharedCategory,
  setSharedCategory,
  sharedLevel,
  setSharedLevel,
  sharedQuestionNumber,
  setSharedQuestionNumber,
  sharedBlockIdentifier,
  setSharedBlockIdentifier
}: NoesisConstructorProps) {

  // Safety utility for localStorage
  const getStorageItem = (key: string, defaultValue: string) => {
    try {
      return localStorage.getItem(key) || defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  const getStorageJSON = <T,>(key: string, defaultValue: T): T => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  };

  const setStorageItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // ignore
    }
  };

  const setStorageJSON = <T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore
    }
  };

  // Default templates list to avoid overwriting user typed custom questions
  const DEFAULT_QUESTION_TEMPLATES = [
    'Який основний принцип утилітаризму Джеремі Бентама?',
    'Які з наведених тверджень відображають дух філософії утилітаризму?',
    'Деонтологія вважає, що моральний вчинок оцінюється виключно за його наслідками.',
    'Розташуйте мислителів у хронологічному порядку їхньої діяльності.',
    'Встановіть відповідність між філософським напрямом та його засновником.',
    'Розподіліть гносеологічні тези за відповідними напрямами.',
    'Яка країна вважається батьківщиною класичного прагматизму?',
    'Пропущений термін: Кант сформулював знаменитий [ ] імператив.',
    'Оберіть античний портрет Аристотеля з наведених варіантів.',
    'У XIV столітті, під час правління монгольської династії Юань, у китайському місті Цзіндечжень відбулася справжня технологічна революція, яка на століття визначила обличчя світової кераміки. Майстри поєднали чисту білу порцеляну з підполивним розписом кобальтом, який привозили з Персії (так званий «мусульманський синій»). Отримані вироби з розкішними драконами, феніксами та квітковими мотивами стали головним предметом експорту та розкоші від Європи до Близького Сходу.',
    'Аналіз уривків історичних джерел.',
    'Введіть статистичні дані соціологічного опитування.',
    'Про яку історичну чи філософську постать йдеться у фактах?'
  ];

  // Placement settings (with hybrid wrappers to sync with shared parent parameters)
  const [localLang, setLocalLang] = useState(() => getStorageItem('noesis_lang', 'ua'));
  const lang = sharedLang !== undefined ? sharedLang : localLang;
  const setLang = (val: string) => {
    if (setSharedLang) setSharedLang(val);
    setLocalLang(val);
    setStorageItem('noesis_lang', val);
  };

  const [localQuizCategory, setLocalQuizCategory] = useState(() => getStorageItem('noesis_category', 'erudite'));
  const quizCategory = sharedCategory !== undefined ? sharedCategory : localQuizCategory;
  const setQuizCategory = (val: string) => {
    if (setSharedCategory) setSharedCategory(val);
    setLocalQuizCategory(val);
    setStorageItem('noesis_category', val);
  };

  const [localLevel, setLocalLevel] = useState<number>(() => Number(getStorageItem('noesis_level', '1')));
  const level = sharedLevel !== undefined ? sharedLevel : localLevel;
  const setLevel = (val: number | ((prev: number) => number)) => {
    const nextVal = typeof val === 'function' ? val(level) : val;
    if (setSharedLevel) setSharedLevel(nextVal);
    setLocalLevel(nextVal);
    setStorageItem('noesis_level', String(nextVal));
  };

  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'plus' | 'expert'>(() => (getStorageItem('noesis_subscription_tier', 'free') as 'free' | 'plus' | 'expert'));
  const [quizName, setQuizName] = useState(() => getStorageItem('noesis_quiz_name', ''));
  const [author, setAuthor] = useState(() => getStorageItem('noesis_author', ''));
  const [levelDescription, setLevelDescription] = useState(() => getStorageItem('noesis_level_description', ''));
  const [levelRecommendedLiterature, setLevelRecommendedLiterature] = useState<LiteratureSource[]>([]);
  const [isLevelLiteratureLoading, setIsLevelLiteratureLoading] = useState(false);
  const [isLevelLiteratureSaving, setIsLevelLiteratureSaving] = useState(false);
  const [loadedLevelLiteraturePath, setLoadedLevelLiteraturePath] = useState('');
  const [levelLiteratureLoadError, setLevelLiteratureLoadError] = useState('');

  const [localQuestionNumber, setLocalQuestionNumber] = useState<string>(() => getStorageItem('noesis_qnum', '1'));
  const questionNumber = sharedQuestionNumber !== undefined ? sharedQuestionNumber : localQuestionNumber;
  const setQuestionNumber = (val: string | ((prev: string) => string)) => {
    const nextVal = typeof val === 'function' ? val(questionNumber) : val;
    if (setSharedQuestionNumber) setSharedQuestionNumber(nextVal);
    setLocalQuestionNumber(nextVal);
    setStorageItem('noesis_qnum', nextVal);
  };

  const [localBlockIdentifier, setLocalBlockIdentifier] = useState<string>(() => getStorageItem('noesis_block', 'A'));
  const blockIdentifier = sharedBlockIdentifier !== undefined ? sharedBlockIdentifier : localBlockIdentifier;
  const setBlockIdentifier = (val: string) => {
    if (setSharedBlockIdentifier) setSharedBlockIdentifier(val);
    setLocalBlockIdentifier(val);
    setStorageItem('noesis_block', val);
  };

  const [questionIdName, setQuestionIdName] = useState<string>(() => getStorageItem('noesis_question_id_name', ''));
  
  // Debate Constructor State Mode
  const [constructorMode, setConstructorMode] = useState<ConstructorMode>('quiz');

  // Debate Topic form states
  const [topicId, setTopicId] = useState('ua--symposium--ethics--can-always-tell-truth');
  const [isManualTopicId, setIsManualTopicId] = useState(false);
  const [topicMode, setTopicMode] = useState<'symposium' | 'dialectic'>('symposium');
  const [topicTitle, setTopicTitle] = useState("Чи можна завжди казати правду?");
  const [topicDesc, setTopicDesc] = useState("Тема для вільного обговорення про правду, моральну відповідальність і ситуації, коли чесність може мати складні наслідки.");
  const [topicDisciplineId, setTopicDisciplineId] = useState('ethics');
  const [topicLang, setTopicLang] = useState<'ua' | 'de' | 'en' | 'all'>('ua');
  const [topicOrder, setTopicOrder] = useState<number>(10);
  const [topicStatus, setTopicStatus] = useState<'active' | 'draft' | 'archived'>('active');

  // Debate Discipline form states
  const [discId, setDiscId] = useState('ethics');
  const [isManualDiscId, setIsManualDiscId] = useState(false);
  const [discName, setDiscName] = useState('');
  const [discDesc, setDiscDesc] = useState('');
  const [discOrder, setDiscOrder] = useState<number>(10);
  const [discStatus, setDiscStatus] = useState<'active' | 'draft' | 'archived'>('active');
  const [discLang, setDiscLang] = useState<'ua' | 'de' | 'en' | 'all'>('ua');

  // Debate Form Sub-Tab selection
  const [activeDebateSubTab, setActiveDebateSubTab] = useState<'topics' | 'disciplines'>('topics');

  // Loaded topics, disciplines, and filters
  const [loadedTopics, setLoadedTopics] = useState<any[]>([]);
  const [loadedDisciplines, setLoadedDisciplines] = useState<any[]>([]);
  const [topicFilterMode, setTopicFilterMode] = useState<string>('all');
  const [topicFilterLang, setTopicFilterLang] = useState<string>('all');
  const [topicFilterDiscipline, setTopicFilterDiscipline] = useState<string>('all');
  const [topicFilterStatus, setTopicFilterStatus] = useState<string>('all');
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');

  // Loaded disciplines filters
  const [discFilterLang, setDiscFilterLang] = useState<string>('all');
  const [discFilterStatus, setDiscFilterStatus] = useState<string>('all');
  const [discSearchQuery, setDiscSearchQuery] = useState<string>('');

  // Constructor Access Privileges state
  const [hasConstructorPermission, setHasConstructorPermission] = useState<boolean>(false);
  const [isCheckingConstructor, setIsCheckingConstructor] = useState<boolean>(false);
  const [isActivatingAccess, setIsActivatingAccess] = useState<boolean>(false);

  useEffect(() => {
    if (!dbInstance) {
      setHasConstructorPermission(false);
      return;
    }

    if (bypassAuth) {
      setHasConstructorPermission(true);
      setIsCheckingConstructor(false);
      return;
    }

    if (!authInstance) {
      setHasConstructorPermission(false);
      return;
    }

    let isSubscribed = true;
    setIsCheckingConstructor(true);

    const checkAccess = async () => {
      try {
        if (bypassAuth) {
          if (isSubscribed) {
            setHasConstructorPermission(true);
            setIsCheckingConstructor(false);
          }
          return;
        }

        const user = authInstance.currentUser;
        if (!user) {
          if (isSubscribed) {
            setHasConstructorPermission(false);
            setIsCheckingConstructor(false);
          }
          return;
        }

        // 1. If admin email
        if (user.email === 'ivan555211992@gmail.com') {
          if (isSubscribed) {
            setHasConstructorPermission(true);
            setIsCheckingConstructor(false);
          }
          return;
        }

        // 2. Fetch /constructorAccess/{uid}
        const docRef = doc(dbInstance, 'constructorAccess', user.uid);
        const docSnap = await getDoc(docRef);
        if (isSubscribed) {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const hasAccess = 
              data?.content === true || 
              data?.tournamentQuestions === true || 
              data?.admin === true || 
              data?.role === 'admin';
            
            setHasConstructorPermission(hasAccess);
          } else {
            setHasConstructorPermission(false);
          }
          setIsCheckingConstructor(false);
        }
      } catch (err) {
        console.error("Error checking constructor permission: ", err);
        if (isSubscribed) {
          setHasConstructorPermission(false);
          setIsCheckingConstructor(false);
        }
      }
    };

    checkAccess();

    let unsubscribe = () => {};
    try {
      unsubscribe = authInstance.onAuthStateChanged(
        () => { checkAccess(); },
        (err: any) => {
          console.warn("Constructor Auth observer error:", err);
          if (isSubscribed) {
            if (bypassAuth) setHasConstructorPermission(true);
            setIsCheckingConstructor(false);
          }
        }
      );
    } catch (err) {
      console.warn("Constructor onAuthStateChanged exception:", err);
    }

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [dbInstance, authInstance, bypassAuth]);

  const handleActivateConstructorAccess = async () => {
    if (!dbInstance || !authInstance) {
      triggerToast('No active database or authentication client! Connect first.', 'error');
      return;
    }
    const user = authInstance.currentUser;
    if (!user) {
      triggerToast('Будь ласка, увійдіть в систему спочатку! (Please sign in first.)', 'error');
      return;
    }

    try {
      setIsActivatingAccess(true);
      const docRef = doc(dbInstance, 'constructorAccess', user.uid);
      await setDoc(docRef, {
        content: true,
        tournamentQuestions: true,
        email: user.email || '',
        displayName: user.displayName || '',
        activatedAt: Date.now()
      });
      setHasConstructorPermission(true);
      triggerToast('Доступ конструктора активовано успішно! (Constructor access activated successfully!)', 'success');
    } catch (err: any) {
      console.error(err);
      triggerToast(`Не вдалося активувати доступ: ${err.message || 'Помилка доступу'}`, 'error');
    } finally {
      setIsActivatingAccess(false);
    }
  };
  
  // Sync basic configurations to localStorage
  useEffect(() => {
    setStorageItem('noesis_lang', lang);
  }, [lang]);

  useEffect(() => {
    setStorageItem('noesis_subscription_tier', subscriptionTier);
  }, [subscriptionTier]);

  useEffect(() => {
    setStorageItem('noesis_quiz_name', quizName);
  }, [quizName]);

  useEffect(() => {
    setStorageItem('noesis_author', author);
  }, [author]);

  useEffect(() => {
    setStorageItem('noesis_level_description', levelDescription);
  }, [levelDescription]);

  useEffect(() => {
    setStorageItem('noesis_question_id_name', questionIdName);
  }, [questionIdName]);

  useEffect(() => {
    setStorageItem('noesis_category', quizCategory);
  }, [quizCategory]);

  useEffect(() => {
    setStorageItem('noesis_level', String(level));
  }, [level]);

  useEffect(() => {
    setStorageItem('noesis_block', blockIdentifier);
  }, [blockIdentifier]);

  useEffect(() => {
    setStorageItem('noesis_qnum', questionNumber);
  }, [questionNumber]);
  
  // Stable random suffix is generated once and changes only when the user chooses to or after saved.
  const [randomSuffix, setRandomSuffix] = useState(() => Math.random().toString(36).substring(2, 6));
  const [isEditingIdSlug, setIsEditingIdSlug] = useState(false);

  // Stale state tracking for question inputs (to allow auto-clearing upon focus/click after save)
  const [isQuestionTextStale, setIsQuestionTextStale] = useState(false);
  const [isExplanationStale, setIsExplanationStale] = useState(false);
  const [isLiteratureStale, setIsLiteratureStale] = useState(false);
  const [isOptionsStale, setIsOptionsStale] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishingLevelBundle, setIsPublishingLevelBundle] = useState(false);
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);

  // Taxonomy
  const [scientificDisciplines, setScientificDisciplines] = useState<string>(() => getStorageItem('noesis_scientific_disciplines', 'philosophy'));
  const [disciplinesDropdownOpen, setDisciplinesDropdownOpen] = useState(false);
  const [disciplinesSearch, setDisciplinesSearch] = useState('');
  const [topicsInput, setTopicsInput] = useState<string>(() => getStorageItem('noesis_topics_input', ''));

  useEffect(() => {
    setStorageItem('noesis_scientific_disciplines', scientificDisciplines);
  }, [scientificDisciplines]);

  useEffect(() => {
    setStorageItem('noesis_topics_input', topicsInput);
  }, [topicsInput]);

  // Select helper for scientific disciplines list
  const selectedIds = useMemo(() => {
    return scientificDisciplines.split(',').map(s => s.trim()).filter(Boolean);
  }, [scientificDisciplines]);

  const toggleDiscipline = (val: string) => {
    let newList: string[];
    if (selectedIds.includes(val)) {
      newList = selectedIds.filter(id => id !== val);
    } else {
      newList = [...selectedIds, val];
    }
    setScientificDisciplines(newList.join(', '));
  };

  // Common Question fields
  const [questionText, setQuestionText] = useState(() => getStorageItem('noesis_question_text', 'Який основний принцип утилітаризму Джеремі Бентама?'));
  const [shortTask, setShortTask] = useState(() => getStorageItem('noesis_short_task', 'Оберіть серед поданих зображень китайську порцелянову вазу, яка репрезентує цей всесвітній культ'));
  const [isShortTaskStale, setIsShortTaskStale] = useState(false);
  const [explanation, setExplanation] = useState(() => getStorageItem('noesis_explanation', 'Бентамова етика оцінює дію за її наслідками для щастя найбільшої кількості людей.'));
  const [recommendedLiterature, setRecommendedLiterature] = useState<{ name: string; link: string }[]>(() => getStorageJSON('noesis_literature', [
    { name: 'Вступ до принципів моралі та законодавства', link: 'https://uk.wikipedia.org/wiki/Джеремі_Бентам' }
  ]));
  const [literatureHiddenAtStart, setLiteratureHiddenAtStart] = useState<boolean>(() => {
    const val = getStorageItem('noesis_literature_hidden', 'false');
    return val === 'true';
  });
  const [contentPolicy, setContentPolicy] = useState(() => ({ ...DEFAULT_CONTENT_POLICY }));

  useEffect(() => {
    setStorageItem('noesis_question_text', questionText);
  }, [questionText]);

  useEffect(() => {
    setStorageItem('noesis_short_task', shortTask);
  }, [shortTask]);

  useEffect(() => {
    setStorageItem('noesis_explanation', explanation);
  }, [explanation]);

  useEffect(() => {
    setStorageJSON('noesis_literature', recommendedLiterature);
  }, [recommendedLiterature]);

  useEffect(() => {
    setStorageItem('noesis_literature_hidden', String(literatureHiddenAtStart));
  }, [literatureHiddenAtStart]);

  // Question Types enum
  const [questionType, setQuestionType] = useState<string>(() => getStorageItem('noesis_question_type', 'SINGLE_CHOICE'));

  useEffect(() => {
    setStorageItem('noesis_question_type', questionType);
  }, [questionType]);

  // Interactive Specific values
  const [options, setOptions] = useState<{ value: string; isCorrect: boolean }[]>(() => getStorageJSON('noesis_options', [
    { value: 'Максимізація найбільшого щастя для найбільшої кількості людей', isCorrect: true },
    { value: 'Дотримання безумовного морального обов\'язку', isCorrect: false },
    { value: 'Пошук істини через діалог', isCorrect: false },
    { value: 'Визнання чеснот як головної мети', isCorrect: false },
    { value: 'Абсолютне заперечення наслідків дії', isCorrect: false },
    { value: 'Перевага традиції над користю', isCorrect: false }
  ]));
  const [correctSingleChoice, setCorrectSingleChoice] = useState<number>(() => Number(getStorageItem('noesis_correct_single_choice', '0')));

  useEffect(() => {
    setStorageJSON('noesis_options', options);
  }, [options]);

  useEffect(() => {
    setStorageItem('noesis_correct_single_choice', String(correctSingleChoice));
  }, [correctSingleChoice]);

  // TRUE_FALSE Specific
  const [trueFalseAnswer, setTrueFalseAnswer] = useState<boolean>(() => getStorageItem('noesis_tf_answer', 'true') === 'true');

  useEffect(() => {
    setStorageItem('noesis_tf_answer', String(trueFalseAnswer));
  }, [trueFalseAnswer]);

  // SEQUENCE Specific
  const [sequenceItems, setSequenceItems] = useState<{ value: string; order: string }[]>(() => getStorageJSON('noesis_sequence_items', [
    { value: 'Заснування Киева', order: '1' },
    { value: 'Хрещення Русі', order: '2' },
    { value: 'Люблинська унія', order: '3' },
    { value: 'Проголошення Незалежності', order: '4' }
  ]));

  useEffect(() => {
    setStorageJSON('noesis_sequence_items', sequenceItems);
  }, [sequenceItems]);

  // MATCHING Specific (Left side options + Right side options)
  const [matchingLeft, setMatchingLeft] = useState<{ value: string; match: string }[]>(() => getStorageJSON('noesis_matching_left', [
    { value: 'Кант', match: 'A' },
    { value: 'Бентам', match: 'B' },
    { value: 'Фейєрбах', match: 'C' },
    { value: 'Платон', match: 'D' }
  ]));
  const [matchingRight, setMatchingRight] = useState<{ value: string }[]>(() => getStorageJSON('noesis_matching_right', [
    { value: 'Категоричний імператив' }, // A
    { value: 'Принцип користі' },        // B
    { value: 'Проекційна критика релігії' }, // C
    { value: 'Теорія ідей' },            // D
    { value: 'Діалектичний матеріалізм' } // Extra distractor
  ]));
  const [extraOptionIndex, setExtraOptionIndex] = useState<number>(() => Number(getStorageItem('noesis_extra_option_index', '4')));

  useEffect(() => {
    setStorageJSON('noesis_matching_left', matchingLeft);
  }, [matchingLeft]);

  useEffect(() => {
    setStorageJSON('noesis_matching_right', matchingRight);
  }, [matchingRight]);

  useEffect(() => {
    setStorageItem('noesis_extra_option_index', String(extraOptionIndex));
  }, [extraOptionIndex]);

  // COMPARISON Specific
  const [comparisonCategories, setComparisonCategories] = useState<string[]>(() => getStorageJSON('noesis_comparison_categories', ['Емпіризм', 'Раціоналізм', 'Спільне']));
  const [comparisonStatements, setComparisonStatements] = useState<{ text: string; correctCategoryIndex: string }[]>(() => getStorageJSON('noesis_comparison_statements', [
    { text: 'Наголошує на ролі досвіду', correctCategoryIndex: '0' },
    { text: 'Наголошує на ролі розуму', correctCategoryIndex: '1' },
    { text: 'Досліджує джерела пізнання', correctCategoryIndex: '2' }
  ]));

  useEffect(() => {
    setStorageJSON('noesis_comparison_categories', comparisonCategories);
  }, [comparisonCategories]);

  useEffect(() => {
    setStorageJSON('noesis_comparison_statements', comparisonStatements);
  }, [comparisonStatements]);

  // PAIRWISE_DISTINCTION Specific
  const [pairwiseObjects, setPairwiseObjects] = useState<{
    id: string;
    name: string;
    imagePath: string;
    altText?: string;
  }[]>(() => getStorageJSON('noesis_pairwise_objects', [
    {
      id: 'alligator',
      name: 'Алігатор',
      imagePath: '/quiz-images/erudite/level-0001/q012/alligator.webp',
      altText: 'Голова алігатора з широкою мордою'
    },
    {
      id: 'crocodile',
      name: 'Крокодил',
      imagePath: '/quiz-images/erudite/level-0001/q012/crocodile.webp',
      altText: 'Голова крокодила з вузькою мордою'
    }
  ]));

  const [pairwiseStatements, setPairwiseStatements] = useState<{
    id: string;
    text: string;
    correctObjectId: string;
  }[]>(() => getStorageJSON('noesis_pairwise_statements', [
    {
      id: 'snout_u',
      text: 'Має широку U-подібну морду',
      correctObjectId: 'alligator'
    },
    {
      id: 'snout_v',
      text: 'Має вужчу V-подібну морду',
      correctObjectId: 'crocodile'
    },
    {
      id: 'teeth',
      text: 'При закритій пащі частіше видно нижні зуби',
      correctObjectId: 'crocodile'
    },
    {
      id: 'freshwater',
      text: 'Частіше трапляється у прісній воді',
      correctObjectId: 'alligator'
    }
  ]));

  useEffect(() => {
    setStorageJSON('noesis_pairwise_objects', pairwiseObjects);
  }, [pairwiseObjects]);

  useEffect(() => {
    setStorageJSON('noesis_pairwise_statements', pairwiseStatements);
  }, [pairwiseStatements]);

  // TEXT_INPUT
  const [textAnswer, setTextAnswer] = useState(() => getStorageItem('noesis_text_answer', 'утилітаризм'));

  useEffect(() => {
    setStorageItem('noesis_text_answer', textAnswer);
  }, [textAnswer]);

  // FILL_IN_THE_BLANK
  const [fillInParts, setFillInParts] = useState<{ type: 'text' | 'blank'; value: string }[]>(() => getStorageJSON('noesis_fill_in_parts', [
    { type: 'text', value: 'Етична теорія Бентама називається ' },
    { type: 'blank', value: 'утилітаризм' },
    { type: 'text', value: '.' }
  ]));

  useEffect(() => {
    setStorageJSON('noesis_fill_in_parts', fillInParts);
  }, [fillInParts]);

  // IMAGE_CHOICE
  const [imageOptions, setImageOptions] = useState<{ url: string; name?: string; description?: string }[]>(() => getStorageJSON('noesis_image_options', [
    { url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400', name: 'Леопольд Козелух', description: 'Класичний австрійський композитор' },
    { url: 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=400', name: 'Вольфганг Амадей Моцарт', description: 'Геніальний композитор класичної епохи' },
    { url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400', name: 'Йозеф Гайдн', description: 'Батько класичної симфонії' },
    { url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400', name: 'Людвіг ван Бетховен', description: 'Представник віденської класики та раннього романтизму' }
  ]));
  const [correctImageChoice, setCorrectImageChoice] = useState<number>(() => Number(getStorageItem('noesis_correct_image_choice', '1')));

  useEffect(() => {
    setStorageJSON('noesis_image_options', imageOptions);
  }, [imageOptions]);

  useEffect(() => {
    setStorageItem('noesis_correct_image_choice', String(correctImageChoice));
  }, [correctImageChoice]);

  // READING_COMPREHENSION
  const [readingText1, setReadingText1] = useState(() => getStorageItem('noesis_reading_text1', 'Наші вчинки мають утилітарну цінність. Чим більше загальної користі ми приносимо в результаті дії, тим благороднішим є наш крок з погляду Бентама.'));
  const [readingText2, setReadingText2] = useState(() => getStorageItem('noesis_reading_text2', 'Проте кантіанська деонтологія наполягає на зворотному: наслідки ніщо, а чистий моральний обов’язок та добра воля — це все, що має справжню вартість.'));
  const [readingCompQuestions, setReadingCompQuestions] = useState<{
    question: string;
    options: { value: string }[];
    correctAnswerIndex: string;
  }[]>(() => getStorageJSON('noesis_reading_comp_questions', [
    {
      question: 'Що є головним критерієм моральності за Бентамом?',
      options: [{ value: 'Загальна користь результату' }, { value: 'Суворий обов’язок' }, { value: 'Релігійні канони' }, { value: 'Особистий егоїзм' }],
      correctAnswerIndex: '0'
    },
    {
      question: 'Чому Кванту деонтологія протилежна утилітаризму?',
      options: [{ value: 'Вона ігнорує наслідки вчинків' }, { value: 'Вона підкреслює матеріальну вигоду' }, { value: 'Вона заперечує розум' }, { value: 'Вона створена раніше' }],
      correctAnswerIndex: '0'
    }
  ]));

  useEffect(() => {
    setStorageItem('noesis_reading_text1', readingText1);
  }, [readingText1]);

  useEffect(() => {
    setStorageItem('noesis_reading_text2', readingText2);
  }, [readingText2]);

  useEffect(() => {
    setStorageJSON('noesis_reading_comp_questions', readingCompQuestions);
  }, [readingCompQuestions]);

  // SLIDER_SCALE
  const [respondentsCount, setRespondentsCount] = useState(() => getStorageItem('noesis_slider_respondents', '28 333'));
  const [countriesCount, setCountriesCount] = useState(() => getStorageItem('noesis_slider_countries', '25'));
  const [surveyPeriod, setSurveyPeriod] = useState(() => getStorageItem('noesis_slider_period', 'січень–квітень 2025'));
  const [researchCenter, setResearchCenter] = useState(() => getStorageItem('noesis_slider_center', 'Pew Research Center'));
  const [sliders, setSliders] = useState<{ question: string; correctAnswer: number }[]>(() => getStorageJSON('noesis_sliders', [
    { question: 'Який відсоток опитаних повністю відкинули деонтологію?', correctAnswer: 42 },
    { question: 'Скільки відсотків підтримали розширену свободу волі?', correctAnswer: 78 }
  ]));

  useEffect(() => {
    setStorageItem('noesis_slider_respondents', respondentsCount);
  }, [respondentsCount]);

  useEffect(() => {
    setStorageItem('noesis_slider_countries', countriesCount);
  }, [countriesCount]);

  useEffect(() => {
    setStorageItem('noesis_slider_period', surveyPeriod);
  }, [surveyPeriod]);

  useEffect(() => {
    setStorageItem('noesis_slider_center', researchCenter);
  }, [researchCenter]);

  useEffect(() => {
    setStorageJSON('noesis_sliders', sliders);
  }, [sliders]);

  // TEN_FACTS
  const [tenFacts, setTenFacts] = useState<{ value: string }[]>(() => getStorageJSON('noesis_ten_facts', [
    { value: 'Він народився в Лондоні у родині юристів.' },
    { value: 'Був надзвичайно обдарованою дитиною: вивчав латину у віці трьох років.' },
    { value: 'Його вважають засновником етичної теорії утилітаризму.' },
    { value: 'Сформулював так зване «обчислення щастя» (hedonic calculus).' },
    { value: 'Заповідав забальзамувати своє тіло після смерті.' },
    { value: 'Йому належить термін «інтернаціональний».' },
    { value: 'Він рішуче виступав за рівні права жінок та скасування рабства.' },
    { value: 'Вважав, що тварини здатні страждати, тому мають права.' },
    { value: 'Його ідеї вплинули на Джон Стюарта Мілля та інших реформаторів.' },
    { value: 'Він стверджував, що природа поставила людство под владу задоволення та болю.' }
  ]));

  useEffect(() => {
    setStorageJSON('noesis_ten_facts', tenFacts);
  }, [tenFacts]);

  // Tournament Fields
  const [saveToTournament, setSaveToTournament] = useState<boolean>(() => getStorageItem('noesis_save_to_tournament', 'false') === 'true');
  const [tournamentYear, setTournamentYear] = useState<string>(() => getStorageItem('noesis_tournament_year', '2026'));
  const [tournamentQuestion, setTournamentQuestion] = useState<string>(() => getStorageItem('noesis_tournament_question', ''));
  const [tournamentCategoryId, setTournamentCategoryId] = useState<string>(() => getStorageItem('noesis_tournament_category_id', 'science'));
  const [tournamentDifficulty, setTournamentDifficulty] = useState<number>(() => Number(getStorageItem('noesis_tournament_difficulty', '2')));
  const [tournamentStatus, setTournamentStatus] = useState<string>(() => getStorageItem('noesis_tournament_status', 'active'));
  const [tournamentEnabledState, setTournamentEnabledState] = useState<boolean>(() => getStorageItem('noesis_tournament_enabled_state', 'true') === 'true');
  const [tournamentTopicLabel, setTournamentTopicLabel] = useState<string>(() => getStorageItem('noesis_tournament_topic_label', ''));
  const [tournamentSourceVersion, setTournamentSourceVersion] = useState<number>(() => Number(getStorageItem('noesis_tournament_source_version', '1')));
  const [tournamentSchemaVersion, setTournamentSchemaVersion] = useState<number>(() => Number(getStorageItem('noesis_tournament_schema_version', '1')));

  const [useMainAnswers, setUseMainAnswers] = useState<boolean>(() => getStorageItem('noesis_use_main_answers', 'true') === 'true');
  const [tournamentAnswers, setTournamentAnswers] = useState<string[]>(() => getStorageJSON('noesis_tournament_answers', ['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D']));
  const [tournamentCorrectIndices, setTournamentCorrectIndices] = useState<number[]>(() => getStorageJSON('noesis_tournament_correct_indices', [0]));
  const [tournamentTrueFalseAnswer, setTournamentTrueFalseAnswer] = useState<boolean>(() => getStorageItem('noesis_tournament_tf_answer', 'true') === 'true');
  const [tournamentTextAnswers, setTournamentTextAnswers] = useState<string>(() => getStorageItem('noesis_tournament_text_answers', ''));

  const [tournamentPublishResult, setTournamentPublishResult] = useState<{
    questionId: string;
    contentHash: string;
    sourceVersion: number;
    schemaVersion: number;
  } | null>(null);
  const [tournamentPublishError, setTournamentPublishError] = useState<string | null>(null);
  const [isPublishingTournament, setIsPublishingTournament] = useState<boolean>(false);

  // Workflow tracking states
  const [isMainQuestionSaved, setIsMainQuestionSaved] = useState<boolean>(false);
  const [lastSavedSourcePath, setLastSavedSourcePath] = useState<string | null>(null);
  const [tournamentPublicationStatus, setTournamentPublicationStatus] = useState<'NOT_PUBLISHED' | 'PUBLISHED' | 'NEEDS_UPDATE'>('NOT_PUBLISHED');

  useEffect(() => {
    setStorageItem('noesis_save_to_tournament', String(saveToTournament));
  }, [saveToTournament]);

  useEffect(() => {
    setStorageItem('noesis_tournament_year', tournamentYear);
  }, [tournamentYear]);

  useEffect(() => {
    setStorageItem('noesis_tournament_question', tournamentQuestion);
  }, [tournamentQuestion]);

  useEffect(() => {
    setStorageItem('noesis_tournament_category_id', tournamentCategoryId);
  }, [tournamentCategoryId]);

  useEffect(() => {
    setStorageItem('noesis_tournament_difficulty', String(tournamentDifficulty));
  }, [tournamentDifficulty]);

  useEffect(() => {
    setStorageItem('noesis_tournament_status', tournamentStatus);
  }, [tournamentStatus]);

  useEffect(() => {
    setStorageItem('noesis_tournament_enabled_state', String(tournamentEnabledState));
  }, [tournamentEnabledState]);

  useEffect(() => {
    setStorageItem('noesis_tournament_topic_label', tournamentTopicLabel);
  }, [tournamentTopicLabel]);

  useEffect(() => {
    setStorageItem('noesis_tournament_source_version', String(tournamentSourceVersion));
  }, [tournamentSourceVersion]);

  useEffect(() => {
    setStorageItem('noesis_tournament_schema_version', String(tournamentSchemaVersion));
  }, [tournamentSchemaVersion]);

  useEffect(() => {
    setStorageItem('noesis_use_main_answers', String(useMainAnswers));
  }, [useMainAnswers]);

  useEffect(() => {
    setStorageJSON('noesis_tournament_answers', tournamentAnswers);
  }, [tournamentAnswers]);

  useEffect(() => {
    setStorageJSON('noesis_tournament_correct_indices', tournamentCorrectIndices);
  }, [tournamentCorrectIndices]);

  useEffect(() => {
    setStorageItem('noesis_tournament_tf_answer', String(tournamentTrueFalseAnswer));
  }, [tournamentTrueFalseAnswer]);

  useEffect(() => {
    setStorageItem('noesis_tournament_text_answers', tournamentTextAnswers);
  }, [tournamentTextAnswers]);

  // Listen for external Question loading request from Explorer
  useEffect(() => {
    if (!loadRequest) return;
    const { category, level: reqLevel, lang: reqLang, questionId, questionData } = loadRequest;
    
    try {
      // 1. Basic properties
      setLang(reqLang || 'ua');
      setQuizCategory(category || 'erudite');
      setLevel(reqLevel || 1);
      
      const qType = questionData.type || 'SINGLE_CHOICE';
      setQuestionType(qType);
      setQuestionText(questionData.question || '');
      setExplanation(questionData.explanation || '');
      
      setTopicsInput(Array.isArray(questionData.topics) ? questionData.topics.join(', ') : '');
      setScientificDisciplines(Array.isArray(questionData.scientificDisciplines) ? questionData.scientificDisciplines.join(', ') : '');
      
      if (Array.isArray(questionData.recommendedLiterature)) {
        setRecommendedLiterature(questionData.recommendedLiterature);
      } else {
        setRecommendedLiterature([]);
      }
      setLiteratureHiddenAtStart(Boolean(questionData.literatureHiddenAtStart ?? questionData.isLiteratureHiddenAtStart ?? false));
      setContentPolicy(normalizeContentPolicy(questionData));

      // 2. Parse Question ID to segments so it can be re-assembled correctly
      const idParts = questionId.split('--');
      if (idParts.length >= 2) {
        // e.g. ua--01--A--utilitarianism-bentham--xyz
        const qNumParsed = String(parseInt(idParts[1], 10) || 1);
        setQuestionNumber(qNumParsed);
        
        let blockSeg = '';
        let slugSeg = '';
        let suffixSeg = '';
        
        if (idParts.length === 3) {
          slugSeg = idParts[2];
        } else if (idParts.length === 4) {
          slugSeg = idParts[2];
          suffixSeg = idParts[3];
        } else if (idParts.length >= 5) {
          blockSeg = idParts[2];
          slugSeg = idParts.slice(3, -1).join('--');
          suffixSeg = idParts[idParts.length - 1];
        }
        
        setBlockIdentifier(blockSeg);
        setQuestionIdName(slugSeg);
        if (suffixSeg) {
          setRandomSuffix(suffixSeg);
        }
      }

      // 3. Specific fields per type
      if (qType === 'SINGLE_CHOICE') {
        const answersArr = Array.isArray(questionData.answers) ? questionData.answers : [];
        const correctIdx = Array.isArray(questionData.correctAnswerIndices) ? (questionData.correctAnswerIndices[0] ?? 0) : 0;
        setCorrectSingleChoice(correctIdx);
        setOptions(answersArr.map((v, i) => ({ value: v, isCorrect: i === correctIdx })));
      }
      else if (qType === 'MULTIPLE_CHOICE') {
        const answersArr = Array.isArray(questionData.answers) ? questionData.answers : [];
        const correctIndices = Array.isArray(questionData.correctAnswerIndices) ? questionData.correctAnswerIndices : [];
        setOptions(answersArr.map((v, i) => ({ value: v, isCorrect: correctIndices.includes(i) })));
      }
      else if (qType === 'TRUE_FALSE') {
        setTrueFalseAnswer(questionData.correctAnswer === true);
      }
      else if (qType === 'SEQUENCE') {
        const answersArr = Array.isArray(questionData.answers) ? questionData.answers : [];
        const correctIndices = Array.isArray(questionData.correctAnswerIndices) ? questionData.correctAnswerIndices : [];
        const rebuilt = answersArr.map((v, idx) => {
          const sortedPos = correctIndices.indexOf(idx);
          const orderNum = sortedPos !== -1 ? String(sortedPos + 1) : String(idx + 1);
          return { value: v, order: orderNum };
        });
        setSequenceItems(rebuilt);
      }
      else if (qType === 'MATCHING') {
        const leftArr = Array.isArray(questionData.leftSide) ? questionData.leftSide : [];
        const rightArr = Array.isArray(questionData.rightSide) ? questionData.rightSide : [];
        const correctMatches = Array.isArray(questionData.correctMatches) ? questionData.correctMatches : [];
        
        setMatchingRight(rightArr.map(v => ({ value: v })));
        
        const rebuiltLeft = leftArr.map((v, idx) => {
          const matchObj = correctMatches.find(m => m && m.leftIndex === idx);
          const rightIdx = matchObj ? matchObj.rightIndex : null;
          const matchChar = rightIdx !== null && rightIdx >= 0 && rightIdx < rightArr.length ? String.fromCharCode(65 + rightIdx) : '';
          return { value: v, match: matchChar };
        });
        setMatchingLeft(rebuiltLeft);
      }
      else if (qType === 'COMPARISON') {
        if (Array.isArray(questionData.categories)) {
          setComparisonCategories(questionData.categories);
        }
        if (Array.isArray(questionData.statements)) {
          const mapped = questionData.statements.map((s: any) => {
            return {
              text: s.text || '',
              correctCategoryIndex: String(s.correctCategory ?? 0)
            };
          });
          setComparisonStatements(mapped);
        }
      }
      else if (qType === 'PAIRWISE_DISTINCTION') {
        if (Array.isArray(questionData.objects)) {
          setPairwiseObjects(questionData.objects.map((o: any) => ({
            id: o.id || '',
            name: o.name || '',
            imagePath: o.imagePath || '',
            altText: o.altText || ''
          })));
        }
        if (Array.isArray(questionData.statements)) {
          setPairwiseStatements(questionData.statements.map((s: any) => ({
            id: s.id || '',
            text: s.text || '',
            correctObjectId: s.correctObjectId || ''
          })));
        }
      }
      else if (qType === 'TEXT_INPUT') {
        const correctAnswers = Array.isArray(questionData.correctAnswers) ? questionData.correctAnswers : [];
        setTextAnswer(correctAnswers.join(', '));
      }
      else if (qType === 'FILL_IN_THE_BLANK') {
        // Reconstruct fillInParts
        const qRaw = questionData.question || '';
        const blankAnswers = Array.isArray(questionData.correctAnswers) ? questionData.correctAnswers : [];
        
        const segments = qRaw.split(' [ ] ');
        const parts: { type: 'text' | 'blank'; value: string }[] = [];
        
        segments.forEach((seg, sIdx) => {
          if (seg) {
            parts.push({ type: 'text', value: seg });
          }
          if (sIdx < segments.length - 1) {
            parts.push({ type: 'blank', value: blankAnswers[sIdx] || '' });
          }
        });
        setFillInParts(parts);
      }
      else if (qType === 'IMAGE_CHOICE') {
        const correctIdx = Array.isArray(questionData.correctAnswerIndices) ? (questionData.correctAnswerIndices[0] ?? 0) : 0;
        setCorrectImageChoice(correctIdx);
        setShortTask(questionData.shortTask || 'Оберіть серед поданих зображень китайську порцелянову вазу, яка репрезентує цей всесвітній культ');

        if (Array.isArray(questionData.imageDetails)) {
          setImageOptions(questionData.imageDetails.map((v: any) => ({
            url: v.url || '',
            name: v.name || '',
            description: v.description || ''
          })));
        } else {
          const answersArr = Array.isArray(questionData.answers) ? questionData.answers : [];
          setImageOptions(answersArr.map((v: any) => {
            if (v && typeof v === 'object') {
              return {
                url: v.url || '',
                name: v.name || '',
                description: v.description || ''
              };
            }
            return { url: String(v || ''), name: '', description: '' };
          }));
        }
      }
      else if (qType === 'READING_COMPREHENSION') {
        setReadingText1(questionData.text1 || '');
        setReadingText2(questionData.text2 || '');
        if (Array.isArray(questionData.questions)) {
          const rebuiltQuestions = questionData.questions.map((q: any) => ({
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options.map((o: any) => ({ value: o })) : [],
            correctAnswerIndex: String(q.correctAnswerIndex ?? 0)
          }));
          setReadingCompQuestions(rebuiltQuestions);
        }
      }
      else if (qType === 'SLIDER_SCALE') {
        setRespondentsCount(questionData.respondentsCount || '');
        setCountriesCount(questionData.countriesCount || '');
        setSurveyPeriod(questionData.surveyPeriod || '');
        setResearchCenter(questionData.researchCenter || '');
        if (Array.isArray(questionData.sliders)) {
          setSliders(questionData.sliders);
        }
      }
      else if (qType === 'TEN_FACTS') {
        const factsArr = Array.isArray(questionData.facts) ? questionData.facts : [];
        setTenFacts(factsArr.map(f => ({ value: f })));
        
        const answersArr = Array.isArray(questionData.answers) ? questionData.answers : [];
        const correctIdx = Array.isArray(questionData.correctAnswerIndices) ? (questionData.correctAnswerIndices[0] ?? 0) : 0;
        setCorrectSingleChoice(correctIdx);
        setOptions(answersArr.map((v, i) => ({ value: v, isCorrect: i === correctIdx })));
      }
      
      // 4. Pre-populate the tournament mirror for every source type.
      setTournamentQuestion(questionData.question || '');
      setTournamentTopicLabel(Array.isArray(questionData.topics) ? questionData.topics[0] || '' : '');
      setSaveToTournament(false);

      if (isNativeTournamentQuestionType(qType)) {
        setUseMainAnswers(true);

        if (qType === 'SINGLE_CHOICE' || qType === 'MULTIPLE_CHOICE') {
          const answersArr = Array.isArray(questionData.answers) ? questionData.answers : [];
          const correctIndices = Array.isArray(questionData.correctAnswerIndices) ? questionData.correctAnswerIndices : [0];
          setTournamentAnswers(answersArr.length > 0 ? answersArr : ['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D']);
          setTournamentCorrectIndices(correctIndices);
        }
        else if (qType === 'TRUE_FALSE') {
          setTournamentTrueFalseAnswer(questionData.correctAnswer === true);
        }
        else if (qType === 'TEXT_INPUT') {
          const correctAnswers = Array.isArray(questionData.correctAnswers) ? questionData.correctAnswers : [];
          setTournamentTextAnswers(correctAnswers.join(', '));
        }
      } else {
        setUseMainAnswers(false);
        setTournamentAnswers(['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D']);
        setTournamentCorrectIndices([0]);
      }
      
      triggerToast(`Successfully loaded question ${idParts[1] || '01'} from DB!`, 'success');
    } catch (err: any) {
      console.error(err);
      triggerToast(`Failed to automatically populate constructor fields: ${err.message}`, 'error');
    } finally {
      if (clearLoadRequest) clearLoadRequest();
    }
  }, [loadRequest, clearLoadRequest, triggerToast]);

  // Sandbox Game state for interactive testing
  const [sandboxAnswerObj, setSandboxAnswerObj] = useState<any>(null);
  const [sandboxResponseFeedback, setSandboxResponseFeedback] = useState<string | null>(null);
  const [sandboxPassed, setSandboxPassed] = useState<boolean | null>(null);

  // Sync Default Template field pre-sets if user changes QuestionType
  useEffect(() => {
    // Reset sandbox
    setSandboxResponseFeedback(null);
    setSandboxPassed(null);
    setSandboxAnswerObj(null);

    // Guard update: Only overwrite template text if current questionText is blank or matches a template 
    // to prevent losing user customized query texts
    const isBlankOrTemplateText = !questionText.trim() || DEFAULT_QUESTION_TEMPLATES.includes(questionText);
    if (!isBlankOrTemplateText) return;

    // Adjust descriptions and default questions slightly to match the type
    if (questionType === 'SINGLE_CHOICE') {
      setQuestionText('Який основний принцип утилітаризму Джеремі Бентама?');
    } else if (questionType === 'MULTIPLE_CHOICE') {
      setQuestionText('Які з наведених тверджень відображають дух філософії утилітаризму?');
    } else if (questionType === 'TRUE_FALSE') {
      setQuestionText('Деонтологія вважає, що моральний вчинок оцінюється виключно за його наслідками.');
    } else if (questionType === 'SEQUENCE') {
      setQuestionText('Розташуйте мислителів у хронологічному порядку їхньої діяльності.');
    } else if (questionType === 'MATCHING') {
      setQuestionText('Встановіть відповідність між філософським напрямом та його засновником.');
    } else if (questionType === 'COMPARISON') {
      setQuestionText('Розподіліть гносеологічні тези за відповідними напрямами.');
    } else if (questionType === 'TEXT_INPUT') {
      setQuestionText('Яка країна вважається батьківщиною класичного прагматизму?');
    } else if (questionType === 'FILL_IN_THE_BLANK') {
      setQuestionText('Пропущений термін: Кант сформулював знаменитий [ ] імператив.');
    } else if (questionType === 'IMAGE_CHOICE') {
      setQuestionText('У XIV столітті, під час правління монгольської династії Юань, у китайському місті Цзіндечжень відбулася справжня технологічна революція, яка на століття визначила обличчя світової кераміки. Майстри поєднали чисту білу порцеляну з підполивним розписом кобальтом, який привозили з Персії (так званий «мусульманський синій»). Отримані вироби з розкішними драконами, феніксами та квітковими мотивами стали головним предметом експорту та розкоші від Європи до Близького Сходу.');
      setShortTask('Оберіть серед поданих зображень китайську порцелянову вазу, яка репресутнує цей всесвітній культ');
    } else if (questionType === 'READING_COMPREHENSION') {
      setQuestionText('Аналіз уривків історичних джерел.');
    } else if (questionType === 'SLIDER_SCALE') {
      setQuestionText('Введіть статистичні дані соціологічного опитування.');
    } else if (questionType === 'TEN_FACTS') {
      setQuestionText('Про яку історичну чи філософську постать йдеться у фактах?');
    } else if (questionType === 'PAIRWISE_DISTINCTION') {
      setQuestionText('Яка різниця між Алігатором і Крокодилом?');
    }
  }, [questionType]);

  // Generate real-time output data structure
  const questionData = useMemo(() => {
    const rawData: any = {
      lang,
      type: questionType,
      question: questionText,
      topics: topicsInput.split(',').map(s => s.trim()).filter(Boolean),
      scientificDisciplines: scientificDisciplines.split(',').map(s => s.trim()).filter(Boolean),
      explanation: explanation,
      recommendedLiterature: recommendedLiterature.filter(lit => lit.name.trim() !== ''),
      literatureHiddenAtStart: literatureHiddenAtStart,
      minimumAge: contentPolicy.minimumAge,
      contentWarnings: contentPolicy.contentWarnings,
      contentTags: contentPolicy.contentTags
    };

    // Specific mapping per type
    if (questionType === 'SINGLE_CHOICE') {
      rawData.answers = options.map(o => o.value).filter(Boolean);
      rawData.correctAnswerIndices = [correctSingleChoice];
    } 
    else if (questionType === 'MULTIPLE_CHOICE') {
      rawData.answers = options.map(o => o.value).filter(Boolean);
      rawData.correctAnswerIndices = options
        .map((opt, idx) => opt.isCorrect ? idx : -1)
        .filter(idx => idx !== -1);
    } 
    else if (questionType === 'TRUE_FALSE') {
      rawData.correctAnswer = trueFalseAnswer;
      delete rawData.answers;
      delete rawData.correctAnswerIndices;
    } 
    else if (questionType === 'SEQUENCE') {
      const validSeq = sequenceItems.filter(item => item.value.trim());
      rawData.answers = validSeq.map(item => item.value);
      const sorted = [...validSeq].sort((a, b) => parseInt(a.order, 10) - parseInt(b.order, 10));
      rawData.correctAnswerIndices = sorted.map(sortedItem => 
        validSeq.findIndex(orig => orig === sortedItem)
      );
    } 
    else if (questionType === 'MATCHING') {
      const validL = matchingLeft.filter(item => item.value.trim());
      const validR = matchingRight.filter(item => item.value.trim());
      rawData.leftSide = validL.map(item => item.value);
      rawData.rightSide = validR.map(item => item.value);
      rawData.correctMatches = validL
        .map((leftItem, leftIdx) => {
          const matchChar = leftItem.match?.trim().toUpperCase();
          if (!matchChar) return null;
          const rightAlphaIdx = matchChar.charCodeAt(0) - 65; // A=0, B=1, ...
          if (rightAlphaIdx === extraOptionIndex) return null;
          return { leftIndex: leftIdx, rightIndex: rightAlphaIdx };
        })
        .filter(m => m !== null && m.rightIndex < validR.length);
    } 
    else if (questionType === 'COMPARISON') {
      rawData.categories = comparisonCategories.filter(Boolean);
      rawData.statements = comparisonStatements
        .filter(s => s.text.trim())
        .map(s => {
          let categoryIndex = 0;
          if (s.correctCategoryIndex === 'common') {
            const commonIdx = comparisonCategories.indexOf('Спільне');
            categoryIndex = commonIdx !== -1 ? commonIdx : (comparisonCategories.length - 1);
          } else {
            const parsed = parseInt(s.correctCategoryIndex, 10);
            categoryIndex = !isNaN(parsed) ? parsed : 0;
          }
          if (categoryIndex < 0 || categoryIndex >= comparisonCategories.length) {
            categoryIndex = 0;
          }
          return {
            text: s.text,
            correctCategory: categoryIndex
          };
        });
    } 
    else if (questionType === 'TEXT_INPUT') {
      rawData.correctAnswers = textAnswer
        ? textAnswer.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    } 
    else if (questionType === 'FILL_IN_THE_BLANK') {
      rawData.question = fillInParts
        .map(p => p.type === 'text' ? p.value : ' [ ] ')
        .join('');
      rawData.correctAnswers = fillInParts
        .filter(p => p.type === 'blank' && p.value)
        .map(p => p.value);
    } 
    else if (questionType === 'IMAGE_CHOICE') {
      rawData.shortTask = shortTask;
      rawData.answers = imageOptions.map(img => img.url).filter(Boolean);
      rawData.imageDetails = imageOptions.map(img => ({
        url: img.url || '',
        name: img.name || '',
        description: img.description || ''
      }));
      rawData.correctAnswerIndices = [correctImageChoice];
    } 
    else if (questionType === 'READING_COMPREHENSION') {
      rawData.text1 = readingText1;
      rawData.text2 = readingText2;
      rawData.questions = readingCompQuestions.map(q => ({
        question: q.question,
        options: q.options.map(o => o.value),
        correctAnswerIndex: parseInt(q.correctAnswerIndex, 10)
      }));
      delete rawData.question;
    } 
    else if (questionType === 'SLIDER_SCALE') {
      rawData.respondentsCount = respondentsCount;
      rawData.countriesCount = countriesCount;
      rawData.surveyPeriod = surveyPeriod;
      rawData.researchCenter = researchCenter;
      rawData.sliders = sliders
        .filter(s => s.question.trim())
        .map(s => ({
          question: s.question,
          correctAnswer: s.correctAnswer
        }));
    } 
    else if (questionType === 'TEN_FACTS') {
      rawData.facts = tenFacts.map(f => f.value).filter(Boolean);
      rawData.answers = options.map(o => o.value).filter(Boolean);
      rawData.correctAnswerIndices = [correctSingleChoice];
    }
    else if (questionType === 'PAIRWISE_DISTINCTION') {
      rawData.objects = pairwiseObjects.map(obj => ({
        id: obj.id.trim(),
        name: obj.name.trim(),
        imagePath: obj.imagePath.trim(),
        ...(obj.altText?.trim() ? { altText: obj.altText.trim() } : {})
      }));
      rawData.statements = pairwiseStatements.map(st => ({
        id: st.id.trim(),
        text: st.text.trim(),
        correctObjectId: st.correctObjectId.trim()
      }));
      delete rawData.question;
    }

    // Object and Array details cleaning (Section 12)
    const cleaned = Object.fromEntries(
      Object.entries(rawData).filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return false;
        return true;
      })
    );

    return cleaned;
  }, [
    lang, questionType, questionText, shortTask, topicsInput, scientificDisciplines, 
    explanation, recommendedLiterature, literatureHiddenAtStart, options, correctSingleChoice, 
    trueFalseAnswer, sequenceItems, matchingLeft, matchingRight, extraOptionIndex, 
    comparisonCategories, comparisonStatements, textAnswer, fillInParts, 
    imageOptions, correctImageChoice, readingText1, readingText2, 
    readingCompQuestions, respondentsCount, countriesCount, surveyPeriod, researchCenter, sliders, tenFacts,
    pairwiseObjects, pairwiseStatements, contentPolicy
  ]);

  // Real-time generated Question ID
  const calculatedQuestionId = useMemo(() => {
    const qNum = String(parseInt(questionNumber, 10) || 1).padStart(2, '0');
    const block = blockIdentifier ? `${blockIdentifier.trim().toUpperCase()}--` : '';
    const rawName = questionIdName || questionText?.substring(0, 20) || 'q';
    const qSlug = questionIdName ? slugify(questionIdName).substring(0, 35) : slugify(rawName).substring(0, 20);
    return `${lang}--${qNum}--${block}${qSlug}--${randomSuffix}`;
  }, [lang, questionNumber, blockIdentifier, questionIdName, questionText, randomSuffix]);

  const resolvedCategory = useMemo(() => {
    if (lang === 'ua') {
      return quizCategory;
    }
    return `${quizCategory}_${lang}`;
  }, [quizCategory, lang]);

  const levelDocPath = useMemo(() => {
    return `/${resolvedCategory}/${level}`;
  }, [resolvedCategory, level]);

  const questionDocPath = useMemo(() => {
    return `/${resolvedCategory}/${level}/questions/${calculatedQuestionId}`;
  }, [resolvedCategory, level, calculatedQuestionId]);

  useEffect(() => {
    let isCurrent = true;

    setLevelRecommendedLiterature([]);
    setLoadedLevelLiteraturePath('');
    setLevelLiteratureLoadError('');

    if (!dbInstance) {
      setIsLevelLiteratureLoading(false);
      return () => {
        isCurrent = false;
      };
    }

    setIsLevelLiteratureLoading(true);

    const loadLevelLiterature = async () => {
      try {
        const snapshot = await getDoc(doc(dbInstance, resolvedCategory, String(level)));
        if (!isCurrent) return;

        const sources = snapshot.exists()
          ? parseLiteratureSources(snapshot.data().recommendedLiterature)
          : [];
        setLevelRecommendedLiterature(sources);
        setLoadedLevelLiteraturePath(levelDocPath);
      } catch (error) {
        if (!isCurrent) return;
        console.error('Failed to load level recommended literature', error);
        setLevelLiteratureLoadError('Не вдалося завантажити джерела рівня. Збереження заблоковано, щоб не стерти наявні дані.');
      } finally {
        if (isCurrent) setIsLevelLiteratureLoading(false);
      }
    };

    void loadLevelLiterature();

    return () => {
      isCurrent = false;
    };
  }, [dbInstance, level, levelDocPath, resolvedCategory]);

  const validateLevelLiterature = (): LiteratureSource[] | null => {
    const normalized = levelRecommendedLiterature
      .map(source => ({ name: source.name.trim(), link: source.link.trim() }))
      .filter(source => source.name || source.link);

    if (normalized.some(source => !source.name || !source.link)) {
      triggerToast('Для кожного джерела рівня вкажіть назву та посилання.', 'error');
      return null;
    }
    if (normalized.some(source => !/^https:\/\//i.test(source.link))) {
      triggerToast('Посилання джерел рівня повинні починатися з https://', 'error');
      return null;
    }

    return normalized;
  };

  const handleSaveLevelLiterature = async () => {
    if (!dbInstance) {
      triggerToast('Спочатку підключіть Firebase.', 'error');
      return;
    }
    if (isLevelLiteratureLoading || loadedLevelLiteraturePath !== levelDocPath) {
      triggerToast('Зачекайте, доки завантажаться джерела вибраного рівня.', 'error');
      return;
    }

    const normalized = validateLevelLiterature();
    if (!normalized) return;

    try {
      setIsLevelLiteratureSaving(true);
      await setDoc(
        doc(dbInstance, resolvedCategory, String(level)),
        { recommendedLiterature: normalized },
        { merge: true }
      );
      setLevelRecommendedLiterature(normalized);
      triggerToast(`Джерела рівня ${level} збережено.`, 'success');
      onRefreshExplorer();
    } catch (error) {
      console.error('Failed to save level recommended literature', error);
      triggerToast('Не вдалося зберегти джерела рівня.', 'error');
    } finally {
      setIsLevelLiteratureSaving(false);
    }
  };

  // Save changes to Database using Transaction (Section 16)
  const handleSaveToDatabase = async () => {
    if (!dbInstance) {
      triggerToast('No active database client specified! Setup / Connect first.', 'error');
      return;
    }

    // General field validations
    if (!topicsInput.trim()) {
      triggerToast('Topics tagging is required (Topics)!', 'error');
      return;
    }
    
    // Type specific Validations (Section 15)
    if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') {
      if (options.length === 0) {
        triggerToast('Please provide at least one option!', 'error');
        return;
      }
    }
    if (questionType === 'SINGLE_CHOICE') {
      if (correctSingleChoice < 0 || correctSingleChoice >= options.length) {
        triggerToast('Select exactly 1 correct answer index!', 'error');
        return;
      }
    }
    if (questionType === 'MULTIPLE_CHOICE') {
      const correctIndices = options.map((o, i) => o.isCorrect ? i : -1).filter(i => i !== -1);
      if (correctIndices.length === 0) {
        triggerToast('Please select at least one correct option!', 'error');
        return;
      }
    }
    if (questionType === 'MATCHING') {
      if (matchingLeft.length === 0 || matchingRight.length === 0) {
        triggerToast('Matching left side and right side should have at least one element!', 'error');
        return;
      }
    }
    if (questionType === 'FILL_IN_THE_BLANK') {
      const blanks = fillInParts.filter(p => p.type === 'blank');
      if (blanks.length === 0) {
        triggerToast('Please provide at least one blank slot [ ]!', 'error');
        return;
      }
    }
    if (questionType === 'SEQUENCE') {
      if (sequenceItems.length === 0) {
        triggerToast('Sequence expects at least 1 orderable row!', 'error');
        return;
      }
    }
    if (questionType === 'PAIRWISE_DISTINCTION') {
      if (pairwiseObjects.length !== 2) {
        triggerToast('PAIRWISE_DISTINCTION вимагає рівно 2 об\'єкти!', 'error');
        return;
      }

      for (let i = 0; i < pairwiseObjects.length; i++) {
        const obj = pairwiseObjects[i];
        if (!obj.id.trim() || !obj.name.trim() || !obj.imagePath.trim()) {
          triggerToast(`Об'єкт ${i + 1} має містити ID, Назву та Шлях до зображення (imagePath)!`, 'error');
          return;
        }
      }

      const objIds = pairwiseObjects.map(o => o.id.trim());
      if (new Set(objIds).size !== objIds.length) {
        triggerToast('ID об\'єктів повинні бути унікальними!', 'error');
        return;
      }

      if (pairwiseStatements.length < 2) {
        triggerToast('PAIRWISE_DISTINCTION вимагає щонайменше 2 твердження!', 'error');
        return;
      }

      const statementIds = pairwiseStatements.map(s => s.id.trim());
      if (new Set(statementIds).size !== statementIds.length) {
        triggerToast('ID тверджень повинні бути унікальними!', 'error');
        return;
      }

      for (let i = 0; i < pairwiseStatements.length; i++) {
        const st = pairwiseStatements[i];
        if (!st.id.trim()) {
          triggerToast(`Твердження ${i + 1} має містити унікальний ID!`, 'error');
          return;
        }
        if (!st.text.trim()) {
          triggerToast(`Твердження ${i + 1} не може бути порожнім!`, 'error');
          return;
        }
        if (!objIds.includes(st.correctObjectId.trim())) {
          triggerToast(`Твердження ${i + 1} посилається на неіснуючий correctObjectId "${st.correctObjectId}"!`, 'error');
          return;
        }
      }

      const assignedObjIds = new Set(pairwiseStatements.map(s => s.correctObjectId.trim()));
      if (assignedObjIds.size < 2) {
        triggerToast('Обидва об\'єкти повинні мати хоча б одне правильне твердження!', 'error');
        return;
      }
    }

    await handleSaveQuestion();
  };

  // --- STEP 1: PREPARE DRAFT FOR TOURNAMENT ---
  const handlePrepareTournamentDraft = () => {
      const tType = resolveTournamentQuestionType(questionType);
      const finalQText = questionText.trim() || 'Текст турнірного питання';
      const finalTopic = topicTitle.trim() || '';

      setTournamentQuestion(finalQText);
      setTournamentTopicLabel(finalTopic);
      setTournamentCategoryId(quizCategory || 'science');
      setTournamentDifficulty(tournamentDifficulty || 2);

      if (tType === 'SINGLE_CHOICE') {
        const adapted = adaptMainToTournamentSingleChoice(options, correctSingleChoice);
        setTournamentAnswers(adapted.answers);
        setTournamentCorrectIndices(adapted.correctAnswerIndices);
      } else if (tType === 'MULTIPLE_CHOICE') {
        const nonEmp = options.filter(o => o.value && o.value.trim() !== '');
        if (nonEmp.length >= 2) {
          setTournamentAnswers(nonEmp.map(o => o.value.trim()));
          const correctIdxs = nonEmp.map((o, idx) => o.isCorrect ? idx : -1).filter(i => i !== -1);
          setTournamentCorrectIndices(correctIdxs.length > 0 ? correctIdxs : [0]);
        }
      } else if (tType === 'TRUE_FALSE') {
        setTournamentTrueFalseAnswer(trueFalseAnswer);
      } else if (tType === 'TEXT_INPUT') {
        setTournamentTextAnswers(textAnswer);
      }

      setSaveToTournament(true);
      triggerToast('Чернетку турнірного питання підготовлено!', 'success');
    };

    // --- STEP 2: SAVE MAIN QUESTION ONLY ---
    const handleSaveQuestion = async () => {
      // Main validations
      if (!calculatedQuestionId) {
        triggerToast('Не вдалося сформувати ID питання!', 'error');
        return;
      }
      if (!questionText.trim()) {
        triggerToast('Текст питання не може бути порожнім!', 'error');
        return;
      }

      if (isLevelLiteratureLoading || loadedLevelLiteraturePath !== levelDocPath) {
        triggerToast('Зачекайте, доки завантажаться джерела вибраного рівня.', 'error');
        return;
      }

      const normalizedLevelLiterature = validateLevelLiterature();
      if (!normalizedLevelLiterature) return;

      if (questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') {
        const nonEmp = options.filter(o => o.value && o.value.trim() !== '');
        if (nonEmp.length < 2) {
          triggerToast('Питання повинно мати щонайменше 2 варіанти відповідей!', 'error');
          return;
        }
      }

      try {
        setIsSaving(true);
        const levelId = String(level);
        const levelDocRef = doc(dbInstance, resolvedCategory, levelId);

        await runTransaction(dbInstance, async (transaction) => {
          const levelSnapshot = await transaction.get(levelDocRef);
          const questionRef = doc(collection(levelDocRef, 'questions'), calculatedQuestionId);
          const questionSnapshot = await transaction.get(questionRef);
          const alreadyExists = questionSnapshot.exists();

          if (!levelSnapshot.exists()) {
            transaction.set(levelDocRef, {
              levelNumber: Number(level),
              subscriptionTier: subscriptionTier || 'free',
              status: 'UNLOCKED',
              questionCount: 1,
              recommendedLiterature: normalizedLevelLiterature,
              ...(quizName.trim() ? { name: quizName.trim() } : {}),
              ...(author.trim() ? { author: author.trim() } : {}),
              ...(levelDescription.trim() ? { description: levelDescription.trim() } : {})
            });
          } else {
            transaction.update(levelDocRef, {
              ...(!alreadyExists ? { questionCount: increment(1) } : {}),
              subscriptionTier: subscriptionTier || 'free',
              recommendedLiterature: normalizedLevelLiterature
            });
          }

          transaction.set(questionRef, questionData);
        });

        const fullSourcePath = `${resolvedCategory}/${level}/questions/${calculatedQuestionId}`;
        setIsMainQuestionSaved(true);
        setLastSavedSourcePath(fullSourcePath);

        if (tournamentPublicationStatus === 'PUBLISHED') {
          setTournamentPublicationStatus('NEEDS_UPDATE');
        }

        triggerToast(`Основне питання успішно збережено в Firestore: ${calculatedQuestionId}`, 'success');
        onRefreshExplorer();

        // Increment question number
        const nextNum = parseInt(questionNumber, 10) + 1;
        setQuestionNumber(String(nextNum));
        setRandomSuffix(Math.random().toString(36).substring(2, 6));

        setIsQuestionTextStale(true);
        setIsExplanationStale(true);
        setIsLiteratureStale(true);
        setIsOptionsStale(true);

        // Prepare tournament draft automatically for convenience
        handlePrepareTournamentDraft();

      } catch (err: any) {
        console.error(err);
        triggerToast(`Помилка збереження основного питання: ${err.message}`, 'error');
      } finally {
        setIsSaving(false);
      }
    };

    // --- STEP 3: PUBLISH TO TOURNAMENT POOL ---
    const handlePublishTournament = async () => {
      if (!isMainQuestionSaved && !lastSavedSourcePath) {
        triggerToast('Спочатку збережіть основне питання!', 'error');
        return;
      }

      const finalQuestion = tournamentQuestion.trim() || questionText.trim();
      if (!finalQuestion) {
        triggerToast('Текст запитання для турніру не може бути порожнім!', 'error');
        return;
      }
      if (finalQuestion.length > 400) {
        triggerToast('Текст запитання для турніру не повинен перевищувати 400 символів!', 'error');
        return;
      }

      const finalTopicLabel = tournamentTopicLabel.trim() || null;
      if (finalTopicLabel && finalTopicLabel.length > 100) {
        triggerToast('Тема/Топік для турніру не повинна перевищувати 100 символів!', 'error');
        return;
      }

      const diff = Number(tournamentDifficulty) || 2;
      if (diff < 1 || diff > 5) {
        triggerToast('Складність турніру повинна бути в діапазоні від 1 до 5!', 'error');
        return;
      }

      const sVer = Number(tournamentSourceVersion) || 1;
      const finalSeasonId = tournamentYear.trim() || null;
      if (finalSeasonId) {
        if (finalSeasonId.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(finalSeasonId)) {
          triggerToast('Невалідний ідентифікатор сезону (seasonId)!', 'error');
          return;
        }
      }

      const tType = resolveTournamentQuestionType(questionType);
      const sourcePath = lastSavedSourcePath || `${resolvedCategory}/${level}/questions/${calculatedQuestionId}`;

      if (contentPolicy.minimumAge >= 18 || contentPolicy.contentWarnings.length > 0) {
        triggerToast(
          'Питання 18+ або з попередженнями залишаються лише в основній колекції і не додаються до турнірів.',
          'error'
        );
        return;
      }

      const tPayload: TournamentQuestionPayload = {
        language: lang === 'uk' ? 'ua' : (lang as any),
        categoryId: tournamentCategoryId || quizCategory,
        type: tType,
        question: finalQuestion,
        difficulty: diff,
        status: tournamentStatus || 'active',
        seasonId: finalSeasonId,
        topicLabel: finalTopicLabel,
        sourcePath,
        sourceVersion: sVer,
        minimumAge: contentPolicy.minimumAge,
        contentWarnings: contentPolicy.contentWarnings
      };

      if (tType === 'SINGLE_CHOICE' || tType === 'MULTIPLE_CHOICE') {
        const finalAnswers = tournamentAnswers.map(a => a.trim()).filter(Boolean);
        if (finalAnswers.length < 2 || finalAnswers.length > 6) {
          triggerToast('Турнірне питання має містити від 2 до 6 варіантів відповідей!', 'error');
          return;
        }

        const uniqueAnswers = new Set(finalAnswers);
        if (uniqueAnswers.size !== finalAnswers.length) {
          triggerToast('Варіанти відповідей для турніру не повинні дублюватися!', 'error');
          return;
        }

        const valRes = validateTournamentIndices(tType, finalAnswers.length, tournamentCorrectIndices);
        if (!valRes.valid) {
          triggerToast(valRes.error || 'Помилка індексів правильної відповіді!', 'error');
          return;
        }

        tPayload.answers = finalAnswers;
        tPayload.correctAnswerIndices = tournamentCorrectIndices;

      } else if (tType === 'TRUE_FALSE') {
        tPayload.correctAnswer = tournamentTrueFalseAnswer;

      } else if (tType === 'TEXT_INPUT') {
        const rawAnswers = tournamentTextAnswers;
        const finalCorrectAnswers = Array.from(
          new Set<string>(rawAnswers.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
        );
        if (finalCorrectAnswers.length < 1 || finalCorrectAnswers.length > 12) {
          triggerToast('Для текстового запитання дозволено від 1 до 12 унікальних відповідей!', 'error');
          return;
        }
        tPayload.correctAnswers = finalCorrectAnswers;
      }

      setIsPublishingTournament(true);
      setTournamentPublishError(null);
      setTournamentPublishResult(null);

      try {
        if (!authInstance) {
          throw new Error('Firebase Auth не ініціалізовано.');
        }
        const result = await publishTournamentQuestion(authInstance, tPayload);
        setTournamentPublishResult({
          questionId: result.questionId || calculatedQuestionId,
          contentHash: result.contentHash || 'ok',
          sourceVersion: result.sourceVersion || sVer,
          schemaVersion: result.schemaVersion || 1
        });

        setTournamentPublicationStatus('PUBLISHED');
        triggerToast('Турнірне питання успішно опубліковане у tournamentQuestionPools!', 'success');
      } catch (err: any) {
        console.error(err);
        setTournamentPublishError(err.message || 'Помилка публікації турнірного питання');
        triggerToast(`Помилка публікації в турнір: ${err.message}`, 'error');
      } finally {
        setIsPublishingTournament(false);
      }
    };

  const handleResetFields = () => {
    if (!window.confirm('Скинути всі внесені зміни в поля та повернути початковий шаблон? Ваш поточний текст, варіанти відповідей тощо будуть скинуті.')) {
      return;
    }
    
    // Clear localStorage values
    const keysToClear = [
      'noesis_scientific_disciplines',
      'noesis_topics_input',
      'noesis_question_text',
      'noesis_short_task',
      'noesis_explanation',
      'noesis_literature',
      'noesis_options',
      'noesis_correct_single_choice',
      'noesis_tf_answer',
      'noesis_sequence_items',
      'noesis_matching_left',
      'noesis_matching_right',
      'noesis_extra_option_index',
      'noesis_comparison_categories',
      'noesis_comparison_statements',
      'noesis_text_answer',
      'noesis_fill_in_parts',
      'noesis_image_options',
      'noesis_correct_image_choice',
      'noesis_reading_text1',
      'noesis_reading_text2',
      'noesis_reading_comp_questions',
      'noesis_slider_respondents',
      'noesis_slider_countries',
      'noesis_slider_period',
      'noesis_slider_center',
      'noesis_sliders',
      'noesis_ten_facts',
      'noesis_pairwise_objects',
      'noesis_pairwise_statements',
      'noesis_question_id_name',
      'noesis_save_to_tournament',
      'noesis_tournament_year',
      'noesis_tournament_question',
      'noesis_tournament_category_id',
      'noesis_tournament_difficulty',
      'noesis_tournament_status',
      'noesis_tournament_enabled_state',
      'noesis_tournament_topic_label',
      'noesis_tournament_source_version',
      'noesis_tournament_schema_version',
      'noesis_use_main_answers',
      'noesis_tournament_answers',
      'noesis_tournament_correct_indices',
      'noesis_tournament_tf_answer',
      'noesis_tournament_text_answers'
    ];
    keysToClear.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    });

    // Reset components states back to template defaults
    setSaveToTournament(false);
    setTournamentYear('2026');
    setTournamentQuestion('');
    setTournamentCategoryId('science');
    setTournamentDifficulty(2);
    setTournamentStatus('active');
    setTournamentEnabledState(true);
    setTournamentTopicLabel('');
    setTournamentSourceVersion(1);
    setTournamentSchemaVersion(1);
    setUseMainAnswers(true);
    setTournamentAnswers(['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D']);
    setTournamentCorrectIndices([0]);
    setTournamentTrueFalseAnswer(true);
    setTournamentTextAnswers('');

    setScientificDisciplines('philosophy');
    setTopicsInput('');
    setExplanation('Бентамова етика оцінює дію за її наслідками для щастя найбільшої количества людей.');
    setRecommendedLiterature([
      { name: 'Вступ до принципів моралі та законодавства', link: 'https://uk.wikipedia.org/wiki/Джеремі_Бентам' }
    ]);
    setQuestionType('SINGLE_CHOICE');
    setShortTask('Оберіть серед поданих зображень китайську порцелянову вазу, яка репрезентує цей всесвітній культ');
    setOptions([
      { value: 'Максимізація найбільшого щастя для найбільшої кількості людей', isCorrect: true },
      { value: 'Дотримання безумовного морального обов\'язку', isCorrect: false },
      { value: 'Пошук істини через діалог', isCorrect: false },
      { value: 'Визнання чеснот як головної мети', isCorrect: false },
      { value: 'Абсолютне заперечення наслідків дії', isCorrect: false },
      { value: 'Перевага традиції над користю', isCorrect: false }
    ]);
    setCorrectSingleChoice(0);
    setTrueFalseAnswer(true);
    setSequenceItems([
      { value: 'Заснування Киева', order: '1' },
      { value: 'Хрещення Русі', order: '2' },
      { value: 'Люблинська унія', order: '3' },
      { value: 'Проголошення Незалежності', order: '4' }
    ]);
    setMatchingLeft([
      { value: 'Кант', match: 'A' },
      { value: 'Бентам', match: 'B' },
      { value: 'Фейєрбах', match: 'C' },
      { value: 'Платон', match: 'D' }
    ]);
    setMatchingRight([
      { value: 'Категоричний імператив' },
      { value: 'Принцип користі' },
      { value: 'Проекційна критика релігії' },
      { value: 'Теорія ідей' },
      { value: 'Діалектичний матеріалізм' }
    ]);
    setExtraOptionIndex(4);
    setComparisonCategories(['Емпіризм', 'Раціоналізм', 'Спільне']);
    setComparisonStatements([
      { text: 'Наголошує на ролі досвіду', correctCategoryIndex: '0' },
      { text: 'Наголошує на ролі розуму', correctCategoryIndex: '1' },
      { text: 'Досліджує джерела пізнання', correctCategoryIndex: '2' }
    ]);
    setTextAnswer('утилітаризм');
    setFillInParts([
      { type: 'text', value: 'Етична теорія Бентама називається ' },
      { type: 'blank', value: 'утилітаризм' },
      { type: 'text', value: '.' }
    ]);
    setImageOptions([
      { url: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=400' },
      { url: 'https://images.unsplash.com/photo-1595152772835-219674b2a8a6?w=400' },
      { url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400' },
      { url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400' }
    ]);
    setCorrectImageChoice(1);
    setReadingText1('Наші вчинки мають утилітарну цінність. Чим більше загальної користі ми приносимо в результаті дії, тим благороднішим є наш крок з погляду Бентама.');
    setReadingText2('Проте кантіанська деонтологія наполягає на зворотному: наслідки ніщо, а чистий моральний обов’язок та добра воля — це все, що має справжню вартість.');
    setReadingCompQuestions([
      {
        question: 'Що є головним критерієм моральності за Бентамом?',
        options: [{ value: 'Загальна користь результату' }, { value: 'Суворий обов’язок' }, { value: 'Релігійні канони' }, { value: 'Особистий егоїзм' }],
        correctAnswerIndex: '0'
      },
      {
        question: 'Чому Кванту деонтологія протилежна утилітаризму?',
        options: [{ value: 'Вона ігнорує наслідки вчинків' }, { value: 'Вона підкреслює матеріальну вигоду' }, { value: 'Вона заперечує розум' }, { value: 'Вона створена раніше' }],
        correctAnswerIndex: '0'
      }
    ]);
    setRespondentsCount('28 333');
    setCountriesCount('25');
    setSurveyPeriod('січень–квітень 2025');
    setResearchCenter('Pew Research Center');
    setSliders([
      { question: 'Який відсоток опитаних повністю відкинули деонтологію?', correctAnswer: 42 },
      { question: 'Скільки відсотків підтримали розширену свободу волі?', correctAnswer: 78 }
    ]);
    setTenFacts([
      { value: 'Він народився в Лондоні у родині юристів.' },
      { value: 'Був надзвичайно обдарованою дитиною: вивчав латину у віці трьох років.' },
      { value: 'Його вважають засновником етичної теорії утилітаризму.' },
      { value: 'Сформулював так зване «обчислення щастя» (hedonic calculus).' },
      { value: 'Заповідав забальзамувати своє тіло після смерті.' },
      { value: 'Йому належить термін «інтернаціональний».' },
      { value: 'Він рішуче виступав за рівні права жінок та скасування рабства.' },
      { value: 'Вважав, що тварини здатні страждати, тому мають права.' },
      { value: 'Його ідеї вплинули на Джон Стюарта Мілля та інших реформаторів.' },
      { value: 'Він стверджував, що природа поставила людство под владу задоволення та болю.' }
    ]);
    setPairwiseObjects([
      {
        id: 'alligator',
        name: 'Алігатор',
        imagePath: '/quiz-images/erudite/level-0001/q012/alligator.webp',
        altText: 'Голова алігатора з широкою мордою'
      },
      {
        id: 'crocodile',
        name: 'Крокодил',
        imagePath: '/quiz-images/erudite/level-0001/q012/crocodile.webp',
        altText: 'Голова крокодила з вузькою мордою'
      }
    ]);
    setPairwiseStatements([
      {
        id: 'snout_u',
        text: 'Має широку U-подібну морду',
        correctObjectId: 'alligator'
      },
      {
        id: 'snout_v',
        text: 'Має вужчу V-подібну морду',
        correctObjectId: 'crocodile'
      },
      {
        id: 'teeth',
        text: 'При закритій пащі частіше видно нижні зуби',
        correctObjectId: 'crocodile'
      },
      {
        id: 'freshwater',
        text: 'Частіше трапляється у прісній воді',
        correctObjectId: 'alligator'
      }
    ]);
    setQuestionIdName('');
    setQuestionText('Який основний принцип утилітаризму Джеремі Бентама?');
    setContentPolicy({ ...DEFAULT_CONTENT_POLICY });
    
    triggerToast('Всі поля повернено до початкових значень шаблону!', 'success');
  };

  // Setup Literature Item addition
  const handleAddLiterature = () => {
    setRecommendedLiterature([...recommendedLiterature, { name: '', link: '' }]);
  };

  const handleRemoveLiterature = (idx: number) => {
    setRecommendedLiterature(recommendedLiterature.filter((_, i) => i !== idx));
  };

  // Comparison categories managers
  const handleAddCategory = () => {
    setComparisonCategories([...comparisonCategories, '']);
  };

  const handleRemoveCategory = (catIdx: number) => {
    if (comparisonCategories.length <= 1) {
      triggerToast('Requires at least 1 category!', 'error');
      return;
    }
    const updatedCategories = comparisonCategories.filter((_, idx) => idx !== catIdx);
    setComparisonCategories(updatedCategories);

    // Shift indexes in statements to align with new indexes
    const updatedStatements = comparisonStatements.map(stmt => {
      if (stmt.correctCategoryIndex === 'common') {
        return stmt;
      }
      const stIdx = parseInt(stmt.correctCategoryIndex, 10);
      if (isNaN(stIdx)) {
        return { ...stmt, correctCategoryIndex: '0' };
      }
      if (stIdx === catIdx) {
        return { ...stmt, correctCategoryIndex: '0' };
      } else if (stIdx > catIdx) {
        return { ...stmt, correctCategoryIndex: String(stIdx - 1) };
      }
      return stmt;
    });
    setComparisonStatements(updatedStatements);
  };

  // Interactive Sandbox evaluation simulation inside UI preview
  const handleTestSandbox = () => {
    setSandboxResponseFeedback(null);
    setSandboxPassed(null);

    if (questionType === 'SINGLE_CHOICE' || questionType === 'TEN_FACTS') {
      const isOk = sandboxAnswerObj === correctSingleChoice;
      setSandboxPassed(isOk);
      setSandboxResponseFeedback(
        isOk 
          ? `🎉 Вітання! Обрано вірну відповідь: "${questionType === 'TEN_FACTS' ? options[correctSingleChoice]?.value : options[correctSingleChoice]?.value}"`
          : `❌ Спробуйте ще раз! Ви помилилися.`
      );
    }
    else if (questionType === 'MULTIPLE_CHOICE') {
      const correctIndices = options.map((o, idx) => o.isCorrect ? idx : -1).filter(idx => idx !== -1);
      const userSelected: number[] = sandboxAnswerObj || [];
      const match = correctIndices.length === userSelected.length && 
                    correctIndices.every(val => userSelected.includes(val));
      setSandboxPassed(match);
      setSandboxResponseFeedback(
        match
          ? `🎉 Абсолютно вірно! Виділено всі правильні опції.`
          : `❌ Спроба непевна. Очікувані правильні масиви індексів: ${correctIndices.join(', ')}`
      );
    }
    else if (questionType === 'TRUE_FALSE') {
      const isOk = String(sandboxAnswerObj) === String(trueFalseAnswer);
      setSandboxPassed(isOk);
      setSandboxResponseFeedback(
        isOk ? `🎉 Правильно! Твердження дійсно є ${trueFalseAnswer ? 'істинним (True)' : 'хибним (False)'}` : `❌ Спроба невдала!`
      );
    }
    else if (questionType === 'TEXT_INPUT') {
      const allowedAnswers = textAnswer
        ? textAnswer.split(',').map(s => normalizeApostrophes(s.trim().toLowerCase())).filter(Boolean)
        : [];
      const userAns = normalizeApostrophes(String(sandboxAnswerObj).trim().toLowerCase());
      const isOk = allowedAnswers.includes(userAns);
      setSandboxPassed(isOk);
      setSandboxResponseFeedback(
        isOk 
          ? `🎉 Точний збіг тексту! Відповідь "${userAns}" є серед дозволених.` 
          : `❌ Спробуйте змінити написання або надішліть інше слово. Дозволені варіанти: ${allowedAnswers.join(', ')}`
      );
    }
    else if (questionType === 'FILL_IN_THE_BLANK') {
      const corrects = fillInParts.filter(p => p.type === 'blank').map(p => normalizeApostrophes(p.value.trim().toLowerCase()));
      const inputs: string[] = sandboxAnswerObj || [];
      const isOk = corrects.length === inputs.length && corrects.every((v, i) => v === normalizeApostrophes((inputs[i] || '').trim().toLowerCase()));
      setSandboxPassed(isOk);
      setSandboxResponseFeedback(
        isOk ? '🎉 Прекрасно! Усі вписані слова вірні.' : `❌ Невідповідність. Правильний варіант: "${corrects.join(', ')}"`
      );
    }
    else if (questionType === 'SLIDER_SCALE') {
      const inputs: number[] = sandboxAnswerObj || [];
      let isOk = true;
      sliders.forEach((s, i) => {
        const val = inputs[i] || 0;
        if (Math.abs(val - s.correctAnswer) > 5) isOk = false; // allows 5% tolerance in sand box testing
      });
      setSandboxPassed(isOk);
      setSandboxResponseFeedback(
        isOk 
          ? '🎉 Вірно! Значення повзунків знаходяться у допустимому наближенні.' 
          : '❌ Похибка занадто велика. Наблизьтеся ближче до правди соцопитування.'
      );
    }
    else if (questionType === 'PAIRWISE_DISTINCTION') {
      const userMap: Record<string, string> = sandboxAnswerObj || {};
      const isOk = pairwiseStatements.length > 0 && pairwiseStatements.every(st => {
        return userMap[st.id] === st.correctObjectId;
      });
      setSandboxPassed(isOk);
      setSandboxResponseFeedback(
        isOk 
          ? '🎉 Відмінно! Усі ознаки правильно розподілені між об\'єктами!' 
          : '❌ Не всі ознаки розподілено вірно. Перевірте правильність вибору для кожного твердження.'
      );
    }
    else {
      setSandboxPassed(true);
      setSandboxResponseFeedback('🎉 Логіка даного тестового типу підтримується Firestore схемами. Спробуйте зберегти!');
    }
  };

  // --- DEBATE PERSISTENCE HANDLERS & SEEDERS ---
  
  // Auto-generate topicId if not manual
  useEffect(() => {
    if (!isManualTopicId && topicTitle) {
      const slugified = slugify(topicTitle).substring(0, 30);
      setTopicId(`${topicLang}--${topicMode}--${topicDisciplineId}--${slugified}`);
    }
  }, [topicTitle, topicLang, topicMode, topicDisciplineId, isManualTopicId]);

  const handleClearTopicForm = () => {
    setTopicId('');
    setIsManualTopicId(false);
    setTopicMode('symposium');
    setTopicTitle('');
    setTopicDesc('');
    setTopicDisciplineId('ethics');
    setTopicLang('ua');
    setTopicOrder(10);
    setTopicStatus('active');
    triggerToast('Форму очищено!', 'info');
  };

  const handleEditTopic = (item: any) => {
    setTopicId(item.id);
    setIsManualTopicId(true);
    setTopicMode(item.mode || 'symposium');
    setTopicTitle(item.title || '');
    setTopicDesc(item.description || '');
    setTopicDisciplineId(item.disciplineId || 'ethics');
    setTopicLang(item.lang || 'ua');
    setTopicOrder(Number(item.order) || 10);
    setTopicStatus(item.status || 'active');
    triggerToast(`Тему завантажено в редактор!`, 'info');
  };

  // Auto-generate discId if not manual
  useEffect(() => {
    if (!isManualDiscId && discName) {
      setDiscId(slugify(discName).substring(0, 30));
    }
  }, [discName, isManualDiscId]);

  const fetchDebateDisciplines = async () => {
    if (!dbInstance) return;
    try {
      const q = collection(dbInstance, 'debateDisciplines');
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort by order, then name
      list.sort((a, b) => {
        const orderA = Number(a.order) || 0;
        const orderB = Number(b.order) || 0;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });
      setLoadedDisciplines(list);
    } catch (e: any) {
      console.error("Error fetching debate disciplines:", e);
    }
  };

  const handleClearDiscForm = () => {
    setDiscId('');
    setIsManualDiscId(false);
    setDiscName('');
    setDiscDesc('');
    setDiscOrder(10);
    setDiscStatus('active');
    setDiscLang('ua');
    triggerToast('Форму дисциплін очищено!', 'info');
  };

  const handleEditDiscipline = (item: any) => {
    setDiscId(item.id);
    setIsManualDiscId(true);
    setDiscName(item.name || '');
    setDiscDesc(item.description || '');
    setDiscOrder(Number(item.order) || 10);
    setDiscStatus(item.status || 'active');
    setDiscLang(item.lang || 'ua');
    triggerToast(`Дисципліну "${item.name}" завантажено в редактор!`, 'info');
  };

  const handleSaveDiscipline = async () => {
    if (!dbInstance) {
      triggerToast('База даних не підключена!', 'error');
      return;
    }
    const cleanId = discId.trim();
    if (!cleanId) {
      triggerToast('ID документа не може бути порожнім!', 'error');
      return;
    }
    if (!discName.trim()) {
      triggerToast('Назва дисципліни не може бути порожньою!', 'error');
      return;
    }
    if (!discDesc.trim()) {
      triggerToast('Опис дисципліни не може бути порожнім!', 'error');
      return;
    }
    const parsedOrder = Number(discOrder);
    if (isNaN(parsedOrder)) {
      triggerToast('Порядок має бути числом!', 'error');
      return;
    }

    try {
      const docRef = doc(dbInstance, 'debateDisciplines', cleanId);
      await setDoc(docRef, {
        name: discName.trim(),
        description: discDesc.trim(),
        order: parsedOrder,
        status: discStatus,
        lang: discLang
      });
      triggerToast(`Дисципліну дебатів успішно збережено як "${cleanId}"!`, 'success');
      fetchDebateDisciplines();
    } catch (e: any) {
      triggerToast(`Помилка збереження дисципліни: ${e.message}`, 'error');
    }
  };

  const handleDeleteDiscipline = async (idToDelete: string) => {
    if (!dbInstance) return;
    if (!window.confirm(`Ви впевнені, що хочете видалити дисципліну "${idToDelete}"? Це не видалить пов'язані теми, але вони втратять дійсну прив'язку.`)) return;
    try {
      await deleteDoc(doc(dbInstance, 'debateDisciplines', idToDelete));
      triggerToast(`Дисципліну "${idToDelete}" успішно видалено!`, 'success');
      fetchDebateDisciplines();
    } catch (e: any) {
      triggerToast(`Помилка видалення дисципліни: ${e.message}`, 'error');
    }
  };

  const handleToggleDisciplineStatus = async (item: any) => {
    if (!dbInstance) return;
    const newStatus = item.status === 'active' ? 'draft' : 'active';
    try {
      await setDoc(doc(dbInstance, 'debateDisciplines', item.id), {
        name: item.name || '',
        description: item.description || '',
        order: Number(item.order) || 10,
        status: newStatus,
        lang: item.lang || 'ua'
      });
      triggerToast(`Статус дисципліни "${item.id}" змінено на "${newStatus}"!`, 'success');
      fetchDebateDisciplines();
    } catch (e: any) {
      triggerToast(`Помилка оновлення статусу дисципліни: ${e.message}`, 'error');
    }
  };

  const handleSeedDisciplines = async () => {
    if (!dbInstance) {
      triggerToast('База даних не підключена!', 'error');
      return;
    }
    try {
      const batch = writeBatch(dbInstance);
      const baseDisciplines = [
        { id: 'ethics', name: 'Етика', description: 'Теми про мораль, відповідальність і вибір.', order: 10, status: 'active', lang: 'ua' },
        { id: 'philosophy', name: 'Філософія', description: 'Теми про буття, пізнання, сенс життя та світогляд.', order: 20, status: 'active', lang: 'ua' },
        { id: 'science', name: 'Наука', description: 'Теми про науковий метод, відкриття, прогрес та емпіричні дослідження.', order: 30, status: 'active', lang: 'ua' },
        { id: 'society', name: 'Суспільство', description: 'Теми про соціальну нерівність, права людини, культуру та владу.', order: 40, status: 'active', lang: 'ua' },
        { id: 'technology', name: 'Технології', description: 'Теми про штучний інтелект, цифровізацію, інновації та майбутнє людства.', order: 50, status: 'active', lang: 'ua' },
        { id: 'ecology', name: 'Екологія', description: 'Теми про клімат, збереження природи, сталий розвиток та захист тварин.', order: 60, status: 'active', lang: 'ua' },
        { id: 'history', name: 'Історія', description: 'Теми про уроки минулого, історичну справедливість та пам\'ять.', order: 70, status: 'active', lang: 'ua' }
      ];

      for (const d of baseDisciplines) {
        const dRef = doc(dbInstance, 'debateDisciplines', d.id);
        batch.set(dRef, {
          name: d.name,
          description: d.description,
          order: d.order,
          status: d.status,
          lang: d.lang
        });
      }
      await batch.commit();
      triggerToast('Базові дисципліни успішно засіяно в БД!', 'success');
      fetchDebateDisciplines();
    } catch (e: any) {
      triggerToast(`Помилка засівання дисциплін: ${e.message}`, 'error');
    }
  };

  const fetchDebateTopics = async () => {
    if (!dbInstance) return;
    try {
      const q = collection(dbInstance, 'debateTopics');
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      // Sort by disciplineId, then mode, then order inside discipline and mode
      list.sort((a, b) => {
        const discA = (a.disciplineId || '').localeCompare(b.disciplineId || '');
        if (discA !== 0) return discA;

        const modeA = (a.mode || '').localeCompare(b.mode || '');
        if (modeA !== 0) return modeA;

        const orderA = Number(a.order) || 0;
        const orderB = Number(b.order) || 0;
        if (orderA !== orderB) return orderA - orderB;

        return (a.title || '').localeCompare(b.title || '');
      });
      setLoadedTopics(list);
    } catch (e: any) {
      console.error("Error fetching debate topics:", e);
    }
  };

  useEffect(() => {
    if (dbInstance && constructorMode === 'debate') {
      fetchDebateTopics();
      fetchDebateDisciplines();
    }
  }, [dbInstance, constructorMode]);

  const handleSaveTopic = async () => {
    if (!dbInstance) {
      triggerToast('База даних не підключена!', 'error');
      return;
    }
    const cleanId = topicId.trim();
    if (!cleanId) {
      triggerToast('ID документа не може бути порожнім!', 'error');
      return;
    }
    if (!topicTitle.trim()) {
      triggerToast('Назва теми не може бути порожньою!', 'error');
      return;
    }
    if (!topicDesc.trim()) {
      triggerToast('Опис теми не може бути порожнім!', 'error');
      return;
    }
    if (topicMode !== 'symposium' && topicMode !== 'dialectic') {
      triggerToast('Режим має бути тільки "symposium" або "dialectic"!', 'error');
      return;
    }
    if (!['ua', 'de', 'en', 'all'].includes(topicLang)) {
      triggerToast('Мова має бути тільки "ua", "de", "en" або "all"!', 'error');
      return;
    }
    if (!['active', 'draft', 'archived'].includes(topicStatus)) {
      triggerToast('Статус має бути тільки "active", "draft" або "archived"!', 'error');
      return;
    }
    const parsedOrder = Number(topicOrder);
    if (isNaN(parsedOrder)) {
      triggerToast('Порядок має бути числом!', 'error');
      return;
    }

    try {
      const docRef = doc(dbInstance, 'debateTopics', cleanId);
      await setDoc(docRef, {
        mode: topicMode,
        title: topicTitle.trim(),
        description: topicDesc.trim(),
        disciplineId: topicDisciplineId.trim(),
        lang: topicLang,
        order: parsedOrder,
        status: topicStatus
      });
      triggerToast(`Тему дебатів успішно збережено як "${cleanId}"!`, 'success');
      fetchDebateTopics();
      if (onRefreshExplorer) onRefreshExplorer();
    } catch (e: any) {
      triggerToast(`Помилка збереження теми: ${e.message}`, 'error');
    }
  };

  const handleDeleteTopic = async (idToDelete: string) => {
    if (!dbInstance) return;
    if (!window.confirm(`Ви впевнені, що хочете видалити тему "${idToDelete}"?`)) return;
    try {
      await deleteDoc(doc(dbInstance, 'debateTopics', idToDelete));
      triggerToast(`Тему "${idToDelete}" успішно видалено!`, 'success');
      fetchDebateTopics();
      if (onRefreshExplorer) onRefreshExplorer();
    } catch (e: any) {
      triggerToast(`Помилка видалення теми: ${e.message}`, 'error');
    }
  };

  const handleToggleTopicStatus = async (item: any) => {
    if (!dbInstance) return;
    const newStatus = item.status === 'active' ? 'draft' : 'active';
    try {
      await setDoc(doc(dbInstance, 'debateTopics', item.id), {
        mode: item.mode || 'symposium',
        title: item.title || '',
        description: item.description || '',
        disciplineId: item.disciplineId || 'ethics',
        lang: item.lang || 'ua',
        order: Number(item.order) || 10,
        status: newStatus
      });
      triggerToast(`Статус теми "${item.id}" змінено на "${newStatus}"!`, 'success');
      fetchDebateTopics();
      if (onRefreshExplorer) onRefreshExplorer();
    } catch (e: any) {
      triggerToast(`Помилка оновлення статусу: ${e.message}`, 'error');
    }
  };

  const handleSeedTopics = async () => {
    if (!dbInstance) {
      triggerToast('База даних не підключена!', 'error');
      return;
    }
    try {
      const batch = writeBatch(dbInstance);
      const demoTopics = [
        {
          id: 'ua--symposium--ethics--friendship-and-truth',
          data: {
            mode: 'symposium',
            title: 'Чи можна завжди казати правду?',
            description: 'Тема для вільного обговорення про правду, моральну відповідальність і ситуації, коли чесність може мати складні наслідки.',
            disciplineId: 'ethics',
            lang: 'ua',
            order: 10,
            status: 'active'
          }
        },
        {
          id: 'ua--dialectic--technology--ai-in-education',
          data: {
            mode: 'dialectic',
            title: 'Штучний інтелект більше допомагає освіті, ніж шкодить їй.',
            description: 'Один гравець захищає тезу, інший її спростовує. Ролі призначаються застосунком випадково після створення дебатів.',
            disciplineId: 'technology',
            lang: 'ua',
            order: 20,
            status: 'active'
          }
        },
        {
          id: 'de--dialectic--ecology--nuclear-energy',
          data: {
            mode: 'dialectic',
            title: 'Kernenergie ist notwendig für den Übergang zu einer grünen Wirtschaft.',
            description: 'Diskussion über Kernenergie als CO2-freie Brückentechnologie versus ökologische Risiken und Abfallproblematik.',
            disciplineId: 'ecology',
            lang: 'de',
            order: 30,
            status: 'active'
          }
        },
        {
          id: 'en--symposium--society--social-networks',
          data: {
            mode: 'symposium',
            title: 'Do social networks do more harm than good to society?',
            description: 'A free-form debate on mental health, digital connection, disinformation, and the social fabric in the digital age.',
            disciplineId: 'society',
            lang: 'en',
            order: 40,
            status: 'active'
          }
        }
      ];

      for (const t of demoTopics) {
        const tRef = doc(dbInstance, 'debateTopics', t.id);
        batch.set(tRef, t.data);
      }
      await batch.commit();
      triggerToast('Базовий набір тем дебатів (4 шт) засіяно успішно!', 'success');
      fetchDebateTopics();
      if (onRefreshExplorer) onRefreshExplorer();
    } catch (e: any) {
      triggerToast(`Помилка засівання тем: ${e.message}`, 'error');
    }
  };

  const previewQNum = String(parseInt(questionNumber, 10) || 1).padStart(2, '0');
  const previewBlock = blockIdentifier ? `${blockIdentifier.trim().toUpperCase()}--` : '';
  const previewRawName = questionIdName || questionText?.substring(0, 20) || 'q';
  const previewQSlug = questionIdName ? slugify(questionIdName).substring(0, 35) : slugify(previewRawName).substring(0, 20);

  if (constructorMode === 'debate') {
    // Unique list of disciplineIds found in loaded topics
    const uniqueTopicDisciplines = Array.from(new Set(loadedTopics.map(t => t.disciplineId).filter(Boolean)));

    // Perform clientside filtering for topics
    const filteredTopics = loadedTopics.filter(topic => {
      const titleLower = (topic.title || '').toLowerCase();
      const descLower = (topic.description || '').toLowerCase();
      const idLower = (topic.id || '').toLowerCase();
      const queryLower = topicSearchQuery.toLowerCase();
      
      if (topicSearchQuery && !titleLower.includes(queryLower) && !descLower.includes(queryLower) && !idLower.includes(queryLower)) {
        return false;
      }
      if (topicFilterLang !== 'all' && topic.lang !== topicFilterLang) {
        return false;
      }
      if (topicFilterMode !== 'all' && topic.mode !== topicFilterMode) {
        return false;
      }
      if (topicFilterDiscipline !== 'all' && topic.disciplineId !== topicFilterDiscipline) {
        return false;
      }
      if (topicFilterStatus !== 'all' && topic.status !== topicFilterStatus) {
        return false;
      }
      return true;
    });

    // Perform clientside filtering for disciplines
    const filteredDisciplines = loadedDisciplines.filter(disc => {
      const nameLower = (disc.name || '').toLowerCase();
      const descLower = (disc.description || '').toLowerCase();
      const idLower = (disc.id || '').toLowerCase();
      const queryLower = discSearchQuery.toLowerCase();

      if (discSearchQuery && !nameLower.includes(queryLower) && !descLower.includes(queryLower) && !idLower.includes(queryLower)) {
        return false;
      }
      if (discFilterLang !== 'all' && disc.lang !== discFilterLang) {
        return false;
      }
      if (discFilterStatus !== 'all' && disc.status !== discFilterStatus) {
        return false;
      }
      return true;
    });

    return (
      <div className="constructor-shell flex flex-col gap-6 w-full animate-fadeIn" id="noesis-debate-constructor">
        <ConstructorModeTabs value={constructorMode} onChange={setConstructorMode} />

        {/* Sub-Navigation: Topics vs Disciplines */}
        <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-xl shadow-sm border self-start" id="debate-subtab-navigation">
          <button
            type="button"
            id="subtab-topics"
            onClick={() => setActiveDebateSubTab('topics')}
            className={`py-1.5 px-4 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              activeDebateSubTab === 'topics'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Теми дебатів ({loadedTopics.length})
          </button>
          <button
            type="button"
            id="subtab-disciplines"
            onClick={() => setActiveDebateSubTab('disciplines')}
            className={`py-1.5 px-4 rounded-lg font-bold text-xs transition cursor-pointer flex items-center gap-1.5 ${
              activeDebateSubTab === 'disciplines'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Дисципліни дебатів ({loadedDisciplines.length})
          </button>
        </div>

        {/* Active layout switcher */}
        {activeDebateSubTab === 'topics' ? (
          /* ================== TAB: DEBATE TOPICS ================== */
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start" id="debate-topics-manager-grid">
            
            {/* Left Column: Topic Editor Form */}
            <div className="xl:col-span-5 flex flex-col gap-6" id="debate-topic-form-column">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800">Редактор тем дебатів</h3>
                      <p className="text-[11px] text-slate-400">Створення та зміна тем для колекції debateTopics</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  
                  {/* Discipline Selector (Required choice) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Дисципліна дебатів (disciplineId) *Обов’язково</span>
                      <span className="text-amber-500 text-[9px] lowercase font-semibold">колекція debateDisciplines</span>
                    </label>
                    <select
                      id="input-topic-discipline-id"
                      value={topicDisciplineId}
                      onChange={e => setTopicDisciplineId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">-- Оберіть дисципліну --</option>
                      {loadedDisciplines.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.id})
                        </option>
                      ))}
                      {/* Enforce showing basic static items as options if database is completely unseeded */}
                      {loadedDisciplines.length === 0 && [
                        { id: 'ethics', name: 'Етика' },
                        { id: 'philosophy', name: 'Філософія' },
                        { id: 'science', name: 'Наука' },
                        { id: 'society', name: 'Суспільство' },
                        { id: 'technology', name: 'Технології' },
                        { id: 'ecology', name: 'Екологія' },
                        { id: 'history', name: 'Історія' }
                      ].map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.id}) [Потрібно засіяти]
                        </option>
                      ))}
                    </select>
                    {loadedDisciplines.length === 0 && (
                      <p className="text-[9px] text-rose-500 font-medium">
                        Увага: у базі немає збережених дисциплін. Будь ласка, засійте базові дисципліни у сусідній вкладці!
                      </p>
                    )}
                  </div>

                  {/* Mode Select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Режим дебатів (mode)</label>
                    <select
                      id="input-topic-mode"
                      value={topicMode}
                      onChange={e => setTopicMode(e.target.value as 'symposium' | 'dialectic')}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="symposium">symposium (Вільне обговорення)</option>
                      <option value="dialectic">dialectic (Діалектика: апологетика / скептицизм)</option>
                    </select>
                  </div>

                  {/* Language Select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Мова (lang)</label>
                    <select
                      id="input-topic-lang"
                      value={topicLang}
                      onChange={e => setTopicLang(e.target.value as 'ua' | 'de' | 'en' | 'all')}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="ua">ua (Українська)</option>
                      <option value="de">de (Deutsch)</option>
                      <option value="en">en (English)</option>
                      <option value="all">all (Усі мови)</option>
                    </select>
                  </div>

                  {/* Title */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Назва теми / Теза (title)</label>
                    <input
                      type="text"
                      id="input-topic-title"
                      value={topicTitle}
                      onChange={e => setTopicTitle(e.target.value)}
                      placeholder="напр., Чи завжди правда є моральним обов'язком?"
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* ID Field with auto-gen toggle */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Документа (topicId)</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!isManualTopicId}
                          onChange={e => setIsManualTopicId(!e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-500 h-3 w-3"
                        />
                        Авто-генерація
                      </label>
                    </div>
                    <input
                      type="text"
                      id="input-topic-id"
                      value={topicId}
                      disabled={!isManualTopicId}
                      onChange={e => setTopicId(slugify(e.target.value))}
                      className={`border px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                        !isManualTopicId 
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    />
                    {!isManualTopicId && (
                      <span className="text-[9px] text-slate-400 font-mono italic">
                        Формат: lang--mode--disciplineId--slug
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Опис теми (description)</label>
                    <textarea
                      id="input-topic-description"
                      value={topicDesc}
                      onChange={e => setTopicDesc(e.target.value)}
                      placeholder="Вступний опис (1-3 речення) для показу у додатку..."
                      rows={3}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  {/* Order & Status row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Порядок сортування (order)</label>
                      <input
                        type="number"
                        id="input-topic-order"
                        value={topicOrder}
                        onChange={e => setTopicOrder(parseInt(e.target.value, 10) || 10)}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Статус теми (status)</label>
                      <select
                        id="input-topic-status"
                        value={topicStatus}
                        onChange={e => setTopicStatus(e.target.value as 'active' | 'draft' | 'archived')}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="active">active (Активний)</option>
                        <option value="draft">draft (Чернетка)</option>
                        <option value="archived">archived (Архівовано)</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex gap-2.5 mt-2">
                    <button
                      type="button"
                      id="btn-clear-topic-form"
                      onClick={handleClearTopicForm}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5"
                    >
                      Очистити
                    </button>
                    <button
                      type="button"
                      id="btn-save-topic-to-firestore"
                      onClick={handleSaveTopic}
                      className="flex-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Save className="h-4 w-4" />
                      Зберегти в Firestore
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Loaded Topics List & Filters */}
            <div className="xl:col-span-7 flex flex-col gap-6" id="debate-topics-list-column">
              
              {/* Filter and Control Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Завантажені теми</span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Знайдено {filteredTopics.length} із {loadedTopics.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-refresh-topics"
                      onClick={fetchDebateTopics}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
                      title="Оновити список з БД"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      id="btn-seed-topics"
                      onClick={handleSeedTopics}
                      className="bg-amber-50 hover:bg-amber-100 hover:text-amber-800 text-amber-600 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-amber-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Засіяти 4 Демо-теми
                    </button>
                  </div>
                </div>

                {/* Filters in sequence: Language -> Mode -> Discipline -> Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3" id="topics-sequential-filters">
                  
                  {/* Filter 1: Language */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Мова (lang)</span>
                    <select
                      id="filter-topic-lang"
                      value={topicFilterLang}
                      onChange={e => setTopicFilterLang(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">Усі мови</option>
                      <option value="ua">ua</option>
                      <option value="de">de</option>
                      <option value="en">en</option>
                      <option value="all_lang">all</option>
                    </select>
                  </div>

                  {/* Filter 2: Mode */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Режим (mode)</span>
                    <select
                      id="filter-topic-mode"
                      value={topicFilterMode}
                      onChange={e => setTopicFilterMode(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">Усі режими</option>
                      <option value="symposium">symposium</option>
                      <option value="dialectic">dialectic</option>
                    </select>
                  </div>

                  {/* Filter 3: Discipline */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Дисципліна (discipline)</span>
                    <select
                      id="filter-topic-discipline"
                      value={topicFilterDiscipline}
                      onChange={e => setTopicFilterDiscipline(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">Усі дисципліни</option>
                      {uniqueTopicDisciplines.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter 4: Status */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Статус (status)</span>
                    <select
                      id="filter-topic-status"
                      value={topicFilterStatus}
                      onChange={e => setTopicFilterStatus(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">Усі статуси</option>
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                </div>

                {/* Text search overlay */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Пошук за текстом</span>
                  <input
                    type="text"
                    id="search-topics-text"
                    value={topicSearchQuery}
                    onChange={e => setTopicSearchQuery(e.target.value)}
                    placeholder="Введіть фразу для пошуку в назві чи описі..."
                    className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* List of Topics */}
              <div className="flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-1" id="debate-topics-scrollable-container">
                {filteredTopics.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Info className="h-8 w-8 text-slate-300" />
                    <p className="text-xs font-semibold">Жодної теми не знайдено за поточними фільтрами</p>
                    <p className="text-[10px] text-slate-400">Створіть тему зліва, змініть фільтри або натисніть "Засіяти 4 Демо-теми"</p>
                  </div>
                ) : (
                  filteredTopics.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="bg-slate-100 text-slate-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                            {item.lang ? item.lang.toUpperCase() : 'UA'}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                            item.mode === 'dialectic' 
                              ? 'bg-pink-50 text-pink-700 border-pink-150' 
                              : 'bg-sky-50 text-sky-700 border-sky-150'
                          }`}>
                            {item.mode || 'symposium'}
                          </span>
                          <span className="bg-purple-50 text-purple-700 border border-purple-150 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {item.disciplineId || 'ethics'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            item.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                              : item.status === 'draft'
                              ? 'bg-amber-50 text-amber-700 border border-amber-150'
                              : 'bg-slate-50 text-slate-500 border border-slate-150'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              item.status === 'active' 
                                ? 'bg-emerald-500' 
                                : item.status === 'draft'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`} />
                            {item.status || 'active'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Порядок: {item.order ?? 10}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-slate-800 leading-snug">
                          {item.title}
                        </h4>
                        
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="text-[9px] text-slate-400 font-mono break-all select-all flex items-center gap-1">
                          <span className="text-slate-300">ID:</span> {item.id}
                        </div>
                      </div>

                      {/* Quick Controls */}
                      <div className="flex md:flex-col gap-1.5 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleEditTopic(item)}
                          className="flex-1 md:flex-none bg-slate-50 hover:bg-slate-100 text-slate-700 p-1.5 rounded-xl border border-slate-200 transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1"
                          title="Редагувати тему"
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                          <span className="md:hidden">Редагувати</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleTopicStatus(item)}
                          className="flex-1 md:flex-none bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 p-1.5 rounded-xl border border-slate-200 hover:border-amber-200 transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1"
                          title="Змінити статус (active/draft)"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                          <span className="md:hidden">Статус</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTopic(item.id)}
                          className="flex-1 md:flex-none bg-rose-50 hover:bg-rose-100 text-rose-700 p-1.5 rounded-xl border border-rose-150 transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1"
                          title="Видалити тему"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          <span className="md:hidden">Видалити</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Architectural note */}
              <div className="bg-slate-900 rounded-2xl p-5 border border-slate-850 text-white flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-800">
                  <Info className="h-4.5 w-4.5 text-amber-400" />
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-400">Специфікація інтеграції NOESIS</h4>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">
                  Конструктор записує теми в колекцію <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-emerald-400">debateTopics/{"{topicId}"}</code>, а дисципліни в <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-emerald-400">debateDisciplines/{"{disciplineId}"}</code>. 
                  Додаток NOESIS читає ці колекції для показу за наступними критеріями:
                </p>
                <ul className="list-disc list-inside text-[10.5px] text-slate-400 flex flex-col gap-1 pl-1">
                  <li>Фільтр: <code className="text-amber-300">status == "active"</code></li>
                  <li>Доступні мови: <code className="text-amber-300">"ua", "en", "de", "all"</code></li>
                  <li>Порядок сортування: <code className="text-amber-300">order</code> та алфавітний</li>
                </ul>
                <p className="text-[10px] text-slate-500 italic">
                  * Інформація: Очищено всі вигадані чи проміжні поля (на кшталт answers, roles, messages тощо). Теми є чистими метаданими.
                </p>
              </div>

            </div>

          </div>
        ) : (
          /* ================== TAB: DEBATE DISCIPLINES ================== */
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start" id="debate-disciplines-manager-grid">
            
            {/* Left Column: Discipline Editor Form */}
            <div className="xl:col-span-5 flex flex-col gap-6" id="debate-discipline-form-column">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-amber-500" />
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-800">Блок Дисципліни дебатів</h3>
                      <p className="text-[11px] text-slate-400">Створення та зміна дисциплін у debateDisciplines</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Name (Cyrillic or other) */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Назва дисципліни (name)</label>
                    <input
                      type="text"
                      id="input-disc-name"
                      value={discName}
                      onChange={e => setDiscName(e.target.value)}
                      placeholder="напр., Етика, Філософія, Технології"
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* ID Field with auto-gen toggle */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID Документа (disciplineId / slug)</label>
                      <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={!isManualDiscId}
                          onChange={e => setIsManualDiscId(!e.target.checked)}
                          className="rounded text-amber-500 focus:ring-amber-500 h-3 w-3"
                        />
                        Авто-генерація
                      </label>
                    </div>
                    <input
                      type="text"
                      id="input-disc-id"
                      value={discId}
                      disabled={!isManualDiscId}
                      onChange={e => setDiscId(slugify(e.target.value))}
                      placeholder="напр., ethics"
                      className={`border px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                        !isManualDiscId 
                          ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    />
                    <span className="text-[9px] text-slate-400 font-mono italic">
                      Рекомендується використовувати короткий англійський slug: ethics, philosophy, science, society, technology, ecology, history
                    </span>
                  </div>

                  {/* Description */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Опис дисципліни (description)</label>
                    <textarea
                      id="input-disc-description"
                      value={discDesc}
                      onChange={e => setDiscDesc(e.target.value)}
                      placeholder="Теми про мораль, відповідальність і вибір..."
                      rows={3}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                    />
                  </div>

                  {/* Language Select */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Мова (lang)</label>
                    <select
                      id="input-disc-lang"
                      value={discLang}
                      onChange={e => setDiscLang(e.target.value as 'ua' | 'de' | 'en' | 'all')}
                      className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="ua">ua (Українська)</option>
                      <option value="de">de (Deutsch)</option>
                      <option value="en">en (English)</option>
                      <option value="all">all (Усі мови)</option>
                    </select>
                  </div>

                  {/* Order & Status row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Порядок сортування (order)</label>
                      <input
                        type="number"
                        id="input-disc-order"
                        value={discOrder}
                        onChange={e => setDiscOrder(parseInt(e.target.value, 10) || 10)}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Статус (status)</label>
                      <select
                        id="input-disc-status"
                        value={discStatus}
                        onChange={e => setDiscStatus(e.target.value as 'active' | 'draft' | 'archived')}
                        className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="active">active (Активний)</option>
                        <option value="draft">draft (Чернетка)</option>
                        <option value="archived">archived (Архівовано)</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex gap-2.5 mt-2">
                    <button
                      type="button"
                      id="btn-clear-disc-form"
                      onClick={handleClearDiscForm}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer border border-slate-200 flex items-center justify-center gap-1.5"
                    >
                      Очистити
                    </button>
                    <button
                      type="button"
                      id="btn-save-disc-to-firestore"
                      onClick={handleSaveDiscipline}
                      className="flex-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Save className="h-4 w-4" />
                      Зберегти Дисципліну
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Loaded Disciplines List & Filters */}
            <div className="xl:col-span-7 flex flex-col gap-6" id="debate-disciplines-list-column">
              
              {/* Filter and Control Panel */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-slate-400" />
                    <span className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Завантажені дисципліни</span>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Знайдено {filteredDisciplines.length} із {loadedDisciplines.length}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-refresh-disciplines"
                      onClick={fetchDebateDisciplines}
                      className="bg-slate-50 hover:bg-slate-100 text-slate-600 p-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
                      title="Оновити список з БД"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      id="btn-seed-disciplines"
                      onClick={handleSeedDisciplines}
                      className="bg-amber-50 hover:bg-amber-100 hover:text-amber-800 text-amber-600 text-[10px] font-bold py-1.5 px-3 rounded-lg border border-amber-200 transition cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" />
                      Засіяти 7 Базових Дисциплін
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="disc-sequential-filters">
                  {/* Language Filter */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Мова (lang)</span>
                    <select
                      id="filter-disc-lang"
                      value={discFilterLang}
                      onChange={e => setDiscFilterLang(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">Усі мови</option>
                      <option value="ua">ua</option>
                      <option value="de">de</option>
                      <option value="en">en</option>
                      <option value="all">all</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Статус (status)</span>
                    <select
                      id="filter-disc-status"
                      value={discFilterStatus}
                      onChange={e => setDiscFilterStatus(e.target.value)}
                      className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                    >
                      <option value="all">Усі статуси</option>
                      <option value="active">active</option>
                      <option value="draft">draft</option>
                      <option value="archived">archived</option>
                    </select>
                  </div>
                </div>

                {/* Text Search */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Пошук дисциплін за назвою</span>
                  <input
                    type="text"
                    id="search-disc-text"
                    value={discSearchQuery}
                    onChange={e => setDiscSearchQuery(e.target.value)}
                    placeholder="Введіть фразу для пошуку в назві чи описі дисципліни..."
                    className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* List of Disciplines */}
              <div className="flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-1" id="debate-disciplines-scrollable-container">
                {filteredDisciplines.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Info className="h-8 w-8 text-slate-300" />
                    <p className="text-xs font-semibold">Жодної дисципліни не знайдено за поточними фільтрами</p>
                    <p className="text-[10px] text-slate-400">Створіть дисципліну зліва або натисніть "Засіяти 7 Базових Дисциплін"</p>
                  </div>
                ) : (
                  filteredDisciplines.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white border border-slate-200 hover:border-amber-300 rounded-2xl p-4 shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            ID: {item.id}
                          </span>
                          <span className="bg-slate-100 text-slate-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                            {item.lang ? item.lang.toUpperCase() : 'UA'}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            item.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                              : item.status === 'draft'
                              ? 'bg-amber-50 text-amber-700 border border-amber-150'
                              : 'bg-slate-50 text-slate-500 border border-slate-150'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              item.status === 'active' 
                                ? 'bg-emerald-500' 
                                : item.status === 'draft'
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`} />
                            {item.status || 'active'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Порядок: {item.order ?? 10}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-slate-800 leading-snug">
                          {item.name}
                        </h4>
                        
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      {/* Quick Controls */}
                      <div className="flex md:flex-col gap-1.5 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => handleEditDiscipline(item)}
                          className="flex-1 md:flex-none bg-slate-50 hover:bg-slate-100 text-slate-700 p-1.5 rounded-xl border border-slate-200 transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1"
                          title="Редагувати дисципліну"
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                          <span className="md:hidden">Редагувати</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDisciplineStatus(item)}
                          className="flex-1 md:flex-none bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 p-1.5 rounded-xl border border-slate-200 hover:border-amber-200 transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1"
                          title="Змінити статус (active/draft)"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                          <span className="md:hidden">Статус</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDiscipline(item.id)}
                          className="flex-1 md:flex-none bg-rose-50 hover:bg-rose-100 text-rose-700 p-1.5 rounded-xl border border-rose-150 transition cursor-pointer text-xs font-bold flex items-center justify-center gap-1"
                          title="Видалити дисципліну"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                          <span className="md:hidden">Видалити</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>

          </div>
        )}
      </div>
    );
  }

  if (constructorMode === 'causal_graph') {
    return (
      <div className="constructor-shell flex flex-col gap-6 w-full animate-fadeIn">
        <ConstructorModeTabs value={constructorMode} onChange={setConstructorMode} />

        <Suspense fallback={<LazyPanelFallback />}>
          <CausalGraphConstructor
            dbInstance={dbInstance}
            authInstance={authInstance}
            category={resolvedCategory}
            levelId={level}
            questionId={calculatedQuestionId}
            hasConstructorPermission={hasConstructorPermission}
            triggerToast={triggerToast}
            onRefreshExplorer={onRefreshExplorer}
            activeConnId={activeConn?.id}
            activeConnName={activeConn?.name}
          />
        </Suspense>
      </div>
    );
  }

  if (constructorMode === 'logic') {
    return (
      <div className="constructor-shell flex flex-col gap-6 w-full animate-fadeIn">
        <ConstructorModeTabs value={constructorMode} onChange={setConstructorMode} />
        <Suspense fallback={<LazyPanelFallback />}>
          <LogicConstructorWorkspace
            dbInstance={dbInstance}
            authInstance={authInstance}
            category={resolvedCategory}
            levelId={String(level)}
            questionId={calculatedQuestionId}
            lang={lang}
            questionNumber={questionNumber}
            block={blockIdentifier}
            hasConstructorPermission={hasConstructorPermission}
            triggerToast={triggerToast}
            onRefreshExplorer={onRefreshExplorer}
          />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="constructor-shell flex flex-col gap-6 w-full">
      <ConstructorModeTabs value={constructorMode} onChange={setConstructorMode} />

      {/* Constructor Status Banner */}
      {authInstance && dbInstance && (
        <div className="w-full">
          {(() => {
            const user = authInstance.currentUser;
            if (!user) {
              return (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold">
                  <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    🔑 Будь ласка, увійдіть в акаунт у верхній панелі, щоб мати змогу записувати дані у Firestore. 
                    (Please sign in first to enable Firestore writes.)
                  </span>
                </div>
              );
            }

            if (hasConstructorPermission) {
              return (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span>
                      ✓ <strong>Статус Конструктора: Активний</strong> — У вас є повні права на запис до категорій тестів та дебатів. 
                      (Constructor Status: Active — You have full write permissions.)
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider shrink-0">
                    AUTHORIZED
                  </span>
                </div>
              );
            }

            return (
              <div className="bg-white rounded-2xl border-2 border-amber-400/80 shadow-md p-5 flex flex-col gap-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="bg-amber-100 text-amber-700 p-2 rounded-xl shrink-0">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5 flex-wrap">
                      <span>Немає прав на запис у Firestore?</span>
                      <span className="text-xs font-normal text-slate-400">(No write permissions to Firestore?)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Для безпеки запис у категорії тестів та дебатів обмежено. Щоб розпочати роботу, вам потрібно активувати статус конструктора на вашій базі даних.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <span className="bg-slate-200 text-slate-800 rounded-full h-4 w-4 inline-flex items-center justify-center text-[10px]">1</span>
                      Крок 1: Додайте Правила
                    </p>
                    <p className="text-slate-500 leading-relaxed text-[11px]">
                      Оскільки ви підключили власну базу <code className="text-amber-600 font-bold font-mono">{(dbInstance as any)?.app?.options?.projectId || 'вашу'}</code>, переконайтеся, що ви скопіювали та опублікували наш файл <strong className="font-semibold text-slate-700">firestore.rules</strong> у розділі <strong className="font-semibold text-slate-700">Firestore Rules</strong> у вашій консолі Firebase.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                      <span className="bg-slate-200 text-slate-800 rounded-full h-4 w-4 inline-flex items-center justify-center text-[10px]">2</span>
                      Крок 2: Активуйте Статус
                    </p>
                    <p className="text-slate-500 leading-relaxed text-[11px]">
                      Натисніть кнопку праворуч. Якщо правила безпеки встановлено правильно, програма запише ваш UID у спеціальну колекцію авторизованих розробників у вашій базі, що дасть вам повний доступ.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
                  <div className="text-[11px] text-slate-400 font-mono">
                    User UID: <span className="font-bold text-slate-600">{user.uid}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleActivateConstructorAccess}
                    disabled={isActivatingAccess}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition duration-200 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isActivatingAccess ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Активувати статус конструктора (Activate Access)
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      
      {/* LEFT FORM BUILDER CONTROLS - 7 Rows spacing */}
      <div className="xl:col-span-7 flex flex-col gap-6">
        
        {/* Placement Options Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Layers className="h-5 w-5 text-amber-500 animate-pulse" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">1. Розміщення та Рівень (Level &amp; Placement)</h3>
              <p className="text-[11px] text-slate-400">Шлях та назва документа у Firestore дереві категорій</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Категорія (Category)</label>
              <select
                value={quizCategory}
                onChange={e => setQuizCategory(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
              >
                <option value="erudite">erudite (Ерудит)</option>
                <option value="agora">agora (Агора)</option>
                <option value="noesis">noesis (Ноезис)</option>
                <option value="science">science (Наука)</option>
                <option value="philosophy">philosophy (Філософія)</option>
                <option value="culture">culture (Культура)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Номер Рівня (Level Index)</label>
              <input
                type="number"
                min="1"
                value={level}
                onChange={e => setLevel(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Тариф (Subscription Tier)</label>
              <select
                value={subscriptionTier}
                onChange={e => setSubscriptionTier(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
              >
                <option value="free">free (Безкоштовно)</option>
                <option value="plus">plus (+Plus)</option>
                <option value="expert">expert (Expert)</option>
              </select>
            </div>
          </div>

          {/* Optional Level Document details */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl flex flex-col gap-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
              <Info className="h-3.5 w-3.5 text-blue-500" />
              Додаткові метадані рівня (записуються у документ /{quizCategory}/{level})
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Назва Рівня (Quiz Title) (напр. 'Етика утилітаризму')"
                  value={quizName}
                  onChange={e => setQuizName(e.target.value)}
                  className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Автор Рівня (Author) (напр. 'Данило Юрков')"
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs"
                />
              </div>
            </div>
            <textarea
              rows={1}
              placeholder="Короткий опис Рівня (Description) для екрана очікування..."
              value={levelDescription}
              onChange={e => setLevelDescription(e.target.value)}
              className="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs w-full resize-none"
            />

            <div className="border-t border-slate-200 pt-3 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <BookOpen className="h-3.5 w-3.5 text-amber-600" />
                    Література рівня (Level recommendedLiterature)
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">
                    До 4 спільних джерел для вкладки літератури рівня. Це не джерела окремого питання.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLevelRecommendedLiterature(current => [
                      ...current,
                      { name: '', link: '' }
                    ])}
                    disabled={isLevelLiteratureLoading || isLevelLiteratureSaving || levelRecommendedLiterature.length >= MAX_LEVEL_LITERATURE_SOURCES}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3 w-3" />
                    Додати ({levelRecommendedLiterature.length}/{MAX_LEVEL_LITERATURE_SOURCES})
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveLevelLiterature()}
                    disabled={isLevelLiteratureLoading || isLevelLiteratureSaving || Boolean(levelLiteratureLoadError)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLevelLiteratureSaving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Зберегти джерела
                  </button>
                </div>
              </div>

              {isLevelLiteratureLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[11px] text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Завантаження джерел документа {levelDocPath}...
                </div>
              )}

              {levelLiteratureLoadError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {levelLiteratureLoadError}
                </div>
              )}

              {!isLevelLiteratureLoading && !levelLiteratureLoadError && levelRecommendedLiterature.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-400">
                  Для цього рівня джерела ще не додані.
                </p>
              )}

              {levelRecommendedLiterature.map((source, index) => (
                <div key={index} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2.5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_36px] md:items-center">
                  <input
                    type="text"
                    value={source.name}
                    onChange={event => setLevelRecommendedLiterature(current => current.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, name: event.target.value } : item
                    )))}
                    placeholder={`Назва джерела ${index + 1}`}
                    disabled={isLevelLiteratureLoading || isLevelLiteratureSaving}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs focus:border-amber-400 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                  <input
                    type="url"
                    inputMode="url"
                    value={source.link}
                    onChange={event => setLevelRecommendedLiterature(current => current.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, link: event.target.value } : item
                    )))}
                    placeholder="https://..."
                    disabled={isLevelLiteratureLoading || isLevelLiteratureSaving}
                    className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs focus:border-amber-400 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setLevelRecommendedLiterature(current => current.filter((_, itemIndex) => itemIndex !== index))}
                    disabled={isLevelLiteratureLoading || isLevelLiteratureSaving}
                    aria-label={`Видалити джерело ${index + 1}`}
                    title="Видалити джерело"
                    className="inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Question ID custom scheme Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Flame className="h-5 w-5 text-amber-500 animate-bounce" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">2. Формування Ідентифікатора (ID Scheme)</h3>
              <p className="text-[11px] text-slate-400">Автоматична схема генерації унікального ID за схемою Канону</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Мова (Language)</label>
              <select
                value={lang}
                onChange={e => setLang(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="ua">Ukrainian (ua)</option>
                <option value="en">English (en)</option>
                <option value="pl">Polish (pl)</option>
                <option value="de">German (de)</option>
                <option value="fr">French (fr)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Секвенція (Q Number)</label>
              <input
                type="number"
                min="1"
                value={questionNumber}
                onChange={e => setQuestionNumber(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Блок (Block ID)</label>
              <input
                type="text"
                maxLength={2}
                placeholder="A, B, C..."
                value={blockIdentifier}
                onChange={e => setBlockIdentifier(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Власний ярлик (Slug Text)</label>
              <input
                type="text"
                placeholder="Авто з тексту питання"
                value={questionIdName}
                onChange={e => setQuestionIdName(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-[9px] text-amber-700 font-extrabold uppercase tracking-wider block">Буде сформовано ID документа (Document ID):</span>
              <div className="flex flex-wrap items-center gap-y-1 font-mono text-xs font-extrabold text-amber-950 min-w-0 leading-relaxed">
                <span>{lang}--{previewQNum}--{previewBlock}</span>
                
                {isEditingIdSlug ? (
                  <div className="inline-flex items-center gap-1 bg-white border border-amber-500 rounded-lg px-2 py-0.5 shadow-sm">
                    <input
                      type="text"
                      value={questionIdName || previewQSlug}
                      onChange={(e) => setQuestionIdName(slugify(e.target.value).substring(0, 35))}
                      onBlur={() => setIsEditingIdSlug(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setIsEditingIdSlug(false);
                        }
                      }}
                      className="bg-transparent border-none p-0 text-xs text-slate-900 font-bold font-mono focus:outline-none w-44"
                      autoFocus
                      placeholder="Введіть ярлик вручну"
                    />
                    <button
                      type="button"
                      onClick={() => setIsEditingIdSlug(false)}
                      className="p-0.5 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition shadow-sm bg-slate-50"
                      title="Зберегти (Save)"
                    >
                      <Check className="h-3 w-3 text-emerald-600" />
                    </button>
                  </div>
                ) : (
                  <span
                    onClick={() => setIsEditingIdSlug(true)}
                    className="relative inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-950 border border-dashed border-amber-400 rounded-lg cursor-pointer transition select-none group"
                    title="Клацніть, щоб редагувати ярлик (Click to edit slug)"
                  >
                    <span className="underline decoration-dotted decoration-amber-600 font-extrabold">{previewQSlug}</span>
                    <Pencil className="h-2.5 w-2.5 text-amber-700 opacity-60 group-hover:opacity-100 transition shrink-0" />
                  </span>
                )}
                
                <span>--{randomSuffix}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              {/* Refresh random suffix */}
              <button
                type="button"
                onClick={() => {
                  setRandomSuffix(Math.random().toString(36).substring(2, 6));
                  triggerToast('Regenerated random suffix!', 'info');
                }}
                className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-700 transition"
                title="Оновити випадковий суфікс (Regenerate random suffix)"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin-hover" />
              </button>
              
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(calculatedQuestionId);
                  triggerToast('Copied ID to clipboard!');
                }}
                className="p-1.5 hover:bg-amber-150 rounded-lg text-amber-700 transition"
                title="Copy ID to Clipboard"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content & Taxonomy Common Block */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <BookOpen className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">3. Тематика та Текст (Taxonomy &amp; Common Core)</h3>
              <p className="text-[11px] text-slate-400">Систематика, опис дисципліни, відповідне джерело та пояснення</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Дисципліни (Scientific Disciplines)</label>
              
              {/* Trigger Input-like div */}
              <div
                onClick={() => setDisciplinesDropdownOpen(!disciplinesDropdownOpen)}
                className="bg-slate-50 border border-slate-200 min-h-[38px] px-3 py-1.5 rounded-xl text-xs flex flex-wrap gap-1.5 items-center cursor-pointer select-none hover:border-slate-300 focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition"
              >
                {selectedIds.length > 0 ? (
                  selectedIds.map(id => {
                    const label = DISCIPLINE_MAP[id] || id;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 bg-amber-500/15 text-slate-900 border border-amber-500/20 px-2 py-0.5 rounded-lg text-[11px] font-semibold"
                      >
                        {label}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDiscipline(id);
                          }}
                          className="p-0.5 hover:bg-amber-500/10 rounded text-slate-500 hover:text-slate-800 transition shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-slate-400 pl-1">Оберіть дисципліни... (Select disciplines...)</span>
                )}
                <ChevronDown className="h-4 w-4 text-slate-400 ml-auto shrink-0" />
              </div>

              {/* Click outside backdrop */}
              {disciplinesDropdownOpen && (
                <div 
                  className="fixed inset-0 z-30 bg-transparent" 
                  onClick={() => setDisciplinesDropdownOpen(false)} 
                />
              )}

              {/* Dropdown Card */}
              {disciplinesDropdownOpen && (
                <div className="absolute top-[102%] left-0 right-0 z-40 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden flex flex-col mt-0.5 max-h-[320px] pointer-events-auto">
                  {/* Search Bar */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50 shrink-0">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Шукати дисципліну... (Search name/ID)"
                      value={disciplinesSearch}
                      onClick={(e) => e.stopPropagation()} // stop click propagating to overlay
                      onChange={(e) => setDisciplinesSearch(e.target.value)}
                      className="bg-transparent border-none text-xs w-full focus:outline-none placeholder-slate-400"
                    />
                    {disciplinesSearch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDisciplinesSearch('');
                        }}
                        className="p-1 hover:bg-slate-200 rounded shrink-0"
                      >
                        <X className="h-3 w-3 text-slate-400" />
                      </button>
                    )}
                  </div>

                  {/* Option List Grid */}
                  <div className="overflow-y-auto p-2 space-y-3 max-h-[260px]">
                    {(() => {
                      let hasAnyResults = false;
                      const items = DISCIPLINARY_GROUPS.map(groupObj => {
                        const filtered = groupObj.disciplines.filter(d => 
                          d.label.toLowerCase().includes(disciplinesSearch.toLowerCase()) ||
                          d.value.toLowerCase().includes(disciplinesSearch.toLowerCase())
                        );
                        if (filtered.length > 0) {
                          hasAnyResults = true;
                        }
                        return {
                          ...groupObj,
                          disciplines: filtered
                        };
                      }).filter(groupObj => groupObj.disciplines.length > 0);

                      if (!hasAnyResults) {
                        return (
                          <div className="p-4 text-center text-xs text-slate-400 italic">
                            Нічого не знайдено (No results found)
                          </div>
                        );
                      }

                      return items.map((groupObj, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="text-[9px] font-bold text-slate-400 tracking-wider px-2 uppercase py-1 bg-slate-50 rounded-md">
                            {groupObj.group}
                          </div>
                          <div className="grid grid-cols-1 gap-0.5">
                            {groupObj.disciplines.map(d => {
                              const isSelected = selectedIds.includes(d.value);
                              return (
                                <div
                                  key={d.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDiscipline(d.value);
                                  }}
                                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer select-none transition ${
                                    isSelected 
                                      ? 'bg-amber-500/10 text-amber-950 font-semibold' 
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <span className="flex items-center gap-2">
                                    <span>{d.label}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">({d.value})</span>
                                  </span>
                                  {isSelected && <Check className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Теги / Топіки (Topics) (comma-separated)</label>
              <input
                type="text"
                placeholder="філософія, кант, деонтологія"
                value={topicsInput}
                onChange={e => setTopicsInput(e.target.value)}
                className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono"
              />
            </div>
          </div>

          <ContentPolicyFields value={contentPolicy} onChange={setContentPolicy} />

          {questionType === 'PAIRWISE_DISTINCTION' && (
            <div className="bg-amber-50/80 border border-amber-200/80 p-3.5 rounded-xl text-xs text-amber-900 font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Для типу <strong>PAIRWISE_DISTINCTION</strong> формулювання запитання генерується нативно у додатку (напр., «Яка різниця між...»). Поле тексту питання приховане і не зберігається у Firestore.
              </span>
            </div>
          )}

          {questionType !== 'READING_COMPREHENSION' && questionType !== 'PAIRWISE_DISTINCTION' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Головний текст питання (Question / Task Target)</label>
              <textarea
                rows={6}
                value={questionText}
                onChange={e => {
                  setQuestionText(e.target.value);
                  setIsQuestionTextStale(false);
                }}
                onFocus={() => {
                  if (isQuestionTextStale) {
                    setQuestionText('');
                    setIsQuestionTextStale(false);
                  }
                }}
                onClick={() => {
                  if (isQuestionTextStale) {
                    setQuestionText('');
                    setIsQuestionTextStale(false);
                  }
                }}
                className={`bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs focus:bg-white transition-all duration-200 ${
                  isQuestionTextStale 
                    ? 'border-amber-300 text-slate-400 italic bg-amber-50/10 cursor-pointer hover:border-amber-400' 
                    : 'border-slate-200 text-slate-800'
                }`}
                placeholder="Введіть текст питання..."
              />
            </div>
          )}

          {questionType === 'IMAGE_CHOICE' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Коротке завдання (Short Task / Instruction)</label>
              <textarea
                rows={3}
                value={shortTask}
                onChange={e => {
                  setShortTask(e.target.value);
                  setIsShortTaskStale(false);
                }}
                onFocus={() => {
                  if (isShortTaskStale) {
                    setShortTask('');
                    setIsShortTaskStale(false);
                  }
                }}
                onClick={() => {
                  if (isShortTaskStale) {
                    setShortTask('');
                    setIsShortTaskStale(false);
                  }
                }}
                className={`bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs focus:bg-white transition-all duration-200 ${
                  isShortTaskStale 
                    ? 'border-amber-300 text-slate-400 italic bg-amber-50/10 cursor-pointer hover:border-amber-400' 
                    : 'border-slate-200 text-slate-800'
                }`}
                placeholder="Введіть коротке завдання..."
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Розгорнуте наукове Пояснення рішення (Explanation for correct Answer)</label>
            <textarea
              rows={9}
              value={explanation}
              onChange={e => {
                setExplanation(e.target.value);
                setIsExplanationStale(false);
              }}
              onFocus={() => {
                if (isExplanationStale) {
                  setExplanation('');
                  setIsExplanationStale(false);
                }
              }}
              onClick={() => {
                if (isExplanationStale) {
                  setExplanation('');
                  setIsExplanationStale(false);
                }
              }}
              className={`bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs focus:bg-white transition-all duration-200 ${
                isExplanationStale 
                  ? 'border-amber-300 text-slate-400 italic bg-amber-50/10 cursor-pointer hover:border-amber-400' 
                  : 'border-slate-200 text-slate-800'
              }`}
              placeholder="Введіть наукове пояснення..."
            />
          </div>

          {/* Source literature mapping list */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Рекомендована Література (Sources / recommendedLiterature)</label>
              <button
                type="button"
                onClick={handleAddLiterature}
                className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg text-slate-700 transition flex items-center gap-0.5 shrink-0"
              >
                <Plus className="h-2.5 w-2.5" /> Додати Джерело
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {recommendedLiterature.map((lit, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="text"
                    placeholder="Назва джерела або бібліографія"
                    value={lit.name}
                    onChange={e => {
                      if (isLiteratureStale) {
                        setRecommendedLiterature([{ name: e.target.value, link: '' }]);
                        setIsLiteratureStale(false);
                      } else {
                        const updated = [...recommendedLiterature];
                        updated[idx].name = e.target.value;
                        setRecommendedLiterature(updated);
                      }
                    }}
                    onFocus={() => {
                      if (isLiteratureStale) {
                        setRecommendedLiterature([{ name: '', link: '' }]);
                        setIsLiteratureStale(false);
                      }
                    }}
                    onClick={() => {
                      if (isLiteratureStale) {
                        setRecommendedLiterature([{ name: '', link: '' }]);
                        setIsLiteratureStale(false);
                      }
                    }}
                    className={`w-full sm:flex-1 min-w-0 text-xs bg-slate-50 border px-2.5 py-1.5 rounded-lg transition-all ${
                      isLiteratureStale 
                        ? 'border-amber-300 text-slate-400 italic bg-amber-50/10 cursor-pointer' 
                        : 'border-slate-200 text-slate-800'
                    }`}
                  />
                  <div className="flex items-center gap-2 w-full sm:flex-1 min-w-0">
                    <input
                      type="text"
                      placeholder="Посилання (https://...)"
                      value={lit.link}
                      onChange={e => {
                        if (isLiteratureStale) {
                          setRecommendedLiterature([{ name: '', link: e.target.value }]);
                          setIsLiteratureStale(false);
                        } else {
                          const updated = [...recommendedLiterature];
                          updated[idx].link = e.target.value;
                          setRecommendedLiterature(updated);
                        }
                      }}
                      onFocus={() => {
                        if (isLiteratureStale) {
                          setRecommendedLiterature([{ name: '', link: '' }]);
                          setIsLiteratureStale(false);
                        }
                      }}
                      onClick={() => {
                        if (isLiteratureStale) {
                          setRecommendedLiterature([{ name: '', link: '' }]);
                          setIsLiteratureStale(false);
                        }
                      }}
                      className={`flex-1 min-w-0 text-xs bg-slate-50 border px-2.5 py-1.5 rounded-lg text-blue-600 underline font-mono transition-all ${
                        isLiteratureStale 
                          ? 'border-amber-300 text-slate-400 italic bg-amber-50/10 cursor-pointer' 
                          : 'border-slate-200'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLiterature(idx)}
                      className="p-1.5 hover:text-red-500 rounded-lg text-slate-400 transition animate-pulse-hover shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Toggle: literatureHiddenAtStart */}
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                  <span>Статус джерел на початку питання:</span>
                </span>
                <p className="text-[10px] text-slate-400">
                  Приховайте літературу на старті, якщо вона може розкрити відповідь.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLiteratureHiddenAtStart(!literatureHiddenAtStart)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-sm cursor-pointer self-start sm:self-auto ${
                  literatureHiddenAtStart
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {literatureHiddenAtStart ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5 shrink-0" />
                    <span>Приховано на початку (Hidden at start)</span>
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5 shrink-0" />
                    <span>Відкрито одразу (Show immediately)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Specific Interactive inputs depending on type */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm text-slate-800">4. Поля Типу Питання (Type Specific Editor)</h3>
                <p className="text-[11px] text-slate-400 truncate">Формування специфічних параметрів для обраного типу {questionType}</p>
              </div>
            </div>

            <select
              value={questionType}
              onChange={e => setQuestionType(e.target.value)}
              className="bg-amber-500 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-extrabold shadow-sm hover:bg-amber-600 transition w-full sm:w-auto max-w-full min-w-0"
            >
              <option value="SINGLE_CHOICE">SINGLE_CHOICE (Один правильний з 6)</option>
              <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE (Кілька правильних з 6)</option>
              <option value="TRUE_FALSE">TRUE_FALSE (Так / Ні)</option>
              <option value="SEQUENCE">SEQUENCE (Послідовність)</option>
              <option value="MATCHING">MATCHING (Пари відповідностей)</option>
              <option value="COMPARISON">COMPARISON (Класифікатор)</option>
              <option value="TEXT_INPUT">TEXT_INPUT (Рядок-термін увід)</option>
              <option value="FILL_IN_THE_BLANK">FILL_IN_THE_BLANK (Пропуски в тексті)</option>
              <option value="IMAGE_CHOICE">IMAGE_CHOICE (Вибір фото)</option>
              <option value="READING_COMPREHENSION">READING_COMPREHENSION (Текст + Субпитання)</option>
              <option value="SLIDER_SCALE">SLIDER_SCALE (Повзунок-Шкала)</option>
              <option value="TEN_FACTS">TEN_FACTS (Десять Етапних Фактів)</option>
              <option value="PAIRWISE_DISTINCTION">PAIRWISE_DISTINCTION (Розрізнення двох об'єктів)</option>
            </select>
          </div>

          {/* DYNAMIC FORMS ACCORDING TO TYPE */}
          
          {/* 1 & 2: SINGLE & MULTIPLE CHOICES */}
          {(questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Варіанти відповіді (Answers Options)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOptions([...options, { value: '', isCorrect: false }]);
                    setIsOptionsStale(false);
                  }}
                  className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-2 py-1 rounded-lg transition"
                >
                  + Додати варіант (+ Add option)
                </button>
              </div>
              <div className="flex flex-col gap-2.5">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                    <span className="text-xs font-extrabold text-slate-400 w-5">{idx + 1}.</span>
                    <input
                      type="text"
                      placeholder={`Варіант ${idx + 1}`}
                      value={opt.value}
                      onChange={e => {
                        if (isOptionsStale) {
                          const updated = options.map((o, oIdx) => ({
                            value: oIdx === idx ? e.target.value : '',
                            isCorrect: oIdx === 0
                          }));
                          setOptions(updated);
                          setCorrectSingleChoice(0);
                          setIsOptionsStale(false);
                        } else {
                          const updated = [...options];
                          updated[idx].value = e.target.value;
                          setOptions(updated);
                        }
                      }}
                      onFocus={() => {
                        if (isOptionsStale) {
                          const updated = options.map((_, oIdx) => ({
                            value: '',
                            isCorrect: oIdx === 0
                          }));
                          setOptions(updated);
                          setCorrectSingleChoice(0);
                          setIsOptionsStale(false);
                        }
                      }}
                      onClick={() => {
                        if (isOptionsStale) {
                          const updated = options.map((_, oIdx) => ({
                            value: '',
                            isCorrect: oIdx === 0
                          }));
                          setOptions(updated);
                          setCorrectSingleChoice(0);
                          setIsOptionsStale(false);
                        }
                      }}
                      className={`flex-1 text-xs bg-white border px-2.5 py-1.5 rounded-lg transition-all ${
                        isOptionsStale 
                          ? 'border-amber-300 text-slate-400 italic bg-amber-50/10 cursor-pointer' 
                          : 'border-slate-200 text-slate-800'
                      }`}
                    />
                    {questionType === 'SINGLE_CHOICE' ? (
                      <input
                        type="radio"
                        name="correctSingleChoice"
                        checked={correctSingleChoice === idx}
                        onChange={() => setCorrectSingleChoice(idx)}
                        className="h-4.5 w-4.5 accent-amber-500 cursor-pointer"
                        title="Позначити правильним"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={opt.isCorrect}
                        onChange={e => {
                          const updated = [...options];
                          updated[idx].isCorrect = e.target.checked;
                          setOptions(updated);
                        }}
                        className="h-4.5 w-4.5 accent-amber-500 cursor-pointer"
                        title="Позначити правильним"
                      />
                    )}
                    {options.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = options.filter((_, i) => i !== idx);
                          setOptions(updated);
                          if (correctSingleChoice >= updated.length) {
                            setCorrectSingleChoice(Math.max(0, updated.length - 1));
                          }
                          setIsOptionsStale(false);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1"
                        title="Видалити варіант"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3: TRUE_FALSE */}
          {questionType === 'TRUE_FALSE' && (
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Правильне твердження (correctAnswer)</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTrueFalseAnswer(true)}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition duration-200 ${
                    trueFalseAnswer === true
                      ? 'bg-emerald-500 border-emerald-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ПРАВДА / TRUE
                </button>
                <button
                  type="button"
                  onClick={() => setTrueFalseAnswer(false)}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition duration-200 ${
                    trueFalseAnswer === false
                      ? 'bg-red-500 border-red-600 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  НЕПРАВДА / FALSE
                </button>
              </div>
            </div>
          )}

          {/* 4: SEQUENCE Chronology */}
          {questionType === 'SEQUENCE' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Елементи упорядкування (sequenceItems)
                </label>
                <button
                  type="button"
                  onClick={() => setSequenceItems([...sequenceItems, { value: '', order: String(sequenceItems.length + 1) }])}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold"
                >
                  + Елемент
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {sequenceItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Назва елемента ${idx + 1}`}
                      value={item.value}
                      onChange={e => {
                        const updated = [...sequenceItems];
                        updated[idx].value = e.target.value;
                        setSequenceItems(updated);
                      }}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg"
                    />
                    <select
                      value={item.order}
                      onChange={e => {
                        const updated = [...sequenceItems];
                        updated[idx].order = e.target.value;
                        setSequenceItems(updated);
                      }}
                      className="bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-xs"
                    >
                      {sequenceItems.map((_, i) => (
                        <option key={i} value={String(i + 1)}>
                          {i + 1}
                        </option>
                      ))}
                    </select>
                    {sequenceItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = sequenceItems.filter((_, i) => i !== idx);
                          setSequenceItems(updated);
                        }}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5: MATCHING */}
          {questionType === 'MATCHING' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Left side column */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ліва сторона (Left Side)</span>
                    <button
                      type="button"
                      onClick={() => setMatchingLeft([...matchingLeft, { value: '', match: 'A' }])}
                      className="text-[9px] bg-slate-150 px-1.5 py-0.5 rounded text-slate-700"
                    >
                      + Варіант
                    </button>
                  </div>
                  {matchingLeft.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <span className="text-xs font-bold text-amber-600 w-5">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder="Ключове слово"
                        value={item.value}
                        onChange={e => {
                          const updated = [...matchingLeft];
                          updated[idx].value = e.target.value;
                          setMatchingLeft(updated);
                        }}
                        className="flex-1 text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-lg"
                      />
                      <select
                        value={item.match}
                        onChange={e => {
                          const updated = [...matchingLeft];
                          updated[idx].match = e.target.value;
                          setMatchingLeft(updated);
                        }}
                        className="text-xs bg-slate-250 font-bold px-1 py-0.5 rounded w-14 text-center font-mono"
                        title="З яким літерним індексом правої зони зєднується"
                      >
                        {['A', 'B', 'C', 'D', 'E', 'F'].map(letter => (
                          <option key={letter} value={letter}>{letter}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setMatchingLeft(matchingLeft.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-550"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Right side column */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Права сторона (Right Side)</span>
                    <button
                      type="button"
                      onClick={() => setMatchingRight([...matchingRight, { value: '' }])}
                      className="text-[9px] bg-slate-150 px-1.5 py-0.5 rounded text-slate-700"
                    >
                      + Варіант
                    </button>
                  </div>
                  {matchingRight.map((item, idx) => {
                    const charCode = String.fromCharCode(65 + idx);
                    return (
                      <div key={idx} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        <span className="text-xs font-mono font-extrabold text-amber-600 w-5">{charCode}.</span>
                        <input
                          type="text"
                          placeholder="Пов’язане визначення"
                          value={item.value}
                          onChange={e => {
                            const updated = [...matchingRight];
                            updated[idx].value = e.target.value;
                            setMatchingRight(updated);
                          }}
                          className="flex-1 text-xs bg-white border border-slate-200 px-1.5 py-0.5 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => setMatchingRight(matchingRight.filter((_, i) => i !== idx))}
                          className="text-slate-400 hover:text-red-550"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>

              </div>

              <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Зайва опція дистрактор праворуч (extraOptionIndex)</label>
                <select
                  value={extraOptionIndex}
                  onChange={e => setExtraOptionIndex(parseInt(e.target.value, 10))}
                  className="bg-white border border-slate-200 rounded-lg p-1 text-xs font-mono"
                >
                  {matchingRight.map((_, i) => (
                    <option key={i} value={i}>Індекс #{i} ({String.fromCharCode(65 + i)} is Distractor)</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 6: COMPARISON */}
          {questionType === 'COMPARISON' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Групові Категорії (Categories)</label>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-2 py-0.5 rounded transition"
                >
                  + Додати категорію (+ Category)
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {comparisonCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      placeholder={`Категорія ${idx + 1}`}
                      value={cat}
                      onChange={e => {
                        const updated = [...comparisonCategories];
                        updated[idx] = e.target.value;
                        setComparisonCategories(updated);
                      }}
                      className="text-xs flex-1 bg-white border border-slate-200 py-1 px-2 rounded-md font-bold text-center"
                    />
                    {comparisonCategories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(idx)}
                        className="text-slate-400 hover:text-red-500 p-1 focus:outline-none shrink-0"
                        title="Видалити категорію"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Тези класифікації (Statements)</span>
                <button
                  type="button"
                  onClick={() => setComparisonStatements([...comparisonStatements, { text: '', correctCategoryIndex: '0' }])}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 font-bold"
                >
                  + Тезу
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {comparisonStatements.map((stm, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Текст твердження для сортування"
                      value={stm.text}
                      onChange={e => {
                        const updated = [...comparisonStatements];
                        updated[idx].text = e.target.value;
                        setComparisonStatements(updated);
                      }}
                      className="flex-1 text-xs bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg"
                    />
                    <select
                      value={stm.correctCategoryIndex}
                      onChange={e => {
                        const updated = [...comparisonStatements];
                        updated[idx].correctCategoryIndex = e.target.value;
                        setComparisonStatements(updated);
                      }}
                      className="text-xs bg-white border border-slate-200 rounded-lg p-1.5 focus:outline-none"
                    >
                      {comparisonCategories.map((cat, i) => (
                        <option key={i} value={String(i)}>{cat || `Категорія ${i+1}`}</option>
                      ))}
                      <option value="common">Спільне (Common)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setComparisonStatements(comparisonStatements.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7: TEXT_INPUT */}
          {questionType === 'TEXT_INPUT' && (
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Правильні відповіді через кому (correctAnswers)</label>
              <input
                type="text"
                placeholder="Введіть правильні відповіді, розділяючи комами (наприклад: США, Сполучені Штати Америки, Америка)"
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                className="bg-slate-50 border border-slate-201 p-2.5 rounded-xl text-xs font-mono focus:bg-white"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                Можна ввести кілька синонімів або варіантів написання через кому. Будь-яка з цих відповідей буде зарахована як правильна у додатку.
              </p>
            </div>
          )}

          {/* 8: FILL_IN_THE_BLANK */}
          {questionType === 'FILL_IN_THE_BLANK' && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Частини фрази та Пропуски</label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFillInParts([...fillInParts, { type: 'text', value: '' }])}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-700 italic"
                  >
                    + Додати текст
                  </button>
                  <button
                    type="button"
                    onClick={() => setFillInParts([...fillInParts, { type: 'blank', value: 'слово' }])}
                    className="text-[10px] bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded text-amber-800 font-bold"
                  >
                    + Вставити Пропуск [ ]
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-dashed border-slate-200">
                {fillInParts.map((part, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded min-w-[50px] text-center border mr-1 self-center bg-white">
                      {part.type === 'text' ? 'Текст' : 'Пропуск'}
                    </span>
                    <input
                      type="text"
                      placeholder={part.type === 'text' ? 'Введіть частину речення' : 'Правильна вставка'}
                      value={part.value}
                      onChange={e => {
                        const updated = [...fillInParts];
                        updated[idx].value = e.target.value;
                        setFillInParts(updated);
                      }}
                      className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg border focus:bg-white ${
                        part.type === 'blank' ? 'bg-amber-50 border-amber-300 font-bold text-amber-950 font-mono' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setFillInParts(fillInParts.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9: IMAGE_CHOICE */}
          {questionType === 'IMAGE_CHOICE' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Фото-Джерела (Image options list)</label>
                <button
                  type="button"
                  onClick={() => setImageOptions([...imageOptions, { url: '', name: '', description: '' }])}
                  className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1.5 rounded-lg transition"
                >
                  + Додати фото (+ Add photo)
                </button>
              </div>
              <div className="flex flex-col gap-3.5">
                {imageOptions.map((opt, idx) => (
                  <div key={idx} className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition relative">
                    {/* Header bar of the photo card */}
                    <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-1">
                      <span className="text-xs font-extrabold text-amber-600 uppercase tracking-wider">Фото #{idx + 1}</span>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                          <input
                            type="radio"
                            name="correctImageChoice"
                            checked={correctImageChoice === idx}
                            onChange={() => setCorrectImageChoice(idx)}
                            className="h-4.5 w-4.5 accent-amber-500 cursor-pointer"
                          />
                          <span>Правильна відповідь</span>
                        </label>
                        {imageOptions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = imageOptions.filter((_, i) => i !== idx);
                              setImageOptions(updated);
                              if (correctImageChoice >= updated.length) {
                                setCorrectImageChoice(Math.max(0, updated.length - 1));
                              }
                            }}
                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition"
                            title="Видалити фото"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Editor Fields with Preview */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      {opt.url && (
                        <div className="md:col-span-2 flex items-center justify-center bg-white border border-slate-200 rounded-xl p-1 aspect-square overflow-hidden max-h-[85px] shadow-xs">
                          <img
                            src={opt.url}
                            alt={opt.name || `Photo ${idx + 1}`}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div className={opt.url ? "md:col-span-10 flex flex-col gap-3 w-full" : "md:col-span-12 flex flex-col gap-3 w-full"}>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL зображення</span>
                          <input
                            type="text"
                            value={opt.url}
                            onChange={e => {
                              const updated = [...imageOptions];
                              updated[idx].url = e.target.value;
                              setImageOptions(updated);
                            }}
                            className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg font-mono focus:border-amber-500 focus:outline-none w-full"
                            placeholder="https://images.unsplash.com/... або інше"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Назва фото (явища, процесу)</span>
                          <input
                            type="text"
                            value={opt.name || ''}
                            onChange={e => {
                              const updated = [...imageOptions];
                              updated[idx].name = e.target.value;
                              setImageOptions(updated);
                            }}
                            className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-none w-full"
                            placeholder="Назва чи назва процесу на фото"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Опис (цього явища)</span>
                          <textarea
                            value={opt.description || ''}
                            onChange={e => {
                              const updated = [...imageOptions];
                              updated[idx].description = e.target.value;
                              setImageOptions(updated);
                            }}
                            rows={3}
                            className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg focus:border-amber-500 focus:outline-none w-full resize-y min-h-[60px]"
                            placeholder="Додатковий опис явища"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 10: READING_COMPREHENSION */}
          {questionType === 'READING_COMPREHENSION' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Перший Текст Джерела (text1)</label>
                  <textarea
                    rows={4}
                    value={readingText1}
                    onChange={e => setReadingText1(e.target.value)}
                    className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Другий Текст Джерела (text2)</label>
                  <textarea
                    rows={4}
                    value={readingText2}
                    onChange={e => setReadingText2(e.target.value)}
                    className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-bold text-slate-700">Підпитання (Questions) (рекомендовано до 10)</span>
                <button
                  type="button"
                  onClick={() => setReadingCompQuestions([...readingCompQuestions, {
                    question: '',
                    options: [{ value: '' }, { value: '' }, { value: '' }, { value: '' }],
                    correctAnswerIndex: '0'
                  }])}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded font-bold text-slate-700"
                >
                  + Нове Підпитання
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {readingCompQuestions.map((q, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-700">№{idx + 1} Завдання:</span>
                      <button
                        type="button"
                        onClick={() => setReadingCompQuestions(readingCompQuestions.filter((_, i) => i !== idx))}
                        className="text-slate-450 hover:text-red-550 text-xs"
                      >
                        Видалити
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Введіть питання до текстів..."
                      value={q.question}
                      onChange={e => {
                        const updated = [...readingCompQuestions];
                        updated[idx].question = e.target.value;
                        setReadingCompQuestions(updated);
                      }}
                      className="text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg w-full font-bold"
                    />
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {q.options.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center gap-1 bg-white border border-slate-150 p-1.5 rounded-lg">
                          <span className="text-[10px] font-bold text-slate-350">{oIdx + 1}.</span>
                          <input
                            type="text"
                            placeholder={`Варіант ${oIdx + 1}`}
                            value={opt.value}
                            onChange={e => {
                              const updated = [...readingCompQuestions];
                              updated[idx].options[oIdx].value = e.target.value;
                              setReadingCompQuestions(updated);
                            }}
                            className="flex-1 text-[11px] outline-none"
                          />
                          <input
                            type="radio"
                            name={`correctSub_${idx}`}
                            checked={parseInt(q.correctAnswerIndex, 10) === oIdx}
                            onChange={() => {
                              const updated = [...readingCompQuestions];
                              updated[idx].correctAnswerIndex = String(oIdx);
                              setReadingCompQuestions(updated);
                            }}
                            className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 11: SLIDER_SCALE */}
          {questionType === 'SLIDER_SCALE' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">👥 Кількість опитаних (Respondents)</label>
                  <input
                    type="text"
                    value={respondentsCount}
                    onChange={e => setRespondentsCount(e.target.value)}
                    placeholder="напр. 28 333"
                    className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🌍 Кількість країн (Countries)</label>
                  <input
                    type="text"
                    value={countriesCount}
                    onChange={e => setCountriesCount(e.target.value)}
                    placeholder="напр. 25"
                    className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📅 Тривалість опитування (Period)</label>
                  <input
                    type="text"
                    value={surveyPeriod}
                    onChange={e => setSurveyPeriod(e.target.value)}
                    placeholder="напр. січень–квітень 2025"
                    className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🏛️ Хто проводив дослідження (Center/Author)</label>
                  <input
                    type="text"
                    value={researchCenter}
                    onChange={e => setResearchCenter(e.target.value)}
                    placeholder="напр. Pew Research Center"
                    className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-amber-400 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">Слайдери та Оцінки (sliders)</span>
                <button
                  type="button"
                  onClick={() => setSliders([...sliders, { question: '', correctAnswer: 50 }])}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded text-slate-700"
                >
                  + Новий Повзунок
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {sliders.map((s, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <input
                      type="text"
                      placeholder="Який відсоток підтримав...?"
                      value={s.question}
                      onChange={e => {
                        const updated = [...sliders];
                        updated[idx].question = e.target.value;
                        setSliders(updated);
                      }}
                      className="flex-1 text-xs bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-500 w-8 text-right">{s.correctAnswer}%</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={s.correctAnswer}
                        onChange={e => {
                          const updated = [...sliders];
                          updated[idx].correctAnswer = parseInt(e.target.value, 10);
                          setSliders(updated);
                        }}
                        className="h-2 bg-amber-200 accent-amber-500 cursor-pointer"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSliders(sliders.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 12: TEN_FACTS */}
          {questionType === 'TEN_FACTS' && (
            <div className="flex flex-col gap-4">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Десять завуальованих фактів (facts)
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {tenFacts.map((fact, idx) => (
                  <div key={idx} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[10px] font-mono font-extrabold text-amber-600 block w-14">Факт #{idx + 1}:</span>
                    <input
                      type="text"
                      placeholder={`Несподіване твердження ${idx + 1}`}
                      value={fact.value}
                      onChange={e => {
                        const updated = [...tenFacts];
                        updated[idx].value = e.target.value;
                        setTenFacts(updated);
                      }}
                      className="flex-1 text-[11px] bg-white border border-slate-200 px-2 py-1 rounded-md"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Список варіантів відгадок:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setOptions([...options, { value: '', isCorrect: false }]);
                      setIsOptionsStale(false);
                    }}
                    className="text-[9px] bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-2 py-0.5 rounded transition"
                  >
                    + Додати варіант (+ Add option)
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                      <input
                        type="text"
                        value={opt.value}
                        onChange={e => {
                          const updated = [...options];
                          updated[idx].value = e.target.value;
                          setOptions(updated);
                        }}
                        className="flex-1 text-[11px] bg-white border border-slate-200 px-2.5 py-1 rounded-lg animate-fade-in"
                      />
                      <input
                        type="radio"
                        name="correctTenFacts"
                        checked={correctSingleChoice === idx}
                        onChange={() => setCorrectSingleChoice(idx)}
                        className="h-4 w-4 accent-amber-500 cursor-pointer"
                      />
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = options.filter((_, i) => i !== idx);
                            setOptions(updated);
                            if (correctSingleChoice >= updated.length) {
                              setCorrectSingleChoice(Math.max(0, updated.length - 1));
                            }
                          }}
                          className="text-slate-400 hover:text-red-550 focus:outline-none shrink-0"
                          title="Видалити варіант"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 13: PAIRWISE_DISTINCTION */}
          {questionType === 'PAIRWISE_DISTINCTION' && (
            <div className="flex flex-col gap-6">
              {/* Objects Editor Block */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      1. Два об'єкти для порівняння (Objects - Exactly 2)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    2 Об'єкти
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pairwiseObjects.map((obj, objIdx) => (
                    <div 
                      key={objIdx} 
                      className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 flex flex-col gap-3 relative hover:border-amber-400/60 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-lg">
                          Об'єкт #{objIdx + 1}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          id: <strong className="text-slate-700">{obj.id || '—'}</strong>
                        </span>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Унікальний ID (id)</label>
                          <input
                            type="text"
                            placeholder="напр. alligator"
                            value={obj.id}
                            onChange={e => {
                              const updated = [...pairwiseObjects];
                              updated[objIdx].id = e.target.value;
                              setPairwiseObjects(updated);
                            }}
                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-slate-800"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Назва об'єкта (Name)</label>
                          <input
                            type="text"
                            placeholder="напр. Алігатор"
                            value={obj.name}
                            onChange={e => {
                              const updated = [...pairwiseObjects];
                              updated[objIdx].name = e.target.value;
                              setPairwiseObjects(updated);
                            }}
                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Шлях до зображення (imagePath)</label>
                          <input
                            type="text"
                            placeholder="/quiz-images/.../alligator.webp"
                            value={obj.imagePath}
                            onChange={e => {
                              const updated = [...pairwiseObjects];
                              updated[objIdx].imagePath = e.target.value;
                              setPairwiseObjects(updated);
                            }}
                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-700"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Альтернативний текст (altText - optional)</label>
                          <input
                            type="text"
                            placeholder="Опис зображення для доступності"
                            value={obj.altText || ''}
                            onChange={e => {
                              const updated = [...pairwiseObjects];
                              updated[objIdx].altText = e.target.value;
                              setPairwiseObjects(updated);
                            }}
                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs text-slate-700"
                          />
                        </div>
                      </div>

                      {/* Image Preview */}
                      {obj.imagePath && (
                        <div className="mt-1 pt-2 border-t border-slate-200/60 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300 flex items-center justify-center">
                            <img 
                              src={obj.imagePath} 
                              alt={obj.altText || obj.name}
                              className="w-full h-full object-cover"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500 truncate font-mono">
                            {obj.imagePath}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Statements Editor Block */}
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-200/80">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                      2. Твердження / Ознаки для розподілу (Statements)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Кожне твердження має унікальний ID, текст та правильний об'єкт (correctObjectId)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const newId = `st_${Date.now().toString(36).slice(-4)}`;
                      setPairwiseStatements([
                        ...pairwiseStatements,
                        {
                          id: newId,
                          text: '',
                          correctObjectId: pairwiseObjects[0]?.id || ''
                        }
                      ]);
                    }}
                    className="text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Додати твердження
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                  {pairwiseStatements.map((st, stIdx) => (
                    <div 
                      key={stIdx} 
                      className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex flex-col md:flex-row items-start md:items-center gap-3 hover:border-amber-400/50 transition"
                    >
                      <span className="text-[11px] font-mono font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md shrink-0">
                        #{stIdx + 1}
                      </span>

                      {/* ID input */}
                      <div className="w-full md:w-32 shrink-0 flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">ID твердження</label>
                        <input
                          type="text"
                          placeholder="id"
                          value={st.id}
                          onChange={e => {
                            const updated = [...pairwiseStatements];
                            updated[stIdx].id = e.target.value;
                            setPairwiseStatements(updated);
                          }}
                          className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-slate-800"
                        />
                      </div>

                      {/* Text input */}
                      <div className="flex-1 w-full flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Текст твердження</label>
                        <input
                          type="text"
                          placeholder="Введіть ознаку чи твердження..."
                          value={st.text}
                          onChange={e => {
                            const updated = [...pairwiseStatements];
                            updated[stIdx].text = e.target.value;
                            setPairwiseStatements(updated);
                          }}
                          className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-medium text-slate-800"
                        />
                      </div>

                      {/* Correct Object Select */}
                      <div className="w-full md:w-48 shrink-0 flex flex-col gap-0.5">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Правильний об'єкт</label>
                        <select
                          value={st.correctObjectId}
                          onChange={e => {
                            const updated = [...pairwiseStatements];
                            updated[stIdx].correctObjectId = e.target.value;
                            setPairwiseStatements(updated);
                          }}
                          className="bg-white border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-amber-500"
                        >
                          {pairwiseObjects.map(obj => (
                            <option key={obj.id} value={obj.id}>
                              {obj.name || obj.id} ({obj.id})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete button */}
                      {pairwiseStatements.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPairwiseStatements(pairwiseStatements.filter((_, i) => i !== stIdx));
                          }}
                          className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-200/60 transition shrink-0 self-end md:self-center"
                          title="Видалити твердження"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TOURNAMENT DUPLICATION FIELDS */}
          <div className="mt-6 border-t border-slate-200/60 pt-6" id="tournament-config-section">
              <div className="bg-amber-50/20 border border-amber-500/20 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-amber-500/10 text-amber-600 rounded-lg">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm text-slate-800">Турнірне питання (Tournament Question Mirror)</h4>
                        
                        {/* Status Badge */}
                        {tournamentPublicationStatus === 'PUBLISHED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Опубліковано
                          </span>
                        )}
                        {tournamentPublicationStatus === 'NEEDS_UPDATE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Потребує оновлення
                          </span>
                        )}
                        {tournamentPublicationStatus === 'NOT_PUBLISHED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-600 border border-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Не опубліковано
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">Спрощена структура в колекції tournamentQuestionPools</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={saveToTournament} 
                      onChange={e => setSaveToTournament(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                    <span className="ml-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">Увімкнути</span>
                  </label>
                </div>

                {saveToTournament && (
                  <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 animate-fade-in">
                    
                    {/* Collection configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📅 Рік / Сезон (seasonId)</label>
                        <input
                          type="text"
                          value={tournamentYear}
                          onChange={e => setTournamentYear(e.target.value)}
                          placeholder="напр. 2026 (порожньо для безстрокових)"
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📁 Колекція Firestore (Фіксовано)</label>
                        <div className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs font-mono text-slate-600 select-all">
                          tournamentQuestionPools
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🔑 Пошуковий ключ (poolKey)</label>
                        <div className="bg-amber-50/50 border border-amber-200/50 text-amber-800 px-3 py-2 rounded-xl text-xs font-mono font-bold truncate">
                          {lang}|{tournamentCategoryId || quizCategory}|{resolveTournamentQuestionType(questionType)}|{Number(tournamentDifficulty) || 2}
                        </div>
                      </div>
                    </div>

                    {/* Question customization */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📝 Спрощений текст запитання для турніру</label>
                        <button
                          type="button"
                          onClick={() => setTournamentQuestion(questionText)}
                          className="text-[10px] text-amber-600 hover:text-amber-700 font-bold uppercase tracking-wider"
                        >
                          Скопіювати з основного
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={tournamentQuestion}
                        onChange={e => setTournamentQuestion(e.target.value)}
                        placeholder="Залиште порожнім, щоб використати текст основного питання, або введіть спрощений варіант..."
                        className="bg-white border border-slate-200 px-3 py-2.5 rounded-xl text-xs focus:bg-white focus:ring-1 focus:ring-amber-500 outline-none"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🏷️ Категорія (CategoryId)</label>
                        <select
                          value={tournamentCategoryId}
                          onChange={e => setTournamentCategoryId(e.target.value)}
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none font-medium text-slate-700"
                        >
                          <option value="science">science</option>
                          <option value="culture">culture</option>
                          <option value="erudite">erudite</option>
                          <option value="philosophy">philosophy</option>
                          <option value="noesis">noesis</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📊 Складність (Difficulty 1–5)</label>
                        <select
                          value={tournamentDifficulty}
                          onChange={e => setTournamentDifficulty(Number(e.target.value))}
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none font-medium text-slate-700"
                        >
                          <option value={1}>1 - Легко</option>
                          <option value={2}>2 - Нормально</option>
                          <option value={3}>3 - Середньо</option>
                          <option value={4}>4 - Складно</option>
                          <option value={5}>5 - Експерт</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⚡ Статус питання (Status)</label>
                        <select
                          value={tournamentStatus}
                          onChange={e => setTournamentStatus(e.target.value)}
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none font-medium text-slate-700"
                        >
                          <option value="active">Active</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⏳ Ліміт часу (секунди)</label>
                        <div className="bg-slate-100 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-500 font-medium select-none h-9 flex items-center">
                          15 (Фіксовано для Android V2)
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📝 Тема / Топік (topicLabel)</label>
                        <input
                          type="text"
                          value={tournamentTopicLabel}
                          onChange={e => setTournamentTopicLabel(e.target.value)}
                          placeholder="напр. Астрономія"
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🎯 Доступність</label>
                        <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-600 font-semibold h-9 flex items-center">
                          Завжди активна для пулу
                        </div>
                      </div>
                    </div>

                    {/* Version settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">🔄 Версія оригінального питання (sourceVersion)</label>
                        <input
                          type="number"
                          value={tournamentSourceVersion}
                          onChange={e => setTournamentSourceVersion(Number(e.target.value))}
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">⚙️ Версія турнірної схеми (schemaVersion)</label>
                        <input
                          type="number"
                          value={tournamentSchemaVersion}
                          onChange={e => setTournamentSchemaVersion(Number(e.target.value))}
                          className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                        />
                      </div>
                    </div>

                    {/* Custom options overrides */}
                    <div className="border-t border-slate-100 pt-4 mt-2">
                      {!isNativeTournamentQuestionType(questionType) && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                          <span className="font-bold">{questionType}</span> не підтримується турнірним екраном напряму.
                          У турнір буде записано окрему спрощену версію <span className="font-bold">SINGLE_CHOICE</span>.
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Варіанти відповідей для турніру</h5>
                        {isNativeTournamentQuestionType(questionType) && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={useMainAnswers}
                              onChange={e => setUseMainAnswers(e.target.checked)}
                              className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">Використовувати з основного питання</span>
                          </label>
                        )}
                      </div>

                      {(!isNativeTournamentQuestionType(questionType) || !useMainAnswers) && (
                        <div className="bg-slate-50/50 border border-slate-200/50 p-4 rounded-xl flex flex-col gap-3">
                          {/* SINGLE_CHOICE / MULTIPLE_CHOICE answers */}
                          {(resolveTournamentQuestionType(questionType) === 'SINGLE_CHOICE' || resolveTournamentQuestionType(questionType) === 'MULTIPLE_CHOICE') && (
                            <div className="flex flex-col gap-2.5">
                              {tournamentAnswers.map((ans, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <span className="text-xs font-mono font-bold text-slate-400 w-4">{String.fromCharCode(65 + idx)}</span>
                                  <input
                                    type="text"
                                    value={ans}
                                    onChange={e => {
                                      const updated = [...tournamentAnswers];
                                      updated[idx] = e.target.value;
                                      setTournamentAnswers(updated);
                                    }}
                                    placeholder={`Варіант ${String.fromCharCode(65 + idx)}`}
                                    className="bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs flex-1 outline-none focus:ring-1 focus:ring-amber-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (tournamentCorrectIndices.includes(idx)) {
                                        setTournamentCorrectIndices(tournamentCorrectIndices.filter(i => i !== idx));
                                      } else {
                                        if (resolveTournamentQuestionType(questionType) === 'SINGLE_CHOICE') {
                                          setTournamentCorrectIndices([idx]);
                                        } else {
                                          setTournamentCorrectIndices([...tournamentCorrectIndices, idx].sort());
                                        }
                                      }
                                    }}
                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition ${
                                      tournamentCorrectIndices.includes(idx)
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'
                                    }`}
                                  >
                                    {tournamentCorrectIndices.includes(idx) ? 'Вірно' : 'Невірно'}
                                  </button>
                                  {tournamentAnswers.length > 2 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTournamentAnswers(tournamentAnswers.filter((_, i) => i !== idx));
                                        setTournamentCorrectIndices(tournamentCorrectIndices.filter(i => i !== idx).map(i => i > idx ? i - 1 : i));
                                      }}
                                      className="text-slate-400 hover:text-red-500"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {tournamentAnswers.length < 6 && (
                                <button
                                  type="button"
                                  onClick={() => setTournamentAnswers([...tournamentAnswers, ''])}
                                  className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 mt-1"
                                >
                                  <Plus className="h-3 w-3" /> Додати варіант відповідей
                                </button>
                              )}
                            </div>
                          )}

                          {/* TRUE_FALSE */}
                          {resolveTournamentQuestionType(questionType) === 'TRUE_FALSE' && (
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-semibold text-slate-600">Турнірна відповідь:</span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setTournamentTrueFalseAnswer(true)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                                    tournamentTrueFalseAnswer
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  Правда (True)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTournamentTrueFalseAnswer(false)}
                                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                                    !tournamentTrueFalseAnswer
                                      ? 'bg-red-50 border-red-300 text-red-700'
                                      : 'bg-white border-slate-200 text-slate-600'
                                  }`}
                                >
                                  Неправда (False)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* TEXT_INPUT */}
                          {resolveTournamentQuestionType(questionType) === 'TEXT_INPUT' && (
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Прийнятні відповіді (через кому)</label>
                              <input
                                type="text"
                                value={tournamentTextAnswers}
                                onChange={e => setTournamentTextAnswers(e.target.value)}
                                placeholder="напр. Київ, Київ місто, місто Київ"
                                className="bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* LIVE CORRECT ANSWER PREVIEW BOX */}
                    <div className="mt-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col gap-1.5">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Перегляд правильної відповіді перед публікацією</span>
                      </div>

                      {resolveTournamentQuestionType(questionType) === 'SINGLE_CHOICE' && (
                        tournamentCorrectIndices[0] >= 0 && tournamentCorrectIndices[0] < tournamentAnswers.length ? (
                          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong className="text-emerald-900">Правильна відповідь: {tournamentCorrectIndices[0] + 1}.</strong> "{tournamentAnswers[tournamentCorrectIndices[0]]}"
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-semibold text-red-800 bg-red-50/90 p-2.5 rounded-lg border border-red-200">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>⚠️ Індекс правильної відповіді не обрано або він поза межами! Публікація заблокована.</span>
                          </div>
                        )
                      )}

                      {resolveTournamentQuestionType(questionType) === 'MULTIPLE_CHOICE' && (
                        tournamentCorrectIndices.filter(i => i >= 0 && i < tournamentAnswers.length).length > 0 ? (
                          <div className="flex items-start gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <div className="font-bold text-emerald-900">
                                Правильні відповіді ({tournamentCorrectIndices.filter(i => i >= 0 && i < tournamentAnswers.length).length}):
                              </div>
                              <ul className="list-disc list-inside mt-1 space-y-0.5 font-normal">
                                {tournamentCorrectIndices.filter(i => i >= 0 && i < tournamentAnswers.length).map(i => (
                                  <li key={i}>{i + 1}. "{tournamentAnswers[i]}"</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-semibold text-red-800 bg-red-50/90 p-2.5 rounded-lg border border-red-200">
                            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                            <span>⚠️ Не обрано жодної правильної відповіді!</span>
                          </div>
                        )
                      )}

                      {resolveTournamentQuestionType(questionType) === 'TRUE_FALSE' && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Правильна відповідь:</strong> {tournamentTrueFalseAnswer ? 'Правда (True)' : 'Неправда (False)'}
                          </span>
                        </div>
                      )}

                      {resolveTournamentQuestionType(questionType) === 'TEXT_INPUT' && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50/90 p-2.5 rounded-lg border border-emerald-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>
                            <strong>Прийнятні відповіді:</strong> {tournamentTextAnswers || '(не вказано)'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* DEDICATED ACTION BUTTONS BAR */}
                    <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-200/80 mt-2">
                      <button
                        type="button"
                        onClick={handlePrepareTournamentDraft}
                        className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>2. Підготувати для турніру</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePublishTournament}
                        disabled={isPublishingTournament || (!isMainQuestionSaved && !lastSavedSourcePath)}
                        className={`flex items-center gap-2 px-5 py-2.5 font-bold rounded-xl text-xs shadow-md transition cursor-pointer ${
                          isMainQuestionSaved || lastSavedSourcePath
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        }`}
                        title={!isMainQuestionSaved && !lastSavedSourcePath ? 'Спочатку збережіть основне питання' : 'Опублікувати в турнірну колекцію'}
                      >
                        {isPublishingTournament ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        <span>3. Опублікувати в турнірах</span>
                      </button>
                    </div>

                    {/* Tournament Publishing Status Overlay / Box */}
                    {(isPublishingTournament || tournamentPublishResult || tournamentPublishError) && (
                      <div className="mt-4 p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 flex flex-col gap-2.5 animate-fade-in text-xs font-medium">
                        {isPublishingTournament && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
                            <span>Публікація турнірного питання... (Calling publishTournamentQuestion)</span>
                          </div>
                        )}
                        
                        {tournamentPublishResult && (
                          <div className="bg-emerald-50 border border-emerald-250 text-emerald-800 p-3 rounded-xl flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 font-extrabold text-emerald-700">
                              <Check className="h-4 w-4" />
                              <span>Питання успішно опубліковано у турнірний пул!</span>
                            </div>
                            <div className="font-mono text-[11px] mt-1 space-y-1 bg-white/60 p-2.5 rounded-lg border border-emerald-100/50">
                              <div><span className="font-bold text-slate-500">ID питання:</span> {tournamentPublishResult.questionId}</div>
                              <div><span className="font-bold text-slate-500 text-xs truncate block">Хеш вмісту:</span> {tournamentPublishResult.contentHash}</div>
                              <div><span className="font-bold text-slate-500">Версія джерела:</span> {tournamentPublishResult.sourceVersion}</div>
                              <div><span className="font-bold text-slate-500">Версія схеми:</span> {tournamentPublishResult.schemaVersion}</div>
                            </div>
                          </div>
                        )}

                        {tournamentPublishError && (
                          <div className="bg-red-50 border border-red-200 text-red-850 p-3 rounded-xl flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 font-extrabold text-red-700">
                              <X className="h-4 w-4" />
                              <span>Помилка публікації в турнір</span>
                            </div>
                            <p className="text-xs text-red-600 bg-white/60 p-2.5 rounded-lg border border-red-100/50">{tournamentPublishError}</p>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

        </div>

        <LevelPublishPanel
          db={dbInstance}
          auth={authInstance}
          category={quizCategory}
          resolvedCategory={resolvedCategory}
          levelId={String(level)}
          lang={lang}
          disabled={isSaving || isPublishingTournament || isPublishingLevelBundle}
          onPublishingChange={setIsPublishingLevelBundle}
          triggerToast={triggerToast}
        />

        {/* Database execution transaction submit button */}
        <div className="sticky bottom-2 z-20 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-xl flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleResetFields}
            disabled={isSaving || isPublishingTournament || isPublishingLevelBundle}
            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-3.5 px-6 rounded-2xl transition shadow-xs text-sm cursor-pointer border border-slate-300 text-center flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Скинути чернетку (Reset Draft)
          </button>

          <button
            type="button"
            onClick={handleSaveToDatabase}
            disabled={isSaving || isPublishingTournament || isPublishingLevelBundle}
            className={`flex-1 font-extrabold py-3.5 px-6 rounded-2xl transition shadow-md flex items-center justify-center gap-2 text-sm ${
              (isSaving || isPublishingTournament || isPublishingLevelBundle)
                ? 'bg-amber-500/60 text-slate-900 cursor-not-allowed opacity-80'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-950 cursor-pointer animate-pulse-slow'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Запис у Firestore... (Committing Transaction...)
              </>
            ) : isPublishingTournament ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Публікація турніру... (Calling Cloud Function...)
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Записати у Firestore (Commit)
              </>
            )}
          </button>
        </div>

      </div>

      {/* RIGHT SIDEBAR PREVIEW & INTEGRATIVE SANDBOX GAME - 5 Rows spacing */}
      <div className="xl:col-span-5 flex flex-col gap-6">
        
        {/* Real-time Document Preview schema */}
        <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileCheck className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0">
                <h4 className="font-extrabold text-sm text-slate-100">Firestore Doc Schema Stream</h4>
                <p className="text-[10px] text-slate-400 font-mono break-all">path: /{quizCategory}/{level}/questions/{calculatedQuestionId}</p>
              </div>
            </div>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(questionData, null, 2));
                triggerToast('Copied JSON string to clipboard!');
              }}
              className="text-[9px] font-bold text-amber-400 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 hover:text-white transition flex items-center gap-1 shrink-0 self-start sm:self-auto"
            >
              Copy JSON
            </button>
          </div>

          <pre className="text-[10px] font-mono leading-relaxed max-h-[360px] overflow-auto select-all bg-black/40 p-3.5 rounded-xl border border-slate-800 text-amber-200 whitespace-pre-wrap break-all max-w-full">
            {JSON.stringify(questionData, null, 2)}
          </pre>
        </div>

        {/* Interactive Simulation Sandbox */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ToggleLeft className="h-5 w-5 text-amber-500" />
              <div>
                <h4 className="font-extrabold text-sm text-slate-800">Тестова пісочниця (Visual Sandbox)</h4>
                <p className="text-[11.5px] text-slate-400">Перевірка логіки відповіді клієнта до збереження в БД</p>
              </div>
            </div>
            <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
              Live play!
            </span>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3 min-h-[160px]">
            {/* Show interactive widget based on currently configured values */}
            <p className="text-[11.5px] font-bold text-slate-600 uppercase tracking-wide">
              {questionType !== 'READING_COMPREHENSION' ? questionText : 'Аналіз уривка тексту:'}
            </p>

            {/* SINGLE_CHOICE / TEN_FACTS Sandbox view */}
            {(questionType === 'SINGLE_CHOICE' || questionType === 'TEN_FACTS') && (
              <div className="flex flex-col gap-1.5">
                {questionType === 'TEN_FACTS' && (
                  <div className="bg-amber-50 text-[10.5px] p-2 rounded-lg text-slate-700 mb-2 font-mono">
                    <strong>Підказка фактів (Ten Facts):</strong>
                    <ul className="list-disc leading-relaxed pl-3.5 mt-1.5 flex flex-col gap-1">
                      {tenFacts.slice(0, 3).map((f, i) => (
                        <li key={i}>{f.value}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {options.slice(0, 6).map((opt, oIdx) => (
                  <label key={oIdx} className="flex items-center gap-2.5 p-2 bg-white hover:bg-slate-100 rounded-lg cursor-pointer text-xs border text-slate-700">
                    <input
                      type="radio"
                      name="sandboxSingle"
                      checked={sandboxAnswerObj === oIdx}
                      onChange={() => setSandboxAnswerObj(oIdx)}
                      className="accent-amber-500"
                    />
                    <span>{opt.value || `Опція ${oIdx + 1}`}</span>
                  </label>
                ))}
              </div>
            )}

            {/* MULTIPLE_CHOICE Sandbox view */}
            {questionType === 'MULTIPLE_CHOICE' && (
              <div className="flex flex-col gap-1.5">
                {options.slice(0, 6).map((opt, oIdx) => {
                  const arr: number[] = sandboxAnswerObj || [];
                  const checked = arr.includes(oIdx);
                  return (
                    <label key={oIdx} className="flex items-center gap-2.5 p-2 bg-white hover:bg-slate-100 rounded-lg cursor-pointer text-xs border text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          if (e.target.checked) {
                            setSandboxAnswerObj([...arr, oIdx]);
                          } else {
                            setSandboxAnswerObj(arr.filter(v => v !== oIdx));
                          }
                        }}
                        className="accent-amber-500"
                      />
                      <span>{opt.value || `Опція ${oIdx + 1}`}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* TRUE_FALSE Sandbox view */}
            {questionType === 'TRUE_FALSE' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setSandboxAnswerObj(true)}
                  className={`p-2.5 rounded-lg text-xs font-bold border ${sandboxAnswerObj === true ? 'bg-amber-100 border-amber-300' : 'bg-white'}`}
                >
                  Правда (True)
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxAnswerObj(false)}
                  className={`p-2.5 rounded-lg text-xs font-bold border ${sandboxAnswerObj === false ? 'bg-amber-100 border-amber-300' : 'bg-white'}`}
                >
                  Неправда (False)
                </button>
              </div>
            )}

            {/* TEXT_INPUT Sandbox view */}
            {questionType === 'TEXT_INPUT' && (
              <input
                type="text"
                placeholder="Введіть ваше текстове рішення тут..."
                value={sandboxAnswerObj || ''}
                onChange={e => setSandboxAnswerObj(e.target.value)}
                className="w-full bg-white border border-slate-250 p-2 text-xs rounded-xl font-mono text-center"
              />
            )}

            {/* FILL_IN_THE_BLANK Sandbox view */}
            {questionType === 'FILL_IN_THE_BLANK' && (
              <div className="flex flex-col gap-2 mt-1">
                <p className="text-xs italic bg-slate-100 p-2.5 rounded-lg text-slate-650 leading-relaxed">
                  {fillInParts.map((p, i) => p.type === 'text' ? p.value : ` [ ______ ] `).join('')}
                </p>
                <div className="flex flex-col gap-1.5 mt-1.5">
                  {fillInParts.filter(p => p.type === 'blank').map((p, bIdx) => {
                    const arr: string[] = sandboxAnswerObj || [];
                    const val = arr[bIdx] || '';
                    return (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">Пропуск #{bIdx + 1}:</span>
                        <input
                          type="text"
                          placeholder="Слово..."
                          value={val}
                          onChange={e => {
                            const updated = [...arr];
                            updated[bIdx] = e.target.value;
                            setSandboxAnswerObj(updated);
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SLIDER_SCALE Sandbox view */}
            {questionType === 'SLIDER_SCALE' && (
              <div className="flex flex-col gap-2.5 mt-1">
                {/* Badges/tags as separate graphic elements */}
                <div className="flex flex-wrap gap-x-2 gap-y-1.5 items-center text-[11px] text-slate-500 font-medium mb-1.5">
                  {respondentsCount && (
                    <span className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-lg shadow-sm">
                      <span>👥</span>
                      <span>{respondentsCount} опитаних</span>
                    </span>
                  )}
                  {respondentsCount && countriesCount && <span className="text-slate-300 font-bold">•</span>}
                  {countriesCount && (
                    <span className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-lg shadow-sm">
                      <span>🌍</span>
                      <span>{countriesCount} країн</span>
                    </span>
                  )}
                  {countriesCount && surveyPeriod && <span className="text-slate-300 font-bold">•</span>}
                  {surveyPeriod && (
                    <span className="flex items-center gap-1 bg-slate-100 border border-slate-200/60 px-2 py-0.5 rounded-lg shadow-sm">
                      <span>📅</span>
                      <span>{surveyPeriod}</span>
                    </span>
                  )}
                  {surveyPeriod && researchCenter && <span className="text-slate-300 font-bold">•</span>}
                  {researchCenter && (
                    <span className="flex items-center gap-1 bg-amber-50/55 border border-amber-100/70 px-2 py-0.5 rounded-lg text-amber-800 font-medium shadow-sm">
                      <span>🏛️</span>
                      <span>{researchCenter}</span>
                    </span>
                  )}
                </div>
                {sliders.map((s, idx) => {
                  const arr: number[] = sandboxAnswerObj || [];
                  const val = arr[idx] || 0;
                  return (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10.5px] font-bold text-slate-600">{s.question}</span>
                      <div className="flex gap-2 items-center">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={val}
                          onChange={e => {
                            const updated = [...arr];
                            updated[idx] = parseInt(e.target.value, 10);
                            setSandboxAnswerObj(updated);
                          }}
                          className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-205"
                        />
                        <span className="text-xs font-mono font-bold text-amber-500 w-10 text-right">{val}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PAIRWISE_DISTINCTION Sandbox view */}
            {questionType === 'PAIRWISE_DISTINCTION' && (
              <div className="flex flex-col gap-4 mt-1">
                {/* Visual Header of Both Objects */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {pairwiseObjects.map((obj, idx) => (
                    <div key={obj.id || idx} className="flex items-center gap-2.5">
                      {obj.imagePath && (
                        <div className="w-10 h-10 rounded-lg bg-slate-200 overflow-hidden shrink-0 border border-slate-300 flex items-center justify-center">
                          <img 
                            src={obj.imagePath} 
                            alt={obj.altText || obj.name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="text-[10px] font-extrabold uppercase text-amber-600">Об'єкт #{idx + 1}</span>
                        <span className="text-xs font-bold text-slate-800">{obj.name || obj.id}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Statements Categorization */}
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                    Розподіліть кожну ознаку за відповідним об'єктом:
                  </span>

                  {pairwiseStatements.map((st, idx) => {
                    const userAnswers: Record<string, string> = sandboxAnswerObj || {};
                    const selectedObjId = userAnswers[st.id] || '';

                    return (
                      <div key={st.id || idx} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col gap-2">
                        <span className="text-xs font-medium text-slate-800">
                          {idx + 1}. {st.text || <em className="text-slate-400">Порожнє твердження</em>}
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {pairwiseObjects.map(obj => {
                            const isSelected = selectedObjId === obj.id;
                            return (
                              <button
                                key={obj.id}
                                type="button"
                                onClick={() => {
                                  setSandboxAnswerObj({
                                    ...userAnswers,
                                    [st.id]: obj.id
                                  });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center justify-between ${
                                  isSelected 
                                    ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-2xs font-extrabold' 
                                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span>{obj.name || obj.id}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other types placeholders */}
            {!['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT_INPUT', 'FILL_IN_THE_BLANK', 'SLIDER_SCALE', 'TEN_FACTS', 'PAIRWISE_DISTINCTION'].includes(questionType) && (
              <p className="text-[11px] text-slate-400 font-mono italic">
                (Для типу {questionType} логіка валідації по моделі структури визначена клієнтом нативно. Протестуйте у нативному Firestore провіднику після експорту)
              </p>
            )}

            <button
              type="button"
              onClick={handleTestSandbox}
              className="mt-4 bg-slate-900 border border-slate-800 text-amber-400 hover:text-white hover:bg-black font-extrabold text-xs py-2 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Перевірити Відповідь
            </button>
          </div>

          {/* Sandbox evaluation report result */}
          {sandboxResponseFeedback && (
            <div className={`p-3.5 rounded-xl border text-xs leading-relaxed flex gap-2 items-start ${
              sandboxPassed
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-bold'
                : 'bg-rose-50 border-rose-200 text-rose-950'
            }`}>
              <span className="text-lg leading-none select-none">{sandboxPassed ? '✅' : '❌'}</span>
              <div>
                <p className="font-extrabold">{sandboxPassed ? 'Відповідь Правильна!' : 'Помилкова відповідь'}</p>
                <p className="text-[11px] text-slate-650 font-medium mt-1">{sandboxResponseFeedback}</p>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
    </div>
  );
}
