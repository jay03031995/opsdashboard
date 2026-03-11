import { NextResponse } from 'next/server';
import { getSession } from '@/lib/middleware';
import { canManageRoles, getAllRoleModuleAccess, getTenantRoles, MODULE_CATALOG, setRoleModuleAccess } from '@/lib/team-role-store';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageRoles(session)) {
    return NextResponse.json({ error: 'Only CF/Admin can view module access settings' }, { status: 403 });
  }

  return NextResponse.json({
    roles: getTenantRoles(session.tenantId),
    accessByRole: getAllRoleModuleAccess(session.tenantId),
    moduleCatalog: MODULE_CATALOG,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!canManageRoles(session)) {
    return NextResponse.json({ error: 'Only CF/Admin can update module access settings' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const roleCode = typeof body.roleCode === 'string' ? body.roleCode.trim().toUpperCase() : '';
    const modules = Array.isArray(body.modules) ? body.modules.filter((v) => typeof v === 'string') : [];

    if (!roleCode) {
      return NextResponse.json({ error: 'roleCode is required' }, { status: 400 });
    }

    const roleExists = getTenantRoles(session.tenantId).some((role) => role.code === roleCode);
    if (!roleExists) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    setRoleModuleAccess(session.tenantId, roleCode, modules);
    return NextResponse.json({ accessByRole: getAllRoleModuleAccess(session.tenantId) });
  } catch {
    return NextResponse.json({ error: 'Failed to update module access' }, { status: 500 });
  }
}
