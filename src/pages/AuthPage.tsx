import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { extractErrorMessage, loginApi, signupApi } from '../api/client';
import { isAuthenticated, saveAuthUser } from '../utils/authStorage';

type AuthMode = 'login' | 'signup';

interface LocationState {
  from?: string;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const [mode, setMode] = useState<AuthMode>(
    location.pathname === '/signup' ? 'signup' : 'login',
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [name, setName] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate(state?.from || '/', { replace: true });
    }
  }, [navigate, state?.from]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
    setPasswordConfirm('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim();
    const trimmedName = name.trim();

    if (!trimmedEmail || !password) {
      setErrorMsg('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (mode === 'signup') {
      if (!trimmedName) {
        setErrorMsg('이름을 입력해 주세요.');
        return;
      }
      if (password.length < 4) {
        setErrorMsg('비밀번호는 4자 이상 입력해 주세요.');
        return;
      }
      if (password !== passwordConfirm) {
        setErrorMsg('비밀번호 확인이 일치하지 않습니다.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        await signupApi({
          email: trimmedEmail,
          password,
          name: trimmedName,
        });
        setMode('login');
        setPassword('');
        setPasswordConfirm('');
        setSuccessMsg('회원가입이 완료되었습니다. 가입한 이메일로 로그인해 주세요.');
      } else {
        const res = await loginApi({
          email: trimmedEmail,
          password,
        });
        saveAuthUser({
          token: res.token,
          userId: res.userId,
          email: res.email,
          name: res.name,
        });
        navigate(state?.from || '/', { replace: true });
      }
    } catch (err: unknown) {
      setErrorMsg(
        extractErrorMessage(
          err,
          mode === 'signup' ? '회원가입에 실패했습니다.' : '로그인에 실패했습니다.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-xl font-extrabold text-white shadow-xs">
            감
          </div>
          <h1 className="text-2xl font-bold text-slate-900">감귤 백전전승</h1>
          <p className="mt-1 text-sm text-slate-500">
            AI 맞춤 문제 출제 · 자동 채점 · 개인 오답노트
          </p>
        </div>

        {/* 탭 전환 */}
        <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`cursor-pointer rounded-lg py-2 text-sm font-semibold transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`cursor-pointer rounded-lg py-2 text-sm font-semibold transition-all ${
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            회원가입
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                이름
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                autoComplete="name"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1.5 block text-sm font-medium text-slate-700">
              이메일
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              비밀번호
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-password-confirm"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                비밀번호 확인
              </label>
              <input
                id="auth-password-confirm"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="비밀번호 다시 입력"
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full cursor-pointer rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? mode === 'login'
                ? '로그인 중...'
                : '가입 처리 중...'
              : mode === 'login'
                ? '로그인'
                : '회원가입 완료'}
          </button>
        </form>
      </div>
    </div>
  );
}