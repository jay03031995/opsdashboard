'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link2, MessageCircleMore, RefreshCw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

type ChatMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  text: string;
  type: 'MESSAGE' | 'DOUBT';
  taskId: string | null;
  taskLabel: string | null;
  mentions: { id: string; name: string }[];
  createdAt: string;
};

type ChatUser = {
  id: string;
  name: string;
  email?: string;
  role: string;
};

type ChatTask = {
  id: string;
  label: string;
  date: string;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TeamChatPanel({ calendarLink }: { calendarLink: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [tasks, setTasks] = useState<ChatTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [taskId, setTaskId] = useState('');
  const [text, setText] = useState('');
  const [isDoubt, setIsDoubt] = useState(false);
  const [mentionIds, setMentionIds] = useState<string[]>([]);

  const selectedMentions = useMemo(
    () => users.filter((user) => mentionIds.includes(user.id)),
    [mentionIds, users]
  );

  const fetchChat = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/team/chat', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to load chat');
        return;
      }
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      setUsers(Array.isArray(data?.users) ? data.users : []);
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch {
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChat();
    const timer = setInterval(fetchChat, 8000);
    return () => clearInterval(timer);
  }, [fetchChat]);

  const toggleMention = (id: string, name: string) => {
    setMentionIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (!text.includes(`@${name}`)) {
        setText((current) => (current ? `${current} @${name}` : `@${name}`));
      }
      return [...prev, id];
    });
  };

  const sendMessage = async () => {
    if (!text.trim()) {
      toast.error('Write a message');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/team/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          taskId: taskId || null,
          mentionIds,
          type: isDoubt ? 'DOUBT' : 'MESSAGE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to send message');
        return;
      }

      setMessages((prev) => [...prev, data]);
      setText('');
      setTaskId('');
      setMentionIds([]);
      setIsDoubt(false);
      toast.success('Message sent');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team Chat</h1>
            <p className="mt-1 text-sm text-slate-500">Discuss tasks, tag members, ask doubts, and track updates in one place.</p>
          </div>
          <button
            onClick={fetchChat}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <MessageCircleMore className="h-4 w-4" />
            Conversation
          </div>
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No messages yet. Start the team conversation.
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{msg.authorName}</span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        {msg.authorRole}
                      </span>
                      {msg.type === 'DOUBT' && (
                        <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                          Doubt
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">{formatTime(msg.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{msg.text}</p>

                  {(msg.taskLabel || msg.mentions.length > 0) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {msg.taskLabel && (
                        <a
                          href={calendarLink}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {msg.taskLabel}
                        </a>
                      )}
                      {msg.mentions.map((mention) => (
                        <span key={`${msg.id}-${mention.id}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700">
                          @{mention.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Tag Task</label>
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm"
              >
                <option value="">No task tag</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Tag Team Members</div>
              <div className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={mentionIds.includes(user.id)}
                      onChange={() => toggleMention(user.id, user.name)}
                    />
                    <span className="truncate">{user.name}</span>
                    <span className="text-xs text-slate-500">({user.role})</span>
                  </label>
                ))}
              </div>
              {selectedMentions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedMentions.map((user) => (
                    <span key={user.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">
                      @{user.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Message</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write update, doubt, or task note..."
                rows={6}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
              />
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={isDoubt} onChange={(e) => setIsDoubt(e.target.checked)} />
              Mark this as doubt/question
            </label>

            <button
              onClick={sendMessage}
              disabled={sending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

