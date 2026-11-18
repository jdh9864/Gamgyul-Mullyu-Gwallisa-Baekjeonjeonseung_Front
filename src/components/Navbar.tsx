import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clearAuthUser, getAuthUser } from '../utils/authStorage';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  const user = getAuthUser();

  const handleLogout = () => {
    clearAuthUser();
    navigate('/login', { replace: true });
  };

  const navLinkClass = (path: string) =>
    `inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2.5 py-2 text-xs font-bold transition-colors sm:px-3.5 sm:py-1.5 sm:text-sm ${
      location.pathname === path
        ? 'bg-blue-600 text-white shadow-sm'
        : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
    }`;

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-2 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 text-base font-bold text-slate-800"
            aria-label="개발자 상식 홈"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2.2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </span>
            <span className="hidden whitespace-nowrap tracking-tight sm:inline">개발자 상식</span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-1.5">
            <Link to="/" className={navLinkClass('/')}>
              문제 풀기
            </Link>
            <Link to="/review" className={navLinkClass('/review')}>
              오답노트
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <span className="hidden max-w-28 truncate text-sm text-slate-600 sm:inline">
                <strong className="font-bold text-slate-800">{user.name}</strong>님
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 sm:px-3 sm:py-1.5"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 sm:px-3.5 sm:py-1.5"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}