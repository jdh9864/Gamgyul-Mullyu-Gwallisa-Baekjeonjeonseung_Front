// src/pages/ExamPage.tsx
import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export interface QuestionResponse {
  id: string;
  domainId: string;
  content: string;
  choices: string[];
}

export interface ScoreSubmitResponse {
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string;
}

export interface DomainItem {
  majorCategory: string;
  domainName: string;
}

export const DOMAIN_LIST: DomainItem[] = [
  // 프론트엔드
  { majorCategory: '프론트엔드', domainName: 'DOM과 가상 DOM (Virtual DOM)' },
  { majorCategory: '프론트엔드', domainName: 'CSR과 SSR (렌더링 방식)' },
  { majorCategory: '프론트엔드', domainName: '웹 성능 최적화' },
  { majorCategory: '프론트엔드', domainName: '상태 관리 (State Management)' },
  { majorCategory: '프론트엔드', domainName: 'CORS (교차 출처 리소스 공유)' },
  // 백엔드
  { majorCategory: '백엔드', domainName: 'RESTful API와 GraphQL' },
  { majorCategory: '백엔드', domainName: '인증과 인가 (Authentication & Authorization)' },
  { majorCategory: '백엔드', domainName: 'ORM (Object-Relational Mapping)' },
  { majorCategory: '백엔드', domainName: '마이크로서비스 아키텍처 (MSA)' },
  { majorCategory: '백엔드', domainName: '캐싱 전략 (Caching Strategy)' },
  // 자료구조/알고리즘
  { majorCategory: '자료구조/알고리즘', domainName: '배열과 연결 리스트' },
  { majorCategory: '자료구조/알고리즘', domainName: '해시 테이블과 충돌 처리' },
  { majorCategory: '자료구조/알고리즘', domainName: '트리와 그래프 탐색 (DFS, BFS)' },
  { majorCategory: '자료구조/알고리즘', domainName: '정렬 알고리즘 (Quick, Merge)' },
  { majorCategory: '자료구조/알고리즘', domainName: '동적 계획법 (Dynamic Programming)' },
  // CS 인프라 기초
  { majorCategory: 'CS 인프라 기초', domainName: 'RDBMS와 NoSQL' },
  { majorCategory: 'CS 인프라 기초', domainName: '데이터베이스 인덱스와 B-Tree' },
  { majorCategory: 'CS 인프라 기초', domainName: 'TCP/IP와 HTTP/HTTPS' },
  { majorCategory: 'CS 인프라 기초', domainName: '컨테이너 가상화 (Docker, Kubernetes)' },
  { majorCategory: 'CS 인프라 기초', domainName: 'CI/CD (지속적 통합 및 배포)' },
];

const customScrollbar = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-400/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400/40";

export default function ExamPage() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [step, setStep] = useState<'SOLVING' | 'RESULT'>('SOLVING');
  const [selectedDomainName, setSelectedDomainName] = useState<string>('');
  const [problemCount, setProblemCount] = useState<number>(5);

  const [examData, setExamData] = useState<QuestionResponse[] | null>(null);
  const [resultData, setResultData] = useState<Record<string, ScoreSubmitResponse> | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // X, Y 동시 추적: 세로 스크롤 중 대각선 오작동 방지
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const categories = Array.from(new Set(DOMAIN_LIST.map((item) => item.majorCategory)));

  const problemsPerPage = isMobile ? 1 : 2;

  const pagesArray: QuestionResponse[][] = [];
  if (examData) {
    for (let i = 0; i < examData.length; i += problemsPerPage) {
      pagesArray.push(examData.slice(i, i + problemsPerPage));
    }
  }
  const totalPages = pagesArray.length;

  useEffect(() => {
    if (totalPages > 0 && currentPage >= totalPages) {
      setCurrentPage(totalPages - 1);
    }
  }, [totalPages, currentPage]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('label') || target.closest('button')) {
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null || isLoading || !examData) return;
    const touch = e.changedTouches[0];
    const diffX = touchStartRef.current.x - touch.clientX;
    const diffY = touchStartRef.current.y - touch.clientY;
    const minSwipeDistance = 55;

    // 순수 가로 스와이프(가로 이동량이 세로 이동량의 1.5배 초과)일 때만 페이지 이동
    if (Math.abs(diffX) > minSwipeDistance && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX > 0 && currentPage < totalPages - 1) {
        setCurrentPage((prev) => prev + 1);
      } else if (diffX < 0 && currentPage > 0) {
        setCurrentPage((prev) => prev - 1);
      }
    }
    touchStartRef.current = null;
  };

  const handleGenerate = async () => {
    if (!selectedDomainName) {
      alert('출제할 단원을 선택해 주십시오.');
      return;
    }

    setIsGenerating(true);
    setExamData(null);
    try {
      const payload = {
        subjectType: '개발자상식',
        subCategories: [selectedDomainName],
        count: problemCount,
      };

      const idempotencyKey = crypto.randomUUID();
      const userId = localStorage.getItem('userId') || 'temp-user';

      const initRes = await axios.post('/api/v1/problems/fetch', payload, {
        headers: { 'User-Id': userId, 'Idempotency-Key': idempotencyKey },
      });

      if (initRes.status === 200 && Array.isArray(initRes.data)) {
        setExamData(initRes.data);
        startSolving();
      } else if (initRes.status === 202) {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get('/api/v1/problems/fetch/status', {
              headers: { 'Idempotency-Key': idempotencyKey },
            });

            if (statusRes.status === 200 && Array.isArray(statusRes.data)) {
              clearInterval(pollInterval);
              setExamData(statusRes.data);
              startSolving();
            }
          } catch (pollError: unknown) {
            if (axios.isAxiosError(pollError) && pollError.response?.status === 400) {
              clearInterval(pollInterval);
              alert('시간이 초과되었거나 요청이 올바르지 않습니다.');
              setIsGenerating(false);
            }
          }
        }, 3000);
      }
    } catch (error) {
      console.error('시험 생성 실패:', error);
      alert('시험지 생성에 실패했습니다. 서버 연결 상태를 확인해주세요.');
      setIsGenerating(false);
    }
  };

  const startSolving = () => {
    setUserAnswers({});
    setResultData(null);
    setCurrentPage(0);
    setStep('SOLVING');
    setIsGenerating(false);
    if (isMobile) setIsMobileSidebarOpen(false);
  };

  const handleAnswerChange = (problemId: string, choiceNumber: number) => {
    setUserAnswers((prev) => ({
      ...prev,
      [problemId]: choiceNumber,
    }));
  };

  const handleSubmit = async () => {
    if (!examData) return;
    if (Object.keys(userAnswers).length < examData.length) {
      if (!window.confirm('아직 풀지 않은 문제가 있습니다. 그래도 제출하시겠습니까?')) return;
    }

    setIsLoading(true);
    const userId = localStorage.getItem('userId') || 'temp-user';
    const newResults: Record<string, ScoreSubmitResponse> = {};

    try {
      await Promise.all(
        examData.map(async (problem) => {
          const userAnswer = userAnswers[problem.id];
          if (userAnswer) {
            const res = await axios.post(
              '/api/v1/score',
              {
                problemId: problem.id,
                userAnswer: userAnswer,
              },
              {
                headers: { 'User-Id': userId },
              },
            );
            newResults[problem.id] = res.data;
          }
        }),
      );
      setResultData(newResults);
      setStep('RESULT');
      setCurrentPage(0);
    } catch (error) {
      console.error('채점 실패:', error);
      alert('채점 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  let totalScore = 0;
  let obtainedScore = 0;
  if (examData && resultData) {
    totalScore = examData.length * 10;
    examData.forEach((p) => {
      if (resultData[p.id]?.isCorrect) obtainedScore += 10;
    });
  }

  return (
    <div className="relative flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-[#F2F8FF] md:flex-row">
      {isMobile && isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 좌측 사이드바 영역 */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[84%] max-w-[320px] flex-col justify-between overflow-y-auto border-r border-slate-200/50 bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-300 ease-in-out md:static md:w-72 md:bg-white/10 md:p-6 md:shadow-sm md:backdrop-blur-sm ${customScrollbar} ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          <div className="mb-5 flex items-center justify-between md:mb-6">
            <h2 className="text-lg font-bold text-slate-800">단원별 문제 출제</h2>
            {isMobile && (
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                aria-label="출제 메뉴 닫기"
                className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <h4 className="mb-2 text-xs font-bold text-slate-500">{category}</h4>
                <div className="space-y-1 border-l-2 border-slate-200 pl-2">
                  {DOMAIN_LIST.filter((item) => item.majorCategory === category).map((item) => (
                    <label
                      key={item.domainName}
                      className="flex cursor-pointer items-center gap-2.5 py-1.5 text-sm font-medium text-slate-700 hover:text-blue-600 md:py-0.5"
                    >
                      <input
                        type="radio"
                        name="domainSelect"
                        value={item.domainName}
                        checked={selectedDomainName === item.domainName}
                        onChange={() => setSelectedDomainName(item.domainName)}
                        className="h-4 w-4 shrink-0 cursor-pointer accent-blue-600 md:h-3.5 md:w-3.5"
                      />
                      <span className="truncate leading-relaxed">{item.domainName}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="mt-5 border-t border-slate-200/60 pt-5">
              <h3 className="mb-2.5 text-sm font-bold text-slate-800">출제 문항 수</h3>
              <select
                value={problemCount}
                onChange={(e) => setProblemCount(Number(e.target.value))}
                className="min-h-11 w-full cursor-pointer rounded-lg border border-slate-200/80 bg-white px-3 text-base font-medium text-slate-700 shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none md:min-h-0 md:bg-white/50 md:p-2.5 md:text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num}문제
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-6 shrink-0 border-t border-slate-200/60 pt-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedDomainName}
            className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 font-bold text-white shadow-md transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-0 md:py-2.5"
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                출제 중...
              </>
            ) : (
              '선택 단원 출제 시작'
            )}
          </button>
        </div>
      </aside>

      {/* 우측 메인 영역 */}
      <main
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative flex flex-1 flex-col overflow-hidden select-none touch-pan-y"
      >
        {isMobile && (
          <div className="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2 shadow-xs">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="출제 메뉴 열기"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </button>
              <h1 className="truncate text-sm font-bold text-slate-800">
                {examData ? selectedDomainName : '단원 선택 대기중'}
              </h1>
            </div>
            {examData && totalPages > 0 && (
              <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600">
                {currentPage + 1} / {totalPages}
              </span>
            )}
          </div>
        )}

        <div className="relative flex flex-1 flex-col overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-8">
          {!examData ? (
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center font-medium text-slate-500">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                <svg
                  className="h-8 w-8 text-blue-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm leading-relaxed text-slate-600 md:text-base">
                좌측 패널에서 학습할 <span className="font-bold text-blue-600">단원</span>과{' '}
                <span className="font-bold text-blue-600">문항 수</span>를 선택한 후
                <br />
                출제 시작 버튼을 눌러주십시오.
              </p>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="mt-6 min-h-11 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-md"
                >
                  출제 메뉴 열기
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              {step === 'RESULT' && resultData && (
                <div className="mb-3 flex shrink-0 flex-row items-center justify-between gap-2 rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-sm md:mb-6 md:px-6 md:py-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 md:text-xl">채점 완료</h2>
                    <p className="hidden text-sm text-slate-500 md:mt-1 md:block">
                      상세 해설 및 정답 여부가 하단에 표시됩니다.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="mr-1.5 text-xs font-bold text-slate-500 md:text-sm">총점:</span>
                    <span className="text-xl font-extrabold text-blue-600 md:text-3xl">
                      {obtainedScore}
                    </span>
                    <span className="text-sm font-bold text-slate-400 md:text-lg">
                      {' '}
                      / {totalScore} 점
                    </span>
                  </div>
                </div>
              )}

              {isLoading && step === 'SOLVING' && (
                <div className="absolute inset-0 z-20 m-3 flex flex-col items-center justify-center rounded-xl bg-white/60 backdrop-blur-sm md:m-8">
                  <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                  <p className="text-base font-bold text-slate-800 md:text-lg">
                    전체 문항 채점 진행 중...
                  </p>
                </div>
              )}

              {/* 슬라이더 트랙 */}
              <div className="relative flex-1 overflow-hidden">
                <div
                  className="flex h-full w-full transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${currentPage * 100}%)` }}
                >
                  {pagesArray.map((pageProblems, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="flex h-full w-full shrink-0 flex-col md:px-2"
                    >
                      <div className={`flex-1 overflow-y-auto pb-4 ${customScrollbar}`}>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
                          {pageProblems.map((problem, idx) => {
                            const actualProblemNumber = pageIndex * problemsPerPage + idx + 1;
                            const resultInfo =
                              step === 'RESULT' && resultData ? resultData[problem.id] : null;
                            const didNotAnswer = step === 'RESULT' && !resultInfo;

                            return (
                              <div
                                key={problem.id}
                                className="flex h-fit flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-7"
                              >
                                <div className="mb-3 flex items-center justify-between md:mb-5">
                                  <h3 className="text-base font-bold tracking-tight text-slate-800 md:text-xl">
                                    {actualProblemNumber}번 문제
                                  </h3>
                                  {step === 'RESULT' && (
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-bold tracking-wide md:text-sm ${
                                        resultInfo?.isCorrect
                                          ? 'border border-green-200 bg-green-50 text-green-700'
                                          : didNotAnswer
                                            ? 'border border-slate-200 bg-slate-50 text-slate-500'
                                            : 'border border-red-200 bg-red-50 text-red-700'
                                      }`}
                                    >
                                      {resultInfo?.isCorrect
                                        ? '정답 (10점)'
                                        : didNotAnswer
                                          ? '미제출 (0점)'
                                          : '오답 (0점)'}
                                    </span>
                                  )}
                                </div>

                                <div className="mb-2 flex-1 break-words whitespace-pre-wrap text-sm leading-relaxed font-medium text-slate-800 select-text md:text-base">
                                  {problem.content}
                                </div>

                                {/* 객관식 보기 영역 */}
                                <div className="mt-4 border-t border-slate-100 pt-4 select-text md:mt-5 md:pt-5">
                                  <div className="flex flex-col gap-2.5">
                                    {problem.choices.map((choice, cIdx) => {
                                      const choiceNumber = cIdx + 1;
                                      const isSelected = userAnswers[problem.id] === choiceNumber;
                                      const isCorrectAnswer =
                                        resultInfo?.correctAnswer === choiceNumber;

                                      let styleClass = 'border-slate-200 hover:bg-slate-50';

                                      if (step === 'RESULT') {
                                        if (isCorrectAnswer) {
                                          styleClass =
                                            'border-green-500 bg-green-50/50 ring-1 ring-green-500';
                                        } else if (isSelected && !isCorrectAnswer) {
                                          styleClass = 'border-red-400 bg-red-50/50';
                                        } else {
                                          styleClass = 'border-slate-200 opacity-50';
                                        }
                                      } else if (isSelected) {
                                        styleClass =
                                          'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500';
                                      }

                                      return (
                                        <label
                                          key={cIdx}
                                          className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all md:min-h-0 md:p-3.5 ${styleClass}`}
                                        >
                                          <div className="pt-0.5">
                                            <input
                                              type="radio"
                                              name={`problem-${problem.id}`}
                                              value={choiceNumber}
                                              checked={isSelected}
                                              onChange={() =>
                                                handleAnswerChange(problem.id, choiceNumber)
                                              }
                                              disabled={step === 'RESULT' || isLoading}
                                              className="h-4 w-4 cursor-pointer accent-blue-600"
                                            />
                                          </div>
                                          <span
                                            className={`min-w-0 flex-1 break-words text-sm leading-snug md:text-base ${
                                              isSelected && step !== 'RESULT'
                                                ? 'font-bold text-blue-900'
                                                : 'text-slate-700'
                                            }`}
                                          >
                                            <span className="mr-1.5 font-bold">
                                              {choiceNumber}.
                                            </span>{' '}
                                            {choice}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* 상세 해설 영역 */}
                                {step === 'RESULT' && resultInfo && resultInfo.explanation && (
                                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3.5 select-text md:mt-5 md:p-4">
                                    <div className="mb-1.5 flex items-center gap-2">
                                      <svg
                                        className="h-4 w-4 shrink-0 text-blue-600"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                        strokeWidth="2.5"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                      </svg>
                                      <label className="text-sm font-bold text-blue-900">
                                        상세 해설
                                      </label>
                                    </div>
                                    <p className="break-words whitespace-pre-wrap text-sm leading-relaxed font-medium text-slate-700">
                                      {resultInfo.explanation}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 하단 컨트롤 */}
              <div className="relative mt-2 flex shrink-0 items-center justify-between border-t border-slate-200/60 pt-3 md:mt-4 md:justify-center md:border-none md:pt-4">
                <div className="w-20 md:hidden" />

                <div className="flex gap-3 md:gap-4">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                    disabled={currentPage === 0 || isLoading}
                    aria-label="이전 페이지"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-800 text-white shadow-md transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage >= totalPages - 1 || isLoading}
                    aria-label="다음 페이지"
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-800 text-white shadow-md transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </div>

                {step === 'SOLVING' && (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="min-h-11 w-20 cursor-pointer rounded-lg bg-blue-600 px-4 text-sm font-extrabold text-white shadow-md transition-colors hover:bg-blue-700 disabled:opacity-50 md:absolute md:right-0 md:w-auto md:px-10 md:py-3 md:text-base md:tracking-wider"
                  >
                    제출
                  </button>
                )}

                {step === 'RESULT' && <div className="w-20 md:hidden" />}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}