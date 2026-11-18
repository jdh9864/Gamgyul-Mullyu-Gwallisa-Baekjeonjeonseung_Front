import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  bulkUpdateHistoriesApi,
  extractErrorMessage,
  getHistoriesApi,
  updateHistoryApi,
} from '../api/client';
import type { DifficultyLevel, HistoryItem } from '../types/history';

interface NoteDraft {
  userDifficulty: string;
  reviewNotes: string;
}

const DIFFICULTIES: readonly DifficultyLevel[] = ['쉬움', '보통', '어려움'];

function formatKstDate(isoString: string): string {
  if (!isoString) return '-';
  const hasZone = /[Zz]|[+-]\d{2}:?\d{2}$/.test(isoString);
  const date = new Date(hasZone ? isoString : `${isoString}Z`);
  if (Number.isNaN(date.getTime())) return isoString;

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function difficultyBadgeStyle(diff: string): string {
  switch (diff) {
    case '어려움':
      return 'bg-red-50 text-red-700 border-red-200';
    case '보통':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case '쉬움':
      return 'bg-green-50 text-green-700 border-green-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
  }
}

export default function ReviewPage() {
  const navigate = useNavigate();

  const [onlyWrong, setOnlyWrong] = useState(true);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const [hideAnswers, setHideAnswers] = useState(false);
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});

  const [drafts, setDrafts] = useState<Record<string, NoteDraft>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedNoticeIds, setSavedNoticeIds] = useState<Record<string, boolean>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchHistories = useCallback(async (wrongOnly: boolean) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getHistoriesApi({ onlyWrong: wrongOnly });
      setItems(data);

      const initialDrafts: Record<string, NoteDraft> = {};
      for (const item of data) {
        initialDrafts[item.problemId] = {
          userDifficulty: item.userDifficulty || '보통',
          reviewNotes: item.reviewNotes ?? '',
        };
      }
      setDrafts(initialDrafts);
      setRevealedMap({});
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, '오답노트 데이터를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHistories(onlyWrong);
  }, [fetchHistories, onlyWrong]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.subjectType) set.add(item.subjectType);
    }
    return Array.from(set);
  }, [items]);

  const subCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (selectedSubject !== 'ALL' && item.subjectType !== selectedSubject) continue;
      if (item.subCategory) set.add(item.subCategory);
    }
    return Array.from(set);
  }, [items, selectedSubject]);

  const filteredItems = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedSubject !== 'ALL' && item.subjectType !== selectedSubject) return false;
      if (selectedSubCategory !== 'ALL' && item.subCategory !== selectedSubCategory) return false;

      const currentDiff = drafts[item.problemId]?.userDifficulty ?? item.userDifficulty;
      if (selectedDifficulty !== 'ALL' && currentDiff !== selectedDifficulty) return false;

      if (kw) {
        const contentMatch = (item.content ?? '').toLowerCase().includes(kw);
        const noteMatch = (drafts[item.problemId]?.reviewNotes ?? item.reviewNotes ?? '')
          .toLowerCase()
          .includes(kw);
        const catMatch = (item.subCategory ?? '').toLowerCase().includes(kw);
        if (!contentMatch && !noteMatch && !catMatch) return false;
      }
      return true;
    });
  }, [items, selectedSubject, selectedSubCategory, selectedDifficulty, searchKeyword, drafts]);

  const dirtyItems = useMemo(() => {
    return items.filter((item) => {
      const draft = drafts[item.problemId];
      if (!draft) return false;
      const origDiff = item.userDifficulty || '보통';
      const origNote = item.reviewNotes ?? '';
      return draft.userDifficulty !== origDiff || draft.reviewNotes !== origNote;
    });
  }, [items, drafts]);

  const stats = useMemo(() => {
    const total = items.length;
    const wrongCount = items.filter((i) => !i.isCorrect).length;
    const notedCount = items.filter((i) => (i.reviewNotes ?? '').trim().length > 0).length;
    const hardCount = items.filter((i) => i.userDifficulty === '어려움').length;
    return { total, wrongCount, notedCount, hardCount };
  }, [items]);

  const updateDraft = (problemId: string, patch: Partial<NoteDraft>) => {
    setDrafts((prev) => {
      const current = prev[problemId] ?? { userDifficulty: '보통', reviewNotes: '' };
      return {
        ...prev,
        [problemId]: { ...current, ...patch },
      };
    });
    setSavedNoticeIds((prev) => ({ ...prev, [problemId]: false }));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 2500);
  };

  const handleSaveSingle = async (item: HistoryItem) => {
    const draft = drafts[item.problemId];
    if (!draft) return;

    setSavingIds((prev) => ({ ...prev, [item.problemId]: true }));
    setErrorMsg(null);
    try {
      const updated = await updateHistoryApi({
        problemId: item.problemId,
        subjectType: item.subjectType,
        subCategory: item.subCategory,
        userDifficulty: draft.userDifficulty,
        reviewNotes: draft.reviewNotes,
      });

      setItems((prev) => prev.map((x) => (x.problemId === updated.problemId ? updated : x)));
      setDrafts((prev) => ({
        ...prev,
        [updated.problemId]: {
          userDifficulty: updated.userDifficulty || '보통',
          reviewNotes: updated.reviewNotes ?? '',
        },
      }));
      setSavedNoticeIds((prev) => ({ ...prev, [updated.problemId]: true }));
      showToast('오답노트가 저장되었습니다.');
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, '저장에 실패했습니다.'));
    } finally {
      setSavingIds((prev) => ({ ...prev, [item.problemId]: false }));
    }
  };

  const handleBulkSave = async () => {
    if (dirtyItems.length === 0) return;

    setBulkSaving(true);
    setErrorMsg(null);
    try {
      const updates = dirtyItems.map((item) => {
        const draft = drafts[item.problemId];
        return {
          problemId: item.problemId,
          subjectType: item.subjectType,
          subCategory: item.subCategory,
          userDifficulty: draft.userDifficulty,
          reviewNotes: draft.reviewNotes,
        };
      });

      const updatedList = await bulkUpdateHistoriesApi({ updates });
      const updatedMap = new Map(updatedList.map((u) => [u.problemId, u]));

      setItems((prev) => prev.map((x) => updatedMap.get(x.problemId) ?? x));
      setDrafts((prev) => {
        const next = { ...prev };
        for (const u of updatedList) {
          next[u.problemId] = {
            userDifficulty: u.userDifficulty || '보통',
            reviewNotes: u.reviewNotes ?? '',
          };
        }
        return next;
      });

      const noticePatch: Record<string, boolean> = {};
      for (const u of updatedList) {
        noticePatch[u.problemId] = true;
      }
      setSavedNoticeIds((prev) => ({ ...prev, ...noticePatch }));
      showToast(`${updatedList.length}건의 오답노트가 일괄 저장되었습니다.`);
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err, '일괄 저장에 실패했습니다.'));
    } finally {
      setBulkSaving(false);
    }
  };

  const toggleCardReveal = (problemId: string) => {
    setRevealedMap((prev) => ({ ...prev, [problemId]: !prev[problemId] }));
  };

  return (
    <div className="min-h-[calc(100dvh-3.5rem)] bg-[#F2F8FF] pb-[max(5rem,env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-5xl px-3 pt-4 sm:px-4 sm:pt-6">
        {/* 상단 타이틀 및 보기 모드 전환 */}
        <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-6 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">
              오답노트 &amp; 풀이 기록
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              체감 난이도를 조정하고 나만의 복습 메모를 기록할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="grid flex-1 grid-cols-2 rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:inline-flex sm:flex-none">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('ALL');
                  setSelectedSubCategory('ALL');
                  setOnlyWrong(true);
                }}
                className={`min-h-9 cursor-pointer whitespace-nowrap rounded-md px-3 text-xs font-bold transition-colors sm:px-3.5 ${
                  onlyWrong
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                틀린 문제만
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('ALL');
                  setSelectedSubCategory('ALL');
                  setOnlyWrong(false);
                }}
                className={`min-h-9 cursor-pointer whitespace-nowrap rounded-md px-3 text-xs font-bold transition-colors sm:px-3.5 ${
                  !onlyWrong
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                전체 풀이
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setHideAnswers((prev) => !prev);
                setRevealedMap({});
              }}
              className={`min-h-10 cursor-pointer whitespace-nowrap rounded-lg border px-3 text-xs font-bold shadow-sm transition-colors ${
                hideAnswers
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {hideAnswers ? '가림 ON' : '정답 가리기'}
            </button>

            <button
              type="button"
              onClick={() => void fetchHistories(onlyWrong)}
              disabled={loading}
              className="min-h-10 cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 요약 통계 카드 (모바일 4열 압축 또는 2x2 균형) */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:mb-6 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="text-xs font-bold text-slate-500">조회된 문항</div>
            <div className="mt-1 text-xl font-extrabold text-slate-800 sm:text-2xl">
              {stats.total}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="text-xs font-bold text-slate-500">오답 문항</div>
            <div className="mt-1 text-xl font-extrabold text-red-600 sm:text-2xl">
              {stats.wrongCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="text-xs font-bold text-slate-500">체감 어려움</div>
            <div className="mt-1 text-xl font-extrabold text-blue-600 sm:text-2xl">
              {stats.hardCount}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
            <div className="text-xs font-bold text-slate-500">메모 작성 완료</div>
            <div className="mt-1 text-xl font-extrabold text-green-600 sm:text-2xl">
              {stats.notedCount}
            </div>
          </div>
        </div>

        {/* 필터 바 (모바일 2열 압축 + 16px 폰트로 iOS 확대 방지) */}
        <div className="mb-4 grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:mb-5 sm:grid-cols-4 sm:gap-3 sm:p-4">
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedSubCategory('ALL');
            }}
            className="min-h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 text-base font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:px-3 sm:text-sm"
          >
            <option value="ALL">전체 과목</option>
            {subjectOptions.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="min-h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 text-base font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:px-3 sm:text-sm"
          >
            <option value="ALL">전체 난이도</option>
            {DIFFICULTIES.map((diff) => (
              <option key={diff} value={diff}>
                {diff}
              </option>
            ))}
          </select>

          <select
            value={selectedSubCategory}
            onChange={(e) => setSelectedSubCategory(e.target.value)}
            className="col-span-2 min-h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 text-base font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:col-span-1 sm:px-3 sm:text-sm"
          >
            <option value="ALL">전체 단원</option>
            {subCategoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="문제 지문 / 메모 검색..."
            className="col-span-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:col-span-1 sm:text-sm"
          />
        </div>

        {/* 토스트 및 에러 알림 */}
        {toastMsg && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {toastMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorMsg}
          </div>
        )}

        {/* 본문 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-20 text-slate-500 shadow-sm">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-bold text-slate-700">오답노트를 불러오는 중입니다...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm sm:py-20">
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
            <p className="text-base font-bold text-slate-800">
              {items.length === 0
                ? onlyWrong
                  ? '아직 틀린 문제가 없습니다.'
                  : '아직 저장된 풀이 기록이 없습니다.'
                : '선택한 필터 조건에 해당하는 문항이 없습니다.'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {items.length === 0
                ? '문제를 풀고 채점하면 자동으로 이 화면에 기록됩니다.'
                : '필터나 검색어를 초기화해 다시 확인해 보세요.'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (items.length === 0) {
                  navigate('/');
                } else {
                  setSelectedSubject('ALL');
                  setSelectedSubCategory('ALL');
                  setSelectedDifficulty('ALL');
                  setSearchKeyword('');
                }
              }}
              className="mt-6 min-h-11 cursor-pointer rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-700"
            >
              {items.length === 0 ? '문제 풀러 가기' : '필터 초기화'}
            </button>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-5">
            {filteredItems.map((item, idx) => {
              const draft = drafts[item.problemId] ?? {
                userDifficulty: item.userDifficulty || '보통',
                reviewNotes: item.reviewNotes ?? '',
              };
              const isDirty =
                draft.userDifficulty !== (item.userDifficulty || '보통') ||
                draft.reviewNotes !== (item.reviewNotes ?? '');
              const isSaving = Boolean(savingIds[item.problemId]);
              const isSavedNotice = Boolean(savedNoticeIds[item.problemId]);
              const showSolution = !hideAnswers || Boolean(revealedMap[item.problemId]);

              return (
                <article
                  key={item.historyId || item.problemId}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  {/* 카드 상단 메타 헤더 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-[#F2F8FF]/60 px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="text-xs font-bold text-slate-500">#{idx + 1}</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          item.isCorrect
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {item.isCorrect ? '정답' : '오답'}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {item.subjectType || '기타'}
                      </span>
                      <span className="max-w-44 truncate rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 sm:max-w-none">
                        {item.subCategory || '기타'}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-bold ${difficultyBadgeStyle(
                          draft.userDifficulty,
                        )}`}
                      >
                        {draft.userDifficulty}
                      </span>
                    </div>

                    <span className="text-[11px] font-medium text-slate-400 sm:text-xs">
                      {formatKstDate(item.solvedAt)}
                    </span>
                  </div>

                  {/* 문제 지문 및 선택지 */}
                  <div className="p-4 sm:p-6">
                    <p className="break-words whitespace-pre-wrap text-sm leading-relaxed font-medium text-slate-800 sm:text-base">
                      {item.content ?? '(삭제되었거나 원문을 찾을 수 없는 문제입니다.)'}
                    </p>

                    {item.choices && item.choices.length > 0 && (
                      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 sm:mt-5 sm:space-y-2.5 sm:pt-5">
                        {item.choices.map((choice, cIdx) => {
                          const choiceNum = cIdx + 1;
                          const isAnswer = showSolution && item.correctAnswer === choiceNum;
                          return (
                            <li
                              key={cIdx}
                              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-all sm:px-3.5 sm:py-3 ${
                                isAnswer
                                  ? 'border-green-500 bg-green-50/50 font-bold text-slate-800 ring-1 ring-green-500'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <span
                                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isAnswer
                                    ? 'bg-green-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {choiceNum}
                              </span>
                              <span className="min-w-0 flex-1 break-words whitespace-pre-wrap leading-snug">
                                {choice}
                              </span>
                              {isAnswer && (
                                <span className="shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">
                                  정답
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* 복습 가림 모드 토글 */}
                    {hideAnswers && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => toggleCardReveal(item.problemId)}
                          className="min-h-10 cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-4 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                        >
                          {showSolution ? '정답 · 해설 숨기기' : '정답 · 해설 확인하기'}
                        </button>
                      </div>
                    )}

                    {/* 상세 해설 영역 */}
                    {showSolution && item.explanation && (
                      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/70 p-3.5 sm:mt-5 sm:p-4">
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
                          <span className="text-sm font-bold text-blue-900">
                            상세 해설 (정답: {item.correctAnswer ?? '-'}번)
                          </span>
                        </div>
                        <p className="break-words whitespace-pre-wrap text-sm leading-relaxed font-medium text-slate-700">
                          {item.explanation}
                        </p>
                      </div>
                    )}

                    {/* 체감 난이도 & 복습 메모 편집 영역 (터치 타겟 40px+ & 16px textarea) */}
                    <div className="mt-4 rounded-lg border border-slate-200 bg-[#F2F8FF]/50 p-3.5 sm:mt-5 sm:p-4">
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs font-bold text-slate-700">체감 난이도</span>
                        <div className="grid grid-cols-3 gap-1.5 sm:flex">
                          {DIFFICULTIES.map((level) => {
                            const active = draft.userDifficulty === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() =>
                                  updateDraft(item.problemId, { userDifficulty: level })
                                }
                                className={`min-h-10 cursor-pointer rounded-lg border px-3 text-xs font-bold transition-colors sm:min-h-8 ${
                                  active
                                    ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                                }`}
                              >
                                {level}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label
                        htmlFor={`note-${item.problemId}`}
                        className="mb-1.5 block text-xs font-bold text-slate-700"
                      >
                        복습 메모 (틀린 이유, 암기 포인트)
                      </label>
                      <textarea
                        id={`note-${item.problemId}`}
                        rows={3}
                        value={draft.reviewNotes}
                        onChange={(e) =>
                          updateDraft(item.problemId, { reviewNotes: e.target.value })
                        }
                        placeholder="예: 개념 A와 B의 차이를 혼동함. 핵심 키워드 다시 정리..."
                        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 sm:px-3.5 sm:text-sm"
                      />

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold">
                          {isDirty ? (
                            <span className="text-blue-600">● 변경됨</span>
                          ) : isSavedNotice ? (
                            <span className="text-green-600">✓ 저장 완료</span>
                          ) : (
                            <span className="text-slate-400">저장됨</span>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => void handleSaveSingle(item)}
                          disabled={isSaving || !isDirty}
                          className="min-h-10 cursor-pointer rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                        >
                          {isSaving ? '저장 중...' : '메모 저장'}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* 미저장 항목이 있을 때 화면 하단 고정 일괄 저장 바 (모바일 엄지 영역 최적화) */}
      {dirtyItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-blue-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-700 sm:text-sm">
              미저장 메모 <strong className="font-bold text-blue-600">{dirtyItems.length}건</strong>
            </span>
            <button
              type="button"
              onClick={() => void handleBulkSave()}
              disabled={bulkSaving}
              className="min-h-10 cursor-pointer rounded-lg bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 sm:px-5 sm:text-sm"
            >
              {bulkSaving ? '일괄 저장 중...' : `${dirtyItems.length}건 일괄 저장`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}