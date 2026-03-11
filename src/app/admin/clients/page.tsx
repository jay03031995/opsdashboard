'use client';

import { useState, useEffect } from 'react';
import { Plus, User, Folder } from 'lucide-react';
import toast from 'react-hot-toast';

interface Client {
  id: string;
  name: string;
  oneDriveFolder: string | null;
  editor?: { id: string; name: string | null; email: string };
}

interface Editor {
  id: string;
  name: string | null;
  email: string;
  role?: 'EDITOR' | 'GRAPHIC_DESIGNER';
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [savingClientId, setSavingClientId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', oneDriveFolder: '', editorId: '' });
  const [editingClient, setEditingClient] = useState({ id: '', name: '', oneDriveFolder: '', editorId: '' });

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/admin/clients');
      const data = await res.json();
      if (!res.ok) {
        setClients([]);
        toast.error(data?.error || 'Failed to fetch clients');
        return;
      }

      if (Array.isArray(data)) {
        setClients(data);
        const draft: Record<string, string> = {};
        for (const client of data) {
          draft[client.id] = client.editor?.id || '';
        }
        setMappingDraft(draft);
      } else {
        setClients([]);
        toast.error('Unexpected clients response');
      }
    } catch (err) {
      setClients([]);
      toast.error('Failed to fetch clients');
      console.error(err);
    }
  };

  const saveMapping = async (clientId: string) => {
    try {
      setSavingClientId(clientId);
      const res = await fetch('/api/admin/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: clientId,
          editorId: mappingDraft[clientId] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to update mapping');
        return;
      }
      toast.success('Client-editor mapping saved');
      fetchClients();
    } catch (error) {
      toast.error('Failed to update mapping');
      console.error(error);
    } finally {
      setSavingClientId(null);
    }
  };

  const openEditClient = (client: Client) => {
    setEditingClient({
      id: client.id,
      name: client.name,
      oneDriveFolder: client.oneDriveFolder || '',
      editorId: client.editor?.id || '',
    });
    setShowEditModal(true);
  };

  const saveClientDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient.id) return;

    try {
      setSavingClientId(editingClient.id);
      const res = await fetch('/api/admin/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingClient.id,
          name: editingClient.name,
          oneDriveFolder: editingClient.oneDriveFolder,
          editorId: editingClient.editorId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to update client');
        return;
      }
      toast.success('Client updated');
      setShowEditModal(false);
      fetchClients();
    } catch (error) {
      toast.error('Failed to update client');
      console.error(error);
    } finally {
      setSavingClientId(null);
    }
  };

  const fetchEditors = async () => {
    try {
      const res = await fetch('/api/admin/editors');
      const data = await res.json();
      if (!res.ok) {
        setEditors([]);
        toast.error(data?.error || 'Failed to fetch editors');
        return;
      }
      if (Array.isArray(data)) {
        setEditors(data);
      } else {
        setEditors([]);
        toast.error('Unexpected editors response');
      }
    } catch (err) {
      setEditors([]);
      toast.error('Failed to fetch editors');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchEditors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Client added');
        setShowModal(false);
        setNewClient({ name: '', oneDriveFolder: '', editorId: '' });
        fetchClients();
      } else {
        toast.error(data?.error || 'Failed to add client');
      }
    } catch (err) {
      toast.error('Failed to add client');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Clients</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">OneDrive Folder</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Editor Access</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-slate-500">No clients mapped yet.</td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{client.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="inline-flex items-center">
                      <Folder className="mr-2 h-4 w-4" />
                      {client.oneDriveFolder || 'No folder set'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="inline-flex items-center">
                      <User className="mr-2 h-4 w-4 text-slate-500" />
                      <select
                        className="rounded-lg border border-slate-200 p-2 text-sm"
                        value={mappingDraft[client.id] || ''}
                        onChange={(e) => setMappingDraft({ ...mappingDraft, [client.id]: e.target.value })}
                      >
                        <option value="">Unassigned</option>
                        {editors.map((editor) => (
                          <option key={editor.id} value={editor.id}>
                            {editor.name || editor.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {mappingDraft[client.id] ? 'EDITOR' : 'UNASSIGNED'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => saveMapping(client.id)}
                        disabled={savingClientId === client.id}
                        className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {savingClientId === client.id ? 'Saving...' : 'Save Mapping'}
                      </button>
                      <button
                        onClick={() => openEditClient(client)}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        You can create multiple content calendar events on the same date from the Task Board page. Each event maps to one client and its assigned editor.
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Add New Client</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Client Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">OneDrive Folder (Path or Share URL)</label>
                <input
                  type="text"
                  placeholder="Clients/ClientName or https://1drv.ms/..."
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={newClient.oneDriveFolder}
                  onChange={(e) => setNewClient({ ...newClient, oneDriveFolder: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Assign Editor</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={newClient.editorId}
                  onChange={(e) => setNewClient({ ...newClient, editorId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {editors.map((editor) => (
                    <option key={editor.id} value={editor.id}>
                      {(editor.name || editor.email) + (editor.role ? ` (${editor.role})` : '')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Client</h2>
            <form onSubmit={saveClientDetails} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Client Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">OneDrive Folder (Path or Share URL)</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={editingClient.oneDriveFolder}
                  onChange={(e) => setEditingClient({ ...editingClient, oneDriveFolder: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Assign Member</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  value={editingClient.editorId}
                  onChange={(e) => setEditingClient({ ...editingClient, editorId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {editors.map((editor) => (
                    <option key={editor.id} value={editor.id}>
                      {(editor.name || editor.email) + (editor.role ? ` (${editor.role})` : '')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClientId === editingClient.id}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {savingClientId === editingClient.id ? 'Saving...' : 'Save Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
