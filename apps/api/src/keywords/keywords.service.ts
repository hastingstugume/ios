// keywords.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KeywordsService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.keyword.findMany({
      where: { organizationId: orgId },
      include: { _count: { select: { signalKeywords: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, phrase: string, description?: string) {
    const existing = await this.prisma.keyword.findFirst({
      where: { organizationId: orgId, phrase: { equals: phrase, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('Keyword already exists');

    return this.prisma.keyword.create({
      data: { organizationId: orgId, phrase, description },
    });
  }

  async update(orgId: string, id: string, data: { phrase?: string; description?: string; isActive?: boolean }) {
    const kw = await this.prisma.keyword.findFirst({ where: { id, organizationId: orgId } });
    if (!kw) throw new NotFoundException('Keyword not found');
    if (data.phrase && data.phrase.toLowerCase() !== kw.phrase.toLowerCase()) {
      const existing = await this.prisma.keyword.findFirst({
        where: { organizationId: orgId, phrase: { equals: data.phrase, mode: 'insensitive' }, NOT: { id } },
      });
      if (existing) throw new ConflictException('Keyword already exists');
    }
    return this.prisma.keyword.update({ where: { id }, data });
  }

  async remove(orgId: string, id: string, userId: string) {
    const kw = await this.prisma.keyword.findFirst({ where: { id, organizationId: orgId } });
    if (!kw) throw new NotFoundException('Keyword not found');
    await Promise.all([
      this.prisma.keyword.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: { organizationId: orgId, userId, action: 'KEYWORD_DELETED', metadata: { phrase: kw.phrase } },
      }),
    ]);
    return { success: true };
  }
}
