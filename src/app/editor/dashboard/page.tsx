'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Client {
  id: string;
  name: string;
}

interface CalendarEntry {
  id: string;
  date: string;
  videoTopic: string;
  platform: string;
  status: string;
  videoUrl: string | null;
  client: Client;
}

export default function EditorDashboard() {
  const [assignments, setAssignments] = useState<CalendarEntry[]>([]);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      const res = await fetch('/api/editor/assignments');
      const data = await res.json();
      if (!res.ok) {
        setAssignments([]);
        toast.error(data?.error || 'Failed to fetch assignments');
        return;
      }

      if (Array.isArray(data)) {
        setAssignments(data);
      } else {
        setAssignments([]);
        toast.error('Unexpected assignments response');
      }
    } catch (err) {
      setAssignments([]);
      toast.error('Failed to fetch assignments');
      console.error(err);
    }
  };

  const markComplete = async (id: string) => {
    try {
      const res = await fetch('/api/editor/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || 'Failed to mark complete');
        return;
      }

      toast.success('Task marked as complete!');
      setAssignments(assignments.map(a => a.id === id ? { ...a, status: 'COMPLETED' } : a));
    } catch (error) {
      toast.error('Failed to mark complete');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Assignments</h1>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {assignments.length === 0 ? (
          <div className="col-span-full rounded-xl border-2 border-dashed p-12 text-center text-gray-500">
            No videos assigned yet.
          </div>
        ) : (
          assignments.map((item) => (
            <div key={item.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{item.client.name}</h3>
                  <p className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${
                  item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {item.status}
                </span>
              </div>
              
              <div className="mt-4">
                <p className="font-medium text-gray-700">{item.videoTopic}</p>
                <p className="text-sm text-gray-500">Platform: {item.platform}</p>
              </div>

              <div className="mt-6 flex space-x-3">
                {item.videoUrl && (
                  <a
                    href={item.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Video
                  </a>
                )}
                {item.status !== 'COMPLETED' && (
                  <button
                    onClick={() => markComplete(item.id)}
                    className="flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
