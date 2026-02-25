import type { FunctionTool } from 'openai/resources/responses/responses';

/**
 * Definiciones de herramientas contables para el agente de IA.
 * Estas se envían a OpenAI en cada llamada a la Responses API.
 */
export const ACCOUNTING_TOOLS: FunctionTool[] = [
  {
    type: 'function',
    name: 'list_accounts',
    description:
      'Lista el plan de cuentas del tenant actual. Úsala para conocer las cuentas disponibles antes de crear asientos.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_account',
    description:
      'Crea una nueva cuenta contable en el plan de cuentas. Verifica primero con list_accounts que no exista.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Código de la cuenta (ej: "1.1.05", "2.1.03")',
        },
        name: {
          type: 'string',
          description: 'Nombre descriptivo de la cuenta (ej: "Capital social")',
        },
        type: {
          type: 'string',
          enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
          description: 'Tipo de cuenta contable',
        },
        parentCode: {
          type: ['string', 'null'],
          description: 'Código de la cuenta padre, null si es cuenta raíz',
        },
      },
      required: ['code', 'name', 'type', 'parentCode'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_journal_entry',
    description:
      'Crea un asiento contable. Las líneas deben estar balanceadas (suma débitos = suma créditos). Usa códigos de cuenta del plan de cuentas.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Fecha del asiento en formato ISO 8601 (ej: "2026-01-01")',
        },
        description: {
          type: 'string',
          description: 'Descripción o glosa del asiento',
        },
        fiscalPeriodId: {
          type: 'string',
          description: 'ID del período fiscal al que pertenece el asiento',
        },
        lines: {
          type: 'array',
          description: 'Líneas del asiento (debe haber al menos una con débito y una con crédito)',
          items: {
            type: 'object',
            properties: {
              accountCode: {
                type: 'string',
                description: 'Código de la cuenta a afectar',
              },
              debit: {
                type: 'number',
                description: 'Monto a debitar (0 si es crédito)',
              },
              credit: {
                type: 'number',
                description: 'Monto a acreditar (0 si es débito)',
              },
              description: {
                type: ['string', 'null'],
                description: 'Descripción de la línea, null si no aplica',
              },
            },
            required: ['accountCode', 'debit', 'credit', 'description'],
            additionalProperties: false,
          },
        },
      },
      required: ['date', 'description', 'fiscalPeriodId', 'lines'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_fiscal_periods',
    description: 'Lista los períodos fiscales disponibles. Úsala para obtener el fiscalPeriodId antes de crear asientos.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_fiscal_period',
    description:
      'Crea un período fiscal. Necesario antes de crear asientos contables. Ejemplo: "Año 2024" con startDate 2024-01-01 y endDate 2024-12-31.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Nombre del período (ej: "Año 2024", "Enero 2025")',
        },
        startDate: {
          type: 'string',
          description: 'Fecha de inicio en formato ISO 8601 (ej: "2024-01-01")',
        },
        endDate: {
          type: 'string',
          description: 'Fecha de fin en formato ISO 8601 (ej: "2024-12-31")',
        },
      },
      required: ['name', 'startDate', 'endDate'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_chart_of_accounts_template',
    description:
      'Crea un plan de cuentas estándar chileno para el tenant. Incluye activos, pasivos, patrimonio, ingresos y gastos según estructura SII. Úsala cuando el plan de cuentas está vacío y se necesita empezar a contabilizar.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_journal_entries',
    description:
      'Lista los asientos contables del tenant con detalle completo: cada asiento incluye sus líneas (cuenta, código, débito, crédito, descripción). Permite filtrar por estado (DRAFT, POSTED, VOIDED). Úsala para revisar asientos existentes y ver el detalle necesario para recrear o reversar asientos.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: ['string', 'null'],
          enum: ['DRAFT', 'POSTED', 'VOIDED', null],
          description: 'Filtrar por estado, null para todos',
        },
        page: {
          type: ['number', 'null'],
          description: 'Número de página (1-based), null para la primera',
        },
      },
      required: ['status', 'page'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'post_journal_entry',
    description:
      'Cambia un asiento de DRAFT a POSTED (contabilizado). Solo asientos en estado DRAFT pueden ser posteados. Una vez posteado, el asiento afecta los saldos contables.',
    parameters: {
      type: 'object',
      properties: {
        journalEntryId: {
          type: 'string',
          description: 'ID del asiento contable a postear',
        },
      },
      required: ['journalEntryId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_trial_balance',
    description: 'Obtiene el balance de comprobación del período fiscal activo.',
    parameters: {
      type: 'object',
      properties: {
        fiscalPeriodId: {
          type: 'string',
          description: 'ID del período fiscal',
        },
      },
      required: ['fiscalPeriodId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'tag_document',
    description:
      'Etiqueta un documento adjunto con una categoría contable y tags descriptivos. DEBES llamar esta herramienta siempre que el usuario adjunte un archivo, antes de proponer asientos.',
    parameters: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'ID del documento a etiquetar',
        },
        category: {
          type: 'string',
          enum: ['FACTURA', 'BOLETA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'CONTRATO', 'ESTATUTOS', 'DECLARACION', 'COMPROBANTE', 'REMUNERACION', 'OTRO'],
          description: 'Categoría principal del documento',
        },
        tags: {
          type: 'array',
          description: 'Tags descriptivos libres (ej: ["IVA", "proveedor", "capital social"])',
          items: { type: 'string' },
        },
      },
      required: ['documentId', 'category', 'tags'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'link_document_to_entry',
    description:
      'Vincula un documento a un asiento contable creado. Llama esta herramienta después de crear cada asiento relacionado con un documento adjunto.',
    parameters: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'ID del documento adjunto',
        },
        journalEntryId: {
          type: 'string',
          description: 'ID del asiento contable creado',
        },
      },
      required: ['documentId', 'journalEntryId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_document_journal_entries',
    description:
      'Consulta si un documento ya tiene asientos contables vinculados. DEBES llamarla ANTES de crear un asiento para un documento adjunto. Si devuelve asientos, NO crees uno nuevo; informa al usuario que el documento ya fue procesado y menciona el asiento existente para evitar duplicados.',
    parameters: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'ID del documento adjunto a consultar',
        },
      },
      required: ['documentId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'update_conversation_title',
    description:
      'Actualiza el título de la conversación actual con un nombre descriptivo y conciso. Llama esta herramienta en cuanto tengas suficiente contexto para entender de qué trata la conversación. Puedes llamarla más de una vez si el tema evoluciona. El título debe ser breve (máximo 6 palabras), claro y en el mismo idioma del usuario.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título descriptivo de la conversación (máximo 6 palabras)',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'ask_user_question',
    description:
      'Hace una pregunta al usuario cuando necesitas información adicional para completar una tarea. Proporciona opciones sugeridas para facilitar la respuesta. Úsala SOLO cuando sea imprescindible para continuar.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'La pregunta clara y específica para el usuario',
        },
        options: {
          type: 'array',
          description: 'Opciones de respuesta sugeridas (mínimo 2, máximo 6)',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
            },
            required: ['id', 'label'],
            additionalProperties: false,
          },
        },
        allowFreeText: {
          type: 'boolean',
          description: 'Si el usuario puede escribir una respuesta libre además de las opciones',
        },
      },
      required: ['question', 'options', 'allowFreeText'],
      additionalProperties: false,
    },
    strict: true,
  },

  // ─── Memory tools ────────────────────────────────────────────────────────────

  {
    type: 'function',
    name: 'memory_store',
    description: `Guarda un hecho, preferencia, decisión o patrón importante en la memoria persistente del asistente.
Úsala cuando aprendas algo relevante sobre la organización o el usuario que debería recordarse en futuras conversaciones.

Ejemplos de qué guardar:
- Preferencias contables: "El cliente prefiere que los asientos de IVA usen la cuenta 2.1.02.001"
- Patrones recurrentes: "Los salarios se registran el último día de cada mes"
- Decisiones clave: "Se acordó no usar asientos de ajuste automático"
- Datos del negocio: "El proveedor principal de servicios es Empresa X, RUT 76.xxx.xxx-x"
- Preferencias del usuario: "El usuario prefiere respuestas breves y directas"

NO guardes: información transitoria, datos ya en el sistema contable, resultados de consultas puntuales.`,
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'El hecho o preferencia a recordar. Debe ser una oración clara y completa.',
        },
        category: {
          type: 'string',
          enum: ['PREFERENCE', 'FACT', 'PROCEDURE', 'DECISION', 'CONTEXT'],
          description:
            'PREFERENCE: preferencias del usuario/organización. FACT: datos objetivos del negocio. PROCEDURE: procedimientos recurrentes. DECISION: decisiones tomadas. CONTEXT: contexto general.',
        },
        importance: {
          type: 'number',
          description: 'Relevancia del 1 al 10. 10 = crítico para la contabilidad. 5 = útil pero no crítico. 1 = dato secundario.',
        },
        scope: {
          type: 'string',
          enum: ['tenant', 'user'],
          description:
            'tenant = se aplica a toda la organización (compartido con todos sus usuarios). user = preferencia personal del usuario actual.',
        },
        documentId: {
          type: 'string',
          description:
            'ID del documento de origen (UUID) si la memoria fue extraída de un documento adjunto. Cadena vacía "" si no proviene de un documento.',
        },
      },
      required: ['content', 'category', 'importance', 'scope', 'documentId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'memory_search',
    description:
      'Busca en la memoria persistente del asistente por similitud semántica. Úsala cuando necesites recordar algo específico sobre la organización o el usuario que pueda estar guardado en memoria.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Texto de búsqueda. Puede ser una pregunta o descripción de lo que quieres recordar.',
        },
        scope: {
          type: 'string',
          enum: ['tenant', 'user', 'all'],
          description:
            'tenant = solo memorias de la organización. user = solo memorias del usuario. all = ambos (predeterminado).',
        },
      },
      required: ['query', 'scope'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'memory_delete',
    description:
      'Elimina una memoria que ya no es válida, está desactualizada o fue guardada por error. Úsala cuando el usuario corrija información que tenías en memoria o cuando algo ya no aplique.',
    parameters: {
      type: 'object',
      properties: {
        memoryId: {
          type: 'string',
          description: 'ID de la memoria a eliminar (obtenido de memory_search)',
        },
        reason: {
          type: 'string',
          description: 'Breve motivo de la eliminación (para el log interno)',
        },
      },
      required: ['memoryId', 'reason'],
      additionalProperties: false,
    },
    strict: true,
  },
];

/** Human-readable labels para las herramientas */
export const TOOL_LABELS: Record<string, string> = {
  update_conversation_title: 'Actualizando título de conversación',
  list_accounts: 'Consultando plan de cuentas',
  create_account: 'Creando cuenta contable',
  create_journal_entry: 'Creando asiento contable',
  create_fiscal_period: 'Creando período fiscal',
  create_chart_of_accounts_template: 'Creando plan de cuentas estándar',
  list_journal_entries: 'Consultando asientos contables',
  list_fiscal_periods: 'Consultando períodos fiscales',
  post_journal_entry: 'Contabilizando asiento',
  get_trial_balance: 'Obteniendo balance de comprobación',
  tag_document: 'Clasificando documento',
  link_document_to_entry: 'Vinculando documento a asiento',
  get_document_journal_entries: 'Comprobando si el documento ya tiene asientos',
  ask_user_question: 'Preguntando al usuario',
  memory_store: 'Guardando en memoria',
  memory_search: 'Buscando en memoria',
  memory_delete: 'Eliminando de memoria',
};
