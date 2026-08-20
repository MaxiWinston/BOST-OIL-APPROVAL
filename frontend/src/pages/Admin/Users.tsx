import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CaretDownIcon,
  DotsThreeVerticalIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { AdminSidebar } from '../../components/AdminSidebar';
import type { UserRole } from '../../types';

const roleLabels: Record<UserRole, string> = {
  MANAGER: 'Depot Manager',
  CUSTOMS_OFFICER: 'Customs Officer',
  DEPOT_OPERATOR: 'Loading Bay',
  ADMIN: 'Administrator',
};

const departments: Record<UserRole, string> = {
  MANAGER: 'Depot Management',
  CUSTOMS_OFFICER: 'Customs',
  DEPOT_OPERATOR: 'Logistics',
  ADMIN: 'Management',
};

const ROLES = Object.keys(roleLabels) as UserRole[];

const emptyForm = {
  username: '',
  password: '',
  role: 'MANAGER' as UserRole,
  first_name: '',
  last_name: '',
  email: '',
  depot_id: '',
  company_name: '',
};

export function AdminUsers() {
  const { users, addUser, refreshUsers } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    refreshUsers().catch((err) =>
      setLoadError(err instanceof Error ? err.message : 'Could not load users.'),
    );
  }, [refreshUsers]);

  const filteredUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesSearch =
        !search ||
        [user.name, user.username, user.company_name, user.location, user.email]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search));
      return matchesRole && matchesSearch;
    });
  }, [users, query, roleFilter]);

  const handleCreate = async () => {
    if (!form.username || !form.password) {
      toast.error('Username and password are required.');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await addUser({
        username: form.username,
        password: form.password,
        role: form.role,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || undefined,
        depot_id: form.depot_id || undefined,
        company_name: form.company_name || undefined,
      });
      toast.success(`User ${form.username} created.`);
      setForm(emptyForm);
      setIsCreating(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the user.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (name: string) =>
    name.split(' ').map((word) => word[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#fcf8fa] text-[#102f71]">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-5 md:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                <UsersThreeIcon className="size-4 text-[#7fb445]" weight="bold" />
                System access
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#102f71]">User Management</h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Manage accounts, roles, and platform access.
              </p>
            </div>
            <Button
              className="h-9 bg-[#7fb445] px-3 font-bold text-white hover:bg-[#7fb445]"
              onClick={() => setIsCreating((open) => !open)}
            >
              <PlusIcon className="size-4" weight="bold" />
              Add User
            </Button>
          </div>

          {loadError && (
            <div className="mb-4 border-l-2 border-rose-500 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {loadError}
            </div>
          )}

          {isCreating && (
            <section className="mb-4 border border-outline-variant bg-white p-5 shadow-level-1">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-[#102f71]">Create user</h2>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Grant a new user access to the platform.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-on-surface-variant"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="first_name">First name</Label>
                  <Input
                    id="first_name"
                    value={form.first_name}
                    onChange={(e) => setForm((v) => ({ ...v, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last_name">Last name</Label>
                  <Input
                    id="last_name"
                    value={form.last_name}
                    onChange={(e) => setForm((v) => ({ ...v, last_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={form.username}
                    onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password (min 8 chars)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="depot_id">Depot ID</Label>
                  <Input
                    id="depot_id"
                    placeholder="DEPOT-TEMA-01"
                    value={form.depot_id}
                    onChange={(e) => setForm((v) => ({ ...v, depot_id: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company_name">Company</Label>
                  <Input
                    id="company_name"
                    value={form.company_name}
                    onChange={(e) => setForm((v) => ({ ...v, company_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    className="h-8 w-full border border-outline bg-white px-2.5 text-xs text-[#102f71] outline-none focus:border-[#7fb445]"
                    value={form.role}
                    onChange={(e) => setForm((v) => ({ ...v, role: e.target.value as UserRole }))}
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{roleLabels[role]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  className="bg-[#7fb445] text-white hover:bg-[#7fb445]"
                  onClick={handleCreate}
                  disabled={saving}
                >
                  {saving ? 'Creating…' : 'Create User'}
                </Button>
              </div>
            </section>
          )}

          <section className="overflow-hidden border border-outline-variant bg-white shadow-level-1">
            <div className="flex flex-col gap-4 border-b border-outline-variant bg-surface-container-low p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-sm">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
                <Input
                  className="h-9 bg-white pl-9 text-sm"
                  placeholder="Search name, username, or email..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <FunnelSimpleIcon className="size-4 text-on-surface-variant" weight="bold" />
                <label className="text-xs font-bold uppercase tracking-wide text-on-surface-variant" htmlFor="role-filter">
                  Role
                </label>
                <div className="relative">
                  <select
                    id="role-filter"
                    className="h-9 appearance-none border border-outline-variant bg-white py-1 pl-3 pr-8 text-xs font-medium text-[#102f71] outline-none focus:border-[#7fb445]"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
                  >
                    <option value="all">All roles</option>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>{roleLabels[role]}</option>
                    ))}
                  </select>
                  <CaretDownIcon className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-on-surface-variant" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container-low">
                  <tr className="text-[11px] font-bold uppercase tracking-[0.1em] text-on-surface-variant">
                    <th className="px-5 py-3">Name &amp; ID</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Department</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Depot</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="group transition-colors hover:bg-surface-container-low">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#102f71] text-[11px] font-bold text-white group-hover:bg-[#7fb445]">
                            {initials(user.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-[#102f71]">{user.name}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-on-surface-variant">
                              USR-{String(user.id).padStart(4, '0')} · {user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex border border-outline-variant bg-surface-container-highest px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#102f71]">
                          {roleLabels[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-on-surface">
                        {departments[user.role] ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 font-mono text-xs uppercase text-on-surface">
                          <span className={`size-2 rounded-full ${user.is_active ? 'bg-[#7fb445]' : 'bg-gray-400'}`} />
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-on-surface-variant">
                        {user.depot_id || '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Actions for ${user.name}`}
                          className="text-on-surface-variant hover:bg-surface-container-high hover:text-[#102f71]"
                        >
                          <DotsThreeVerticalIcon className="size-4" weight="bold" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && (
                <div className="p-12 text-center text-sm text-on-surface-variant">
                  No users match the current search and filter.
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-5 py-3 text-xs text-on-surface-variant">
              <span>Showing {filteredUsers.length} of {users.length} users</span>
              <span className="font-mono uppercase tracking-wide">System access directory</span>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

export default AdminUsers;
