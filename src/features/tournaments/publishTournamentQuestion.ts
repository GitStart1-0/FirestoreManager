import { Auth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  TOURNAMENT_MAX_OPTION_LENGTH,
  type TournamentQuestionType
} from '../../services/tournamentQuestionAdapter';

export interface TournamentQuestionPayload {
  language: string;
  categoryId: string;
  type: TournamentQuestionType;
  question: string;
  difficulty: number;
  status: string;
  seasonId: string | null;
  topicLabel: string | null;
  sourcePath: string;
  sourceVersion: number;
  minimumAge?: number;
  contentWarnings?: string[];
  answers?: string[];
  correctAnswerIndices?: number[];
  correctAnswer?: boolean;
  correctAnswers?: string[];
}

export interface TournamentPublishResult {
  questionId: string;
  contentHash: string;
  sourceVersion: number;
  schemaVersion: number;
}

/**
 * Tournament content is privileged data. It must always pass through the
 * server validator; direct Firestore fallback would bypass validation and
 * produce documents that the tournament runtime may not understand.
 */
export async function publishTournamentQuestion(
  auth: Auth,
  payload: TournamentQuestionPayload
): Promise<TournamentPublishResult> {
  if (!auth.currentUser) {
    throw new Error('Увійдіть у дозволений обліковий запис конструктора.');
  }

  if ((payload.minimumAge ?? 16) >= 18 || (payload.contentWarnings?.length ?? 0) > 0) {
    throw new Error(
      'Матеріали 18+ або з попередженнями не публікуються в спільному турнірному пулі.'
    );
  }

  if (payload.type === 'SINGLE_CHOICE' || payload.type === 'MULTIPLE_CHOICE') {
    const answers = payload.answers ?? [];
    if (answers.length < 2 || answers.length > 6) {
      throw new Error('Турнірне питання повинно містити від 2 до 6 варіантів відповіді.');
    }
    const oversizedIndex = answers.findIndex(answer => answer.length > TOURNAMENT_MAX_OPTION_LENGTH);
    if (oversizedIndex >= 0) {
      throw new Error(
        `Варіант ${oversizedIndex + 1} перевищує ліміт ${TOURNAMENT_MAX_OPTION_LENGTH} символів.`
      );
    }
  }

  const callable = httpsCallable<TournamentQuestionPayload, TournamentPublishResult>(
    getFunctions(auth.app),
    'publishTournamentQuestion'
  );
  const response = await callable(payload);
  return response.data;
}
