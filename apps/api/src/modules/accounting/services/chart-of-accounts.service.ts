import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateAccountSchema, UpdateAccountSchema } from '@zeru/shared';

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    const accounts = await client.account.findMany({
      orderBy: { code: 'asc' },
    });

    return this.buildTree(accounts, null);
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    const account = await client.account.findUnique({
      where: { id },
      include: {
        children: true,
      },
    });

    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }

    return account;
  }

  async create(tenantId: string, data: CreateAccountSchema) {
    const client = this.prisma.forTenant(tenantId) as any;

    return client.account.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        parentId: data.parentId ?? null,
      },
    });
  }

  async update(id: string, tenantId: string, data: UpdateAccountSchema) {
    const client = this.prisma.forTenant(tenantId) as any;

    const account = await client.account.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException(`Account with id ${id} not found`);
    }

    return client.account.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
      },
    });
  }

  private buildTree(
    accounts: Array<{ id: string; parentId: string | null; [key: string]: unknown }>,
    parentId: string | null,
  ): Array<Record<string, unknown>> {
    return accounts
      .filter((a) => a.parentId === parentId)
      .map((account) => ({
        ...account,
        children: this.buildTree(accounts, account.id),
      }));
  }
}
