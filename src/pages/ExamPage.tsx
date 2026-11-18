// src/pages/ExamPage.tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [step, setStep] = useState<'SOLVING' | 'RESULT'>('SOLVING');
  
  // 실전 모의고사 삭제 -> 오직 단원 선택과 문제 수만 관리
  const [selectedDomainName, setSelectedDomainName] = useState<string>('');
  const [problemCount, setProblemCount] = useState<number>(5);

  const [examData, setExamData] = useState<QuestionResponse[] | null>(null);
  const [resultData, setResultData] = useState<Record<string, ScoreSubmitResponse> | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const touchStartXRef = useRef<number | null>(null);
  const categories = Array.from(new Set(DOMAIN_LIST.map((item) => item.majorCategory)));

  const problemsPerPage = isMobile ? 1 : 2;

  const pagesArray = [];
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
    if (target.closest('label')) {
      touchStartXRef.current = null;
      return;
    }
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || isLoading) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchStartXRef.current - touchEndX;
    const minSwipeDistance = 50; 

    if (diffX > minSwipeDistance) {
      if (!examData) navigate('/review');
      else if (currentPage < totalPages - 1) setCurrentPage((prev) => prev + 1);
      else if (currentPage === totalPages - 1) navigate('/review');
    } else if (diffX < -minSwipeDistance) {
      if (currentPage > 0) setCurrentPage((prev) => prev - 1);
    }
    touchStartXRef.current = null;
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
        subjectType: "개발자상식",
        subCategories: [selectedDomainName], // 선택된 단원명 정확히 전달
        count: problemCount,
      };

      const idempotencyKey = crypto.randomUUID();
      const userId = localStorage.getItem('userId') || "temp-user";

      const initRes = await axios.post(`/api/v1/problems/fetch`, payload, {
        headers: { 'User-Id': userId, 'Idempotency-Key': idempotencyKey }
      });

      if (initRes.status === 200 && Array.isArray(initRes.data)) {
        setExamData(initRes.data);
        startSolving();
      } else if (initRes.status === 202) {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`/api/v1/problems/fetch/status`, {
              headers: { 'Idempotency-Key': idempotencyKey }
            });

            if (statusRes.status === 200 && Array.isArray(statusRes.data)) {
              clearInterval(pollInterval);
              setExamData(statusRes.data);
              startSolving();
            }
          } catch (pollError: any) {
            if (pollError.response?.status === 400) {
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
    const userId = localStorage.getItem('userId') || "temp-user";
    const newResults: Record<string, ScoreSubmitResponse> = {};

    try {
      await Promise.all(
        examData.map(async (problem) => {
          const userAnswer = userAnswers[problem.id];
          if (userAnswer) {
            const res = await axios.post(`/api/v1/score`, {
              problemId: problem.id,
              userAnswer: userAnswer
            }, {
              headers: { 'User-Id': userId }
            });
            newResults[problem.id] = res.data;
          }
        })
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
    examData.forEach(p => {
      if (resultData[p.id]?.isCorrect) obtainedScore += 10;
    });
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F2F8FF] relative overflow-hidden">
      
      {isMobile && isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* 좌측 사이드바 영역 */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 flex flex-col justify-between 
        w-[80%] max-w-[320px] md:w-72 bg-white md:bg-white/10 shadow-2xl md:shadow-sm border-r border-slate-200/50 p-6 md:backdrop-blur-sm overflow-y-auto 
        transition-transform duration-300 ease-in-out ${customScrollbar}
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg text-slate-800">단원별 문제 출제</h2>
            {isMobile && (
              <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            )}
          </div>

          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <h4 className="text-xs font-bold text-slate-500 mb-2.5">{category}</h4>
                <div className="space-y-1.5 pl-2 border-l-2 border-slate-200">
                  {DOMAIN_LIST.filter((item) => item.majorCategory === category).map((item) => (
                    <label
                      key={item.domainName}
                      className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700 hover:text-blue-600 py-0.5"
                    >
                      <input
                        type="radio"
                        name="domainSelect"
                        value={item.domainName}
                        checked={selectedDomainName === item.domainName}
                        onChange={() => setSelectedDomainName(item.domainName)}
                        className="accent-blue-600 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="truncate leading-relaxed">{item.domainName}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-5 mt-5 border-t border-slate-200/60">
              <h3 className="font-bold text-sm text-slate-800 mb-3">출제 문항 수</h3>
              <select
                value={problemCount}
                onChange={(e) => setProblemCount(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200/80 rounded-lg text-sm font-medium text-slate-700 bg-white md:bg-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>{num}문제</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 mt-6 border-t border-slate-200/60 flex-shrink-0">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !selectedDomainName}
            className="w-full px-6 py-3 md:py-2.5 bg-blue-600 text-white rounded-lg font-bold cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                출제 중...
              </>
            ) : '선택 단원 출제 시작'}
          </button>
        </div>
      </aside>

      {/* 우측 메인 영역 */}
      <main 
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex flex-col relative overflow-hidden select-none touch-pan-y"
      >
        {isMobile && (
          <div className="flex items-center p-4 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg mr-3"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <h1 className="font-bold text-lg text-slate-800 truncate pr-2">
              {examData ? selectedDomainName : '단원 선택 대기중'}
            </h1>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 flex flex-col overflow-hidden relative">
          {!examData ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-medium px-4 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              </div>
              <p className="text-base text-slate-600 leading-relaxed">
                좌측 패널에서 학습할 <span className="font-bold text-blue-600">단원</span>과 <span className="font-bold text-blue-600">문항 수</span>를 선택한 후<br/>출제 시작 버튼을 눌러주십시오.
              </p>
              {isMobile && (
                <button 
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="mt-6 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg text-sm shadow-md"
                >
                  출제 메뉴 열기
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              
              {step === 'RESULT' && resultData && (
                <div className="mb-4 md:mb-6 px-4 md:px-6 py-4 bg-white border border-blue-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between shadow-sm flex-shrink-0 gap-3 md:gap-0">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-slate-800">채점 완료</h2>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">상세 해설 및 정답 여부가 하단에 표시됩니다.</p>
                  </div>
                  <div className="text-left md:text-right">
                    <span className="text-sm font-bold text-slate-500 mr-2">총점:</span>
                    <span className="text-2xl md:text-3xl font-extrabold text-blue-600">{obtainedScore}</span>
                    <span className="text-base md:text-lg font-bold text-slate-400"> / {totalScore} 점</span>
                  </div>
                </div>
              )}

              {isLoading && step === 'SOLVING' && (
                <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl m-4 md:m-8">
                  <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-lg font-bold text-slate-800">전체 문항 채점 진행 중...</p>
                </div>
              )}

              {/* 슬라이더 트랙 */}
              <div className="flex-1 overflow-hidden relative">
                <div 
                  className="w-full h-full flex transition-transform duration-300 ease-out"
                  style={{ transform: `translateX(-${currentPage * 100}%)` }}
                >
                  {pagesArray.map((pageProblems, pageIndex) => (
                    <div 
                      key={pageIndex} 
                      className="w-full h-full flex-shrink-0 md:px-2 flex flex-col"
                    >
                      <div className={`flex-1 overflow-y-auto pb-4 ${customScrollbar}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 h-full">
                          
                          {pageProblems.map((problem, idx) => {
                            const actualProblemNumber = pageIndex * problemsPerPage + idx + 1;
                            const resultInfo = step === 'RESULT' && resultData ? resultData[problem.id] : null;
                            const didNotAnswer = step === 'RESULT' && !resultInfo;

                            return (
                              <div key={problem.id} className="bg-white p-5 md:p-7 rounded-xl shadow-sm border border-slate-200 flex flex-col h-fit">
                                
                                <div className="mb-4 md:mb-5 flex justify-between items-center">
                                  <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight">{actualProblemNumber}번 문제</h3>
                                  {step === 'RESULT' && (
                                    <span className={`px-3 py-1 rounded-full text-xs md:text-sm font-bold tracking-wide ${
                                      resultInfo?.isCorrect 
                                        ? 'bg-green-50 text-green-700 border border-green-200' 
                                        : didNotAnswer 
                                        ? 'bg-slate-50 text-slate-500 border border-slate-200'
                                        : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                      {resultInfo?.isCorrect ? '정답 (10점)' : didNotAnswer ? '미제출 (0점)' : '오답 (0점)'}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="text-sm md:text-base text-slate-800 whitespace-pre-wrap leading-relaxed flex-1 select-text font-medium mb-2">
                                  {problem.content}
                                </div>

                                {/* 객관식 보기 영역 */}
                                <div className="mt-5 border-t border-slate-100 pt-5 select-text">
                                  <div className="flex flex-col gap-2.5">
                                    {problem.choices.map((choice, cIdx) => {
                                      const choiceNumber = cIdx + 1;
                                      const isSelected = userAnswers[problem.id] === choiceNumber;
                                      const isCorrectAnswer = resultInfo?.correctAnswer === choiceNumber;
                                      
                                      let styleClass = "border-slate-200 hover:bg-slate-50";
                                      
                                      if (step === 'RESULT') {
                                        if (isCorrectAnswer) {
                                          styleClass = "border-green-500 bg-green-50/50 ring-1 ring-green-500";
                                        } else if (isSelected && !isCorrectAnswer) {
                                          styleClass = "border-red-400 bg-red-50/50";
                                        } else {
                                          styleClass = "border-slate-200 opacity-50";
                                        }
                                      } else if (isSelected) {
                                        styleClass = "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500";
                                      }

                                      return (
                                        <label key={cIdx} className={`flex items-start gap-3 p-3 md:p-3.5 rounded-lg border cursor-pointer transition-all ${styleClass}`}>
                                          <div className="pt-0.5">
                                            <input
                                              type="radio"
                                              name={`problem-${problem.id}`}
                                              value={choiceNumber}
                                              checked={isSelected}
                                              onChange={() => handleAnswerChange(problem.id, choiceNumber)}
                                              disabled={step === 'RESULT' || isLoading}
                                              className="accent-blue-600 w-4 h-4 cursor-pointer"
                                            />
                                          </div>
                                          <span className={`text-sm md:text-base leading-snug ${isSelected && step !== 'RESULT' ? 'text-blue-900 font-bold' : 'text-slate-700'}`}>
                                            <span className="font-bold mr-1.5">{choiceNumber}.</span> {choice}
                                          </span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* AI 해설 영역 */}
                                {step === 'RESULT' && resultInfo && resultInfo.explanation && (
                                  <div className="mt-5 p-4 bg-blue-50/70 border border-blue-100 rounded-lg select-text">
                                    <div className="flex items-center gap-2 mb-2">
                                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                      <label className="text-sm font-bold text-blue-900">상세 해설</label>
                                    </div>
                                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
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
              <div className="mt-3 md:mt-4 pt-4 border-t md:border-none border-slate-200/60 flex items-center justify-between md:justify-center relative flex-shrink-0">
                <div className="w-20 md:hidden"></div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                    disabled={currentPage === 0 || isLoading}
                    className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors shadow-md cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage >= totalPages - 1 || isLoading}
                    className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors shadow-md cursor-pointer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>

                {step === 'SOLVING' && (
                  <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-20 md:w-auto md:absolute md:right-0 px-4 md:px-10 py-2.5 md:py-3 bg-blue-600 text-white rounded-lg font-extrabold text-sm md:text-base cursor-pointer hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-md md:tracking-wider"
                  >
                    제출
                  </button>
                )}
                
                {step === 'RESULT' && <div className="w-20 md:hidden"></div>}
              </div>

            </div>
          )}
        </div>
      </main>
    </div>
  );
}