import axios from 'axios';
import type {
  HistoryBulkUpdateRequest,
  HistoryItem,
  HistoryUpdateRequest,
  LoginRequest,
  SignupRequest,
  TokenResponse,
} from '../types/history';
import { getAuthUser } from '../utils/authStorage';

export const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const user = getAuthUser();
  if (user) {
    if (!config.headers.get('User-Id')) {
      config.headers.set('User-Id', user.userId);
    }
    if (!config.headers.get('Authorization')) {
      config.headers.set('Authorization', `Bearer ${user.token}`);
    }
  }
  return config;
});

export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === 'string' && data.trim().length > 0) {
      return data;
    }
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim().length > 0) {
        return msg;
      }
    }
    if (!err.response) {
      return '서버와 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.';
    }
  }
  return fallback;
}

// --- 인증 API (Server B: /api/v1/auth/*) ---

export async function signupApi(payload: SignupRequest): Promise<string> {
  const { data } = await apiClient.post<string>('/api/v1/auth/signup', payload);
  return data;
}

export async function loginApi(payload: LoginRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/login', payload);
  return data;
}

// --- 오답노트 API (Server B: /api/v1/history/*) ---

export async function getHistoriesApi(params: {
  onlyWrong: boolean;
  subjectType?: string;
  subCategory?: string;
}): Promise<HistoryItem[]> {
  const query: Record<string, string | boolean> = {
    onlyWrong: params.onlyWrong,
  };
  if (params.subjectType) query.subjectType = params.subjectType;
  if (params.subCategory) query.subCategory = params.subCategory;

  const { data } = await apiClient.get<HistoryItem[]>('/api/v1/history', { params: query });
  return data;
}

export async function updateHistoryApi(payload: HistoryUpdateRequest): Promise<HistoryItem> {
  const { data } = await apiClient.put<HistoryItem>('/api/v1/history', payload);
  return data;
}

export async function bulkUpdateHistoriesApi(
  payload: HistoryBulkUpdateRequest,
): Promise<HistoryItem[]> {
  const { data } = await apiClient.put<HistoryItem[]>('/api/v1/history/bulk', payload);
  return data;
}