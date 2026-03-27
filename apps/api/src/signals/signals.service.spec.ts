import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SignalsService } from './signals.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma: any = {
  signal: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

describe('SignalsService', () => {
  let service: SignalsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(SignalsService);
  });

  it('rejects assigning a signal to a user outside the workspace', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_1',
      organizationId: 'org_1',
      stage: 'TO_REVIEW',
      status: 'NEW',
      closedAt: null,
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorkflow('org_1', 'sig_1', 'user_1', { assigneeId: 'user_2' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('promotes a new signal into the pipeline when a workflow stage is set', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_1',
      organizationId: 'org_1',
      stage: 'TO_REVIEW',
      status: 'NEW',
      closedAt: null,
    });
    mockPrisma.signal.update.mockResolvedValue({ id: 'sig_1', stage: 'IN_PROGRESS', status: 'SAVED' });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 'log_1' });

    await service.updateWorkflow('org_1', 'sig_1', 'user_1', {
      stage: 'IN_PROGRESS',
      nextStep: 'Reach out to the buyer',
    });

    expect(mockPrisma.signal.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sig_1' },
      data: expect.objectContaining({
        stage: 'IN_PROGRESS',
        status: 'SAVED',
        nextStep: 'Reach out to the buyer',
        closedAt: null,
      }),
    }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'SIGNAL_WORKFLOW_UPDATED',
      }),
    }));
  });

  it('clears workflow fields when resetting a signal back to NEW', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_2',
      organizationId: 'org_1',
      stage: 'OUTREACH',
      status: 'SAVED',
      closedAt: null,
    });
    mockPrisma.signal.update.mockResolvedValue({ id: 'sig_2', status: 'NEW', stage: 'TO_REVIEW' });

    await service.updateStatus('org_1', 'sig_2', 'user_1', 'NEW');

    expect(mockPrisma.signal.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'sig_2' },
      data: expect.objectContaining({
        status: 'NEW',
        stage: 'TO_REVIEW',
        assigneeId: null,
        nextStep: null,
        closedAt: null,
      }),
    }));
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('throws when updating workflow for an unknown signal', async () => {
    mockPrisma.signal.findFirst.mockResolvedValue(null);

    await expect(
      service.updateWorkflow('org_1', 'missing', 'user_1', { stage: 'IN_PROGRESS' }),
    ).rejects.toThrow(NotFoundException);
  });
});
