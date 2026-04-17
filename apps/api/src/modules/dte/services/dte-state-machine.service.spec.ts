import { Test } from '@nestjs/testing';
import { DteStateMachineService } from './dte-state-machine.service';

describe('DteStateMachineService', () => {
  let service: DteStateMachineService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DteStateMachineService],
    }).compile();
    service = module.get(DteStateMachineService);
  });

  it('should allow valid transition DRAFT -> QUEUED', () => {
    expect(service.canTransition('DRAFT', 'QUEUED')).toBe(true);
  });

  it('should allow valid transition SIGNED -> SENT', () => {
    expect(service.canTransition('SIGNED', 'SENT')).toBe(true);
  });

  it('should reject invalid transition DRAFT -> ACCEPTED', () => {
    expect(service.canTransition('DRAFT', 'ACCEPTED')).toBe(false);
  });

  it('should reject transition from terminal state REJECTED', () => {
    expect(service.canTransition('REJECTED', 'QUEUED')).toBe(false);
  });

  it('should allow ERROR -> QUEUED (retry)', () => {
    expect(service.canTransition('ERROR', 'QUEUED')).toBe(true);
  });

  it('should transition with optimistic lock', async () => {
    const db: any = {
      dte: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      dteLog: {
        create: jest.fn(),
      },
    };

    await service.transition('dte-1', 'DRAFT', 'QUEUED', db, 'test');

    expect(db.dte.updateMany).toHaveBeenCalledWith({
      where: { id: 'dte-1', status: 'DRAFT' },
      data: { status: 'QUEUED' },
    });
    expect(db.dteLog.create).toHaveBeenCalled();
  });

  it('should throw ConflictException on stale transition', async () => {
    const db: any = {
      dte: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ status: 'SIGNED' }),
      },
    };

    await expect(
      service.transition('dte-1', 'DRAFT', 'QUEUED', db),
    ).rejects.toThrow('ya no está en estado DRAFT');
  });
});
