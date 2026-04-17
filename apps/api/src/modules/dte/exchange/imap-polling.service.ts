import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ImapFlow } from 'imapflow';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { DteConfigService } from '../services/dte-config.service';

export interface ImapXmlReceivedPayload {
  tenantId: string;
  xmlContent: string;
  fromEmail: string;
  subject: string;
  receivedAt: Date;
  messageUid: number;
}

/**
 * Polls an IMAP mailbox for incoming DTE XML attachments.
 *
 * This is the entry point for the "Received DTEs" flow:
 * an email with EnvioDTE XML attachments arrives at the company's
 * SII-registered exchange email. This service periodically polls
 * the inbox, extracts XML attachments, and emits events for
 * downstream processing.
 *
 * IMAP credentials are stored per-tenant in DteConfig
 * (imapHost, imapPort, imapUser, encryptedImapPass, imapEnabled).
 *
 * The service tracks the last processed UID so it only picks up new emails.
 */
@Injectable()
export class ImapPollingService {
  private readonly logger = new Logger(ImapPollingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: DteConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Poll the configured IMAP mailbox for new emails with XML attachments.
   * Called by cron or manually via controller.
   *
   * @returns Number of XML attachments found and emitted as events.
   */
  async pollForNewDtes(tenantId: string): Promise<number> {
    const config = await this.configService.get(tenantId);

    if (!config.imapEnabled) {
      this.logger.debug(
        `IMAP polling disabled for tenant ${tenantId}, skipping`,
      );
      return 0;
    }

    if (!config.imapHost || !config.imapUser || !config.encryptedImapPass) {
      this.logger.warn(
        `IMAP credentials incomplete for tenant ${tenantId}, skipping poll`,
      );
      return 0;
    }

    let client: ImapFlow | null = null;
    let processedCount = 0;

    try {
      client = new ImapFlow({
        host: config.imapHost,
        port: config.imapPort ?? 993,
        secure: true,
        auth: {
          user: config.imapUser,
          // DteConfigService.get() already decrypts this in-memory.
          pass: config.encryptedImapPass,
        },
        logger: false,
      });

      await client.connect();
      this.logger.log(
        `Connected to IMAP server ${config.imapHost} for tenant ${tenantId}`,
      );

      const lock = await client.getMailboxLock('INBOX');

      try {
        // Search for messages newer than the last processed UID
        const searchCriteria: Record<string, unknown> = { seen: false };
        if (config.imapLastUid) {
          searchCriteria.uid = `${config.imapLastUid + 1}:*`;
        }

        const messages = client.fetch(searchCriteria, {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: true,
        });

        let maxUid = config.imapLastUid ?? 0;

        for await (const message of messages) {
          try {
            const xmlAttachments = await this.extractXmlAttachments(
              client,
              message,
            );

            const fromAddress =
              message.envelope?.from?.[0]?.address ?? 'unknown';
            const subject = message.envelope?.subject ?? '(sin asunto)';

            for (const xml of xmlAttachments) {
              const payload: ImapXmlReceivedPayload = {
                tenantId,
                xmlContent: xml,
                fromEmail: fromAddress,
                subject,
                receivedAt: new Date(),
                messageUid: message.uid,
              };

              this.eventEmitter.emit('dte.xml-received', payload);
              processedCount++;

              this.logger.log(
                `Emitted dte.xml-received from email "${subject}" (UID ${message.uid})`,
              );
            }

            if (message.uid > maxUid) {
              maxUid = message.uid;
            }
          } catch (msgError) {
            this.logger.error(
              `Error processing message UID ${message.uid}: ${msgError}`,
            );
            // Continue with next message — don't let one bad email block the rest
          }
        }

        // Update last poll timestamp and UID in config
        if (maxUid > (config.imapLastUid ?? 0) || processedCount >= 0) {
          const db = this.prisma.forTenant(
            tenantId,
          ) as unknown as PrismaClient;
          await db.dteConfig.update({
            where: { tenantId },
            data: {
              imapLastPollAt: new Date(),
              ...(maxUid > (config.imapLastUid ?? 0)
                ? { imapLastUid: maxUid }
                : {}),
            },
          });
        }
      } finally {
        lock.release();
      }

      this.logger.log(
        `Poll complete for tenant ${tenantId}: ${processedCount} XML attachment(s) found`,
      );
      return processedCount;
    } catch (error) {
      this.logger.error(
        `IMAP polling failed for tenant ${tenantId}: ${error}`,
      );
      throw error;
    } finally {
      if (client) {
        try {
          await client.logout();
        } catch (logoutError) {
          this.logger.warn(
            `IMAP logout failed for tenant ${tenantId} (connection may already be closed): ${logoutError}`,
          );
        }
      }
    }
  }

  /**
   * Extract XML content from email attachments.
   * Looks for .xml file extensions or text/xml MIME types.
   */
  private async extractXmlAttachments(
    client: ImapFlow,
    message: { uid: number; bodyStructure?: any; source?: Buffer },
  ): Promise<string[]> {
    const xmlContents: string[] = [];

    // Strategy 1: Parse the full source if available
    if (message.source) {
      const sourceStr = message.source.toString('utf-8');
      const extracted = this.extractXmlFromMimeSource(sourceStr);
      if (extracted.length > 0) {
        return extracted;
      }
    }

    // Strategy 2: Walk bodyStructure and fetch individual parts
    if (message.bodyStructure) {
      const xmlParts = this.findXmlParts(message.bodyStructure);

      for (const part of xmlParts) {
        try {
          const { content } = await client.download(
            String(message.uid),
            part.part,
            { uid: true },
          );

          const chunks: Buffer[] = [];
          for await (const chunk of content) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const xmlStr = Buffer.concat(chunks).toString('utf-8');

          // Basic sanity check — must look like XML
          if (
            xmlStr.includes('<?xml') ||
            xmlStr.includes('<EnvioDTE') ||
            xmlStr.includes('<DTE')
          ) {
            xmlContents.push(xmlStr);
          }
        } catch (partError) {
          this.logger.warn(
            `Failed to download part ${part.part} of UID ${message.uid}: ${partError}`,
          );
        }
      }
    }

    return xmlContents;
  }

  /**
   * Extract XML documents from a raw MIME email source.
   * This handles base64-encoded and quoted-printable attachments.
   */
  private extractXmlFromMimeSource(source: string): string[] {
    const results: string[] = [];

    // Look for XML-like content in the email source
    // Match base64-encoded sections after XML content-type headers
    const mimePartRegex =
      /Content-Type:\s*(?:text\/xml|application\/xml)[^\r\n]*(?:\r?\n[^\r\n]+)*\r?\n\r?\n([\s\S]*?)(?=--[\w-]+|$)/gi;

    let match: RegExpExecArray | null;
    while ((match = mimePartRegex.exec(source)) !== null) {
      const bodyContent = match[1].trim();

      // Check if base64 encoded
      if (/Content-Transfer-Encoding:\s*base64/i.test(match[0])) {
        try {
          const decoded = Buffer.from(
            bodyContent.replace(/\s/g, ''),
            'base64',
          ).toString('utf-8');
          if (decoded.includes('<DTE') || decoded.includes('<EnvioDTE')) {
            results.push(decoded);
          }
        } catch (decodeError) {
          this.logger.warn(
            `Failed to decode base64 XML attachment in MIME source: ${decodeError}`,
          );
        }
      } else if (
        bodyContent.includes('<DTE') ||
        bodyContent.includes('<EnvioDTE')
      ) {
        // Plain text or quoted-printable
        results.push(bodyContent);
      }
    }

    return results;
  }

  /**
   * Recursively find MIME parts with XML content type in a bodyStructure tree.
   */
  private findXmlParts(
    structure: any,
    parentPart = '',
  ): Array<{ part: string; type: string }> {
    const parts: Array<{ part: string; type: string }> = [];

    if (!structure) return parts;

    const type = `${structure.type ?? ''}/${structure.subtype ?? ''}`.toLowerCase();
    const filename = (
      structure.dispositionParameters?.filename ??
      structure.parameters?.name ??
      ''
    ).toLowerCase();

    const isXml =
      type === 'text/xml' ||
      type === 'application/xml' ||
      filename.endsWith('.xml');

    if (isXml) {
      const currentPart = structure.part || parentPart || '1';
      parts.push({ part: currentPart, type });
    }

    // Recurse into child parts (multipart messages)
    if (structure.childNodes?.length) {
      for (let i = 0; i < structure.childNodes.length; i++) {
        const childPart = parentPart
          ? `${parentPart}.${i + 1}`
          : `${i + 1}`;
        parts.push(...this.findXmlParts(structure.childNodes[i], childPart));
      }
    }

    return parts;
  }
}
