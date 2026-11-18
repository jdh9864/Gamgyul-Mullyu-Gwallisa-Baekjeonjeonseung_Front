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
    `px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
      location.pathname === path
        ? 'bg-orange-500 text-white shadow-xs'
        : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-xs font-extrabold text-white">
              감
            </span>
            <span>감귤 백전전승</span>
          </Link>

          <nav className="flex items-center gap-1.5">
            <Link to="/" className={navLinkClass('/')}>
              문제 풀기
            </Link>
            <Link to="/review" className={navLinkClass('/review')}>
              오답노트
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate-600 sm:inline">
                <strong className="font-semibold text-slate-900">{user.name}</strong>님
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}