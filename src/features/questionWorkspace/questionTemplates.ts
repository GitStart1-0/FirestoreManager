export const QUESTION_TEMPLATES = [
  {
    id: 'single_choice',
    nameUk: 'Одиночний вибір (Single Choice)',
    nameEn: 'Single Choice',
    descriptionUk: 'Одне правильне запитання з кількох варіантів відповідей.',
    descriptionEn: 'Exactly one correct answer option.',
    fields: [
      { key: 'type', value: 'single_choice', type: 'string' },
      { key: 'question', value: 'Яка планета найближча до Сонця?', type: 'string' },
      { key: 'options', value: '["Меркурій", "Венера", "Земля", "Марс"]', type: 'array' },
      { key: 'correctAnswerIndex', value: '0', type: 'number' },
      { key: 'points', value: '10', type: 'number' },
      { key: 'category', value: 'Астрономія', type: 'string' }
    ]
  },
  {
    id: 'multiple_choice',
    nameUk: 'Множинний вибір (Multiple Choice)',
    nameEn: 'Multiple Choice',
    descriptionUk: 'Кілька правильних варіантів відповідей.',
    descriptionEn: 'Multiple correct answer options from a list.',
    fields: [
      { key: 'type', value: 'multiple_choice', type: 'string' },
      { key: 'question', value: 'Оберіть міста України:', type: 'string' },
      { key: 'options', value: '["Київ", "Париж", "Львів", "Берлін"]', type: 'array' },
      { key: 'correctAnswerIndices', value: '[0, 2]', type: 'array' },
      { key: 'points', value: '20', type: 'number' },
      { key: 'category', value: 'Географія', type: 'string' }
    ]
  },
  {
    id: 'true_false',
    nameUk: 'Правда / Неправда (True / False)',
    nameEn: 'True / False',
    descriptionUk: 'Питання з альтернативною відповіддю: правда чи ні.',
    descriptionEn: 'Binary choice: Statement is either true or false.',
    fields: [
      { key: 'type', value: 'true_false', type: 'string' },
      { key: 'question', value: 'Земля обертається навколо своєї осі?', type: 'string' },
      { key: 'correctBool', value: 'true', type: 'boolean' },
      { key: 'points', value: '10', type: 'number' },
      { key: 'explanation', value: 'Земля робить повний оберт приблизно за 24 години.', type: 'string' }
    ]
  },
  {
    id: 'open_text',
    nameUk: 'Вписати відповідь (Open Text)',
    nameEn: 'Open Text',
    descriptionUk: 'Користувач має вписати текстову відповідь.',
    descriptionEn: 'User must type a matching text value.',
    fields: [
      { key: 'type', value: 'open_text', type: 'string' },
      { key: 'question', value: 'Хто написав «Кобзар»?', type: 'string' },
      { key: 'acceptedAnswers', value: '["Тарас Шевченко", "Шевченко", "Т. Г. Шевченко"]', type: 'array' },
      { key: 'caseSensitive', value: 'false', type: 'boolean' },
      { key: 'points', value: '15', type: 'number' }
    ]
  },
  {
    id: 'matching',
    nameUk: 'Встановлення відповідності (Matching)',
    nameEn: 'Matching',
    descriptionUk: 'З\'єднати пов\'язані елементи лівої та правої сторінки.',
    descriptionEn: 'Match related rows between left and right groups.',
    fields: [
      { key: 'type', value: 'matching', type: 'string' },
      { key: 'question', value: 'З\'єднайте письменників з їхніми творами:', type: 'string' },
      { key: 'leftSides', value: '["Шевченко", "Франко", "Леся Українка"]', type: 'array' },
      { key: 'rightSides', value: '["Кобзар", "Захар Беркут", "Лісова пісня"]', type: 'array' },
      { key: 'pairs', value: '{"Шевченко":"Кобзар", "Франко":"Захар Беркут", "Леся Українка":"Лісова пісня"}', type: 'object' },
      { key: 'points', value: '20', type: 'number' }
    ]
  },
  {
    id: 'sorting',
    nameUk: 'Впорядкування / Хронологія (Sorting)',
    nameEn: 'Sorting',
    descriptionUk: 'Розставити елементи у правильному хронологічному чи логічному порядку.',
    descriptionEn: 'Reorganize list items into correct order sequence.',
    fields: [
      { key: 'type', value: 'sorting', type: 'string' },
      { key: 'question', value: 'Розставте історичні події у правильному порядку за часом:', type: 'string' },
      { key: 'items', value: '["Хрещення Русі", "Заснування Києва", "Проголошення Незалежності"]', type: 'array' },
      { key: 'correctSequence', value: '["Заснування Києва", "Хрещення Русі", "Проголошення Незалежності"]', type: 'array' },
      { key: 'points', value: '15', type: 'number' }
    ]
  },
  {
    id: 'find_odd',
    nameUk: 'Виключення / Зайвий елемент (Find Odd)',
    nameEn: 'Find Odd',
    descriptionUk: 'Знайдіть зайвий елемент, який не підходить під тему.',
    descriptionEn: 'Spot a discordant item out of context.',
    fields: [
      { key: 'type', value: 'find_odd', type: 'string' },
      { key: 'question', value: 'Знайдіть зайве слово серед поданих:', type: 'string' },
      { key: 'options', value: '["Яблуко", "Огірок", "Груша", "Абрикос"]', type: 'array' },
      { key: 'correctAnswer', value: 'Огірок', type: 'string' },
      { key: 'explanation', value: 'Огірок це овоч, інші - це фрукти.', type: 'string' },
      { key: 'points', value: '10', type: 'number' }
    ]
  },
  {
    id: 'cloze',
    nameUk: 'Текст із пропусками (Fill in Blanks)',
    nameEn: 'Fill in Blanks',
    descriptionUk: 'Заповнити пропущені слова або фрази всередині цитати.',
    descriptionEn: 'Insert the correct strings into placeholders.',
    fields: [
      { key: 'type', value: 'cloze', type: 'string' },
      { key: 'question', value: 'Реве та стогне [blank1] широкий, сердитий [blank2] завива.', type: 'string' },
      { key: 'correctBlanks', value: '{"blank1":"Дніпр", "blank2":"вітер"}', type: 'object' },
      { key: 'points', value: '15', type: 'number' }
    ]
  },
  {
    id: 'numeric',
    nameUk: 'Числова відповідь (Numeric)',
    nameEn: 'Numeric',
    descriptionUk: 'Математична чи кількісна відповідь у вигляді точного числа.',
    descriptionEn: 'A specific numerical score or input calculation.',
    fields: [
      { key: 'type', value: 'numeric', type: 'string' },
      { key: 'question', value: 'Скільки планет у Сонячній системі (після виключення Плутона)?', type: 'string' },
      { key: 'correctNumber', value: '8', type: 'number' },
      { key: 'tolerance', value: '0', type: 'number' },
      { key: 'points', value: '10', type: 'number' }
    ]
  },
  {
    id: 'audio_question',
    nameUk: 'Аудіопитання (Audio Quiz)',
    nameEn: 'Audio Quiz',
    descriptionUk: 'Завдання, засновано на звуковому треці чи мелодії.',
    descriptionEn: 'Soundtrack based multiple selection quiz.',
    fields: [
      { key: 'type', value: 'audio_question', type: 'string' },
      { key: 'question', value: 'Який птах співає у цьому фрагменті?', type: 'string' },
      { key: 'mediaUrl', value: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', type: 'string' },
      { key: 'options', value: '["Соловей", "Жайворонок", "Синиця"]', type: 'array' },
      { key: 'correctOptionIndex', value: '0', type: 'number' },
      { key: 'points', value: '15', type: 'number' }
    ]
  },
  {
    id: 'image_choice',
    nameUk: 'Клик на малюнку / Гаряча область (Hotspot)',
    nameEn: 'Hotspot Image',
    descriptionUk: 'Вказати правильну зону/координати на малюнку.',
    descriptionEn: 'Pinpoint precise zone pixels over a background graphic.',
    fields: [
      { key: 'type', value: 'image_choice', type: 'string' },
      { key: 'question', value: 'Оберіть серце на цій схемі:', type: 'string' },
      { key: 'imageUrl', value: 'https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?w=500', type: 'string' },
      { key: 'hotspots', value: '[{"id":"heart", "x":50, "y":30, "radius":15}]', type: 'array' },
      { key: 'correctHotspotId', value: 'heart', type: 'string' },
      { key: 'points', value: '20', type: 'number' }
    ]
  },
  {
    id: 'matrix',
    nameUk: 'Матриця відповідностей (Matrix Table)',
    nameEn: 'Matrix Table',
    descriptionUk: 'Порівняти рядки та стовпці у великій таблиці.',
    descriptionEn: 'Comprehensive row-columns state classification matrix.',
    fields: [
      { key: 'type', value: 'matrix', type: 'string' },
      { key: 'question', value: 'Класифікуйте хімічні речовини за агрегатним станом:', type: 'string' },
      { key: 'rows', value: '["Азот", "Залізо", "Ртуть"]', type: 'array' },
      { key: 'columns', value: '["Твердий", "Рідкий", "Газоподібний"]', type: 'array' },
      { key: 'answers', value: '{"Азот":"Газоподібний", "Залізо":"Твердий", "Ртуть":"Рідкий"}', type: 'object' },
      { key: 'points', value: '25', type: 'number' }
    ]
  }
];

export function getQuestionTypeColors(id: string) {
  switch (id) {
    case 'single_choice':
      return {
        badge: 'bg-blue-50 text-blue-700 border-blue-250',
        border: 'border-blue-500',
        bg: 'bg-blue-50/50',
        badgeColor: 'text-blue-700 bg-blue-50 border-blue-200',
        hover: 'hover:bg-blue-50/60 hover:border-blue-400',
        ring: 'ring-blue-500/20',
        text: 'text-blue-950',
        subtext: 'text-blue-800'
      };
    case 'multiple_choice':
      return {
        badge: 'bg-violet-50 text-violet-700 border-violet-250',
        border: 'border-violet-500',
        bg: 'bg-violet-50/50',
        badgeColor: 'text-violet-700 bg-violet-50 border-violet-200',
        hover: 'hover:bg-violet-50/60 hover:border-violet-400',
        ring: 'ring-violet-500/20',
        text: 'text-violet-950',
        subtext: 'text-violet-800'
      };
    case 'true_false':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-250',
        border: 'border-emerald-500',
        bg: 'bg-emerald-50/50',
        badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        hover: 'hover:bg-emerald-50/60 hover:border-emerald-400',
        ring: 'ring-emerald-500/20',
        text: 'text-emerald-950',
        subtext: 'text-emerald-800'
      };
    case 'open_text':
      return {
        badge: 'bg-teal-50 text-teal-700 border-teal-250',
        border: 'border-teal-500',
        bg: 'bg-teal-50/50',
        badgeColor: 'text-teal-700 bg-teal-50 border-teal-200',
        hover: 'hover:bg-teal-50/60 hover:border-teal-400',
        ring: 'ring-teal-500/20',
        text: 'text-teal-950',
        subtext: 'text-teal-800'
      };
    case 'matching':
      return {
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-250',
        border: 'border-indigo-500',
        bg: 'bg-indigo-50/50',
        badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        hover: 'hover:bg-indigo-50/60 hover:border-indigo-400',
        ring: 'ring-indigo-500/20',
        text: 'text-indigo-950',
        subtext: 'text-indigo-800'
      };
    case 'sorting':
      return {
        badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-250',
        border: 'border-fuchsia-500',
        bg: 'bg-fuchsia-50/50',
        badgeColor: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
        hover: 'hover:bg-fuchsia-50/60 hover:border-fuchsia-400',
        ring: 'ring-fuchsia-500/20',
        text: 'text-fuchsia-950',
        subtext: 'text-fuchsia-800'
      };
    case 'find_odd':
      return {
        badge: 'bg-pink-50 text-pink-700 border-pink-250',
        border: 'border-pink-500',
        bg: 'bg-pink-50/50',
        badgeColor: 'text-pink-700 bg-pink-50 border-pink-200',
        hover: 'hover:bg-pink-50/60 hover:border-pink-400',
        ring: 'ring-pink-500/20',
        text: 'text-pink-950',
        subtext: 'text-pink-800'
      };
    case 'cloze':
      return {
        badge: 'bg-sky-50 text-sky-700 border-sky-250',
        border: 'border-sky-500',
        bg: 'bg-sky-50/50',
        badgeColor: 'text-sky-700 bg-sky-50 border-sky-200',
        hover: 'hover:bg-sky-50/60 hover:border-sky-400',
        ring: 'ring-sky-500/20',
        text: 'text-sky-950',
        subtext: 'text-sky-800'
      };
    case 'numeric':
      return {
        badge: 'bg-cyan-50 text-cyan-700 border-cyan-250',
        border: 'border-cyan-500',
        bg: 'bg-cyan-50/50',
        badgeColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
        hover: 'hover:bg-cyan-50/60 hover:border-cyan-400',
        ring: 'ring-cyan-500/10',
        text: 'text-cyan-950',
        subtext: 'text-cyan-800'
      };
    case 'audio_question':
      return {
        badge: 'bg-rose-50 text-rose-700 border-rose-250',
        border: 'border-rose-500',
        bg: 'bg-rose-50/50',
        badgeColor: 'text-rose-700 bg-rose-50 border-rose-200',
        hover: 'hover:bg-rose-50/60 hover:border-rose-400',
        ring: 'ring-rose-500/20',
        text: 'text-rose-950',
        subtext: 'text-rose-800'
      };
    case 'image_choice':
      return {
        badge: 'bg-lime-50 text-lime-700 border-lime-250',
        border: 'border-lime-500',
        bg: 'bg-lime-50/50',
        badgeColor: 'text-lime-700 bg-lime-50 border-lime-200',
        hover: 'hover:bg-lime-50/60 hover:border-lime-400',
        ring: 'ring-lime-500/20',
        text: 'text-lime-950',
        subtext: 'text-lime-800'
      };
    case 'matrix':
      return {
        badge: 'bg-orange-50 text-orange-700 border-orange-250',
        border: 'border-orange-500',
        bg: 'bg-orange-50/50',
        badgeColor: 'text-orange-700 bg-orange-50 border-orange-200',
        hover: 'hover:bg-orange-50/60 hover:border-orange-400',
        ring: 'ring-orange-500/20',
        text: 'text-orange-950',
        subtext: 'text-orange-850'
      };
    default:
      return {
        badge: 'bg-amber-50 text-amber-700 border-amber-250',
        border: 'border-amber-500',
        bg: 'bg-amber-50/50',
        badgeColor: 'text-amber-700 bg-amber-50 border-amber-200',
        hover: 'hover:bg-amber-50/60 hover:border-amber-400',
        ring: 'ring-amber-500/20',
        text: 'text-amber-950',
        subtext: 'text-amber-805'
      };
  }
}

// Helper to extract nested questions map from a Firestore Level document data
export function getNestedQuestions(docData: any) {
  const result: { lang: string; fieldName: string; questions: { id: string; data: any }[] }[] = [];
  if (!docData) return result;
  
  Object.entries(docData).forEach(([key, val]) => {
    if (key.startsWith('questions') && val && typeof val === 'object' && !Array.isArray(val)) {
      const qList = Object.entries(val).map(([qId, qData]) => {
        return {
          id: qId,
          data: qData as any
        };
      });
      
      qList.sort((a, b) => {
        const aParts = a.id.split('--');
        const bParts = b.id.split('--');
        const aNum = parseInt(aParts[1], 10) || 1;
        const bNum = parseInt(bParts[1], 10) || 1;
        return aNum - bNum;
      });
      
      let lang = 'ua';
      if (key.includes('_')) {
        lang = key.split('_')[1];
      } else if (key === 'questions') {
        const firstQData: any = qList[0]?.data;
        if (firstQData?.lang) {
          lang = firstQData.lang;
        } else {
          const firstIdParts = qList[0]?.id?.split('--');
          if (firstIdParts && firstIdParts[0] && ['ua', 'en', 'de', 'es', 'fr'].includes(firstIdParts[0])) {
            lang = firstIdParts[0];
          }
        }
      }
      
      result.push({
        lang,
        fieldName: key,
        questions: qList
      });
    }
  });
  
  return result;
}

// Helper function to detect the question template based on either explicit 'type' field or keys heuristic
export function detectQuestionTemplate(fields: { key: string; value?: string; type?: string }[] | Record<string, any>) {
  if (!fields) return null;

  // Normalize fields into a list of keys and explicit type value
  let keys: string[] = [];
  let explicitType: string | null = null;

  if (Array.isArray(fields)) {
    keys = fields.map(f => f.key);
    const typeField = fields.find(f => f.key === 'type');
    if (typeField && typeField.value) {
      explicitType = typeField.value.trim().toLowerCase();
    }
  } else {
    keys = Object.keys(fields);
    if (fields.type) {
      explicitType = String(fields.type).trim().toLowerCase();
    }
  }

  // 1. Explicit match
  if (explicitType) {
    const matched = QUESTION_TEMPLATES.find(t => t.id === explicitType);
    if (matched) return matched;
  }

  // 2. Heuristics fallback
  if (keys.includes('rows') && keys.includes('columns')) return QUESTION_TEMPLATES.find(t => t.id === 'matrix') || null;
  if (keys.includes('imageUrl') && keys.includes('hotspots')) return QUESTION_TEMPLATES.find(t => t.id === 'image_choice') || null;
  if (keys.includes('mediaUrl')) return QUESTION_TEMPLATES.find(t => t.id === 'audio_question') || null;
  if (keys.includes('correctBlanks')) return QUESTION_TEMPLATES.find(t => t.id === 'cloze') || null;
  if (keys.includes('leftSides') && keys.includes('rightSides')) return QUESTION_TEMPLATES.find(t => t.id === 'matching') || null;
  if (keys.includes('correctSequence') || keys.includes('items')) return QUESTION_TEMPLATES.find(t => t.id === 'sorting') || null;
  if (keys.includes('correctAnswer') && keys.includes('options')) return QUESTION_TEMPLATES.find(t => t.id === 'find_odd') || null;
  if (keys.includes('correctNumber')) return QUESTION_TEMPLATES.find(t => t.id === 'numeric') || null;
  if (keys.includes('acceptedAnswers')) return QUESTION_TEMPLATES.find(t => t.id === 'open_text') || null;
  if (keys.includes('correctBool')) return QUESTION_TEMPLATES.find(t => t.id === 'true_false') || null;
  if (keys.includes('correctAnswerIndices')) return QUESTION_TEMPLATES.find(t => t.id === 'multiple_choice') || null;
  if (keys.includes('correctAnswerIndex') || keys.includes('options')) return QUESTION_TEMPLATES.find(t => t.id === 'single_choice') || null;

  return null;
}



// Reusable Questions Layout and interactive testing sandbox component
