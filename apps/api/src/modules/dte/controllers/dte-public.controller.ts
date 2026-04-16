import {
  Controller,
  Get,
  Param,
  Res,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { DtePdfService } from '../services/dte-pdf.service';

interface DtePublicTokenPayload {
  dteId: string;
  tenantId: string;
  purpose: 'dte-public-link';
}

@Controller('dte/public')
export class DtePublicController {
  private readonly logger = new Logger(DtePublicController.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly dtePdfService: DtePdfService,
  ) {}

  @Get(':token')
  async viewPublicPdf(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    let payload: DtePublicTokenPayload;

    try {
      payload = this.jwtService.verify<DtePublicTokenPayload>(token);
    } catch {
      throw new NotFoundException('Documento no encontrado');
    }

    if (payload.purpose !== 'dte-public-link' || !payload.dteId || !payload.tenantId) {
      throw new NotFoundException('Documento no encontrado');
    }

    try {
      const pdfBuffer = await this.dtePdfService.generatePdf(
        payload.tenantId,
        payload.dteId,
        'standard',
      );

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="DTE-${payload.dteId}.pdf"`,
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(pdfBuffer);
    } catch (error) {
      this.logger.warn(
        `Failed to generate public PDF for DTE ${payload.dteId}: ${(error as Error).message}`,
      );
      throw new NotFoundException('Documento no encontrado');
    }
  }
}
