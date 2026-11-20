import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Bell, BookOpen, ChevronDown, ChevronLeft, GraduationCap, Home, Menu, MessageCircle, Moon, Search, Settings, ShieldCheck, Sun, X, FolderOpen, ListChecks, type LucideIcon } from 'lucide-react';
import type { AppUser } from '../../types';

export interface AppNavItem { id: string; label: string; icon: LucideIcon }
export interface AppNavGroup { title: string; items: AppNavItem[] }
export interface AppSearchResult { id: string; title: string; sub: string; page: string }
interface AppShellProps {
  children: ReactNode; user: AppUser; page: string; pageTitle: string;
  navGroups: AppNavGroup[]; isAdmin: boolean; dark: boolean; search: string;
  searchResults: AppSearchResult[]; unreadCount: number; mobileNav: boolean;
  onSearch: (value: string) => void; onNavigate: (page: string) => void;
  onToggleTheme: () => void; onOpenMobileNav: () => void; onCloseMobileNav: () => void;
}

export function AppShell({ children, user, page, pageTitle, navGroups, isAdmin, dark, search, searchResults, unreadCount, mobileNav, onSearch, onNavigate, onToggleTheme, onOpenMobileNav, onCloseMobileNav }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('enghub-sidebar-collapsed') === '1');
  const [termOpen, setTermOpen] = useState(false);
  const initials = user.displayName.trim().slice(0, 1) || 'ط';
  const all = navGroups.flatMap(group => group.items);
  const find = (id: string, fallback: AppNavItem): AppNavItem => all.find(item => item.id === id) ?? fallback;
  const groups: AppNavGroup[] = [
    { title: 'الرئيسية والدراسة', items: [
      find('home', { id: 'home', label: 'الرئيسية', icon: Home }),
      find('courses', { id: 'courses', label: 'المواد الدراسية', icon: BookOpen }),
      find('tasks', { id: 'tasks', label: 'المهام', icon: ListChecks }),
      find('chat', { id: 'chat', label: 'الدردشة', icon: MessageCircle }),
      { id: 'profile', label: 'الملف الشخصي', icon: Settings },
    ] },
    { title: 'المكتبة والأدوات', items: [
      { id: 'files', label: 'مكتبة الملفات', icon: FolderOpen },
      ...all.filter(item => ['focus', 'planner', 'analytics', 'exams'].includes(item.id)),
    ] },
    ...(isAdmin ? [{ title: 'إدارة المنصة', items: [
      find('admin', { id: 'admin', label: 'لوحة الإدارة', icon: ShieldCheck }),
    ] }] : []),
  ];
  const mobile = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'courses', label: 'المواد', icon: BookOpen },
    { id: 'tasks', label: 'المهام', icon: ListChecks },
    { id: 'chat', label: 'الدردشة', icon: MessageCircle },
    { id: 'profile', label: 'حسابي', icon: Settings },
  ];
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.ref-search input')?.focus();
      }
      if (event.key === 'Escape') { onCloseMobileNav(); onSearch(''); setTermOpen(false); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onCloseMobileNav, onSearch]);
  useEffect(() => { setTermOpen(false); }, [page]);
  const goHome = () => { onNavigate('home'); onCloseMobileNav(); };
  const toggleCollapsed = () => setCollapsed(value => {
    window.localStorage.setItem('enghub-sidebar-collapsed', value ? '0' : '1');
    return !value;
  });
  return (
    <div className={`eh-app ${dark ? 'eh-dark theme-dark ref-dark' : 'eh-light theme-light ref-light'} ref-app ${collapsed ? 'ref-collapsed' : ''}`} dir="rtl">
      <aside className={`ref-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="القائمة الرئيسية">
        <div className="ref-brand-row">
          <button type="button" className="ref-brand" onClick={goHome} aria-label="العودة إلى الرئيسية">
            <img src={`${import.meta.env.BASE_URL}brand/enghub-mark.svg`} alt="" />
            <span><b><i>ENG</i> HUB</b><small>CAIRO UNIVERSITY</small></span>
          </button>
          <button type="button" className="ref-icon-btn ref-close-mobile" onClick={onCloseMobileNav} aria-label="إغلاق القائمة"><X size={18}/></button>
        </div>
        <nav className="ref-side-nav" aria-label="التنقل الرئيسي">
          {groups.map(group => group.items.length > 0 && (
            <section className="ref-nav-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map(item => {
                const Icon = item.icon;
                const active = page === item.id || (item.id === 'courses' && ['lectures', 'subject', 'lecture'].includes(page));
                return <button type="button" key={item.id} className={`ref-nav-link ${active ? 'active' : ''}`} onClick={() => { onNavigate(item.id); onCloseMobileNav(); }} aria-current={active ? 'page' : undefined}>
                  <Icon size={18}/><span>{item.label}</span>{active && <i/>}
                </button>;
              })}
            </section>
          ))}
        </nav>
        <div className="ref-sidebar-foot">
          <button type="button" className="ref-user-card" onClick={() => { onNavigate('profile'); onCloseMobileNav(); }}>
            <span className="ref-avatar">{user.photoURL ? <img src={user.photoURL} alt=""/> : initials}</span>
            <span className="ref-user-meta"><b>{user.displayName}</b><small>{isAdmin ? 'مدير المنصة' : 'طالب هندسة'}</small></span>
            <Settings size={16}/>
          </button>
          <div className="ref-term-wrap">
            <button type="button" className="ref-term" aria-expanded={termOpen} onClick={() => setTermOpen(value => !value)}>
              <span className="ref-term-icon"><GraduationCap size={19}/></span>
              <span><b>{user.term || 'الترم الأول'}</b><small>{user.academicYear || 'السنة الإعدادية'} · جامعة القاهرة</small></span>
              <ChevronDown size={15}/>
            </button>
            {termOpen && <div className="ref-term-menu"><b>الفصل الدراسي الحالي</b><span>{user.term || 'الترم الأول'} · {user.academicYear || 'السنة الإعدادية'}</span><small>يمكن تغيير بيانات الفصل من إعدادات الحساب عند توفرها.</small></div>}
          </div>
        </div>
      </aside>
      {mobileNav && <button type="button" className="ref-scrim" onClick={onCloseMobileNav} aria-label="إغلاق القائمة"/>}
      <section className="ref-workspace">
        <header className="ref-topbar">
          <div className="ref-top-leading">
            <button type="button" className="ref-icon-btn ref-mobile-menu" onClick={onOpenMobileNav} aria-label="فتح القائمة"><Menu size={20}/></button>
            <button type="button" className="ref-icon-btn ref-collapse-btn" onClick={toggleCollapsed} aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}><ChevronLeft size={18}/></button>
            <div className="ref-crumb"><span>ENG HUB</span><ChevronLeft size={14}/><b>{page === 'home' ? `مرحباً، ${user.displayName.trim().split(/\\s+/)[0]}` : pageTitle}</b></div>
          </div>
          <div className="ref-top-actions">
            <div className="ref-search-wrap">
              <label className="ref-search"><Search size={17}/><input value={search} onChange={event => onSearch(event.target.value)} placeholder="ابحث عن مادة أو محاضرة أو مهمة" aria-label="البحث"/><kbd>⌘ K</kbd></label>
              {search.trim() && <div className="ref-search-results">{searchResults.length ? searchResults.map(result => <button type="button" key={result.page + result.id} onClick={() => { onSearch(''); onNavigate(result.page); }}><span><b>{result.title}</b><small>{result.sub}</small></span><ArrowLeft size={15}/></button>) : <p>لا توجد نتائج مطابقة</p>}</div>}
            </div>
            <button type="button" className="ref-icon-btn" onClick={onToggleTheme} aria-label="تغيير المظهر">{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
            <button type="button" className="ref-icon-btn ref-notification" onClick={() => onNavigate('notifications')} aria-label="الإشعارات"><Bell size={19}/>{unreadCount > 0 && <i/>}</button>
            <button type="button" className="ref-avatar ref-top-avatar" onClick={() => onNavigate('profile')} aria-label="الملف الشخصي">{user.photoURL ? <img src={user.photoURL} alt=""/> : initials}</button>
          </div>
        </header>
        <main className="ref-content">{children}</main>
        <nav className="ref-bottom-nav" aria-label="التنقل على الهاتف">
          {mobile.map(item => { const Icon = item.icon; const active = page === item.id || (item.id === 'courses' && ['lectures', 'subject', 'lecture'].includes(page)); return <button type="button" key={item.id} className={active ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon size={19}/><span>{item.label}</span></button>; })}
        </nav>
      </section>
    </div>
  );
}
