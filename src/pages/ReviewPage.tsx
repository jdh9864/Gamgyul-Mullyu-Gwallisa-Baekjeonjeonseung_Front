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
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case '보통':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case '쉬움':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export default function ReviewPage() {
  const navigate = useNavigate();

  // 서버 조회 조건 및 데이터
  const [onlyWrong, setOnlyWrong] = useState(true);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 클라이언트 필터
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // 복습 가림 모드 및 카드별 해설 열림 상태
  const [hideAnswers, setHideAnswers] = useState(false);
  const [revealedMap, setRevealedMap] = useState<Record<string, boolean>>({});

  // 편집 draft 및 저장 피드백 상태
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

  // 동적 과목/단원 옵션 추출
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

  // 필터링된 목록
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

  // 변경된(dirty) 문항 목록 계산
  const dirtyItems = useMemo(() => {
    return items.filter((item) => {
      const draft = drafts[item.problemId];
      if (!draft) return false;
      const origDiff = item.userDifficulty || '보통';
      const origNote = item.reviewNotes ?? '';
      return draft.userDifficulty !== origDiff || draft.reviewNotes !== origNote;
    });
  }, [items, drafts]);

  // 요약 통계
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
    <div className="min-h-screen bg-slate-50 pb-16">
      <main className="mx-auto max-w-5xl px-4 pt-6">
        {/* 상단 타이틀 및 보기 모드 전환 */}
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">오답노트 &amp; 풀이 기록</h1>
            <p className="mt-1 text-sm text-slate-500">
              문항별 체감 난이도를 조정하고 나만의 복습 메모를 기록할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject('ALL');
                  setSelectedSubCategory('ALL');
                  setOnlyWrong(true);
                }}
                className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  onlyWrong
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
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
                className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                  !onlyWrong
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                전체 풀이 기록
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setHideAnswers((prev) => !prev);
                setRevealedMap({});
              }}
              className={`cursor-pointer rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                hideAnswers
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {hideAnswers ? '복습 가림 모드 ON' : '정답·해설 가리기'}
            </button>

            <button
              type="button"
              onClick={() => void fetchHistories(onlyWrong)}
              disabled={loading}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              새로고침
            </button>
          </div>
        </div>

        {/* 요약 통계 카드 4개 */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">조회된 문항</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">오답 문항</div>
            <div className="mt-1 text-2xl font-bold text-rose-600">{stats.wrongCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">체감 어려움</div>
            <div className="mt-1 text-2xl font-bold text-orange-600">{stats.hardCount}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs font-medium text-slate-500">메모 작성 완료</div>
            <div className="mt-1 text-2xl font-bold text-emerald-600">{stats.notedCount}</div>
          </div>
        </div>

        {/* 필터 바 */}
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedSubCategory('ALL');
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="ALL">전체 과목</option>
            {subjectOptions.map((subj) => (
              <option key={subj} value={subj}>
                {subj}
              </option>
            ))}
          </select>

          <select
            value={selectedSubCategory}
            onChange={(e) => setSelectedSubCategory(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="ALL">전체 단원</option>
            {subCategoryOptions.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-500"
          >
            <option value="ALL">전체 난이도</option>
            {DIFFICULTIES.map((diff) => (
              <option key={diff} value={diff}>
                {diff}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="문제 지문 / 메모 검색..."
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-orange-500"
          />
        </div>

        {/* 미저장 일괄 저장 배너 */}
        {dirtyItems.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
            <span className="text-sm font-medium text-orange-900">
              수정 중인 오답노트가 <strong>{dirtyItems.length}건</strong> 있습니다.
            </span>
            <button
              type="button"
              onClick={() => void handleBulkSave()}
              disabled={bulkSaving}
              className="cursor-pointer rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {bulkSaving ? '일괄 저장 중...' : `변경된 ${dirtyItems.length}건 일괄 저장`}
            </button>
          </div>
        )}

        {/* 토스트 및 에러 알림 */}
        {toastMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {toastMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* 본문: 로딩 / 빈 상태 / 오답 카드 리스트 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-slate-500">
            <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500" />
            <p className="text-sm font-medium">오답노트를 불러오는 중입니다...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center">
            <p className="text-base font-semibold text-slate-800">
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
              className="mt-5 cursor-pointer rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
            >
              {items.length === 0 ? '문제 풀러 가기' : '필터 초기화'}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
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
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
                >
                  {/* 카드 상단 메타 헤더 */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          item.isCorrect
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {item.isCorrect ? '정답' : '오답'}
                      </span>
                      <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                        {item.subjectType || '기타'}
                      </span>
                      <span className="rounded-md bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {item.subCategory || '기타'}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${difficultyBadgeStyle(
                          draft.userDifficulty,
                        )}`}
                      >
                        체감: {draft.userDifficulty}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400">
                      최근 풀이: {formatKstDate(item.solvedAt)}
                    </span>
                  </div>

                  {/* 문제 지문 및 선택지 */}
                  <div className="p-5">
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed font-semibold text-slate-900">
                      {item.content ?? '(삭제되었거나 원문을 찾을 수 없는 문제입니다.)'}
                    </p>

                    {item.choices && item.choices.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {item.choices.map((choice, cIdx) => {
                          const choiceNum = cIdx + 1;
                          const isAnswer = showSolution && item.correctAnswer === choiceNum;
                          return (
                            <li
                              key={cIdx}
                              className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ${
                                isAnswer
                                  ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-900'
                                  : 'border-slate-200 bg-white text-slate-700'
                              }`}
                            >
                              <span
                                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  isAnswer
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {choiceNum}
                              </span>
                              <span className="flex-1 whitespace-pre-wrap">{choice}</span>
                              {isAnswer && (
                                <span className="shrink-0 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                  정답
                                </span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* 복습 가림 모드일 때 개별 정답/해설 토글 */}
                    {hideAnswers && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => toggleCardReveal(item.problemId)}
                          className="cursor-pointer rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          {showSolution ? '정답 · 해설 숨기기' : '정답 · 해설 확인하기'}
                        </button>
                      </div>
                    )}

                    {/* AI 해설 영역 */}
                    {showSolution && item.explanation && (
                      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4">
                        <div className="mb-1 flex items-center gap-2 text-xs font-bold text-sky-800">
                          <span>정답: {item.correctAnswer ?? '-'}번</span>
                          <span>·</span>
                          <span>해설</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {item.explanation}
                        </p>
                      </div>
                    )}

                    {/* 체감 난이도 & 복습 메모 편집 영역 */}
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700">체감 난이도</span>
                        <div className="flex items-center gap-1.5">
                          {DIFFICULTIES.map((level) => {
                            const active = draft.userDifficulty === level;
                            return (
                              <button
                                key={level}
                                type="button"
                                onClick={() =>
                                  updateDraft(item.problemId, { userDifficulty: level })
                                }
                                className={`cursor-pointer rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                                  active
                                    ? 'border-orange-500 bg-orange-500 text-white'
                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
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
                        placeholder="예: 조건 A와 B를 혼동함. 핵심 키워드 다시 정리..."
                        className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      />

                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {isDirty ? (
                            <span className="text-orange-600">● 변경 사항 있음 (저장 필요)</span>
                          ) : isSavedNotice ? (
                            <span className="text-emerald-600">✓ 저장 완료</span>
                          ) : (
                            <span className="text-slate-400">저장된 상태</span>
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() => void handleSaveSingle(item)}
                          disabled={isSaving || !isDirty}
                          className="cursor-pointer rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
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
    </div>
  );
}