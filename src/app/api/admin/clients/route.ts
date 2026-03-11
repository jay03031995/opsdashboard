import { NextResponse } from 'next/server';
import { isDatabaseConfigured, prisma } from '@/lib/prisma';
import { getSession } from '@/lib/middleware';
import { DemoClient, ensureDemoEditorsForTenant, getDemoClientsStore } from '@/lib/dev-store';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDatabaseConfigured()) {
    const clients = getDemoClientsStore()
      .filter((client) => client.tenantId === session.tenantId)
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json(clients);
  }

  try {
    const clients = await prisma.client.findMany({
      where: { tenantId: session.tenantId },
      include: {
        editor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, oneDriveFolder, editorId } = body;
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    if (!isDatabaseConfigured()) {
      const editors = ensureDemoEditorsForTenant(session.tenantId);
      const findEditorById = (id: string) =>
        editors.find((editor) => editor.id === id || editor.id.endsWith(`-${id}`)) || null;
      const mappedEditor =
        typeof editorId === 'string' && editorId
          ? findEditorById(editorId)
          : null;

      const demoClient: DemoClient = {
        id: `demo-client-${Date.now()}`,
        name: name.trim(),
        oneDriveFolder: oneDriveFolder?.trim() || null,
        editorId: editorId || null,
        tenantId: session.tenantId,
        editor: mappedEditor,
      };
      getDemoClientsStore().push(demoClient);
      return NextResponse.json(demoClient);
    }

    const client = await prisma.client.create({
      data: {
        name,
        oneDriveFolder,
        editorId,
        tenantId: session.tenantId,
      },
    });

    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientId = typeof body.id === 'string' ? body.id : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const oneDriveFolder =
      typeof body.oneDriveFolder === 'string' ? body.oneDriveFolder.trim() : body.oneDriveFolder === null ? null : undefined;
    const editorId = typeof body.editorId === 'string' && body.editorId.trim() ? body.editorId.trim() : null;

    if (!clientId) {
      return NextResponse.json({ error: 'Client id is required' }, { status: 400 });
    }

    if (!isDatabaseConfigured()) {
      const editors = ensureDemoEditorsForTenant(session.tenantId);
      const findEditorById = (id: string) =>
        editors.find((editor) => editor.id === id || editor.id.endsWith(`-${id}`)) || null;
      const clients = getDemoClientsStore();
      const index = clients.findIndex((client) => client.id === clientId && client.tenantId === session.tenantId);
      if (index === -1) {
        return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      }

      const mappedEditor = editorId ? findEditorById(editorId) : null;
      clients[index] = {
        ...clients[index],
        ...(name ? { name } : {}),
        ...(oneDriveFolder !== undefined ? { oneDriveFolder } : {}),
        editorId,
        editor: mappedEditor,
      };

      return NextResponse.json(clients[index]);
    }

    const existing = await prisma.client.findFirst({
      where: { id: clientId, tenantId: session.tenantId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(name ? { name } : {}),
        ...(oneDriveFolder !== undefined ? { oneDriveFolder } : {}),
        editorId,
      },
    });

    const updated = await prisma.client.findUnique({
      where: { id: clientId },
      include: { editor: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update client mapping' }, { status: 500 });
  }
}
