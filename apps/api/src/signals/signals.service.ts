// src/signals/signals.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SignalStatus, SignalCategory, Prisma } from '@prisma/client';

export interface SignalFilters {
  status?: SignalStatus;
  category?: SignalCategory;
  minConfidence?: number;
  sourceId?: string;
  keywordId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SignalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string, filters: SignalFilters) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SignalWhereInput = {
      organizationId: orgId,
      ...(filters.status && { status: filters.status }),
      ...(filters.category && { category: filters.category }),
      ...(filters.minConfidence !== undefined && { confidenceScore: { gte: filters.minConfidence } }),
      ...(filters.sourceId && { sourceId: filters.sourceId }),
      ...(filters.keywordId && { keywords: { some: { keywordId: filters.keywordId } } }),
      ...(filters.search && {
        OR: [
          { originalTitle: { contains: filters.search, mode: 'insensitive' } },
          { originalText: { contains: filters.search, mode: 'insensitive' } },
          { normalizedText: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.dateFrom || filters.dateTo) && {
        fetchedAt: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(filters.dateTo) }),
        },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.signal.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ confidenceScore: 'desc' }, { fetchedAt: 'desc' }],
        include: {
          source: { select: { id: true, name: true, type: true } },
          keywords: { include: { keyword: { select: { id: true, phrase: true } } } },
          _count: { select: { annotations: true } },
        },
      }),
      this.prisma.signal.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(orgId: string, id: string) {
    const signal = await this.prisma.signal.findFirst({
      where: { id, organizationId: orgId },
      include: {
        source: true,
        keywords: { include: { keyword: true } },
        annotations: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!signal) throw new NotFoundException('Signal not found');
    return signal;
  }

  async updateStatus(orgId: string, id: string, userId: string, status: SignalStatus) {
    const signal = await this.prisma.signal.findFirst({ where: { id, organizationId: orgId } });
    if (!signal) throw new NotFoundException('Signal not found');

    const actionMap: Record<SignalStatus, any> = {
      SAVED: 'SIGNAL_SAVED',
      IGNORED: 'SIGNAL_IGNORED',
      BOOKMARKED: 'SIGNAL_BOOKMARKED',
      NEW: 'SIGNAL_SAVED',
    };

    const [updated] = await Promise.all([
      this.prisma.signal.update({ where: { id }, data: { status } }),
      this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: actionMap[status], metadata: { signalId: id } },
      }),
    ]);
    return updated;
  }

  async addAnnotation(orgId: string, signalId: string, userId: string, note: string) {
    const signal = await this.prisma.signal.findFirst({ where: { id: signalId, organizationId: orgId } });
    if (!signal) throw new NotFoundException('Signal not found');

    return this.prisma.signalAnnotation.create({
      data: { signalId, userId, note },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async getStats(orgId: string) {
    const [total, byCategory, byStatus, highConfidence, recent] = await Promise.all([
      this.prisma.signal.count({ where: { organizationId: orgId } }),
      this.prisma.signal.groupBy({
        by: ['category'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.signal.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: true,
      }),
      this.prisma.signal.count({
        where: { organizationId: orgId, confidenceScore: { gte: 80 }, status: 'NEW' },
      }),
      this.prisma.signal.count({
        where: {
          organizationId: orgId,
          fetchedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return { total, byCategory, byStatus, highConfidence, recent };
  }
}
