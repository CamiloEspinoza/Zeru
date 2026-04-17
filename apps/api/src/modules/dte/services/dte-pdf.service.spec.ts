import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DtePdfService } from './dte-pdf.service';
import { Pdf417Service } from './pdf417.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { BrowserPoolService } from '../../browser/browser-pool.service';

// Mock Puppeteer completely — we never launch a real chromium.
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn(),
    close: jest.fn(),
  }),
}));

describe('DtePdfService', () => {
  let service: DtePdfService;
  let prisma: { forTenant: jest.Mock };
  let tenantDb: { dte: { findUniqueOrThrow: jest.Mock } };
  let browserPool: {
    isAvailable: jest.Mock;
    acquire: jest.Mock;
    release: jest.Mock;
  };
  let pdf417: { generate: jest.Mock };
  let page: { setContent: jest.Mock; pdf: jest.Mock };

  const baseDte = (overrides: Record<string, unknown> = {}) => ({
    id: 'dte-1',
    dteType: 'FACTURA_ELECTRONICA',
    status: 'ACCEPTED',
    folio: 100,
    fechaEmision: new Date('2026-04-16'),
    fechaVenc: null,
    formaPago: 1,
    emisorRut: '76123456-7',
    emisorRazon: 'Test SpA',
    emisorGiro: 'Servicios',
    receptorRut: '77654321-K',
    receptorRazon: 'Cliente Ltda',
    receptorGiro: 'Retail',
    receptorDir: 'Calle 1',
    receptorComuna: 'Providencia',
    montoNeto: 100000,
    montoExento: 0,
    tasaIva: 19,
    iva: 19000,
    montoTotal: 119000,
    tedXml: '<TED>...</TED>',
    items: [
      {
        lineNumber: 1,
        itemName: 'Servicio',
        description: null,
        quantity: 1,
        unit: null,
        unitPrice: 100000,
        descuentoMonto: null,
        montoItem: 100000,
      },
    ],
    references: [],
    siiResponse: null,
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    page = {
      setContent: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('PDF-BYTES')),
    };

    browserPool = {
      isAvailable: jest.fn().mockReturnValue(true),
      acquire: jest.fn().mockResolvedValue(page),
      release: jest.fn().mockResolvedValue(undefined),
    };

    tenantDb = {
      dte: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseDte()),
      },
    };
    prisma = { forTenant: jest.fn().mockReturnValue(tenantDb) };
    pdf417 = {
      generate: jest.fn().mockResolvedValue('data:image/png;base64,AAAA'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DtePdfService,
        { provide: PrismaService, useValue: prisma },
        { provide: BrowserPoolService, useValue: browserPool },
        { provide: Pdf417Service, useValue: pdf417 },
      ],
    }).compile();

    service = moduleRef.get(DtePdfService);
  });

  it('generatePdf() loads the DTE and returns a PDF Buffer (factura template)', async () => {
    const out = await service.generatePdf('tenant-1', 'dte-1');

    expect(out).toBeInstanceOf(Buffer);
    expect(tenantDb.dte.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'dte-1' },
        include: { items: true, references: true },
      }),
    );
    // Factura format uses Letter.
    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'Letter', printBackground: true }),
    );
  });

  it('generatePdf() uses boleta template for tipo 39', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValueOnce(
      baseDte({ dteType: 'BOLETA_ELECTRONICA' }),
    );

    await service.generatePdf('tenant-1', 'dte-1');

    // The rendered HTML is the first arg of setContent — ensure it was called.
    expect(page.setContent).toHaveBeenCalled();
    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'Letter' }),
    );
  });

  it('generatePdf() uses thermal template (80mm) when format=thermal', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValueOnce(
      baseDte({ dteType: 'BOLETA_ELECTRONICA' }),
    );

    await service.generatePdf('tenant-1', 'dte-1', 'thermal');

    expect(page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ width: '80mm', printBackground: true }),
    );
  });

  it('generatePdf() includes PDF417 barcode derived from TED', async () => {
    await service.generatePdf('tenant-1', 'dte-1');
    expect(pdf417.generate).toHaveBeenCalledWith('<TED>...</TED>');
  });

  it('generatePdf() throws when browser is not available', async () => {
    browserPool.isAvailable.mockReturnValueOnce(false);
    await expect(service.generatePdf('tenant-1', 'dte-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('generatePdf() rejects non-commercially-usable DTEs', async () => {
    tenantDb.dte.findUniqueOrThrow.mockResolvedValueOnce(
      baseDte({ status: 'DRAFT' }),
    );
    await expect(service.generatePdf('tenant-1', 'dte-1')).rejects.toThrow(
      /No se puede generar PDF/,
    );
  });

  it('generatePdf() releases the page even if rendering fails', async () => {
    page.pdf.mockRejectedValueOnce(new Error('render boom'));
    await expect(service.generatePdf('tenant-1', 'dte-1')).rejects.toThrow(
      'render boom',
    );
    expect(browserPool.release).toHaveBeenCalledWith(page);
  });
});
