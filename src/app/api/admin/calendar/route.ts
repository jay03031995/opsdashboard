import { NextResponse } from 'next/server';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';
import { getSession } from '@/lib/middleware';
import { getDemoCalendarStore, getDemoClientsStore, getDemoEditorsStore } from '@/lib/dev-store';
import { deleteTaskMeta, getTaskMeta, setTaskMeta } from '@/lib/task-meta-store';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');
  const monthStr = searchParams.get('month');
  const yearStr = searchParams.get('year');
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');

  try {
    if (!isDatabaseConfigured()) {
      const demoEntries = getDemoCalendarStore().filter((entry) => entry.tenantId === session.tenantId);
      const demoClients = getDemoClientsStore().filter((client) => client.tenantId === session.tenantId);

      let filtered = demoEntries;
      if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          filtered = filtered.filter((entry) => {
            const d = new Date(entry.date).getTime();
            return d >= start.getTime() && d <= end.getTime();
          });
        }
      } else if (monthStr && yearStr) {
        const month = Number(monthStr);
        const year = Number(yearStr);
        if (!Number.isNaN(month) && !Number.isNaN(year) && month >= 1 && month <= 12) {
          filtered = filtered.filter((entry) => {
            const d = new Date(entry.date);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          });
        }
      } else if (dateStr) {
        filtered = filtered.filter((entry) => {
          const d = new Date(entry.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return key === dateStr;
        });
      }

      const response = filtered
        .map((entry) => {
          const client = demoClients.find((c) => c.id === entry.clientId);
          const meta = getTaskMeta(session.tenantId, entry.id);
          const assignedEditorId = meta?.assignedEditorId || null;
          const assignedEditorName = assignedEditorId
            ? getDemoEditorsStore().find((e) => e.id === assignedEditorId)?.name || 'Unassigned'
            : null;
          return {
            ...entry,
            videoLink: entry.videoLink || entry.videoUrl || null,
            refVideo: entry.refVideo || null,
            remarks: entry.remarks || entry.videoTopic || null,
            attachmentUrl: entry.attachmentUrl || null,
            assignedEditor: assignedEditorId ? { id: assignedEditorId, name: assignedEditorName } : null,
            client: client
              ? { id: client.id, name: client.name, editor: client.editor ? { name: client.editor.name } : undefined }
              : { id: entry.clientId, name: 'Unknown Client' },
          };
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return NextResponse.json(response);
    }

    const where: any = { tenantId: session.tenantId };
    if (startStr && endStr) {
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const startOfRange = new Date(start.setHours(0, 0, 0, 0));
        const endOfRange = new Date(end.setHours(23, 59, 59, 999));
        where.date = { gte: startOfRange, lte: endOfRange };
      }
    } else if (monthStr && yearStr) {
      const month = Number(monthStr);
      const year = Number(yearStr);
      if (!Number.isNaN(month) && !Number.isNaN(year) && month >= 1 && month <= 12) {
        const startOfMonth = new Date(year, month - 1, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
        where.date = { gte: startOfMonth, lte: endOfMonth };
      }
    } else if (dateStr) {
      const date = new Date(dateStr);
      const startOfDay = new Date(date.setHours(0, 0, 0, 0));
      const endOfDay = new Date(date.setHours(23, 59, 59, 999));
      where.date = { gte: startOfDay, lte: endOfDay };
    }

    const entries = await prisma.contentCalendar.findMany({
      where,
      include: {
        client: {
          include: { editor: { select: { name: true } } }
        }
      },
      orderBy: { date: 'asc' },
    });
    const overrideEditorIds = entries
      .map((entry) => getTaskMeta(session.tenantId, entry.id)?.assignedEditorId)
      .filter((id): id is string => Boolean(id));
    const uniqueIds = Array.from(new Set(overrideEditorIds));
    const editorsById = new Map<string, string>();
    if (uniqueIds.length) {
      const editorRows = await prisma.user.findMany({
        where: { tenantId: session.tenantId, id: { in: uniqueIds } },
        select: { id: true, name: true },
      });
      editorRows.forEach((row) => editorsById.set(row.id, row.name || 'Unassigned'));
    }

    return NextResponse.json(
      entries.map((entry) => {
        const meta = getTaskMeta(session.tenantId, entry.id);
        const assignedEditorId = meta?.assignedEditorId || null;
        return {
          ...entry,
          videoLink: meta?.videoLink ?? entry.videoUrl ?? null,
          refVideo: meta?.refVideo ?? null,
          remarks: meta?.remarks ?? entry.videoTopic ?? null,
          attachmentUrl: meta?.attachmentUrl ?? null,
          assignedEditor: assignedEditorId
            ? { id: assignedEditorId, name: editorsById.get(assignedEditorId) || 'Unassigned' }
            : null,
        };
      })
    );
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, videoTopic, platform, clientId, videoLink, refVideo, remarks, attachmentUrl } = body;

    if (!isDatabaseConfigured()) {
      if (!date || !platform || !clientId) {
        return NextResponse.json({ error: 'date, platform and clientId are required' }, { status: 400 });
      }

      const client = getDemoClientsStore().find((c) => c.id === clientId && c.tenantId === session.tenantId);
      if (!client) {
        return NextResponse.json({ error: 'Client not found for this tenant' }, { status: 404 });
      }

      const entry = {
        id: `demo-calendar-${Date.now()}`,
        date: new Date(date).toISOString(),
        videoTopic: typeof videoTopic === 'string' ? videoTopic : '',
        videoLink: typeof videoLink === 'string' ? videoLink : null,
        refVideo: typeof refVideo === 'string' ? refVideo : null,
        remarks: typeof remarks === 'string' ? remarks : null,
        attachmentUrl: typeof attachmentUrl === 'string' ? attachmentUrl : null,
        platform,
        status: 'PENDING' as const,
        videoUrl: typeof videoLink === 'string' ? videoLink : null,
        clientId,
        tenantId: session.tenantId,
        client: { id: client.id, name: client.name, editor: client.editor ? { name: client.editor.name } : undefined },
      };

      getDemoCalendarStore().push({
        id: entry.id,
        date: entry.date,
        videoTopic: entry.videoTopic,
        videoLink: entry.videoLink,
        refVideo: entry.refVideo,
        remarks: entry.remarks,
        attachmentUrl: entry.attachmentUrl,
        platform: entry.platform,
        status: entry.status,
        videoUrl: entry.videoUrl,
        clientId: entry.clientId,
        tenantId: entry.tenantId,
      });

      return NextResponse.json(entry);
    }

    const entry = await prisma.contentCalendar.create({
      data: {
        date: new Date(date),
        videoTopic: typeof remarks === 'string' && remarks.trim() ? remarks.trim() : typeof videoTopic === 'string' ? videoTopic : 'Task Entry',
        platform,
        videoUrl: typeof videoLink === 'string' && videoLink.trim() ? videoLink.trim() : null,
        clientId,
        tenantId: session.tenantId,
      },
    });

    const response = {
      ...entry,
      videoLink: entry.videoUrl || null,
      refVideo: null,
      remarks: entry.videoTopic || null,
      attachmentUrl: null,
    };
    setTaskMeta(session.tenantId, entry.id, {
      videoLink: response.videoLink,
      refVideo: response.refVideo,
      remarks: response.remarks,
      attachmentUrl: response.attachmentUrl,
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create calendar entry' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
    const id = typeof body.id === 'string' ? body.id : '';
    const date = typeof body.date === 'string' ? body.date : null;
    const videoTopic = typeof body.videoTopic === 'string' ? body.videoTopic.trim() : null;
    const videoLink = typeof body.videoLink === 'string' ? body.videoLink.trim() : null;
    const refVideo = typeof body.refVideo === 'string' ? body.refVideo.trim() : null;
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : null;
    const attachmentUrl = typeof body.attachmentUrl === 'string' ? body.attachmentUrl.trim() : null;
    const platform = typeof body.platform === 'string' ? body.platform.trim() : null;
    const status =
      typeof body.status === 'string' && ['PENDING', 'ASSIGNED', 'COMPLETED'].includes(body.status.toUpperCase())
        ? body.status.toUpperCase()
        : null;
    const clientId = typeof body.clientId === 'string' ? body.clientId : null;
    const assignedEditorId = has('assignedEditorId')
      ? typeof body.assignedEditorId === 'string' && body.assignedEditorId.trim()
        ? body.assignedEditorId.trim()
        : null
      : undefined;

    if (!id) {
      return NextResponse.json({ error: 'Entry id is required' }, { status: 400 });
    }

    if (!isDatabaseConfigured()) {
      const demoEntries = getDemoCalendarStore();
      const index = demoEntries.findIndex((entry) => entry.id === id && entry.tenantId === session.tenantId);
      if (index === -1) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }

      if (has('date') && date) demoEntries[index].date = new Date(date).toISOString();
      if (has('videoTopic')) demoEntries[index].videoTopic = videoTopic || '';
      if (has('videoLink')) {
        demoEntries[index].videoLink = videoLink || null;
        demoEntries[index].videoUrl = videoLink || null;
      }
      if (has('refVideo')) demoEntries[index].refVideo = refVideo || null;
      if (has('remarks')) {
        demoEntries[index].remarks = remarks || null;
        if (remarks) demoEntries[index].videoTopic = remarks;
      }
      if (has('attachmentUrl')) demoEntries[index].attachmentUrl = attachmentUrl || null;
      if (has('platform') && platform) demoEntries[index].platform = platform;
      if (has('status') && status) demoEntries[index].status = status as 'PENDING' | 'ASSIGNED' | 'COMPLETED';
      if (has('clientId') && clientId) demoEntries[index].clientId = clientId;

      const client = getDemoClientsStore().find(
        (c) => c.id === demoEntries[index].clientId && c.tenantId === session.tenantId
      );
      const response = {
        ...demoEntries[index],
        assignedEditor: assignedEditorId
          ? {
              id: assignedEditorId,
              name: getDemoEditorsStore().find((editor) => editor.id === assignedEditorId)?.name || 'Unassigned',
            }
          : null,
        client: client
          ? { id: client.id, name: client.name, editor: client.editor ? { name: client.editor.name } : undefined }
          : { id: demoEntries[index].clientId, name: 'Unknown Client' },
      };
      setTaskMeta(session.tenantId, id, {
        assignedEditorId: assignedEditorId ?? getTaskMeta(session.tenantId, id)?.assignedEditorId ?? null,
      });
      return NextResponse.json(response);
    }

    const existing = await prisma.contentCalendar.findFirst({
      where: { id, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    const updated = await prisma.contentCalendar.update({
      where: { id },
      data: {
        ...(has('date') && date ? { date: new Date(date) } : {}),
        ...(has('remarks') || has('videoTopic') ? { videoTopic: (remarks || videoTopic || '').trim() } : {}),
        ...(has('videoLink') ? { videoUrl: videoLink || null } : {}),
        ...(has('platform') && platform ? { platform } : {}),
        ...(has('status') && status ? { status } : {}),
        ...(has('clientId') && clientId ? { clientId } : {}),
      },
      include: {
        client: {
          include: { editor: { select: { name: true } } },
        },
      },
    });

    const assignedEditorName =
      assignedEditorId
        ? (
            await prisma.user.findFirst({
              where: { id: assignedEditorId, tenantId: session.tenantId },
              select: { name: true },
            })
          )?.name || 'Unassigned'
        : null;

    const response = {
      ...updated,
      videoLink: updated.videoUrl || null,
      refVideo: has('refVideo') ? refVideo || null : getTaskMeta(session.tenantId, updated.id)?.refVideo || null,
      remarks: updated.videoTopic || null,
      attachmentUrl: has('attachmentUrl')
        ? attachmentUrl || null
        : getTaskMeta(session.tenantId, updated.id)?.attachmentUrl || null,
      assignedEditor: assignedEditorId ? { id: assignedEditorId, name: assignedEditorName } : null,
    };
    setTaskMeta(session.tenantId, updated.id, {
      videoLink: response.videoLink,
      refVideo: response.refVideo,
      remarks: response.remarks,
      attachmentUrl: response.attachmentUrl,
      assignedEditorId: assignedEditorId ?? getTaskMeta(session.tenantId, updated.id)?.assignedEditorId ?? null,
    });
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: 'Failed to update calendar entry' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Entry id is required' }, { status: 400 });

    if (!isDatabaseConfigured()) {
      const entries = getDemoCalendarStore();
      const index = entries.findIndex((entry) => entry.id === id && entry.tenantId === session.tenantId);
      if (index === -1) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      entries.splice(index, 1);
      deleteTaskMeta(session.tenantId, id);
      return NextResponse.json({ message: 'Task deleted' });
    }

    const deleted = await prisma.contentCalendar.deleteMany({
      where: { id, tenantId: session.tenantId },
    });
    if (!deleted.count) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    deleteTaskMeta(session.tenantId, id);
    return NextResponse.json({ message: 'Task deleted' });
  } catch {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
