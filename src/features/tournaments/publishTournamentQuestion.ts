import { Auth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import type { TournamentQuestionType } from '../../services/tournamentQuestionAdapter';

export interface TournamentQuestionPayload {
  language: string;
  categoryId: string;
  type: TournamentQuestionType;
  question: string;
  difficulty: number;
  status: string;
  seasonId: string | null;
  topicLabel: string | null;
  explanation: string | null;
  sourcePath: string;
  sourceVersion: number;
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

  const callable = httpsCallable<TournamentQuestionPayload, TournamentPublishResult>(
    getFunctions(auth.app),
    'publishTournamentQuestion'
  );
  const response = await callable(payload);
  return response.data;
}
