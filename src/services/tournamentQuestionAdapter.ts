export const TOURNAMENT_NATIVE_QUESTION_TYPES = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'TEXT_INPUT'
] as const;

export type TournamentQuestionType = typeof TOURNAMENT_NATIVE_QUESTION_TYPES[number];

export function isNativeTournamentQuestionType(
  questionType: string
): questionType is TournamentQuestionType {
  return TOURNAMENT_NATIVE_QUESTION_TYPES.includes(questionType as TournamentQuestionType);
}

/**
 * Complex question mechanics are preserved in the main collection. Tournament
 * mirrors use a short, independently authored single-choice representation.
 */
export function resolveTournamentQuestionType(questionType: string): TournamentQuestionType {
  return isNativeTournamentQuestionType(questionType) ? questionType : 'SINGLE_CHOICE';
}

/**
 * Truncates main options to maximum 4 choices for tournament SINGLE_CHOICE,
 * strictly including the correct answer and stripping extra options.
 */
export function adaptMainToTournamentSingleChoice(
  rawOptions: Array<any>,
  correctIndex?: number
): { answers: string[]; correctAnswerIndices: number[] } {
  if (!Array.isArray(rawOptions)) {
    return {
      answers: ['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D'],
      correctAnswerIndices: [0]
    };
  }

  // Filter out empty options while keeping track of original index and correctness
  const items = rawOptions
    .map((opt, origIdx) => {
      let strVal = '';
      let isCorr = false;
      if (typeof opt === 'string') {
        strVal = opt.trim();
        isCorr = origIdx === correctIndex;
      } else if (typeof opt === 'number') {
        strVal = String(opt);
        isCorr = origIdx === correctIndex;
      } else if (typeof opt === 'object' && opt !== null) {
        strVal = (opt.value || opt.text || opt.answer || String(opt)).trim();
        isCorr = Boolean(opt.isCorrect || origIdx === correctIndex);
      }
      return {
        value: strVal,
        isCorrect: isCorr,
        origIdx
      };
    })
    .filter(item => item.value.length > 0);

  if (items.length === 0) {
    return {
      answers: ['Варіант A', 'Варіант B', 'Варіант C', 'Варіант D'],
      correctAnswerIndices: [0]
    };
  }

  // Find correct item
  let correctItem = items.find(item => item.isCorrect);
  if (!correctItem && typeof correctIndex === 'number' && correctIndex >= 0 && correctIndex < items.length) {
    correctItem = items[correctIndex];
  }
  if (!correctItem) {
    correctItem = items[0];
  }

  // Collect incorrect items
  const incorrectItems = items.filter(item => item !== correctItem);

  // Pick up to 3 incorrect items to form max 4 items total (stripping extra options)
  const selectedIncorrect = incorrectItems.slice(0, 3);

  // Re-assemble list while preserving original relative order
  const combined = items.filter(item => item === correctItem || selectedIncorrect.includes(item));

  const finalAnswers = combined.map(item => item.value);
  const finalCorrectIdx = combined.indexOf(correctItem);

  return {
    answers: finalAnswers,
    correctAnswerIndices: finalCorrectIdx !== -1 ? [finalCorrectIdx] : [0]
  };
}

/**
 * Strict index validation:
 * - Every index must be 0 <= index < answers.length
 * - For SINGLE_CHOICE, exactly 1 index is required.
 */
export function validateTournamentIndices(
  type: TournamentQuestionType,
  answersCount: number,
  indices: number[]
): { valid: boolean; error?: string } {
  if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
    if (answersCount < 2 || answersCount > 6) {
      return { valid: false, error: 'Турнірне питання має містити від 2 до 6 варіантів відповідей' };
    }

    if (!Array.isArray(indices) || indices.length === 0) {
      return { valid: false, error: 'Вкажіть правильну відповідь для турніру!' };
    }

    // Check bounds for every index
    const outOfBounds = indices.some(idx => idx < 0 || idx >= answersCount);
    if (outOfBounds) {
      return { valid: false, error: 'Один або кілька індексів правильної відповіді виходять за межі варіантів!' };
    }

    if (type === 'SINGLE_CHOICE') {
      if (indices.length !== 1) {
        return { valid: false, error: 'Турнірне питання з одиночним вибором повинно мати рівно одну правильну відповідь!' };
      }
    } else {
      // MULTIPLE_CHOICE
      const unique = new Set(indices);
      if (unique.size !== indices.length) {
        return { valid: false, error: 'Індекси правильних відповідей для турніру не повинні дублюватися!' };
      }
    }
  }

  return { valid: true };
}

/**
 * Filters out out-of-bound indices when options list changes.
 */
export function sanitizeTournamentIndices(answersCount: number, indices: number[]): number[] {
  return indices.filter(idx => idx >= 0 && idx < answersCount);
}

