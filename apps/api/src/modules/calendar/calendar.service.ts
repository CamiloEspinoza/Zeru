import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: 'linkedin' | 'interviews' | 'accounting' | 'automations';
  status?: string;
  color: string;
  metadata: Record<string, unknown>;
  href: string;
}

const SOURCE_COLORS = {
  linkedin: '#0077B5',
  interviews: '#8B5CF6',
  accounting: '#F59E0B',
  automations: '#EF4444',
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(
    tenantId: string,
    from: Date,
    to: Date,
    sources: string[],
  ): Promise<CalendarEvent[]> {
    const results: CalendarEvent[][] = await Promise.all([
      sources.includes('linkedin') ? this.getLinkedInEvents(tenantId, from, to) : [],
      sources.includes('interviews') ? this.getInterviewEvents(tenantId, from, to) : [],
      sources.includes('accounting') ? this.getAccountingEvents(tenantId, from, to) : [],
    ]);

    return results.flat().sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  private async getLinkedInEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const posts = await client.linkedInPost.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { scheduledAt: { gte: from, lte: to } },
          { publishedAt: { gte: from, lte: to } },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return posts.map((p) => ({
      id: p.id,
      title: p.content.split('\n')[0].slice(0, 60),
      start: (p.scheduledAt ?? p.publishedAt ?? p.createdAt).toISOString(),
      allDay: false,
      source: 'linkedin' as const,
      status: p.status,
      color: SOURCE_COLORS.linkedin,
      metadata: {
        content: p.content,
        contentPillar: p.contentPillar,
        mediaType: p.mediaType,
      },
      href: `/linkedin/posts`,
    }));
  }

  private async getInterviewEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const interviews = await client.interview.findMany({
      where: {
        tenantId,
        deletedAt: null,
        interviewDate: { gte: from, lte: to },
      },
      include: { speakers: { select: { name: true, isInterviewer: true } }, project: { select: { id: true, name: true } } },
      orderBy: { interviewDate: 'asc' },
    });

    return interviews.map((i) => ({
      id: i.id,
      title: i.title ?? 'Entrevista sin título',
      start: (i.interviewDate ?? i.createdAt).toISOString(),
      allDay: true,
      source: 'interviews' as const,
      status: i.processingStatus,
      color: SOURCE_COLORS.interviews,
      metadata: {
        speakers: i.speakers.map((s) => s.name ?? 'Sin nombre'),
        projectName: (i.project as { name?: string })?.name ?? '',
        projectId: i.projectId,
      },
      href: `/org-intelligence/projects/${i.projectId}/interviews/${i.id}`,
    }));
  }

  private async getAccountingEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const periods = await client.fiscalPeriod.findMany({
      where: {
        tenantId,
        deletedAt: null,
        endDate: { gte: from, lte: to },
      },
      orderBy: { endDate: 'asc' },
    });

    return periods.map((p) => ({
      id: p.id,
      title: `Cierre: ${p.name}`,
      start: p.endDate.toISOString(),
      allDay: true,
      source: 'accounting' as const,
      status: p.status,
      color: SOURCE_COLORS.accounting,
      metadata: { periodName: p.name },
      href: `/accounting/periods`,
    }));
  }
}
