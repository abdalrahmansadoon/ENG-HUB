import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft, Bell, ChevronDown, ChevronLeft, Command, Menu, PanelLeftClose, PanelLeftOpen,
  Moon, Search, Settings, ShieldCheck, Sun, X, type LucideIcon,
} from 'lucide-react';
import type { AppUser } from '../../types';

export interface AppNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}
export interface AppNavGroup {
  title: string;
  items: AppNavItem[];
}
export interface AppSearchResult {
  id: string;
  title: string;
  sub: string;
  page: string;
}

interface AppShellProps {
  children: ReactNode;
  user: AppUser;
  page: string;
  pageTitle: string;
  navGroups: AppNavGroup[];
  isAdmin: boolean;
  dark: boolean;
  search: string;
  searchResults: AppSearchResult[];
  unreadCount: number;
  mobileNav: boolean;
  onSearch: (value: string) => void;
  onNavigate: (page: string) => void;
  onToggleTheme: () => void;
  onOpenMobileNav: () => void;
  onCloseMobileNav: () => void;
}

export function AppShell({
  children, user, page, pageTitle, navGroups, isAdmin, dark, search,
  searchResults, unreadCount, mobileNav, onSearch, onNavigate, onToggleTheme,
  onOpenMobileNav, onCloseMobileNav,
}: AppShellProps) {
  const initials = user.displayName.trim().slice(0, 1) || 'ط';
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem('enghub-sidebar-collapsed') === '1');
  const toggleCollapsed = () => setCollapsed((value) => { window.localStorage.setItem('enghub-sidebar-collapsed', value ? '0' : '1'); return !value; });
  const rootNav = [...navGroups.flatMap((group) => group.items), ...(isAdmin ? [{ id: 'admin', label: 'لوحة الإدارة', icon: ShieldCheck }] : [])];
  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.eh-search input')?.focus();
      }
      if (event.key === 'Escape') {
        onCloseMobileNav();
        const searchInput = document.querySelector<HTMLInputElement>('.eh-search input');
        if (searchInput && document.activeElement === searchInput) {
          onSearch('');
          searchInput.blur();
        }
      }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [onCloseMobileNav, onSearch]);

  const mobileItems = ['home', 'courses', 'tasks', 'focus', 'chat']
    .map((id) => rootNav.find((item) => item.id === id) ?? (id === 'profile' ? { id, label: 'حسابي', icon: Settings } : null))
    .filter(Boolean) as AppNavItem[];

  return (
    <div className={`eh-app ${dark ? 'eh-dark theme-dark' : 'eh-light theme-light'} ${collapsed ? 'eh-sidebar-collapsed' : ''}`} dir="rtl">
      <aside className={`eh-sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="القائمة الرئيسية">
        <div className="eh-brand">
          <div className="eh-brand-symbol"><img src={`${import.meta.env.BASE_URL}brand/enghub-mark.svg`} alt="ENG HUB"/></div>
          <div className="eh-brand-copy"><strong>ENG HUB</strong><span>STUDY · ENGINEER · GROW</span></div>
          <button type="button" className="eh-icon-btn eh-sidebar-close" onClick={onCloseMobileNav} aria-label="إغلاق القائمة"><X size={19}/></button>
        </div>

        <details className="eh-term-switcher" title="السنة والفصل الدراسي الحالي"><summary className="eh-term-card"><span className="eh-term-symbol"><Command size={17}/></span><span><b>{user.term || 'الترم الأول'}</b><small>{user.academicYear || 'السنة الإعدادية'} · هندسة القاهرة</small></span><ChevronDown size={15}/></summary><div className="eh-term-menu"><span>الفصل الدراسي الحالي</span><strong>{user.term || 'الترم الأول'}</strong><small>إدارة السنوات والفصول الدراسية متاحة من إعدادات المدير.</small></div></details>

        <nav className="eh-navigation">
          {navGroups.map((group) => (
            <section className="eh-nav-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = page === item.id || (item.id === 'courses' && page === 'lectures');
                return (
                  <button type="button" key={item.id} className={`eh-nav-link ${active ? 'active' : ''}`} title={item.label} data-tooltip={item.label} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
                    <Icon size={19}/><span>{item.label}</span>{active && <i/>}
                  </button>
                );
              })}
            </section>
          ))}
          {isAdmin && (
            <section className="eh-nav-group">
              <h2>إدارة المنصة</h2>
              <button type="button" className={`eh-nav-link ${page === 'admin' ? 'active' : ''}`} title="لوحة الإدارة" data-tooltip="لوحة الإدارة" onClick={() => onNavigate('admin')}>
                <ShieldCheck size={19}/><span>لوحة الإدارة</span>{page === 'admin' && <i/>}
              </button>
            </section>
          )}
        </nav>

        <div className="eh-sidebar-bottom">

          <button type="button" className="eh-account-mini" onClick={() => onNavigate('profile')} title="الملف الشخصي" data-tooltip="الملف الشخصي">
            <span className="eh-avatar">{user.photoURL ? <img src={user.photoURL} alt=""/> : initials}</span>
            <span className="eh-account-copy"><b>{user.displayName}</b><small>{isAdmin ? 'مدير المنصة' : 'طالب هندسة'}</small></span>
            <Settings size={17}/>
          </button>
        </div>
      </aside>

      {mobileNav && <button type="button" className="eh-scrim" onClick={onCloseMobileNav} aria-label="إغلاق القائمة الجانبية"/>}

      <main className="eh-main">
        <header className="eh-topbar">
          <div className="eh-topbar-leading">
            <button type="button" className="eh-icon-btn eh-mobile-menu" onClick={onOpenMobileNav} aria-label="فتح القائمة"><Menu size={21}/></button>
            <button type="button" className="eh-icon-btn eh-sidebar-toggle" onClick={toggleCollapsed} aria-label={collapsed ? "توسيع القائمة" : "طي القائمة"} title={collapsed ? "توسيع القائمة" : "طي القائمة"}>{collapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}</button><div className="eh-breadcrumb"><span>ENG HUB</span><ChevronLeft size={14}/>{page === "home" ? <b className="eh-home-greeting">أهلاً بعودتك، {user.displayName.trim().split(/\\s+/)[0]}</b> : <b>{pageTitle}</b>}</div>
          </div>
          <div className="eh-topbar-actions">
            <div className="eh-search-wrap">
              <div className="eh-search">
                <Search size={17}/>
                <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="ابحث عن مادة أو محاضرة أو مهمة" aria-label="بحث في المنصة"/>
                <kbd>⌘ K</kbd>
              </div>
              {search.trim() && <div className="eh-search-results">
                {searchResults.length ? searchResults.map((item) => (
                  <button type="button" key={item.page + item.id} onClick={() => { onSearch(''); onNavigate(item.page); }}>
                    <span><b>{item.title}</b><small>{item.sub}</small></span><ArrowLeft size={15}/>
                  </button>
                )) : <div className="eh-search-empty">لا توجد نتائج مطابقة</div>}
              </div>}
            </div>
            <button type="button" className="eh-icon-btn" onClick={onToggleTheme} aria-label={dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button>
            <button type="button" className="eh-icon-btn eh-notification-btn" onClick={() => onNavigate('notifications')} aria-label="الإشعارات"><Bell size={19}/>{unreadCount > 0 && <i/>}</button>
            <button type="button" className="eh-avatar eh-top-avatar" onClick={() => onNavigate('profile')} aria-label="الملف الشخصي">{user.photoURL ? <img src={user.photoURL} alt=""/> : initials}</button>
          </div>
        </header>

        <div className="eh-content">{children}</div>

        <nav className="eh-mobile-nav" aria-label="تنقل الهاتف">
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id || (item.id === 'courses' && page === 'lectures');
            return <button key={item.id} type="button" className={active ? 'active' : ''} onClick={() => onNavigate(item.id)}><Icon size={19}/><span>{item.label}</span></button>;
          })}
        </nav>
      </main>
    </div>
  );
}
