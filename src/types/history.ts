export type DifficultyLevel = '쉬움' | '보통' | '어려움';

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  token: string;
  userId: string;
  email: string;
  name: string;
}

export interface HistoryItem {
  historyId: string;
  problemId: string;
  subjectType: string;
  subCategory: string;
  isCorrect: boolean;
  userDifficulty: string;
  reviewNotes: string | null;
  solvedAt: string;
  content: string | null;
  choices: string[] | null;
  correctAnswer: number | null;
  explanation: string | null;
}

export interface HistoryUpdateRequest {
  problemId: string;
  subjectType?: string;
  subCategory?: string;
  userDifficulty: string;
  reviewNotes: string;
}

export interface HistoryBulkUpdateRequest {
  updates: HistoryUpdateRequest[];
}