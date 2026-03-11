'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, PlusSquare, ShieldPlus, UserSquare2 } from 'lucide-react';
import toast from 'react-hot-toast';

type TeamRoleOption = {
  code: string;
  name: string;
  system?: boolean;
};

type ModuleOption = {
  key: string;
  label: string;
};

type TeamMember = {
  id: string;
  name: string | null;
  email: string;
  role?: string;
};

type Client = {
  id: string;
  name: string;
  editor?: { id: string; name: string | null; email: string };
};

const FALLBACK_ROLES: TeamRoleOption[] = [
  { code: 'SM', name: 'Social Manager', system: true },
  { code: 'VE', name: 'Video Editor', system: true },
  { code: 'ISM', name: 'Intern Social Manager', system: true },
  { code: 'CSM', name: 'Customer Success Manager', system: true },
  { code: 'CF', name: 'Co-founder', system: true },
  { code: 'ADMIN', name: 'Founder', system: true },
];

const FALLBACK_MODULES: ModuleOption[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'task_board', label: 'Task Board' },
  { key: 'clients', label: 'Clients' },
  { key: 'team', label: 'The Team' },
  { key: 'team_chat', label: 'Team Chat' },
  { key: 'settings', label: 'Configuration' },
  { key: 'editor_dashboard', label: 'Editor Dashboard' },
];

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [roles, setRoles] = useState<TeamRoleOption[]>(FALLBACK_ROLES);
  const [canManageRoles, setCanManageRoles] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [newRole, setNewRole] = useState({ code: '', name: '' });
  const [moduleCatalog, setModuleCatalog] = useState<ModuleOption[]>(FALLBACK_MODULES);
  const [accessByRole, setAccessByRole] = useState<Record<string, string[]>>({});
  const [selectedAccessRole, setSelectedAccessRole] = useState('VE');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'VE',
    assignedClientIds: [] as string[],
  });
  const [editing, setEditing] = useState({
    id: '',
    name: '',
    email: '',
    role: 'VE',
    assignedClientIds: [] as string[],
  });

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/team/roles');
      const data = await res.json();
      if (!res.ok) return;
      const fetchedRoles = Array.isArray(data?.roles) ? data.roles : FALLBACK_ROLES;
      setRoles(fetchedRoles);
      setCanManageRoles(Boolean(data?.canManageRoles));
      setForm((prev) => ({ ...prev, role: fetchedRoles[0]?.code || 'VE' }));
      setSelectedAccessRole((prev) => prev || fetchedRoles[0]?.code || 'VE');
    } catch {
      // Keep fallback roles
    }
  }, []);

  const fetchModuleAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/team/module-access');
      const data = await res.json();
      if (!res.ok) return;
      setAccessByRole(data?.accessByRole && typeof data.accessByRole === 'object' ? data.accessByRole : {});
      if (Array.isArray(data?.moduleCatalog)) {
        setModuleCatalog(data.moduleCatalog);
      }
    } catch {
      // no-op
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/editors');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to fetch team members');
        setMembers([]);
        return;
      }
      if (Array.isArray(data)) {
        setMembers(data.map((member) => ({ ...member, role: member.role || 'VE' })));
      } else {
        setMembers([]);
      }
    } catch {
      toast.error('Failed to fetch team members');
      setMembers([]);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/clients');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to fetch clients');
        setClients([]);
        return;
      }
      if (Array.isArray(data)) {
        setClients(data);
      } else {
        setClients([]);
      }
    } catch {
      toast.error('Failed to fetch clients');
      setClients([]);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchMembers();
    fetchClients();
  }, [fetchClients, fetchMembers, fetchRoles]);

  useEffect(() => {
    if (canManageRoles) fetchModuleAccess();
  }, [canManageRoles, fetchModuleAccess]);

  const assignedClientsByMember = useMemo(() => {
    const map: Record<string, Client[]> = {};
    for (const client of clients) {
      const memberId = client.editor?.id;
      if (!memberId) continue;
      if (!map[memberId]) map[memberId] = [];
      map[memberId].push(client);
    }
    return map;
  }, [clients]);

  const applyClientAssignments = async (memberId: string, selectedClientIds: string[]) => {
    const currentlyAssigned = clients.filter((client) => client.editor?.id === memberId).map((client) => client.id);

    const toAssign = selectedClientIds.filter((id) => !currentlyAssigned.includes(id));
    const toUnassign = currentlyAssigned.filter((id) => !selectedClientIds.includes(id));

    await Promise.all([
      ...toAssign.map((id) =>
        fetch('/api/admin/clients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, editorId: memberId }),
        })
      ),
      ...toUnassign.map((id) =>
        fetch('/api/admin/clients', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, editorId: null }),
        })
      ),
    ]);
  };

  const handleCreateRole = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreatingRole(true);
    try {
      const res = await fetch('/api/admin/team/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newRole.code, name: newRole.name }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to create role');
        return;
      }
      const updatedRoles = Array.isArray(data?.roles) ? data.roles : roles;
      setRoles(updatedRoles);
      setNewRole({ code: '', name: '' });
      if (!selectedAccessRole) {
        setSelectedAccessRole(updatedRoles[0]?.code || 'VE');
      }
      toast.success('New role added');
    } catch {
      toast.error('Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const toggleModuleAccess = (roleCode: string, moduleKey: string) => {
    setAccessByRole((prev) => {
      const current = prev[roleCode] || [];
      const next = current.includes(moduleKey)
        ? current.filter((m) => m !== moduleKey)
        : [...current, moduleKey];
      return { ...prev, [roleCode]: next };
    });
  };

  const handleSaveModuleAccess = async () => {
    const modules = accessByRole[selectedAccessRole] || [];
    setSavingAccess(true);
    try {
      const res = await fetch('/api/admin/team/module-access', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCode: selectedAccessRole, modules }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to save module access');
        return;
      }
      setAccessByRole(data?.accessByRole || {});
      toast.success('Module access updated');
    } catch {
      toast.error('Failed to save module access');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleCreateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/editors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || 'Failed to add member');
        return;
      }

      if (form.assignedClientIds.length > 0) {
        await applyClientAssignments(data.id, form.assignedClientIds);
      }

      toast.success('Team member added');
      setShowCreateModal(false);
      setForm({ name: '', email: '', password: '', role: roles[0]?.code || 'VE', assignedClientIds: [] });
      await Promise.all([fetchMembers(), fetchClients()]);
    } catch {
      toast.error('Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleEditMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/editors', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          name: editing.name,
          email: editing.email,
          role: editing.role,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error || 'Failed to update member');
        return;
      }

      await applyClientAssignments(editing.id, editing.assignedClientIds);

      toast.success('Team member updated');
      setShowEditModal(false);
      setEditing({ id: '', name: '', email: '', role: roles[0]?.code || 'VE', assignedClientIds: [] });
      await Promise.all([fetchMembers(), fetchClients()]);
    } catch {
      toast.error('Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const initials = useMemo(() => {
    return members.map((member) => {
      const source = member.name || member.email;
      return source
        .split(' ')
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
    });
  }, [members]);

  const roleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => map.set(role.code, role.name));
    return map;
  }, [roles]);

  const toggleClient = (selected: string[], clientId: string) => {
    return selected.includes(clientId) ? selected.filter((id) => id !== clientId) : [...selected, clientId];
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">The Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage team members, role codes, and client mappings.
          </p>
        </div>
        {canManageRoles && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <PlusSquare className="h-4 w-4" />
            Add Member
          </button>
        )}
      </section>

      {canManageRoles && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldPlus className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Role Setup (CF/Admin)</h2>
          </div>
          <form onSubmit={handleCreateRole} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500">Role Code</label>
              <input
                value={newRole.code}
                onChange={(e) => setNewRole((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. PM"
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="min-w-[260px] flex-1">
              <label className="block text-xs font-medium text-slate-500">Role Name</label>
              <input
                value={newRole.name}
                onChange={(e) => setNewRole((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Performance Manager"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creatingRole}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {creatingRole ? 'Adding...' : 'Add Role'}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Module Access by Role</div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">Role</label>
                <select
                  value={selectedAccessRole}
                  onChange={(e) => setSelectedAccessRole(e.target.value)}
                  className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>{role.code} - {role.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleSaveModuleAccess}
                disabled={savingAccess}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {savingAccess ? 'Saving...' : 'Save Access'}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              {moduleCatalog.map((module) => (
                <label key={module.key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={(accessByRole[selectedAccessRole] || []).includes(module.key)}
                    onChange={() => toggleModuleAccess(selectedAccessRole, module.key)}
                  />
                  <span>{module.label}</span>
                  <span className="text-xs text-slate-400">({module.key})</span>
                </label>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Member</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-400">Assigned Clients</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {members.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-sm text-slate-500">
                  No team members yet. Add your first member.
                </td>
              </tr>
            ) : (
              members.map((member, idx) => {
                const roleCode = (member.role || 'VE').toUpperCase();
                const assignedClients = assignedClientsByMember[member.id] || [];
                return (
                  <tr key={member.id}>
                    <td className="px-6 py-4 text-sm text-slate-900">
                      <div className="inline-flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                          {initials[idx] || 'TM'}
                        </div>
                        <span className="font-medium">{member.name || 'Unnamed Member'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        {member.email}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        {roleCode}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">{roleNameMap.get(roleCode) || 'Custom Role'}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {assignedClients.length === 0
                        ? 'Unassigned'
                        : assignedClients.map((client) => client.name).join(', ')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canManageRoles ? (
                        <button
                          onClick={() => {
                            setEditing({
                              id: member.id,
                              name: member.name || '',
                              email: member.email,
                              role: roleCode,
                              assignedClientIds: assignedClients.map((client) => client.id),
                            });
                            setShowEditModal(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Read only</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {canManageRoles && showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-2">
              <UserSquare2 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-slate-900">Add Team Member</h2>
            </div>

            <form onSubmit={handleCreateMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>{role.code} - {role.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Assigned Clients</label>
                <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {clients.length === 0 ? (
                    <p className="text-sm text-slate-500">No clients available</p>
                  ) : (
                    clients.map((client) => (
                      <label key={client.id} className="flex items-center gap-2 py-1 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.assignedClientIds.includes(client.id)}
                          onChange={() =>
                            setForm({
                              ...form,
                              assignedClientIds: toggleClient(form.assignedClientIds, client.id),
                            })
                          }
                        />
                        <span>{client.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Password (optional)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Defaults to Editor@123 in DB mode"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canManageRoles && showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Edit Team Member</h2>
            <form onSubmit={handleEditMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Name</label>
                <input
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={editing.role}
                  onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"
                >
                  {roles.map((role) => (
                    <option key={role.code} value={role.code}>{role.code} - {role.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Assigned Clients</label>
                <div className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {clients.length === 0 ? (
                    <p className="text-sm text-slate-500">No clients available</p>
                  ) : (
                    clients.map((client) => (
                      <label key={client.id} className="flex items-center gap-2 py-1 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editing.assignedClientIds.includes(client.id)}
                          onChange={() =>
                            setEditing({
                              ...editing,
                              assignedClientIds: toggleClient(editing.assignedClientIds, client.id),
                            })
                          }
                        />
                        <span>{client.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
