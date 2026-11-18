// src/types/api.ts 또는 src/types/exam.ts

// ==========================================
// 1. AI DTO (문제 생성)
// ==========================================
export interface AiGenerateRequest {
  subjectType: string;         // 예: "물류관리론"
  subCategories: string[];     // 예: ["물류총론", "보관하역론", "물류정보"]
  count: number;               // 기본값 5
}

// ==========================================
// 2. Auth DTO (인증/회원가입)
// ==========================================
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
}

// ==========================================
// 3. Problem DTO (문제 조회)
// ==========================================
// 프론트엔드 반환용 (정답/해설 제외됨)
export interface QuestionResponse {
  id: string;                  // 문제 ID
  domainId: string;
  content: string;             // 문제 내용
  choices: string[];           // 4지선다 보기 배열
}

// ==========================================
// 4. Score DTO (단건 문제 채점)
// ==========================================
// 클라이언트 -> 서버: 채점 요청
export interface ScoreSubmitRequest {
  problemId: string;
  userAnswer: number;          // 1 ~ 4
}

// 서버 -> 클라이언트: 채점 결과
export interface ScoreSubmitResponse {
  isCorrect: boolean;          // 정답 여부
  correctAnswer: number;       // 실제 정답 번호 (1~4)
  explanation: string;         // AI 해설
}

// ==========================================
// 5. History DTO (오답노트 및 학습 기록)
// ==========================================
// 단건 업데이트 요청
export interface HistoryUpdateRequest {
  problemId: string;
  subjectType: string;
  subCategory: string;
  userDifficulty: string;
  reviewNotes: string;
}

// 다건 덮어쓰기 요청
export interface HistoryBulkUpdateRequest {
  updates: HistoryUpdateRequest[];
}

// 오답/학습 기록 조회 응답
export interface HistoryResponse {
  problemId: string;
  subjectType: string;
  subCategory: string;
  isCorrect: boolean;
  userDifficulty: string;
  reviewNotes: string;
  solvedAt: string;            // LocalDateTime은 보통 ISO 스트링(YYYY-MM-DDTHH:mm:ss)으로 넘어옴
}

// ==========================================
// 6. Attendance DTO (출석)
// ==========================================
export interface AttendanceResponse {
  lastAttendanceDate: string;
  consecutiveAttendanceDays: number;
}