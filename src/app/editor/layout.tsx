'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, LogOut, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster } from 'react-hot-toast';

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ moduleAccess?: string[] } | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          const fetchedUser = data.user as { moduleAccess?: string[] };
          setUser(fetchedUser);
          const access = new Set(fetchedUser?.moduleAccess || []);
          if (pathname === '/editor/dashboard' && !access.has('editor_dashboard')) {
            router.push('/admin/login');
            return;
          }
          if (pathname === '/editor/chat' && !access.has('team_chat')) {
            router.push('/admin/login');
            return;
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-white transition-transform">
        <div className="flex h-full flex-col px-3 py-4">
          <div className="mb-10 px-2 text-2xl font-bold text-blue-600">EditorPortal</div>
          <nav className="flex-1 space-y-1">
            {(user?.moduleAccess || []).includes('editor_dashboard') && (
              <Link
                href="/editor/dashboard"
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname === '/editor/dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <LayoutDashboard className="mr-3 h-5 w-5" />
                My Assignments
              </Link>
            )}
            {(user?.moduleAccess || []).includes('team_chat') && (
              <Link
                href="/editor/chat"
                className={cn(
                  'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname === '/editor/chat' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <MessageSquareText className="mr-3 h-5 w-5" />
                Team Chat
              </Link>
            )}
          </nav>
          <div className="mt-auto border-t pt-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      <main className="ml-64 w-full p-8">
        {children}
        <Toaster position="bottom-right" />
      </main>
    </div>
  );
}
