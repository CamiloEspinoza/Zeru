import { Test } from '@nestjs/testing';
import { Pdf417Service } from './pdf417.service';

// Mock bwip-js — real library would otherwise generate a bitmap during tests.
const toBufferMock = jest.fn();

jest.mock('bwip-js', () => ({
  __esModule: true,
  default: {
    toBuffer: (...args: unknown[]) => toBufferMock(...args),
  },
  toBuffer: (...args: unknown[]) => toBufferMock(...args),
}));

describe('Pdf417Service', () => {
  let service: Pdf417Service;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [Pdf417Service],
    }).compile();
    service = moduleRef.get(Pdf417Service);
  });

  it('generate() returns a base64 data URL PNG string', async () => {
    toBufferMock.mockImplementation((opts: unknown, cb?: unknown) => {
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header bytes
      if (typeof cb === 'function') {
        (cb as (err: Error | null, b: Buffer) => void)(null, buf);
      }
      return Promise.resolve(buf);
    });

    const result = await service.generate('<TED>data</TED>');

    expect(typeof result).toBe('string');
    expect(result.startsWith('data:image/png;base64,')).toBe(true);
    const b64 = result.replace('data:image/png;base64,', '');
    // Decoded first bytes should be the PNG signature we mocked.
    expect(Buffer.from(b64, 'base64').slice(0, 4)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );
  });

  it('generate() passes pdf417 options to bwip-js', async () => {
    toBufferMock.mockResolvedValue(Buffer.from('x'));
    await service.generate('<TED>payload</TED>');
    expect(toBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bcid: 'pdf417',
        text: '<TED>payload</TED>',
        encoding: 'latin1',
      }),
    );
  });

  it('generate() propagates errors from bwip-js', async () => {
    toBufferMock.mockRejectedValueOnce(new Error('invalid input'));
    await expect(service.generate('not-valid')).rejects.toThrow(
      'invalid input',
    );
  });

  it('generate() handles empty TED by forwarding to bwip-js', async () => {
    toBufferMock.mockResolvedValue(Buffer.from([0x00]));
    const out = await service.generate('');
    expect(toBufferMock).toHaveBeenCalledWith(
      expect.objectContaining({ text: '' }),
    );
    expect(out.startsWith('data:image/png;base64,')).toBe(true);
  });
});
