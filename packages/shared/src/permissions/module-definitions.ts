export type AccessLevel = 'NONE' | 'VIEW' | 'EDIT' | 'MANAGE';

export type SidebarSection =
  | 'core'
  | 'business'
  | 'people'
  | 'laboratory'
  | 'marketing'
  | 'system';

export interface GranularPermission {
  key: string;
  label: string;
  description?: string;
  minLevel: AccessLevel;
}

export interface ModuleDefinition {
  key: string;
  label: string;
  section: SidebarSection;
  granularPermissions: GranularPermission[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  // ── Core ──
  {
    key: 'dashboard',
    label: 'Inicio',
    section: 'core',
    granularPermissions: [],
  },
  {
    key: 'assistant',
    label: 'Asistente IA',
    section: 'core',
    granularPermissions: [],
  },
  {
    key: 'calendar',
    label: 'Calendario',
    section: 'core',
    granularPermissions: [],
  },
  {
    key: 'documents',
    label: 'Documentos',
    section: 'core',
    granularPermissions: [],
  },
  {
    key: 'projects',
    label: 'Proyectos',
    section: 'core',
    granularPermissions: [
      { key: 'create', label: 'Crear proyectos', minLevel: 'EDIT' },
      { key: 'delete', label: 'Eliminar proyectos', minLevel: 'MANAGE' },
      { key: 'manage-members', label: 'Gestionar miembros', minLevel: 'MANAGE' },
    ],
  },

  // ── Negocio ──
  {
    key: 'clients',
    label: 'Clientes',
    section: 'business',
    granularPermissions: [
      { key: 'create', label: 'Crear clientes', minLevel: 'EDIT' },
      { key: 'edit', label: 'Editar clientes', minLevel: 'EDIT' },
      { key: 'delete', label: 'Eliminar clientes', minLevel: 'MANAGE' },
      {
        key: 'manage-profile',
        label: 'Configurar perfil cobranza',
        minLevel: 'MANAGE',
      },
      {
        key: 'manage-contracts',
        label: 'Gestionar contratos',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'collections',
    label: 'Cobranzas',
    section: 'business',
    granularPermissions: [
      {
        key: 'create-liquidation',
        label: 'Crear liquidación',
        minLevel: 'EDIT',
      },
      {
        key: 'approve-liquidation',
        label: 'Aprobar liquidación',
        minLevel: 'MANAGE',
      },
      {
        key: 'void-liquidation',
        label: 'Anular liquidación',
        minLevel: 'MANAGE',
      },
      {
        key: 'register-payment',
        label: 'Registrar pago',
        minLevel: 'EDIT',
      },
      { key: 'export', label: 'Exportar datos', minLevel: 'VIEW' },
    ],
  },
  {
    key: 'invoicing',
    label: 'Facturación',
    section: 'business',
    granularPermissions: [
      { key: 'view-dte', label: 'Ver DTEs', minLevel: 'VIEW' },
      { key: 'emit-dte', label: 'Emitir DTE', minLevel: 'MANAGE' },
      { key: 'void-dte', label: 'Anular DTE', minLevel: 'MANAGE' },
      {
        key: 'manage-certificate',
        label: 'Gestionar certificados',
        minLevel: 'MANAGE',
      },
      {
        key: 'manage-caf',
        label: 'Gestionar folios CAF',
        minLevel: 'MANAGE',
      },
      { key: 'view-config', label: 'Ver configuración', minLevel: 'VIEW' },
      {
        key: 'manage-config',
        label: 'Modificar configuración',
        minLevel: 'MANAGE',
      },
      {
        key: 'switch-environment',
        label: 'Cambiar ambiente SII',
        minLevel: 'MANAGE',
      },
      {
        key: 'manage-received',
        label: 'Aceptar/rechazar DTEs recibidos',
        minLevel: 'EDIT',
      },
      {
        key: 'view-reports',
        label: 'Ver libros y reportes',
        minLevel: 'VIEW',
      },
      { key: 'download-xml', label: 'Descargar XML', minLevel: 'EDIT' },
    ],
  },
  {
    key: 'accounting',
    label: 'Contabilidad',
    section: 'business',
    granularPermissions: [
      { key: 'create-entry', label: 'Crear asientos', minLevel: 'EDIT' },
      { key: 'edit-entry', label: 'Editar asientos', minLevel: 'EDIT' },
      {
        key: 'reverse-entry',
        label: 'Reversar asientos',
        minLevel: 'MANAGE',
      },
      { key: 'close-period', label: 'Cerrar período', minLevel: 'MANAGE' },
      {
        key: 'reopen-period',
        label: 'Reabrir período',
        minLevel: 'MANAGE',
      },
    ],
  },

  // ── Personas ──
  {
    key: 'directory',
    label: 'Directorio',
    section: 'people',
    granularPermissions: [],
  },
  {
    key: 'orgchart',
    label: 'Organigrama',
    section: 'people',
    granularPermissions: [],
  },
  {
    key: 'org-intelligence',
    label: 'Inteligencia Org.',
    section: 'people',
    granularPermissions: [
      {
        key: 'create-project',
        label: 'Crear proyectos',
        minLevel: 'EDIT',
      },
      {
        key: 'conduct-interview',
        label: 'Realizar entrevistas',
        minLevel: 'EDIT',
      },
      {
        key: 'export',
        label: 'Exportar diagnóstico',
        minLevel: 'MANAGE',
      },
    ],
  },

  // ── Laboratorio ──
  {
    key: 'lab',
    label: 'Laboratorio (Admin)',
    section: 'laboratory',
    granularPermissions: [
      { key: 'admin', label: 'Administrar importaciones', minLevel: 'MANAGE' },
      { key: 'view-financial', label: 'Ver datos financieros del laboratorio', minLevel: 'MANAGE' },
    ],
  },
  {
    key: 'lab-reception',
    label: 'Recepción',
    section: 'laboratory',
    granularPermissions: [
      {
        key: 'register-sample',
        label: 'Registrar muestras',
        minLevel: 'EDIT',
      },
      {
        key: 'print-labels',
        label: 'Imprimir etiquetas',
        minLevel: 'VIEW',
      },
      {
        key: 'delete-order',
        label: 'Eliminar órdenes',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'lab-processing',
    label: 'Procesamiento',
    section: 'laboratory',
    granularPermissions: [
      {
        key: 'update-status',
        label: 'Actualizar estado muestra',
        minLevel: 'EDIT',
      },
      {
        key: 'enter-results',
        label: 'Ingresar resultados',
        minLevel: 'EDIT',
      },
    ],
  },
  {
    key: 'lab-reports',
    label: 'Informes de laboratorio',
    section: 'laboratory',
    granularPermissions: [
      { key: 'create-draft', label: 'Crear borrador', minLevel: 'EDIT' },
      { key: 'sign-report', label: 'Firmar informe', minLevel: 'MANAGE' },
      {
        key: 'reject-report',
        label: 'Rechazar informe',
        minLevel: 'MANAGE',
      },
      {
        key: 'export-report',
        label: 'Exportar informes',
        minLevel: 'VIEW',
      },
      {
        key: 'validate',
        label: 'Validar informes anatomopatológicos',
        description: 'Validación y firma de informes anatomopatológicos',
        minLevel: 'MANAGE',
      },
      {
        key: 'override',
        label: 'Sobrescribir validación de informes',
        description: 'Permite anular o forzar el resultado de validación',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'lab-coding',
    label: 'Codificación',
    section: 'laboratory',
    granularPermissions: [
      { key: 'assign-code', label: 'Asignar códigos', minLevel: 'EDIT' },
      {
        key: 'manage-rules',
        label: 'Gestionar reglas',
        minLevel: 'MANAGE',
      },
      {
        key: 'validate-batch',
        label: 'Validar codificación',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'lab-origins',
    label: 'Procedencias',
    section: 'laboratory',
    granularPermissions: [
      { key: 'write', label: 'Crear y editar procedencias', minLevel: 'EDIT' },
      { key: 'export', label: 'Exportar procedencias', minLevel: 'VIEW' },
    ],
  },

  // ── Marketing ──
  {
    key: 'linkedin',
    label: 'LinkedIn',
    section: 'marketing',
    granularPermissions: [
      { key: 'create-post', label: 'Crear posts', minLevel: 'EDIT' },
      { key: 'publish', label: 'Publicar posts', minLevel: 'MANAGE' },
      { key: 'configure', label: 'Configuración', minLevel: 'MANAGE' },
    ],
  },

  // ── Sistema ──
  {
    key: 'operations',
    label: 'Operaciones',
    section: 'system',
    granularPermissions: [
      {
        key: 'manage',
        label: 'Gestión operacional transversal',
        description:
          'Gestión operacional transversal (gerencia de operaciones)',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'approvals',
    label: 'Aprobaciones',
    section: 'system',
    granularPermissions: [
      {
        key: 'decide',
        label: 'Aprobar o rechazar solicitudes',
        description: 'Decide sobre solicitudes de aprobación',
        minLevel: 'EDIT',
      },
      {
        key: 'configure-groups',
        label: 'Configurar grupos aprobadores',
        description: 'Aprobación de solicitudes y configuración de grupos',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'integrations',
    label: 'Integraciones',
    section: 'system',
    granularPermissions: [],
  },
  {
    key: 'reports',
    label: 'Reportes',
    section: 'system',
    granularPermissions: [],
  },
  {
    key: 'admin',
    label: 'Administración',
    section: 'system',
    granularPermissions: [
      { key: 'view-costs', label: 'Ver costos IA', minLevel: 'VIEW' },
      {
        key: 'manage-pricing',
        label: 'Gestionar precios',
        minLevel: 'MANAGE',
      },
    ],
  },
  {
    key: 'settings',
    label: 'Configuración',
    section: 'system',
    granularPermissions: [
      {
        key: 'manage-users',
        label: 'Gestionar usuarios',
        minLevel: 'MANAGE',
      },
      {
        key: 'manage-roles',
        label: 'Gestionar roles',
        minLevel: 'MANAGE',
      },
      {
        key: 'manage-org',
        label: 'Configurar organización',
        minLevel: 'MANAGE',
      },
    ],
  },
];

export const ROUTE_MODULE_MAP: Record<string, string> = {
  '/projects': 'projects',
  '/clients': 'clients',
  '/collections': 'collections',
  '/invoicing': 'invoicing',
  '/accounting': 'accounting',
  '/personas/directorio': 'directory',
  '/personas/organigrama': 'orgchart',
  '/org-intelligence': 'org-intelligence',
  '/laboratory/reception': 'lab-reception',
  '/laboratory/processing': 'lab-processing',
  '/laboratory/reports': 'lab-reports',
  '/laboratory/coding': 'lab-coding',
  '/laboratory/origins': 'lab-origins',
  '/linkedin': 'linkedin',
  '/operations': 'operations',
  '/approvals': 'approvals',
  '/integrations': 'integrations',
  '/reports': 'reports',
  '/admin': 'admin',
  '/settings': 'settings',
};
