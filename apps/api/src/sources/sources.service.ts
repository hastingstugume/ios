// sources.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
    this.validateConfig(data.type, data.config);
    const existing = await this.prisma.source.findFirst({
      where: { organizationId: orgId, name: { equals: data.name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Source name already exists');

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
    if (data.name && data.name.toLowerCase() !== src.name.toLowerCase()) {
      const existing = await this.prisma.source.findFirst({
        where: { organizationId: orgId, name: { equals: data.name, mode: 'insensitive' }, NOT: { id } },
      });
      if (existing) throw new ConflictException('Source name already exists');
    }
    if (data.config) {
      this.validateConfig(src.type, data.config);
    }
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

  private validateConfig(type: SourceType, config: Record<string, any>) {
    if (type === SourceType.REDDIT) {
      if (!config?.subreddit || typeof config.subreddit !== 'string') {
        throw new BadRequestException('Reddit sources require a subreddit name');
      }
    }
    if (type === SourceType.RSS) {
      if (!config?.url || typeof config.url !== 'string' || !/^https?:\/\//.test(config.url)) {
        throw new BadRequestException('RSS sources require a valid feed URL');
      }
    }
  }
}
