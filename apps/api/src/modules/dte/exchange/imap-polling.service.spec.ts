import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ImapPollingService } from './imap-polling.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { DteConfigService } from '../services/dte-config.service';

// Mock the imapflow module — we capture the constructor so each test can
// inspect/configure the client instance used inside the service.
const imapFlowInstances: FakeImapClient[] = [];

jest.mock('imapflow', () => ({
  ImapFlow: jest.fn().mockImplementation(function (opts: unknown) {
    const client = createMockImapClient([]);
    client.__opts = opts;
    imapFlowInstances.push(client);
    return client;
  }),
}));

interface FakeMessage {
  uid: number;
  envelope?: {
    from?: Array<{ address: string }>;
    subject?: string;
  };
  bodyStructure?: unknown;
  source?: Buffer;
  throwOnIter?: boolean;
}

interface FakeImapClient {
  __opts?: unknown;
  __messages: FakeMessage[];
  __searchCriteria?: Record<string, unknown>;
  connect: jest.Mock;
  logout: jest.Mock;
  getMailboxLock: jest.Mock;
  fetch: jest.Mock;
  download: jest.Mock;
  messageFlagsAdd: jest.Mock;
  list: jest.Mock;
  search: jest.Mock;
}

function createMockImapClient(messages: FakeMessage[]): FakeImapClient {
  const lockRelease = jest.fn();
  const client: FakeImapClient = {
    __messages: messages,
    connect: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    getMailboxLock: jest.fn().mockResolvedValue({ release: lockRelease }),
    fetch: jest.fn().mockImplementation(function (
      this: FakeImapClient,
      criteria: Record<string, unknown>,
    ) {
      client.__searchCriteria = criteria;
      return {
        [Symbol.asyncIterator]: () => {
          let idx = 0;
          return {
            next: async () => {
              while (idx < client.__messages.length) {
                const msg = client.__messages[idx++];
                if (msg.throwOnIter) {
                  throw new Error(`synthetic fetch error uid=${msg.uid}`);
                }
                return { value: msg, done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      };
    }),
    download: jest
      .fn()
      .mockImplementation(async () => ({ content: asyncBuffer('') })),
    messageFlagsAdd: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
    search: jest.fn().mockResolvedValue([]),
  };
  return client;
}

function asyncBuffer(str: string): AsyncIterable<Buffer> {
  return {
    [Symbol.asyncIterator]: () => {
      let done = false;
      return {
        next: async () => {
          if (done) return { value: undefined, done: true };
          done = true;
          return { value: Buffer.from(str, 'utf-8'), done: false };
        },
      };
    },
  };
}

describe('ImapPollingService', () => {
  let service: ImapPollingService;
  let prisma: any;
  let configService: any;
  let eventEmitter: any;
  let tenantDb: any;

  const tenantId = 'tenant-imap';

  const baseConfig = {
    imapEnabled: true,
    imapHost: 'imap.example.cl',
    imapPort: 993,
    imapUser: 'buzon@example.cl',
    encryptedImapPass: 'plaintext-pass-after-decrypt',
    imapLastUid: 100,
  };

  beforeEach(async () => {
    imapFlowInstances.length = 0;

    tenantDb = {
      dteConfig: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma = {
      forTenant: jest.fn().mockReturnValue(tenantDb),
    };

    configService = {
      get: jest.fn().mockResolvedValue({ ...baseConfig }),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ImapPollingService,
        { provide: PrismaService, useValue: prisma },
        { provide: DteConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(ImapPollingService);
  });

  it('returns 0 and skips IMAP when polling is disabled', async () => {
    configService.get.mockResolvedValueOnce({
      ...baseConfig,
      imapEnabled: false,
    });

    const result = await service.pollForNewDtes(tenantId);

    expect(result).toBe(0);
    expect(imapFlowInstances).toHaveLength(0);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('returns 0 when IMAP credentials are incomplete', async () => {
    configService.get.mockResolvedValueOnce({
      ...baseConfig,
      imapHost: null,
    });

    const result = await service.pollForNewDtes(tenantId);

    expect(result).toBe(0);
    expect(imapFlowInstances).toHaveLength(0);
  });

  it('connects with imapflow using tenant config and searches using imapLastUid', async () => {
    // No messages — just exercise the connect/fetch/logout lifecycle
    const result = await service.pollForNewDtes(tenantId);

    expect(result).toBe(0);
    expect(imapFlowInstances).toHaveLength(1);
    const client = imapFlowInstances[0];
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.getMailboxLock).toHaveBeenCalledWith('INBOX');
    expect(client.fetch).toHaveBeenCalledTimes(1);

    const criteria = client.__searchCriteria as Record<string, unknown>;
    expect(criteria.seen).toBe(false);
    // uid range must start strictly above imapLastUid (i.e. 101:*)
    expect(criteria.uid).toBe('101:*');

    expect(client.logout).toHaveBeenCalledTimes(1);

    const opts = client.__opts as Record<string, unknown>;
    expect(opts.host).toBe(baseConfig.imapHost);
    expect(opts.port).toBe(baseConfig.imapPort);
    expect((opts.auth as Record<string, unknown>).user).toBe(baseConfig.imapUser);
    expect((opts.auth as Record<string, unknown>).pass).toBe(
      baseConfig.encryptedImapPass,
    );
  });

  it('emits dte.xml-received with correct payload for a message whose source contains an XML attachment', async () => {
    const xmlBody =
      '<?xml version="1.0"?><EnvioDTE><SetDTE><DTE>hello</DTE></SetDTE></EnvioDTE>';
    const rawSource =
      'From: sender@proveedor.cl\r\n' +
      'Subject: Envio DTE\r\n' +
      'MIME-Version: 1.0\r\n' +
      'Content-Type: multipart/mixed; boundary="BOUNDARY"\r\n' +
      '\r\n' +
      '--BOUNDARY\r\n' +
      'Content-Type: text/xml; name="dte.xml"\r\n' +
      'Content-Transfer-Encoding: 7bit\r\n' +
      '\r\n' +
      xmlBody +
      '\r\n' +
      '--BOUNDARY--\r\n';

    const message: FakeMessage = {
      uid: 150,
      envelope: {
        from: [{ address: 'emisor@proveedor.cl' }],
        subject: 'Factura 123',
      },
      source: Buffer.from(rawSource, 'utf-8'),
    };

    // Install next client with this message
    (jest.requireMock('imapflow').ImapFlow as jest.Mock).mockImplementationOnce(
      function () {
        const c = createMockImapClient([message]);
        imapFlowInstances.push(c);
        return c;
      },
    );

    const before = new Date();
    const result = await service.pollForNewDtes(tenantId);
    const after = new Date();

    expect(result).toBe(1);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    const [eventName, payload] = eventEmitter.emit.mock.calls[0];
    expect(eventName).toBe('dte.xml-received');
    expect(payload.tenantId).toBe(tenantId);
    expect(payload.fromEmail).toBe('emisor@proveedor.cl');
    expect(payload.subject).toBe('Factura 123');
    expect(payload.messageUid).toBe(150);
    expect(payload.xmlContent).toContain('<EnvioDTE>');
    expect(payload.receivedAt).toBeInstanceOf(Date);
    expect(payload.receivedAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(payload.receivedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('updates imapLastUid to the maximum uid processed and sets imapLastPollAt', async () => {
    const xmlBody =
      '<?xml version="1.0"?><EnvioDTE><SetDTE><DTE>x</DTE></SetDTE></EnvioDTE>';
    const buildSource = (tag: string) =>
      Buffer.from(
        'Content-Type: multipart/mixed; boundary="B"\r\n\r\n' +
          '--B\r\n' +
          'Content-Type: text/xml\r\n\r\n' +
          xmlBody.replace('x', tag) +
          '\r\n--B--\r\n',
        'utf-8',
      );

    const messages: FakeMessage[] = [
      {
        uid: 120,
        envelope: { from: [{ address: 'a@x.cl' }], subject: 'A' },
        source: buildSource('a'),
      },
      {
        uid: 175,
        envelope: { from: [{ address: 'b@x.cl' }], subject: 'B' },
        source: buildSource('b'),
      },
      {
        uid: 130,
        envelope: { from: [{ address: 'c@x.cl' }], subject: 'C' },
        source: buildSource('c'),
      },
    ];

    (jest.requireMock('imapflow').ImapFlow as jest.Mock).mockImplementationOnce(
      function () {
        const c = createMockImapClient(messages);
        imapFlowInstances.push(c);
        return c;
      },
    );

    const result = await service.pollForNewDtes(tenantId);

    expect(result).toBe(3);
    expect(tenantDb.dteConfig.update).toHaveBeenCalledTimes(1);
    const updateArg = tenantDb.dteConfig.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ tenantId });
    expect(updateArg.data.imapLastUid).toBe(175);
    expect(updateArg.data.imapLastPollAt).toBeInstanceOf(Date);
  });

  it('continues processing when one message fails to iterate/parse (does not block the loop)', async () => {
    const xmlBody =
      '<?xml version="1.0"?><EnvioDTE><SetDTE><DTE>ok</DTE></SetDTE></EnvioDTE>';
    const goodSource = Buffer.from(
      'Content-Type: multipart/mixed; boundary="B"\r\n\r\n' +
        '--B\r\n' +
        'Content-Type: text/xml\r\n\r\n' +
        xmlBody +
        '\r\n--B--\r\n',
      'utf-8',
    );

    // We use the service's own try/catch path: simulate a message whose
    // extractXmlAttachments path throws by giving it a bodyStructure that
    // causes client.download to reject. The service catches per-message
    // errors and continues.
    const messages: FakeMessage[] = [
      {
        uid: 200,
        envelope: { from: [{ address: 'good1@x.cl' }], subject: 'Good 1' },
        source: goodSource,
      },
      {
        // No source → triggers bodyStructure path; download will throw
        uid: 201,
        envelope: { from: [{ address: 'bad@x.cl' }], subject: 'Bad' },
        bodyStructure: {
          type: 'text',
          subtype: 'xml',
          part: '1',
        },
      },
      {
        uid: 202,
        envelope: { from: [{ address: 'good2@x.cl' }], subject: 'Good 2' },
        source: goodSource,
      },
    ];

    (jest.requireMock('imapflow').ImapFlow as jest.Mock).mockImplementationOnce(
      function () {
        const c = createMockImapClient(messages);
        // Make download throw for the middle message to simulate parse failure
        c.download = jest
          .fn()
          .mockRejectedValue(new Error('boom download failure'));
        imapFlowInstances.push(c);
        return c;
      },
    );

    const result = await service.pollForNewDtes(tenantId);

    // Both good messages should have produced events; bad message skipped
    expect(result).toBe(2);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
    const subjects = eventEmitter.emit.mock.calls.map(
      (c: any[]) => c[1].subject,
    );
    expect(subjects).toEqual(expect.arrayContaining(['Good 1', 'Good 2']));
    // maxUid should still advance to the highest uid, including the "bad" one
    const updateArg = tenantDb.dteConfig.update.mock.calls[0][0];
    expect(updateArg.data.imapLastUid).toBe(202);
  });

  it('always calls logout even when fetch throws', async () => {
    (jest.requireMock('imapflow').ImapFlow as jest.Mock).mockImplementationOnce(
      function () {
        const c = createMockImapClient([]);
        c.getMailboxLock = jest
          .fn()
          .mockRejectedValue(new Error('mailbox locked'));
        imapFlowInstances.push(c);
        return c;
      },
    );

    await expect(service.pollForNewDtes(tenantId)).rejects.toThrow(
      'mailbox locked',
    );

    const client = imapFlowInstances[imapFlowInstances.length - 1];
    expect(client.logout).toHaveBeenCalledTimes(1);
  });
});
