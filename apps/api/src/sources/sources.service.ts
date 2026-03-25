// sources.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SourceType, SourceStatus } from '@prisma/client';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.source.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { signals: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, userId: string, data: {
    name: string; type: SourceType; config: Record<string, any>;
  }) {
    const [source] = await Promise.all([
      this.prisma.source.create({
        data: { organizationId: orgId, ...data, status: SourceStatus.ACTIVE },
      }),
    ]);
    await this.prisma.auditLog.create({
      data: { organizationId: orgId, userId, action: 'SOURCE_CREATED', metadata: { name: data.name } },
    });
    return source;
  }

  async update(orgId: string, id: string, data: Partial<{ name: string; status: SourceStatus; config: any }>) {
    const src = await this.prisma.source.findFirst({ where: { id, organizationId: orgId } });
    if (!src) throw new NotFoundException('Source not found');
    return this.prisma.source.update({ where: { id }, data });
  }

  async remove(orgId: string, id: string, userId: string) {
    const src = await this.prisma.source.findFirst({ where: { id, organizationId: orgId } });
    if (!src) throw new NotFoundException('Source not found');
    await Promise.all([
      this.prisma.source.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: 'SOURCE_DELETED', metadata: { name: src.name } },
      }),
    ]);
    return { success: true };
  }
}
