import { NextResponse } from 'next/server';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';
import { getSession } from '@/lib/middleware';
import { getDemoCalendarStore, getDemoClientsStore } from '@/lib/dev-store';
import { getTaskMeta } from '@/lib/task-meta-store';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isDatabaseConfigured()) {
    const demoClients = getDemoClientsStore().filter((client) => client.tenantId === session.tenantId);
    const demoAssignments = getDemoCalendarStore()
      .filter((entry) => entry.tenantId === session.tenantId && (entry.status === 'ASSIGNED' || entry.status === 'COMPLETED'))
      .filter((entry) => {
        const meta = getTaskMeta(session.tenantId, entry.id);
        if (meta?.assignedEditorId) return meta.assignedEditorId === session.userId;
        const client = demoClients.find((c) => c.id === entry.clientId);
        return client?.editorId === session.userId;
      })
      .map((entry) => {
        const client = demoClients.find((c) => c.id === entry.clientId);
        return {
          ...entry,
          videoUrl: entry.videoUrl || null,
          client: { id: client?.id || entry.clientId, name: client?.name || 'Unknown Client' },
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return NextResponse.json(demoAssignments);
  }

  try {
    const assignments = await prisma.contentCalendar.findMany({
      where: {
        tenantId: session.tenantId,
        status: { in: ['ASSIGNED', 'COMPLETED'] }
      },
      include: { client: true },
      orderBy: { date: 'desc' },
    });
    const filtered = assignments.filter((entry) => {
      const meta = getTaskMeta(session.tenantId, entry.id);
      if (meta?.assignedEditorId) return meta.assignedEditorId === session.userId;
      return entry.client.editorId === session.userId;
    });
    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
      const body = await request.json();
      const assignmentId = typeof body.id === 'string' ? body.id : '';
      if (!assignmentId) {
        return NextResponse.json({ error: 'Assignment id is required' }, { status: 400 });
      }

      const entries = getDemoCalendarStore();
      const index = entries.findIndex((entry) => entry.id === assignmentId && entry.tenantId === session.tenantId);
      if (index === -1) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      }

      entries[index].status = 'COMPLETED';
      return NextResponse.json({ message: 'Assignment marked complete' });
    } catch {
      return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
    }
  }

  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const assignmentId = typeof body.id === 'string' ? body.id : '';
    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment id is required' }, { status: 400 });
    }

    const updated = await prisma.contentCalendar.updateMany({
      where: {
        id: assignmentId,
        tenantId: session.tenantId,
        client: { editorId: session.userId },
      },
      data: { status: 'COMPLETED' },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Assignment marked complete' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update assignment' }, { status: 500 });
  }
}
