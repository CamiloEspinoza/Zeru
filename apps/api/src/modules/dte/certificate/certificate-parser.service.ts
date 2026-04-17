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

// Minimal shape of the internal node-forge X509 certificate exposed by
// @devlas/dte-sii's Certificado (`this.cert`). We only use read-only fields.
interface ForgeX509 {
  validity: { notBefore: Date; notAfter: Date };
  serialNumber: string;
  issuer: { getField: (name: string) => { value?: string } | undefined };
  subject: { getField: (name: string) => { value?: string } | undefined };
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

    // The Certificado instance exposes the underlying node-forge X509 cert
    // as `.cert`. Use its parsed validity and issuer to avoid hardcoded dates.
    const x509 = (cert as unknown as { cert: ForgeX509 }).cert;

    const validFrom = x509?.validity?.notBefore ?? new Date();
    const validUntil = x509?.validity?.notAfter ?? new Date();

    const issuerCN = x509?.issuer?.getField('CN')?.value;
    const issuerO = x509?.issuer?.getField('O')?.value;
    const issuer = issuerCN || issuerO || 'Prestador Acreditado';

    // Prefer the real X509 serial (hex string) over a derived fingerprint slice.
    const serialNumber = x509?.serialNumber
      ? x509.serialNumber.toLowerCase()
      : fingerprint.slice(0, 40);

    const info: ParsedCertificateInfo = {
      subjectName: cert.nombre || 'Unknown',
      subjectRut: cert.rut || 'Unknown',
      issuer,
      serialNumber,
      validFrom,
      validUntil,
      sha256Fingerprint: fingerprint,
    };

    return { info, cert };
  }
}
