import { DEMO_EDITORS } from './demo-data';

export type DemoEditor = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  tenantId: string;
  createdAt: string;
};

export type DemoClient = {
  id: string;
  name: string;
  oneDriveFolder: string | null;
  editorId: string | null;
  tenantId: string;
  editor: { id: string; name: string | null; email: string } | null;
};

export type DemoCalendarEntry = {
  id: string;
  date: string;
  videoTopic: string;
  videoLink?: string | null;
  refVideo?: string | null;
  remarks?: string | null;
  attachmentUrl?: string | null;
  platform: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED';
  videoUrl?: string | null;
  clientId: string;
  tenantId: string;
};

const globalForDemo = globalThis as unknown as {
  demoEditors?: DemoEditor[];
  demoClients?: DemoClient[];
  demoCalendarEntries?: DemoCalendarEntry[];
};

export function getDemoEditorsStore() {
  if (!globalForDemo.demoEditors) {
    globalForDemo.demoEditors = [];
  }
  return globalForDemo.demoEditors;
}

export function ensureDemoEditorsForTenant(tenantId: string) {
  const store = getDemoEditorsStore();
  const hasTenantEditors = store.some((editor) => editor.tenantId === tenantId);
  if (!hasTenantEditors) {
    DEMO_EDITORS.forEach((editor) => {
      store.push({
        id: `${tenantId}-${editor.id}`,
        name: editor.name,
        email: editor.email,
        role: editor.role,
        tenantId,
        createdAt: new Date().toISOString(),
      });
    });
  }
  return store.filter((editor) => editor.tenantId === tenantId);
}

export function getDemoClientsStore() {
  if (!globalForDemo.demoClients) {
    globalForDemo.demoClients = [];
  }
  return globalForDemo.demoClients;
}

export function getDemoCalendarStore() {
  if (!globalForDemo.demoCalendarEntries) {
    globalForDemo.demoCalendarEntries = [];
  }
  return globalForDemo.demoCalendarEntries;
}
