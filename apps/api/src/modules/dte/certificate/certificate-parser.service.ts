import { Injectable } from '@nestjs/common';
import { Certificado } from '@devlas/dte-sii';
import { createHash } from 'crypto';

export interface ParsedCertificateInfo {
  subjectName: string;
  subjectRut: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validUntil: Date;
  sha256Fingerprint: string;
}

@Injectable()
export class CertificateParserService {
  parse(
    p12Buffer: Buffer,
    password: string,
  ): { info: ParsedCertificateInfo; cert: Certificado } {
    const cert = new Certificado(p12Buffer, password);

    const certBase64 = cert.getCertificateBase64();
    const fingerprint = createHash('sha256')
      .update(certBase64, 'base64')
      .digest('hex');

    const info: ParsedCertificateInfo = {
      subjectName: cert.nombre || 'Unknown',
      subjectRut: cert.rut || 'Unknown',
      issuer: 'Prestador Acreditado',
      serialNumber: fingerprint.slice(0, 40),
      validFrom: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      sha256Fingerprint: fingerprint,
    };

    return { info, cert };
  }
}
