import { Test } from '@nestjs/testing';
import { DteValidationService } from './dte-validation.service';
import { DteConfigService } from '../services/dte-config.service';
import { ParsedDte } from './dte-xml-parser.service';

describe('DteValidationService', () => {
  let service: DteValidationService;
  let configService: any;

  const mockConfig = {
    rut: '77654321-K',
    razonSocial: 'Mi Empresa SpA',
    giro: 'Servicios',
    direccion: 'Test 123',
    comuna: 'Santiago',
    ciudad: 'Santiago',
    environment: 'PRODUCTION',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockResolvedValue(mockConfig),
    };

    const module = await Test.createTestingModule({
      providers: [
        DteValidationService,
        { provide: DteConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(DteValidationService);
  });

  const validDte: ParsedDte = {
    tipoDTE: 33,
    folio: 12345,
    fechaEmision: '2026-04-10',
    emisor: {
      rut: '76123456-7',
      razonSocial: 'Emisor SpA',
      giro: 'Comercio',
    },
    receptor: {
      rut: '77654321-K',
      razonSocial: 'Mi Empresa SpA',
    },
    totales: {
      montoNeto: 100000,
      montoExento: 0,
      iva: 19000,
      montoTotal: 119000,
      tasaIva: 19,
    },
    items: [
      {
        lineNumber: 1,
        itemName: 'Servicio',
        quantity: 1,
        unitPrice: 100000,
        montoItem: 100000,
      },
    ],
    tedXml: '<TED>...</TED>',
    xmlContent: '<DTE>...</DTE>',
  };

  it('should validate a correct DTE', async () => {
    const result = await service.validate(validDte, 'tenant-1');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.deadlineDate).toBeInstanceOf(Date);
  });

  it('should reject when receptor RUT does not match', async () => {
    const dte = {
      ...validDte,
      receptor: { ...validDte.receptor, rut: '11111111-1' },
    };

    const result = await service.validate(dte, 'tenant-1');

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('no coincide con nuestro RUT'),
    );
  });

  it('should reject when folio is zero or negative', async () => {
    const dte = { ...validDte, folio: 0 };

    const result = await service.validate(dte, 'tenant-1');

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Folio inválido'),
    );
  });

  it('should reject when totals are inconsistent', async () => {
    const dte = {
      ...validDte,
      totales: {
        montoNeto: 100000,
        montoExento: 0,
        iva: 19000,
        montoTotal: 200000, // Wrong total
        tasaIva: 19,
      },
    };

    const result = await service.validate(dte, 'tenant-1');

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('Totales inconsistentes'),
    );
  });

  it('should reject when fecha de emisión is in the future', async () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    const dte = {
      ...validDte,
      fechaEmision: future.toISOString().split('T')[0],
    };

    const result = await service.validate(dte, 'tenant-1');

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('fecha de emisión'),
    );
  });

  it('should reject exempt DTE with IVA', async () => {
    const dte = {
      ...validDte,
      tipoDTE: 34, // Factura exenta
      totales: {
        montoNeto: 0,
        montoExento: 100000,
        iva: 19000, // Should be 0 for exempt
        montoTotal: 100000,
      },
    };

    const result = await service.validate(dte, 'tenant-1');

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('DTE exento'),
    );
  });

  it('should calculate deadline as 8 business days from today', () => {
    // Monday 2026-04-13
    const monday = new Date(2026, 3, 13);
    const deadline = service.calculateDeadline(monday, 8);

    // 8 business days from Monday Apr 13 = Wednesday Apr 23
    // (skipping 2 weekends: Sat Apr 18, Sun Apr 19)
    expect(deadline.getDate()).toBe(23);
    expect(deadline.getMonth()).toBe(3); // April = month 3
  });

  it('should warn when emisor has no razón social', async () => {
    const dte = {
      ...validDte,
      emisor: { ...validDte.emisor, razonSocial: '' },
    };

    const result = await service.validate(dte, 'tenant-1');

    expect(result.warnings).toContainEqual(
      expect.stringContaining('razón social'),
    );
  });
});
