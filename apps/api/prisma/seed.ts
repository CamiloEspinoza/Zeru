import { PrismaClient, AccountType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const CHART_OF_ACCOUNTS = [
  { code: '1', name: 'Activos', type: 'ASSET' as AccountType },
  { code: '1.1', name: 'Activo Corriente', type: 'ASSET' as AccountType, parentCode: '1' },
  { code: '1.1.01', name: 'Caja', type: 'ASSET' as AccountType, parentCode: '1.1' },
  { code: '1.1.02', name: 'Banco', type: 'ASSET' as AccountType, parentCode: '1.1' },
  { code: '1.1.03', name: 'Clientes', type: 'ASSET' as AccountType, parentCode: '1.1' },
  { code: '1.1.04', name: 'IVA Crédito Fiscal', type: 'ASSET' as AccountType, parentCode: '1.1' },
  { code: '1.2', name: 'Activo No Corriente', type: 'ASSET' as AccountType, parentCode: '1' },
  { code: '2', name: 'Pasivos', type: 'LIABILITY' as AccountType },
  { code: '2.1', name: 'Pasivo Corriente', type: 'LIABILITY' as AccountType, parentCode: '2' },
  { code: '2.1.01', name: 'Proveedores', type: 'LIABILITY' as AccountType, parentCode: '2.1' },
  { code: '2.1.02', name: 'IVA Débito Fiscal', type: 'LIABILITY' as AccountType, parentCode: '2.1' },
  { code: '3', name: 'Patrimonio', type: 'EQUITY' as AccountType },
  { code: '3.1', name: 'Capital', type: 'EQUITY' as AccountType, parentCode: '3' },
  { code: '3.2', name: 'Resultados Acumulados', type: 'EQUITY' as AccountType, parentCode: '3' },
  { code: '4', name: 'Ingresos', type: 'REVENUE' as AccountType },
  { code: '4.1', name: 'Ingresos por Ventas', type: 'REVENUE' as AccountType, parentCode: '4' },
  { code: '5', name: 'Gastos', type: 'EXPENSE' as AccountType },
  { code: '5.1', name: 'Gastos de Administración', type: 'EXPENSE' as AccountType, parentCode: '5' },
  { code: '5.2', name: 'Gastos de Ventas', type: 'EXPENSE' as AccountType, parentCode: '5' },
];

async function main() {
  // Crear tenant demo
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Empresa Demo',
      slug: 'demo',
      rut: '76.000.000-0',
    },
  });

  // Crear usuario admin (email globalmente único)
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'admin@zeru.cl' },
    update: {},
    create: {
      email: 'admin@zeru.cl',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'Zeru',
    },
  });

  // Crear membresía si no existe
  await prisma.userTenant.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: UserRole.OWNER,
    },
  });

  // Plan de cuentas
  const accountMap = new Map<string, string>();

  for (const acc of CHART_OF_ACCOUNTS) {
    const parentId = acc.parentCode ? accountMap.get(acc.parentCode) : undefined;

    const created = await prisma.account.upsert({
      where: { code_tenantId: { code: acc.code, tenantId: tenant.id } },
      update: {},
      create: {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        parentId: parentId ?? null,
        tenantId: tenant.id,
      },
    });

    accountMap.set(acc.code, created.id);
  }

  // Período fiscal
  await prisma.fiscalPeriod.upsert({
    where: { id: 'seed-period-2026' },
    update: {},
    create: {
      id: 'seed-period-2026',
      name: 'Enero - Diciembre 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      tenantId: tenant.id,
    },
  });

  console.log(`✓ Tenant: ${tenant.slug}`);
  console.log(`✓ Usuario: ${user.email} → rol OWNER en tenant "${tenant.name}"`);
  console.log(`✓ Plan de cuentas: ${CHART_OF_ACCOUNTS.length} cuentas`);
  console.log(`✓ Período fiscal 2026`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
