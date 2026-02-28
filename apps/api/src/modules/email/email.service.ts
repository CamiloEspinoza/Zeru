import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly ses: SESClient;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.fromEmail = this.config.get<string>('AWS_SES_FROM_EMAIL') ?? 'noreply@zeru.cl';

    this.ses = new SESClient({
      region: this.config.get<string>('AWS_SES_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('AWS_SES_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SES_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  async sendLoginCode(to: string, code: string): Promise<void> {
    const command = new SendEmailCommand({
      Source: this.fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: `${code} — Tu código de acceso a Zeru`, Charset: 'UTF-8' },
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: this.buildLoginCodeHtml(code),
          },
          Text: {
            Charset: 'UTF-8',
            Data: `Tu código de acceso a Zeru es: ${code}\n\nEste código expira en 10 minutos.\nSi no solicitaste este código, ignora este mensaje.`,
          },
        },
      },
    });

    try {
      await this.ses.send(command);
      this.logger.log(`Login code sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send login code to ${to}: ${(err as Error).message}`);
      throw err;
    }
  }

  private buildLoginCodeHtml(code: string): string {
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
            Este código expira en <strong style="color:rgba(255,255,255,0.6)">10 minutos</strong>.<br>
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
