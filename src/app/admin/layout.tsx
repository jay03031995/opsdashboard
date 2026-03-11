'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UserSquare2,
  LayoutGrid,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster } from 'react-hot-toast';

const primaryItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin', moduleKey: 'dashboard' },
  { icon: CalendarDays, label: 'Task Board', href: '/admin/task-board', moduleKey: 'task_board' },
  { icon: Users, label: 'Clients', href: '/admin/clients', moduleKey: 'clients' },
  { icon: UserSquare2, label: 'The Team', href: '/admin/editors', moduleKey: 'team' },
  { icon: MessageSquareText, label: 'Team Chat', href: '/admin/chat', moduleKey: 'team_chat' },
];

const settingsItems = [{ icon: Settings, label: 'Configuration', href: '/admin/settings', moduleKey: 'settings' }];

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string;
  role?: string;
  roleCode?: string;
  moduleAccess?: string[];
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      if (pathname === '/admin/login') return;

      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const fetchedUser = data.user as SessionUser;
          setUser(fetchedUser);
          const access = new Set(fetchedUser?.moduleAccess || []);

          if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
            const item =
              [...primaryItems, ...settingsItems].find((nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`));
            if (item && fetchedUser?.role !== 'ADMIN' && !access.has(item.moduleKey)) {
              router.push(access.has('editor_dashboard') ? '/editor/dashboard' : '/admin/login');
            }
          }
        } else {
          router.push('/admin/login');
        }
      } catch (error) {
        router.push('/admin/login');
      }
    };

    checkAuth();
  }, [pathname, router]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  if (pathname === '/admin/login') {
    return (
      <>
        {children}
        <Toaster position="bottom-right" />
      </>
    );
  }

  const allowedAccess = new Set(user?.moduleAccess || []);
  const visiblePrimaryItems =
    user?.role === 'ADMIN'
      ? primaryItems
      : primaryItems.filter((item) => allowedAccess.has(item.moduleKey));
  const visibleSettingsItems =
    user?.role === 'ADMIN'
      ? settingsItems
      : settingsItems.filter((item) => allowedAccess.has(item.moduleKey));

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="flex min-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="p-6">
            <div className="mb-8 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white">
                <LayoutGrid className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight text-slate-900">Admin Panel</div>
                <div className="text-xs text-slate-500">Management Suite</div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {visiblePrimaryItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Settings</div>
            <nav className="mt-2 space-y-1.5">
              {visibleSettingsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    pathname === item.href
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sign Out
              </button>
            </nav>
          </div>

          <div className="mt-auto border-t border-slate-200 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                {(user?.name || user?.email || 'Admin').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">{user?.name || 'John Doe'}</div>
                <div className="text-xs text-slate-500">{user?.roleCode || 'ADMIN'}</div>
              </div>
            </div>
          </div>
        </aside>

        <main className="w-full overflow-y-auto bg-slate-100 p-6">
          {children}
          <Toaster position="bottom-right" />
        </main>
      </div>
    </div>
  );
}
