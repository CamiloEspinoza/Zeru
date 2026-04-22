import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FmAuthService } from './fm-auth.service';

describe('FmAuthService', () => {
  let service: FmAuthService;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FmAuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (k: string) => {
              if (k === 'FM_HOST') return 'https://fm.test';
              if (k === 'FM_USERNAME') return 'user';
              if (k === 'FM_PASSWORD') return 'pass';
              throw new Error(`unexpected key: ${k}`);
            },
          },
        },
      ],
    }).compile();
    service = module.get(FmAuthService);
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('invalidateSession', () => {
    it('clears the cached token immediately so next getToken triggers a new login', async () => {
      // fetch mock returns in order: login #1 (tok-1), DELETE (ok), login #2 (tok-2)
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: { token: 'tok-1' } }) })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: { token: 'tok-2' } }) });
      global.fetch = fetchMock as any;

      const first = await service.getToken('BIOPSIAS');
      expect(first).toBe('tok-1');

      service.invalidateSession('BIOPSIAS');
      // let the fire-and-forget DELETE finish before we call getToken again
      await new Promise((r) => setImmediate(r));

      const second = await service.getToken('BIOPSIAS');
      expect(second).toBe('tok-2');
    });

    it('sends DELETE /sessions/:token to FM to release the slot server-side', async () => {
      // seed
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: { token: 'tok-42' } }),
      });
      global.fetch = fetchMock as any;
      await service.getToken('BIOPSIAS');

      // next fetch is the DELETE triggered by invalidateSession
      fetchMock.mockResolvedValueOnce({ ok: true });
      service.invalidateSession('BIOPSIAS');

      // give the fire-and-forget microtask time to run
      await new Promise((r) => setImmediate(r));

      const deleteCall = fetchMock.mock.calls.find(
        (c) => typeof c[1] === 'object' && (c[1] as any).method === 'DELETE',
      );
      expect(deleteCall).toBeDefined();
      expect(deleteCall![0]).toBe('https://fm.test/fmi/data/vLatest/databases/BIOPSIAS/sessions/tok-42');
    });

    it('does not throw when the DELETE fails (best-effort)', async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: { token: 'tok-9' } }),
      });
      global.fetch = fetchMock as any;
      await service.getToken('BIOPSIAS');

      // DELETE rejects
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      // must not throw synchronously nor via unhandled rejection
      expect(() => service.invalidateSession('BIOPSIAS')).not.toThrow();
      await new Promise((r) => setImmediate(r));
      // cache still cleared
      expect((service as any).sessions.has('BIOPSIAS')).toBe(false);
    });

    it('is a no-op when there is no cached session', () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as any;
      expect(() => service.invalidateSession('NOPE')).not.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
