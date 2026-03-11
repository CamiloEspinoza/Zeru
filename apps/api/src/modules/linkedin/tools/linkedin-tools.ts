import type { FunctionTool } from 'openai/resources/responses/responses';

export const LINKEDIN_TOOLS: FunctionTool[] = [
  {
    type: 'function',
    name: 'create_linkedin_post',
    description:
      'Crea un post de LinkedIn. Si autoPublish está desactivado, el post queda en PENDING_APPROVAL y el usuario debe aprobarlo. Si está activado, se publica de inmediato. Úsalo para publicaciones inmediatas o borradores.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Texto del post (commentary). Puede incluir emojis y hashtags.',
        },
        media_type: {
          type: 'string',
          enum: ['NONE', 'ARTICLE', 'IMAGE'],
          description: 'Tipo de media del post. NONE para solo texto, ARTICLE para URL, IMAGE para imagen.',
        },
        media_url: {
          type: ['string', 'null'],
          description: 'URL del artículo (si media_type=ARTICLE) o URL de imagen S3 generada (si media_type=IMAGE). null si no aplica.',
        },
        image_s3_key: {
          type: ['string', 'null'],
          description: 'S3 key de la imagen generada por Gemini (si media_type=IMAGE). null si no aplica.',
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS'],
          description: 'Visibilidad del post en LinkedIn.',
        },
        content_pillar: {
          type: ['string', 'null'],
          description: 'Pilar de contenido al que pertenece este post (ej: "thought-leadership", "tips", "case-study").',
        },
      },
      required: ['content', 'media_type', 'media_url', 'image_s3_key', 'visibility', 'content_pillar'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'schedule_linkedin_post',
    description:
      'Programa un post de LinkedIn para publicarse automáticamente en una fecha y hora específica. El post queda en estado SCHEDULED.',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Texto del post (commentary). Puede incluir emojis y hashtags.',
        },
        scheduled_at: {
          type: 'string',
          description: 'Fecha y hora de publicación en formato ISO 8601 (ej: "2026-03-10T10:00:00.000Z").',
        },
        content_pillar: {
          type: ['string', 'null'],
          description: 'Pilar de contenido (ej: "thought-leadership", "tips", "case-study", "industry-news").',
        },
        media_type: {
          type: 'string',
          enum: ['NONE', 'ARTICLE', 'IMAGE'],
          description: 'Tipo de media. Usa NONE para solo texto.',
        },
        media_url: {
          type: ['string', 'null'],
          description: 'URL del artículo si media_type=ARTICLE. null si no aplica.',
        },
        image_s3_key: {
          type: ['string', 'null'],
          description: 'S3 key de imagen generada si media_type=IMAGE. null si no aplica.',
        },
        visibility: {
          type: 'string',
          enum: ['PUBLIC', 'CONNECTIONS'],
          description: 'Visibilidad del post.',
        },
      },
      required: ['content', 'scheduled_at', 'content_pillar', 'media_type', 'media_url', 'image_s3_key', 'visibility'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'bulk_schedule_posts',
    description:
      'Programa múltiples posts de LinkedIn de una vez. Ideal para crear un calendario de contenido completo (ej: 90 posts para 30 días). Todos quedan en estado SCHEDULED.',
    parameters: {
      type: 'object',
      properties: {
        posts: {
          type: 'array',
          description: 'Lista de posts a programar.',
          items: {
            type: 'object',
            properties: {
              content: {
                type: 'string',
                description: 'Texto del post.',
              },
              scheduled_at: {
                type: 'string',
                description: 'Fecha y hora de publicación en ISO 8601.',
              },
              content_pillar: {
                type: ['string', 'null'],
                description: 'Pilar de contenido.',
              },
              visibility: {
                type: 'string',
                enum: ['PUBLIC', 'CONNECTIONS'],
                description: 'Visibilidad.',
              },
            },
            required: ['content', 'scheduled_at', 'content_pillar', 'visibility'],
            additionalProperties: false,
          },
        },
      },
      required: ['posts'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'generate_image',
    description:
      'Genera una imagen con Google Gemini para usarla en un post de LinkedIn. Usa "flash" (Gemini 3.1 Flash, más rápido y económico) para la mayoría de los casos, y "pro" (Gemini 3 Pro, mayor calidad) solo cuando el usuario pida explícitamente mejor calidad. Devuelve la URL de la imagen generada y su S3 key.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Descripción detallada de la imagen a generar. Sé específico sobre estilo, colores, composición y elementos visuales.',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '4:3', '3:4', '16:9', '9:16'],
          description: 'Relación de aspecto de la imagen. 1:1 para posts cuadrados (recomendado para LinkedIn). 16:9 para banners.',
        },
        model: {
          type: 'string',
          enum: ['flash', 'pro'],
          description: 'Modelo a usar: "flash" = Gemini 3.1 Flash (rápido, económico, recomendado por defecto). "pro" = Gemini 3 Pro (mayor calidad, más lento y costoso).',
        },
      },
      required: ['prompt', 'aspect_ratio', 'model'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_linkedin_connection_status',
    description: 'Verifica si LinkedIn está conectado para este tenant y obtiene info del perfil.',
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
    name: 'get_post_history',
    description: 'Lista los posts recientes de LinkedIn con su estado, contenido y pilar.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: ['string', 'null'],
          enum: ['DRAFT', 'PENDING_APPROVAL', 'SCHEDULED', 'PUBLISHED', 'FAILED', 'CANCELLED', null],
          description: 'Filtrar por estado. null para todos.',
        },
        limit: {
          type: 'number',
          description: 'Número máximo de posts a retornar (máx 50).',
        },
      },
      required: ['status', 'limit'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_scheduled_posts',
    description: 'Lista los posts programados pendientes de publicación, ordenados por fecha.',
    parameters: {
      type: 'object',
      properties: {
        from: {
          type: ['string', 'null'],
          description: 'Fecha de inicio en ISO 8601. null para desde ahora.',
        },
        to: {
          type: ['string', 'null'],
          description: 'Fecha de fin en ISO 8601. null para sin límite.',
        },
      },
      required: ['from', 'to'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'cancel_scheduled_post',
    description: 'Cancela un post programado o pendiente de aprobación.',
    parameters: {
      type: 'object',
      properties: {
        post_id: {
          type: 'string',
          description: 'ID del post a cancelar.',
        },
        reason: {
          type: 'string',
          description: 'Motivo de la cancelación para el log.',
        },
      },
      required: ['post_id', 'reason'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_content_pillars',
    description: 'Obtiene los pilares de contenido configurados para este tenant.',
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
    name: 'ask_user_question',
    description:
      'Hace una pregunta al usuario cuando necesitas información o aprobación. Úsala SIEMPRE antes de publicar un post si autoPublish está desactivado.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'La pregunta clara y específica para el usuario.',
        },
        options: {
          type: 'array',
          description: 'Opciones de respuesta sugeridas (mínimo 2, máximo 6).',
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
          description: 'Si el usuario puede escribir una respuesta libre.',
        },
      },
      required: ['question', 'options', 'allowFreeText'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'update_conversation_title',
    description:
      'Actualiza el título de la conversación actual. Llama esta herramienta cuando entiendas el tema principal.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Título descriptivo (máximo 6 palabras).',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'memory_store',
    description: 'Guarda información importante en memoria persistente (preferencias de contenido, audiencia, decisiones de estilo).',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'El hecho o preferencia a recordar.' },
        category: {
          type: 'string',
          enum: ['PREFERENCE', 'FACT', 'PROCEDURE', 'DECISION', 'CONTEXT'],
          description: 'Categoría de la memoria.',
        },
        importance: { type: 'number', description: 'Relevancia del 1 al 10.' },
        scope: { type: 'string', enum: ['tenant', 'user'], description: 'Alcance de la memoria.' },
        documentId: { type: 'string', description: 'ID del documento de origen. "" si no aplica.' },
      },
      required: ['content', 'category', 'importance', 'scope', 'documentId'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'memory_search',
    description: 'Busca en la memoria persistente por similitud semántica.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda.' },
        scope: { type: 'string', enum: ['tenant', 'user', 'all'], description: 'Alcance de búsqueda.' },
      },
      required: ['query', 'scope'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_skill_reference',
    description: 'Carga el contenido de un archivo de referencia de un skill instalado.',
    parameters: {
      type: 'object',
      properties: {
        skill_name: { type: 'string', description: 'Nombre del skill.' },
        file_path: { type: 'string', description: 'Ruta relativa del archivo dentro del skill.' },
      },
      required: ['skill_name', 'file_path'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export const LINKEDIN_TOOL_LABELS: Record<string, string> = {
  create_linkedin_post: 'Creando post de LinkedIn',
  schedule_linkedin_post: 'Programando post de LinkedIn',
  bulk_schedule_posts: 'Programando calendario de contenido',
  generate_image: 'Generando imagen con Gemini',
  get_linkedin_connection_status: 'Verificando conexión de LinkedIn',
  get_post_history: 'Consultando historial de posts',
  get_scheduled_posts: 'Consultando posts programados',
  cancel_scheduled_post: 'Cancelando post programado',
  get_content_pillars: 'Consultando pilares de contenido',
  ask_user_question: 'Preguntando al usuario',
  update_conversation_title: 'Actualizando título',
  memory_store: 'Guardando en memoria',
  memory_search: 'Buscando en memoria',
  get_skill_reference: 'Cargando referencia del skill',
};
