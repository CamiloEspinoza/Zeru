import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Service to sanitize and validate XML input strings,
 * preventing injection attacks and malicious content.
 */
@Injectable()
export class XmlSanitizerService {
  /** Patterns considered dangerous in user-provided XML */
  private readonly INJECTION_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
    { pattern: /<script[\s>]/i, label: 'etiqueta script' },
    { pattern: /<\/script>/i, label: 'etiqueta script de cierre' },
    { pattern: /javascript\s*:/i, label: 'protocolo javascript' },
    { pattern: /on\w+\s*=/i, label: 'atributo de evento HTML' },
    { pattern: /<!ENTITY/i, label: 'declaración ENTITY (XXE)' },
    { pattern: /<!DOCTYPE[^>]*\[/i, label: 'DOCTYPE con subset interno' },
    { pattern: /SYSTEM\s+["']/i, label: 'referencia SYSTEM (XXE)' },
    { pattern: /PUBLIC\s+["']/i, label: 'referencia PUBLIC (XXE)' },
  ];

  /**
   * Sanitizes an XML string by removing potentially dangerous content.
   * - Strips XML processing instructions (<?...?>)
   * - Removes CDATA sections
   * - Trims whitespace
   */
  sanitize(input: string): string {
    let result = input;

    // Strip XML processing instructions (<?xml ...?>, <?php ...?>, etc.)
    result = result.replace(/<\?[^?]*\?>/g, '');

    // Remove CDATA sections, keeping inner content
    result = result.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');

    return result.trim();
  }

  /**
   * Validates that an input string does not contain injection payloads.
   * Throws BadRequestException if suspicious content is detected.
   */
  validateNoInjection(input: string): void {
    for (const { pattern, label } of this.INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        throw new BadRequestException(
          `El contenido XML contiene un patrón no permitido: ${label}. Revise el contenido e intente nuevamente.`,
        );
      }
    }
  }
}
