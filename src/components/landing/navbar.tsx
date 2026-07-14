'use client';

import { useState, useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useAppStore, type DashboardPanel, type AdminPanel } from '@/lib/store';
import { useSiteSettings } from '@/lib/use-site-settings';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Menu,
  Sun,
  Moon,
  LogIn,
  LayoutDashboard,
  FilePlus,
  LogOut,
  Handshake,
  ArrowLeftRight,
  UserCircle,
  ShieldCheck,
  CreditCard,
  Users,
  Settings,
  Receipt,
  MessageCircle,
  FileText,
  Headphones,
  BookOpen,
} from 'lucide-react';

const emptySubscribe = () => () => {};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <button className="flex h-9 w-9 items-center justify-center rounded-lg" aria-label="থিম পরিবর্তন">
        <span className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="থিম পরিবর্তন"
    >
      {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}

function LogoButton({ onClick }: { onClick: () => void }) {
  const { siteName, siteLogo } = useSiteSettings();
  return (
    <button onClick={onClick} className="flex items-center gap-2.5">
      <img
        src={siteLogo}
        alt={siteName}
        className="h-9 w-9 rounded-lg object-contain"
      />
      <span className="text-lg font-bold tracking-tight text-foreground">{siteName}</span>
    </button>
  );
}

function MobileBrandHeader({ sub }: { sub?: string }) {
  const { siteName, siteLogo } = useSiteSettings();
  return (
    <div className="mb-4 flex items-center gap-2.5 px-1">
      <img
        src={siteLogo}
        alt={siteName}
        className="h-9 w-9 rounded-lg object-contain"
      />
      {sub ? (
        <div>
          <p className="text-base font-bold tracking-tight text-foreground">{siteName}</p>
          <p className="text-[10px] font-semibold tracking-widest text-primary">{sub}</p>
        </div>
      ) : (
        <p className="text-base font-bold tracking-tight text-foreground">{siteName}</p>
      )}
    </div>
  );
}

/* ── Dashboard mobile nav items (mirrors sidebar) ── */
const dashboardNavItems: { label: string; icon: React.ElementType; panel: string }[] = [
  { label: 'ড্যাশবোর্ড', icon: LayoutDashboard, panel: 'overview' },
  { label: 'আমার ডিল', icon: Handshake, panel: 'my-deals' },
  { label: 'লেনদেন', icon: ArrowLeftRight, panel: 'payment' },
  { label: 'প্রোফাইল', icon: UserCircle, panel: 'profile' },
  { label: 'সেটিংস', icon: Settings, panel: 'settings' },
];

/* ── Admin mobile nav items (mirrors sidebar) ── */
const adminNavItems: { label: string; icon: React.ElementType; panel: string }[] = [
  { label: 'ড্যাশবোর্ড', icon: LayoutDashboard, panel: 'dashboard' },
  { label: 'পেমেন্ট ভেরিফিকেশন', icon: ShieldCheck, panel: 'payment-verify' },
  { label: 'লাইভ চ্যাট', icon: Headphones, panel: 'admin-calls' },
  { label: 'পেমেন্ট মেথড', icon: CreditCard, panel: 'payment-methods' },
  { label: 'ফি কাঠামো', icon: Receipt, panel: 'fee-rules' },
  { label: 'সকল ডিল', icon: Handshake, panel: 'all-deals' },
  { label: 'ইউজার ম্যানেজমেন্ট', icon: Users, panel: 'users' },
  { label: 'যোগাযোগ', icon: MessageCircle, panel: 'contact-info' },
  { label: 'ওয়েবসাইট সেটিংস', icon: Settings, panel: 'settings' },
  { label: 'চুক্তি পেজ', icon: FileText, panel: 'contract' },
  { label: 'ব্লগ', icon: BookOpen, panel: 'blog' },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { view, user, logout, setView, setDashboardPanel, setAdminPanel, dashboardPanel, adminPanel, activeDeal } = useAppStore();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const isAdmin = view === 'admin';
  const isAuth = view === 'auth' || view === 'dashboard';
  const isDashboard = view === 'dashboard' && user;
  const isSidebarView = isDashboard || isAdmin;

  const isInfoPage = view === 'blog' || view.startsWith('page-');

  const handleLogoClick = () => {
    if (isDashboard) setDashboardPanel('overview');
    else if (isAdmin) setAdminPanel('dashboard');
    else setView('landing');
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    logout();
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <nav
        className={`relative h-16 items-center justify-between px-4 sm:px-6 ${
          isSidebarView ? 'flex lg:pl-0' : 'mx-auto flex max-w-6xl md:px-8'
        }`}
      >
        {/* ── Desktop: Logo aligned with sidebar (dashboard / admin) ── */}
        {isSidebarView && (
          <div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:pl-5">
            <LogoButton onClick={handleLogoClick} />
          </div>
        )}

        {/* ── Main content area ── */}
        <div
          className={`flex items-center ${
            isSidebarView
              ? 'flex-1 lg:justify-end lg:px-0'
              : ''
          }`}
        >
          {/* Landing / Auth logo */}
          {!isSidebarView && <LogoButton onClick={handleLogoClick} />}

          {/* Mobile-only logo for dashboard / admin */}
          {isSidebarView && (
            <div className="lg:hidden">
              <LogoButton onClick={handleLogoClick} />
            </div>
          )}

          {/* ── Desktop Nav: Dashboard ── */}
          {isDashboard && mounted && (
            <div className="hidden items-center gap-1.5 md:flex">
              <button
                onClick={() => setDashboardPanel('overview')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden xl:inline">ড্যাশবোর্ড</span>
              </button>
              <button
                onClick={() => setDashboardPanel('new-deal')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary bg-primary/10 transition-colors hover:bg-primary/15"
              >
                <FilePlus className="h-4 w-4" />
                <span className="hidden xl:inline">নতুন ডিল</span>
              </button>
              <div className="mx-1 h-5 w-px bg-border/60" />
              <ThemeToggle />
              <button
                onClick={() => setDashboardPanel('profile')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary hover:bg-primary/25 transition-colors"
                aria-label="প্রোফাইল"
              >
                {user?.name?.charAt(0) || 'ই'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden xl:inline">লগআউট</span>
              </button>
            </div>
          )}

          {/* ── Desktop Nav: Admin ── */}
          {isAdmin && mounted && (
            <div className="hidden items-center gap-2 md:flex">
              <ThemeToggle />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">A</div>
              <button
                onClick={() => setView('dashboard')}
                className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                <LogOut className="h-4 w-4" />
                এক্সিট অ্যাডমিন
              </button>
            </div>
          )}
        </div>

        {/* ── Center: Landing Desktop Nav Links (direct child of nav for proper absolute centering) ── */}
        {!isAuth && !isAdmin && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden items-center gap-1 md:flex">
            <a href="/security" onClick={(e) => { e.preventDefault(); setView('page-security'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              বৈশিষ্ট্য
            </a>
            <a href="/fees" onClick={(e) => { e.preventDefault(); setView('page-fees'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              ফি কাঠামো
            </a>
            <a href="/how-it-works" onClick={(e) => { e.preventDefault(); setView('page-how-it-works'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              কিভাবে কাজ করে
            </a>
            <a href="/faq" onClick={(e) => { e.preventDefault(); setView('page-faq'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              FAQ
            </a>
            <a href="/blog" onClick={(e) => { e.preventDefault(); setView('blog'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              ব্লগ
            </a>
            <a href="/about" onClick={(e) => { e.preventDefault(); setView('page-about'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              আমাদের সম্পর্কে
            </a>
            <a href="/contact" onClick={(e) => { e.preventDefault(); setView('page-contact'); }} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
              যোগাযোগ
            </a>
          </div>
        )}

        {/* ── Right: Landing Desktop Buttons (direct child of nav) ── */}
        {!isAuth && !isAdmin && (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <ThemeToggle />
            <Button size="sm" onClick={() => setView('auth')} className="gap-2 rounded-lg font-medium shadow-md shadow-primary/20">
              <LogIn className="h-4 w-4" />
              লগইন / নিবন্ধন
            </Button>
          </div>
        )}

        {/* ── Mobile Menu (single hamburger for all views) ── */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="মেনু খুলুন">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 overflow-y-auto">
                <SheetTitle className="sr-only">নেভিগেশন মেনু</SheetTitle>
                <nav className="flex flex-col gap-1 pt-8">
                  {/* ── Dashboard Mobile Nav ── */}
                  {isDashboard && (
                    <>
                      {/* Brand Header */}
                      <MobileBrandHeader sub="DASHBOARD" />

                      {/* CTA: New Deal */}
                      <button
                        onClick={() => { setDashboardPanel('new-deal'); setOpen(false); }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition-colors hover:bg-primary/90"
                      >
                        <FilePlus className="h-4 w-4" />
                        নতুন ডিল তৈরি করুন
                      </button>

                      <div className="my-2 h-px bg-border/60" />

                      {/* Nav Items */}
                      {dashboardNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = dashboardPanel === item.panel;
                        return (
                          <button
                            key={item.label}
                            onClick={() => {
                              if (item.label === 'আমার ডিল' && activeDeal) {
                                setDashboardPanel('deal-detail');
                              } else {
                                setDashboardPanel(item.panel as DashboardPanel);
                              }
                              setOpen(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                              isActive
                                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                            {item.label}
                          </button>
                        );
                      })}

                      {/* User Info */}
                      <div className="my-2 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                            {user?.name?.charAt(0) || 'ই'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{user?.name || 'ইউজার'}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                          </div>
                        </div>
                      </div>

                      {/* Logout */}
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-destructive transition-all hover:bg-destructive/10"
                      >
                        <LogOut className="h-[18px] w-[18px]" />
                        লগআউট
                      </button>
                    </>
                  )}

                  {/* ── Admin Mobile Nav ── */}
                  {isAdmin && (
                    <>
                      {/* Brand Header */}
                      <MobileBrandHeader sub="ADMIN PANEL" />

                      {/* Nav Items */}
                      {adminNavItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = adminPanel === item.panel;
                        return (
                          <button
                            key={item.label}
                            onClick={() => { setAdminPanel(item.panel as AdminPanel); setOpen(false); }}
                            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                              isActive
                                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                            }`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                            {item.label}
                          </button>
                        );
                      })}

                      {/* Admin User Info */}
                      <div className="my-2 border-t border-border/50 pt-3">
                        <div className="flex items-center gap-3 rounded-xl px-4 py-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                            {user?.name?.charAt(0) || 'অ'}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{user?.name || 'অ্যাডমিন'}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email || ''}</p>
                          </div>
                        </div>
                      </div>

                      {/* Exit Admin */}
                      <button
                        onClick={() => { setView('dashboard'); setOpen(false); }}
                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                      >
                        <LogOut className="h-[18px] w-[18px]" />
                        এক্সিট অ্যাডমিন
                      </button>
                    </>
                  )}

                  {/* ── Landing Mobile Nav ── */}
                  {!isAuth && !isAdmin && (
                    <>
                      <MobileBrandHeader />

                      <a href="/security" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-security'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        বৈশিষ্ট্য
                      </a>
                      <a href="/fees" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-fees'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        ফি কাঠামো
                      </a>
                      <a href="/how-it-works" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-how-it-works'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        কিভাবে কাজ করে
                      </a>
                      <a href="/faq" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-faq'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        FAQ
                      </a>
                      <a href="/blog" onClick={(e) => { e.preventDefault(); setOpen(false); setView('blog'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        ব্লগ
                      </a>
                      <a href="/about" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-about'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        আমাদের সম্পর্কে
                      </a>
                      <a href="/contact" onClick={(e) => { e.preventDefault(); setOpen(false); setView('page-contact'); }} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-accent">
                        যোগাযোগ
                      </a>
                      <div className="mt-4 border-t border-border pt-4">
                        <Button onClick={() => { setOpen(false); setView('auth'); }} className="w-full gap-2 rounded-lg font-medium">
                          <LogIn className="h-4 w-4" /> লগইন / নিবন্ধন
                        </Button>
                      </div>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
      </nav>
    </header>
  );
}