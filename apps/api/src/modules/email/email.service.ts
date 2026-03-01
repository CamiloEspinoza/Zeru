import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { EmailConfigService, type DecryptedEmailConfig } from '../email-config/email-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailConfigService: EmailConfigService,
  ) {
    const keyId = this.config.get<string>('AWS_SES_ACCESS_KEY_ID');
    if (!keyId) {
      this.logger.warn(
        'AWS_SES_ACCESS_KEY_ID not configured — system emails (login codes) will fail. ' +
        'Configure AWS_SES_* env vars in .env.production.',
      );
    }
  }

  /**
   * Envía un código de login al email del usuario.
   * Siempre usa las credenciales SES del sistema (env vars) — los login codes
   * son emails de plataforma, no del tenant.
   */
  async sendLoginCode(to: string, code: string, expiryMinutes = 10): Promise<void> {
    const creds = this.systemCredentials();

    const command = new SendEmailCommand({
      Source: creds.fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `${code} — Tu código de acceso a Zeru`, Charset: 'UTF-8' },
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: this.buildLoginCodeHtml(code, expiryMinutes),
          },
          Text: {
            Charset: 'UTF-8',
            Data: `Tu código de acceso a Zeru es: ${code}\n\nEste código expira en ${expiryMinutes} minutos.\nSi no solicitaste este código, ignora este mensaje.`,
          },
        },
      },
    });

    try {
      await this.withSesClient(creds, (client) => client.send(command));
      this.logger.log(`Login code sent to ${this.maskEmail(to)}`);
    } catch (err) {
      this.logger.error(`Failed to send login code to ${this.maskEmail(to)}: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Envía un email genérico usando las credenciales del tenant dado.
   * Fallback a env vars si no hay config de tenant.
   */
  async sendEmail(
    tenantId: string,
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    const creds = await this.resolveCredentialsByTenant(tenantId);

    const command = new SendEmailCommand({
      Source: creds.fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Charset: 'UTF-8', Data: html },
          ...(text ? { Text: { Charset: 'UTF-8', Data: text } } : {}),
        },
      },
    });

    try {
      await this.withSesClient(creds, (client) => client.send(command));
    } catch (err) {
      this.logger.error(`Failed to send email to ${this.maskEmail(to)}: ${(err as Error).message}`);
      throw err;
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async withSesClient<T>(
    creds: DecryptedEmailConfig,
    fn: (client: SESClient) => Promise<T>,
  ): Promise<T> {
    const client = new SESClient({
      region: creds.region,
      credentials: {
        accessKeyId: creds.accessKeyId,
        secretAccessKey: creds.secretAccessKey,
      },
    });
    try {
      return await fn(client);
    } finally {
      client.destroy();
    }
  }

  private maskEmail(email: string): string {
    return email.replace(/(.{2}).*@/, '$1***@');
  }

  /**
   * Resuelve credenciales SES para un tenant específico (alertas, notificaciones).
   * Usa la config del tenant; fallback a credenciales del sistema si no hay config.
   */
  private async resolveCredentialsByTenant(tenantId: string): Promise<DecryptedEmailConfig> {
    const tenantConfig = await this.emailConfigService.getDecryptedConfig(tenantId);
    if (tenantConfig) return tenantConfig;
    return this.systemCredentials();
  }

  /**
   * Credenciales SES del sistema (env vars). Usadas para emails de plataforma
   * (login codes, registro, etc.) — independientes de cualquier tenant.
   */
  private systemCredentials(): DecryptedEmailConfig {
    return {
      region: this.config.get<string>('AWS_SES_REGION') ?? 'us-east-1',
      accessKeyId: this.config.get<string>('AWS_SES_ACCESS_KEY_ID') ?? '',
      secretAccessKey: this.config.get<string>('AWS_SES_SECRET_ACCESS_KEY') ?? '',
      fromEmail: this.config.get<string>('AWS_SES_FROM_EMAIL') ?? 'noreply@zeru.cl',
    };
  }

  private buildLoginCodeHtml(code: string, expiryMinutes: number): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 0">
    <tr><td align="center">
      <table width="420" cellpadding="0" cellspacing="0" style="background:#141414;border-radius:16px;border:1px solid rgba(255,255,255,0.06);padding:48px 40px">
        <tr><td>
          <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 8px">Zeru</h1>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 32px">Tu código de acceso</p>
          <div style="background:rgba(20,184,166,0.08);border:1px solid rgba(20,184,166,0.2);border-radius:12px;padding:24px;text-align:center;margin-bottom:32px">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#2dd4bf;font-family:'Courier New',monospace">${code}</span>
          </div>
          <p style="color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;margin:0">
            Este código expira en <strong style="color:rgba(255,255,255,0.6)">${expiryMinutes} minutos</strong>.<br>
            Si no solicitaste este código, puedes ignorar este mensaje.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
  }
}
