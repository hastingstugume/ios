import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

const mockPrisma: any = {
  alertRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
  },
  signal: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

const mockNotifications = {
  sendAlertEmail: jest.fn(),
};

const mockEntitlements = {
  assertCanCreateAlert: jest.fn(),
};

describe('AlertsService', () => {
  let service: AlertsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: EntitlementsService, useValue: mockEntitlements },
      ],
    }).compile();

    service = module.get(AlertsService);
  });

  it('validates automation assignees during rule creation', async () => {
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);

    await expect(
      service.create('org_1', 'user_1', {
        name: 'Auto assign hot leads',
        emailRecipients: ['owner@example.com'],
        autoAssignUserId: 'user_2',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('applies workflow automation to untouched matching signals', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        name: 'Hot leads',
        keywordIds: [],
        emailRecipients: ['owner@example.com'],
        autoStage: 'OUTREACH',
        autoAssignUserId: 'user_2',
        autoNextStep: 'Send outreach today',
      },
    ]);
    mockPrisma.signal.findUnique.mockResolvedValue({
      id: 'sig_1',
      keywords: [],
      source: { name: 'HN Search' },
    });
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_1',
      status: 'NEW',
      stage: 'TO_REVIEW',
      assigneeId: null,
      nextStep: null,
      closedAt: null,
    });
    mockNotifications.sendAlertEmail.mockResolvedValue(undefined);
    mockPrisma.signal.update.mockResolvedValue({ id: 'sig_1' });
    mockPrisma.alertRule.update.mockResolvedValue({ id: 'rule_1' });

    await service.checkAndTrigger('org_1', 'sig_1', 92, 'BUYING_INTENT');

    expect(mockPrisma.signal.update).toHaveBeenCalledWith({
      where: { id: 'sig_1' },
      data: expect.objectContaining({
        stage: 'OUTREACH',
        assigneeId: 'user_2',
        nextStep: 'Send outreach today',
        status: 'SAVED',
      }),
    });
    expect(mockNotifications.sendAlertEmail).toHaveBeenCalled();
  });

  it('does not override manual workflow progress', async () => {
    mockPrisma.alertRule.findMany.mockResolvedValue([
      {
        id: 'rule_1',
        name: 'Hot leads',
        keywordIds: [],
        emailRecipients: ['owner@example.com'],
        autoStage: 'OUTREACH',
        autoAssignUserId: 'user_2',
        autoNextStep: 'Send outreach today',
      },
    ]);
    mockPrisma.signal.findUnique.mockResolvedValue({
      id: 'sig_1',
      keywords: [],
      source: { name: 'HN Search' },
    });
    mockPrisma.signal.findFirst.mockResolvedValue({
      id: 'sig_1',
      status: 'SAVED',
      stage: 'QUALIFIED',
      assigneeId: 'user_9',
      nextStep: 'Already working this one',
      closedAt: null,
    });
    mockNotifications.sendAlertEmail.mockResolvedValue(undefined);
    mockPrisma.alertRule.update.mockResolvedValue({ id: 'rule_1' });

    await service.checkAndTrigger('org_1', 'sig_1', 92, 'BUYING_INTENT');

    expect(mockPrisma.signal.update).not.toHaveBeenCalled();
    expect(mockNotifications.sendAlertEmail).toHaveBeenCalled();
  });
});
