import { NextResponse } from 'next/server';
import { getSession } from '@/lib/middleware';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';
import { getRoleModuleAccess, resolveSessionTeamRole } from '@/lib/team-role-store';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    const roleCode = resolveSessionTeamRole(session);
    return NextResponse.json({
      user: {
        ...session,
        roleCode,
        moduleAccess: getRoleModuleAccess(session.tenantId, roleCode),
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, tenantId: true },
  });

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleCode = resolveSessionTeamRole(session);
  return NextResponse.json({
    user: {
      ...user,
      roleCode,
      moduleAccess: getRoleModuleAccess(session.tenantId, roleCode),
    },
  });
}
