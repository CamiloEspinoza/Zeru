import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextData {
  actorType: 'USER' | 'SYSTEM' | 'AI' | 'WEBHOOK';
  actorId: string | null;
  tenantId: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
  socketId?: string;
}

const storage = new AsyncLocalStorage<RequestContextData>();

export const RequestContext = {
  run: <T>(data: RequestContextData, fn: () => T): T => {
    return storage.run(data, fn);
  },
  get: (): RequestContextData | undefined => {
    return storage.getStore();
  },
};
