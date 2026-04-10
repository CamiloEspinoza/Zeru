# Modulo de Personas con Organigrama Interactivo - Diseno UX/UI

> **Fecha:** 2026-03-28
> **Estado:** Propuesta de diseno
> **Tecnologias clave:** React, @xyflow/react (v12), shadcn/ui, NestJS, Prisma

---

## Tabla de Contenidos

1. [A. Arquitectura del Modulo Personas](#a-arquitectura-del-modulo-personas)
2. [B. Modelo de Datos Ampliado](#b-modelo-de-datos-ampliado)
3. [C. Diseno del Organigrama](#c-diseno-del-organigrama)
4. [D. Flujo de Edicion Humana](#d-flujo-de-edicion-humana)
5. [E. Interfaz para Agentes IA](#e-interfaz-para-agentes-ia)
6. [F. Mejoras al Directorio de Personas](#f-mejoras-al-directorio-de-personas)
7. [G. Mockups ASCII](#g-mockups-ascii)

---

## A. Arquitectura del Modulo Personas

### A.1 Nueva Estructura de Navegacion

Actualmente "Personas" vive como sub-item de "Inteligencia Org." en la sidebar. La propuesta es elevarlo a modulo principal de primer nivel, preparandolo para crecer hacia un modulo completo de RRHH.

```
Sidebar (appNav)
  ├── Dashboard
  ├── Asistente
  ├── Documentos
  ├── Contabilidad
  │     ├── Plan de Cuentas
  │     ├── Asientos
  │     ├── Periodos Fiscales
  │     └── Reportes
  ├── Calendario
  ├── Personas  ← NUEVO modulo principal (icono: UserMultipleIcon)
  │     ├── Directorio        /personas
  │     ├── Organigrama       /personas/organigrama
  │     └── [futuro]
  │           ├── Contratos        /personas/contratos
  │           ├── Vacaciones       /personas/vacaciones
  │           ├── Evaluaciones     /personas/evaluaciones
  │           └── Onboarding       /personas/onboarding
  ├── Inteligencia Org.  ← Se mantiene pero SIN "Personas"
  │     ├── Proyectos
  │     └── Knowledge Base
  └── Marketing
        └── LinkedIn
```

### A.2 Rutas del Modulo

| Ruta | Descripcion |
|------|-------------|
| `/personas` | Redirect a `/personas/directorio` |
| `/personas/directorio` | Vista de directorio (listado/tabla) |
| `/personas/organigrama` | Vista de organigrama interactivo |
| `/personas/:id` | Detalle/perfil completo de una persona |
| `/personas/:id/editar` | Edicion del perfil (o dialog modal) |

### A.3 Estructura de Archivos Frontend

```
apps/web/app/(dashboard)/personas/
  ├── layout.tsx               ← Layout compartido con tabs Directorio/Organigrama
  ├── page.tsx                 ← Redirect a /directorio
  ├── directorio/
  │     └── page.tsx           ← Vista de directorio mejorada
  ├── organigrama/
  │     └── page.tsx           ← Vista de organigrama interactivo
  └── [id]/
        └── page.tsx           ← Perfil detallado de persona

apps/web/components/personas/
  ├── person-avatar.tsx        ← Mover desde org-intelligence/ (re-export para backward compat)
  ├── person-card.tsx          ← Card reutilizable para grid
  ├── person-table.tsx         ← Tabla del directorio
  ├── person-form-dialog.tsx   ← Dialog crear/editar persona
  ├── person-search.tsx        ← Componente de busqueda con filtros
  ├── orgchart/
  │     ├── orgchart-canvas.tsx      ← Wrapper de ReactFlow
  │     ├── orgchart-node.tsx        ← Custom node para ReactFlow
  │     ├── orgchart-toolbar.tsx     ← Barra de herramientas (zoom, fit, export)
  │     ├── orgchart-sidebar.tsx     ← Panel lateral de detalle al seleccionar nodo
  │     ├── orgchart-minimap.tsx     ← Minimapa de navegacion
  │     └── orgchart-filters.tsx     ← Filtros por departamento, nivel, etc.
  └── hooks/
        ├── use-persons.ts           ← Hook para fetch/cache de personas
        ├── use-orgchart.ts          ← Hook para estado del organigrama
        └── use-orgchart-layout.ts   ← Hook para calculo de layout del arbol
```

### A.4 Layout con Tabs de Navegacion

El layout compartido del modulo incluye un sistema de tabs/pestanas en la parte superior que permite alternar entre las vistas principales sin perder contexto:

```
┌─────────────────────────────────────────────────────────┐
│  Personas                                    [+ Nueva]  │
│                                                         │
│  ┌──────────────┐ ┌─────────────┐                       │
│  │  Directorio  │ │ Organigrama │                       │
│  └──────────────┘ └─────────────┘                       │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│  [Contenido de la tab activa]                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Usar el componente `Tabs` de shadcn/ui enlazado a las rutas (tabs como `Link` components).

---

## B. Modelo de Datos Ampliado

### B.1 Modelo Prisma Actualizado

```prisma
model PersonProfile {
  id          String  @id @default(uuid())
  name        String
  role        String?            // Cargo: "Gerente de Operaciones"
  department  String?            // Departamento: "Operaciones"
  email       String?
  phone       String?
  avatarS3Key String?
  notes       String?

  // ─── Jerarquia organizacional ───
  reportsToId    String?
  reportsTo      PersonProfile?   @relation("ReportsTo", fields: [reportsToId], references: [id])
  directReports  PersonProfile[]  @relation("ReportsTo")

  // ─── Metadata organizacional ───
  employeeCode   String?          // Codigo de empleado (RUT, numero interno, etc.)
  startDate      DateTime?        // Fecha de ingreso
  status         PersonStatus     @default(ACTIVE)

  // ─── Posicion en organigrama (cache visual) ───
  orgchartX      Float?           // Posicion X persistida (opcional, para layout manual)
  orgchartY      Float?           // Posicion Y persistida (opcional, para layout manual)

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  tenantId  String
  tenant    Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@index([tenantId, name])
  @@index([tenantId, reportsToId])
  @@index([tenantId, department])
  @@map("person_profiles")
}

enum PersonStatus {
  ACTIVE      // Persona activa en la organizacion
  INACTIVE    // Persona desvinculada o inactiva
  VACANT      // Posicion vacante (placeholder sin persona asignada)
}
```

### B.2 Justificacion de Campos Nuevos

| Campo | Por que | Uso |
|-------|---------|-----|
| `reportsToId` | Relacion jerarquica para construir el arbol | Organigrama, reportes de equipo |
| `employeeCode` | Identificador unico interno de la empresa | Integraciones, busqueda, CSV import/export |
| `startDate` | Fecha de ingreso | Antiguedad, timeline, RRHH futuro |
| `status` | Estado de la persona/posicion | Filtrar activos, mostrar vacantes en organigrama |
| `orgchartX/Y` | Posiciones manuales del canvas | Persistir layout cuando el usuario arrastra nodos |

### B.3 Consideraciones de Integridad

- `reportsToId` es nullable: las personas en el top de la jerarquia (CEO, Gerente General) no reportan a nadie.
- No se permite referencia circular: validar en el servicio que al asignar `reportsToId`, no se cree un ciclo (A reporta a B, B reporta a A).
- Soft delete (`deletedAt`): ya existe. Al eliminar una persona con reportes directos, mostrar advertencia y preguntar que hacer con sus subordinados.
- El campo `status: VACANT` permite crear posiciones "fantasma" en el organigrama que representan puestos por llenar. Estas posiciones tienen un nombre como "Vacante - Gerente de Ventas" y se muestran con estilo visual diferenciado.

---

## C. Diseno del Organigrama

### C.1 Tecnologia: @xyflow/react

React Flow (ya instalado como `@xyflow/react@^12.10.2`) es la base del canvas interactivo. Permite:

- Custom nodes (nodos personalizados con avatar, nombre, cargo)
- Edges (lineas de conexion entre nodos)
- Drag & drop nativo
- Zoom, pan, minimap
- Callbacks para interaccion (onNodeDrag, onConnect, onNodesChange)
- Layout automatico via algoritmos (dagre, elkjs)

### C.2 Layout General de la Pantalla

La vista de organigrama ocupa el 100% del espacio disponible y se compone de capas superpuestas:

**Capa 1 - Header fijo (arriba del canvas):**
- Breadcrumb: Personas > Organigrama
- Barra de busqueda rapida
- Filtros por departamento (dropdown multi-select)
- Botones de accion: "Agregar Persona", "Auto-layout", "Exportar"

**Capa 2 - Canvas principal (area central):**
- Fondo con patron de puntos sutiles (dot grid) para dar referencia espacial
- Nodos del organigrama dispuestos en arbol top-down
- Edges (lineas) conectando jefe -> subordinado
- Zona de scroll infinito con zoom

**Capa 3 - Controles flotantes:**
- Toolbar de zoom (esquina inferior izquierda): zoom in, zoom out, fit-to-screen, porcentaje actual
- Minimap (esquina inferior derecha): vista miniatura del grafo completo
- Leyenda de colores por departamento (esquina superior derecha, colapsable)

**Capa 4 - Panel lateral (drawer derecho, aparece al seleccionar nodo):**
- Detalle de la persona seleccionada
- Acciones rapidas: editar, cambiar jefe, agregar subordinado
- Lista de reportes directos

### C.3 Diseno del Nodo de Persona

Cada nodo del organigrama es un componente custom de React Flow. Tiene dos variantes segun el nivel de zoom:

**Nodo expandido (zoom >= 70%):**
```
┌──────────────────────────────┐
│  ┌────┐                      │
│  │foto│  Juan Perez          │
│  │    │  Gerente de Ops      │
│  └────┘  Operaciones         │
│          ─────────────────── │
│          3 reportes directos │
│  ○ collapse                  │
└──────────────────────────────┘
```

Dimensiones: ~240px ancho x ~100px alto
- Avatar circular (40x40px) a la izquierda
- Nombre en negrita (14px, truncar si > 20 chars)
- Cargo en gris (12px)
- Departamento con chip de color (12px)
- Indicador de reportes directos (solo si > 0)
- Boton de colapsar/expandir subárbol (icono chevron)
- Borde izquierdo coloreado segun departamento
- Sombra sutil, bordes redondeados (border-radius: 8px)

**Nodo compacto (zoom < 70%):**
```
┌────────────────┐
│  ┌──┐          │
│  │JP│ J. Perez │
│  └──┘ Ger.Ops  │
└────────────────┘
```

Dimensiones: ~160px ancho x ~56px alto
- Avatar mas pequeno (28x28px) con iniciales
- Solo nombre (abreviado) y cargo (abreviado)
- Sin indicador de reportes ni boton de collapse

**Nodo vacante:**
```
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  ┌────┐                      │
│  │ ?? │  VACANTE              │
│  │    │  Gerente de Ventas   │
│  └────┘  Ventas              │
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- Borde punteado (dashed)
- Opacidad reducida (70%)
- Avatar con icono de "?" o silueta generica
- Label "VACANTE" en lugar de nombre

### C.4 Colores por Departamento

Sistema de colores automatico basado en el nombre del departamento. Usar una paleta predefinida de 12 colores que se asignan ciclicamente:

| Indice | Color | Ejemplo Departamento |
|--------|-------|---------------------|
| 0 | `#3B82F6` (blue-500) | Tecnologia |
| 1 | `#10B981` (emerald-500) | Operaciones |
| 2 | `#F59E0B` (amber-500) | Finanzas |
| 3 | `#EF4444` (red-500) | Comercial |
| 4 | `#8B5CF6` (violet-500) | RRHH |
| 5 | `#EC4899` (pink-500) | Marketing |
| 6 | `#06B6D4` (cyan-500) | Legal |
| 7 | `#F97316` (orange-500) | Logistica |
| 8 | `#14B8A6` (teal-500) | Calidad |
| 9 | `#6366F1` (indigo-500) | Produccion |
| 10 | `#84CC16` (lime-500) | Compras |
| 11 | `#A855F7` (purple-500) | Otros |

El color se aplica en:
- Borde izquierdo del nodo (4px solid)
- Chip de departamento dentro del nodo
- Edge (linea) desde el nodo hacia sus subordinados (opacidad 40%)
- Leyenda flotante del canvas

### C.5 Edges (Lineas de Conexion)

- **Tipo:** `smoothstep` (lineas con curvas suaves, no rectas ni bezier)
- **Color:** gris neutro (`#94A3B8`, slate-400) por defecto
- **Grosor:** 1.5px
- **Animacion:** al hacer hover sobre un nodo, sus edges directos se resaltan (color del departamento, grosor 2.5px)
- **Labels en edges:** no se muestran por defecto (el organigrama ya implica "reporta a")

### C.6 Interacciones del Canvas

| Accion | Comportamiento |
|--------|---------------|
| **Click en nodo** | Selecciona el nodo (borde azul), abre panel lateral con detalle |
| **Doble click en nodo** | Abre dialog de edicion rapida |
| **Hover sobre nodo** | Resalta el nodo y sus edges directos, muestra tooltip con email |
| **Drag de nodo** | Mueve el nodo libremente en el canvas (reposicionar visual) |
| **Drag de nodo sobre otro** | Inicia flujo de "mover subordinado": dropdown de confirmacion "Mover [nombre] para que reporte a [nuevo jefe]?" |
| **Click en boton collapse** | Colapsa/expande el subarbol de esa persona. El nodo muestra badge con total de personas ocultas |
| **Scroll (rueda del mouse)** | Zoom in/out |
| **Click + drag en fondo** | Pan (mover el canvas) |
| **Ctrl/Cmd + Click** | Seleccion multiple de nodos |
| **Click en area vacia** | Deselecciona todo, cierra panel lateral |
| **Click derecho en nodo** | Menu contextual: Editar, Agregar subordinado, Cambiar jefe, Eliminar |
| **Click derecho en canvas** | Menu contextual: Agregar persona aqui, Auto-layout, Fit to screen |

### C.7 Toolbar de Zoom y Controles

Ubicacion: esquina inferior izquierda, vertical, semi-transparente.

```
┌─────┐
│  +  │  Zoom in
├─────┤
│ 85% │  Nivel actual (click para input manual)
├─────┤
│  -  │  Zoom out
├─────┤
│ ⛶  │  Fit to screen (ajustar todo el arbol a la vista)
├─────┤
│ ⌖  │  Centrar en root (volver al nodo raiz)
└─────┘
```

### C.8 Minimap

Ubicacion: esquina inferior derecha, 200x140px, semi-transparente.

- Muestra todos los nodos como rectangulos pequenos coloreados por departamento
- Rectangulo de viewport (area visible actualmente) con borde azul
- Click en minimap permite navegar rapidamente a esa zona
- Toggle de visibilidad con boton en toolbar

### C.9 Busqueda en Organigrama

Input de busqueda en el header del organigrama:

1. El usuario escribe un nombre o cargo
2. Se filtran los nodos que coinciden (debounce 300ms)
3. Los nodos que NO coinciden se opacan al 30%
4. Los nodos que SI coinciden mantienen opacidad 100% y se resalta su borde
5. Si hay un solo resultado, el canvas se centra automaticamente en ese nodo
6. Si hay multiples resultados, se muestra un mini-listado debajo del input: "3 resultados - Juan P., Maria G., Pedro L." con flechas para navegar entre ellos (centrar canvas en cada uno)
7. Al limpiar la busqueda, todo vuelve a opacidad normal

### C.10 Filtros por Departamento

Dropdown multi-select en el header:

- Lista de todos los departamentos presentes en la organizacion
- Cada departamento con su chip de color
- Checkbox para seleccionar/deseleccionar
- Al filtrar, se muestran solo los nodos de los departamentos seleccionados Y sus jefes directos (para mantener la cadena jerarquica visible, aunque esten en otro departamento)
- Boton "Todos" para resetear
- Badge con conteo de departamentos activos

### C.11 Layout Automatico (Auto-layout)

Para calcular las posiciones de los nodos automaticamente, usar la libreria `dagre` (ya comun con React Flow):

- **Direccion:** top-to-bottom (TB) por defecto
- **Separacion horizontal entre nodos:** 40px
- **Separacion vertical entre niveles:** 80px
- **Algoritmo:** dagre con `rankdir: 'TB'`, `ranksep: 80`, `nodesep: 40`

El auto-layout se ejecuta:
1. Al cargar el organigrama por primera vez (si no hay posiciones guardadas)
2. Al presionar boton "Auto-layout" en toolbar
3. Al agregar/eliminar personas (con animacion suave de transicion)

Si el usuario ha movido nodos manualmente (posiciones guardadas en `orgchartX/Y`), se respetan esas posiciones y el auto-layout solo se aplica bajo peticion explicita.

### C.12 Escalabilidad (20 a 500 personas)

| Escala | Estrategia |
|--------|-----------|
| **1-50 personas** | Mostrar todo el arbol expandido. Auto-layout funciona bien. |
| **50-150 personas** | Colapsar automaticamente los niveles 3+ al cargar. El usuario expande segun necesita. Minimap es esencial. |
| **150-500 personas** | Colapsar automaticamente niveles 2+. Habilitar "lazy loading" de subarbol al expandir (fetch bajo demanda). Virtualización de nodos fuera de viewport. |

Tecnicas de rendimiento:
- React Flow ya maneja virtualizacion de nodos fuera del viewport
- Usar `memo` en los custom nodes para evitar re-renders innecesarios
- Pagination del fetch: no cargar los 500 perfiles de golpe al organigrama. Cargar nivel 0 y 1, y expandir bajo demanda
- Edge bundling: para arboles muy anchos, agrupar edges en uno solo con label "N reportes" que se expanden al hacer click

---

## D. Flujo de Edicion Humana

### D.1 Agregar una Persona al Organigrama

**Metodo 1 - Desde el header:**
1. Click en boton "+ Nueva Persona" en el header
2. Se abre Dialog (modal) con formulario:
   - Nombre * (obligatorio)
   - Cargo
   - Departamento (input con autocompletado de departamentos existentes)
   - Email
   - Telefono
   - Reporta a (dropdown con busqueda de personas existentes)
   - Foto (upload)
   - Notas
3. Al guardar, el nodo aparece en el organigrama bajo su jefe con animacion de "fade in + slide down"
4. El canvas se centra en el nuevo nodo

**Metodo 2 - Desde un nodo existente (click derecho):**
1. Click derecho en un nodo del organigrama
2. Menu contextual > "Agregar subordinado"
3. Se abre Dialog con el campo "Reporta a" pre-llenado con la persona seleccionada
4. El usuario completa el resto del formulario

**Metodo 3 - Desde el panel lateral:**
1. Seleccionar un nodo (click)
2. En el panel lateral, seccion "Reportes directos", click en "+ Agregar"
3. Se abre Dialog pre-llenado

### D.2 Mover una Persona de un Jefe a Otro

**Metodo 1 - Drag & Drop:**
1. El usuario arrastra un nodo sobre otro nodo
2. Aparece un indicador visual (borde pulsante en el nodo destino)
3. Al soltar, aparece dialog de confirmacion:
   ```
   ┌─────────────────────────────────────────┐
   │  Mover persona                          │
   │                                         │
   │  Mover a "Juan Perez" para que reporte  │
   │  a "Maria Lopez"?                       │
   │                                         │
   │  Jefe actual: Pedro Garcia              │
   │  Nuevo jefe:  Maria Lopez               │
   │                                         │
   │  [ ] Mover tambien sus subordinados     │
   │      (3 personas)                       │
   │                                         │
   │            [Cancelar]  [Confirmar]       │
   └─────────────────────────────────────────┘
   ```
4. Al confirmar, se actualiza `reportsToId` via API
5. El organigrama se re-calcula con animacion de transicion (300ms ease)

**Metodo 2 - Desde edicion del perfil:**
1. Abrir dialog de edicion de la persona
2. Cambiar el campo "Reporta a" en el dropdown
3. Guardar

**Metodo 3 - Desde panel lateral:**
1. Seleccionar nodo
2. En panel lateral, seccion "Reporta a", click en icono de lapiz
3. Dropdown de busqueda para seleccionar nuevo jefe
4. Confirmacion

### D.3 Crear un Departamento/Area

Los departamentos NO son una entidad separada en la base de datos (para mantener simplicidad). Se derivan automaticamente del campo `department` de los perfiles de personas.

**Flujo:**
1. Al crear o editar una persona, el campo "Departamento" es un input con autocompletado
2. Si el usuario escribe un departamento nuevo que no existe, simplemente se crea al guardar
3. Si un departamento queda sin personas, desaparece de las listas de filtro

**Futuro (v2):** Si se necesita metadata de departamento (jefe de area, presupuesto, color personalizado), crear modelo `Department` separado.

### D.4 Gestion de Posiciones Vacantes

1. El usuario puede crear una persona con status `VACANT`
2. En el dialog de creacion, checkbox "Es una posicion vacante"
3. El nombre se auto-sugiere como "Vacante - [Cargo]"
4. Se asigna un jefe (reporta a) para que aparezca en el organigrama
5. El nodo se muestra con estilo visual diferenciado (borde punteado, opacidad reducida, icono de silueta)
6. Al contratar a alguien para esa posicion:
   - Click derecho > "Llenar vacante"
   - Se abre dialog para ingresar los datos de la nueva persona
   - Se reemplaza la vacante por la persona real, manteniendo la posicion en el organigrama

---

## E. Interfaz para Agentes IA

### E.1 Contexto

El pipeline de entrevistas de Zeru puede extraer informacion organizacional de las transcripciones. Un agente IA debe poder:

- Crear personas nuevas detectadas en entrevistas
- Actualizar cargos, departamentos y relaciones jerarquicas
- Consultar el organigrama actual como contexto para analisis

### E.2 API Endpoints Necesarios

Ampliar el controlador actual `PersonProfilesController`:

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| GET | `/api/persons` | Listar personas (paginado, filtros) |
| GET | `/api/persons/:id` | Detalle de una persona |
| POST | `/api/persons` | Crear persona |
| PATCH | `/api/persons/:id` | Actualizar persona |
| DELETE | `/api/persons/:id` | Eliminar persona (soft delete) |
| **GET** | **`/api/persons/orgchart`** | **Arbol jerarquico completo** (nuevo) |
| **PATCH** | **`/api/persons/:id/reports-to`** | **Cambiar jefe** (nuevo) |
| **POST** | **`/api/persons/bulk`** | **Crear/actualizar multiples personas** (nuevo) |
| **GET** | **`/api/persons/departments`** | **Listar departamentos unicos** (nuevo) |
| POST | `/api/persons/:id/avatar` | Subir avatar |
| GET | `/api/persons/:id/avatar` | Obtener URL de avatar |

### E.3 Endpoint de Organigrama: GET /api/persons/orgchart

Devuelve el arbol jerarquico completo en formato anidado, optimizado tanto para renderizado visual como para comprension por agentes IA:

```json
{
  "orgchart": {
    "id": "uuid-ceo",
    "name": "Carlos Martinez",
    "role": "CEO",
    "department": "Direccion",
    "avatarUrl": "https://...",
    "status": "ACTIVE",
    "directReports": [
      {
        "id": "uuid-cto",
        "name": "Ana Gonzalez",
        "role": "CTO",
        "department": "Tecnologia",
        "avatarUrl": "https://...",
        "status": "ACTIVE",
        "directReports": [
          {
            "id": "uuid-dev-lead",
            "name": "Pedro Soto",
            "role": "Dev Lead",
            "department": "Tecnologia",
            "status": "ACTIVE",
            "directReports": []
          }
        ]
      },
      {
        "id": "uuid-cfo",
        "name": "VACANTE",
        "role": "CFO",
        "department": "Finanzas",
        "status": "VACANT",
        "directReports": []
      }
    ]
  },
  "unassigned": [
    {
      "id": "uuid-freelancer",
      "name": "Roberto Diaz",
      "role": "Consultor Externo",
      "department": null,
      "status": "ACTIVE"
    }
  ],
  "stats": {
    "totalPersons": 45,
    "totalActive": 42,
    "totalVacant": 3,
    "departments": ["Direccion", "Tecnologia", "Finanzas", "Operaciones"],
    "maxDepth": 4
  }
}
```

**Notas:**
- `unassigned`: personas sin `reportsToId` que no son raiz (no tienen subordinados tampoco). Son personas "sueltas" que necesitan ser ubicadas.
- El endpoint debe manejar multiples raices (organizaciones con co-CEOs o estructuras planas).

### E.4 Endpoint Bulk: POST /api/persons/bulk

Para que el agente IA pueda crear/actualizar multiples personas de una sola vez (por ejemplo, despues de procesar una entrevista):

```json
{
  "operations": [
    {
      "action": "create",
      "data": {
        "name": "Juan Perez",
        "role": "Gerente de Operaciones",
        "department": "Operaciones",
        "reportsToId": "uuid-coo"
      }
    },
    {
      "action": "update",
      "id": "uuid-existing",
      "data": {
        "role": "Director de Operaciones",
        "department": "Operaciones"
      }
    },
    {
      "action": "move",
      "id": "uuid-person",
      "data": {
        "reportsToId": "uuid-new-boss"
      }
    }
  ]
}
```

Respuesta:
```json
{
  "results": [
    { "action": "create", "success": true, "id": "uuid-new", "name": "Juan Perez" },
    { "action": "update", "success": true, "id": "uuid-existing" },
    { "action": "move", "success": true, "id": "uuid-person" }
  ],
  "summary": {
    "created": 1,
    "updated": 1,
    "moved": 1,
    "errors": 0
  }
}
```

### E.5 Formato de Datos para Agentes IA

Cuando el agente IA necesita entender el organigrama como contexto (por ejemplo, en el system prompt del chat de Zeru), se serializa como texto plano legible:

```
ORGANIGRAMA DE LA ORGANIZACION:

Carlos Martinez - CEO (Direccion)
  ├── Ana Gonzalez - CTO (Tecnologia)
  │     ├── Pedro Soto - Dev Lead (Tecnologia)
  │     ├── Maria Ruiz - QA Lead (Tecnologia)
  │     └── [VACANTE] - Frontend Developer (Tecnologia)
  ├── [VACANTE] - CFO (Finanzas)
  └── Roberto Diaz - COO (Operaciones)
        ├── Juan Perez - Gerente de Planta (Operaciones)
        └── Luis Torres - Gerente de Logistica (Logistica)

Personas sin asignar:
  - Sofia Mendez - Consultora (sin departamento)
```

Este formato se genera server-side y se expone como `GET /api/persons/orgchart?format=text`.

### E.6 Flujo de Actualizacion por Agente IA

```
Entrevista transcrita
       │
       ▼
Pipeline de analisis (agente IA)
       │
       ├── Detecta mencion: "Juan reporta a Maria en Operaciones"
       │
       ▼
Agente consulta: GET /api/persons?search=Juan
       │
       ├── Si existe → PATCH /api/persons/:id (actualizar role/department/reportsTo)
       └── Si no existe → POST /api/persons (crear con datos inferidos)
       │
       ▼
Agente marca cambios como "sugeridos" (campo source: "AI_INFERRED")
       │
       ▼
Notificacion al usuario: "El agente detecto 3 personas nuevas en la entrevista.
                           Revisa y confirma los cambios."
       │
       ▼
Usuario revisa en UI → Confirma/Modifica/Rechaza cada cambio
```

### E.7 Campo de Origen (source)

Agregar campo `source` al modelo para rastrear como se creo/actualizo el registro:

```prisma
enum PersonSource {
  MANUAL         // Creado por el usuario en la UI
  AI_INFERRED    // Creado/inferido por agente IA (pendiente de confirmacion)
  AI_CONFIRMED   // Creado por IA y confirmado por usuario
  CSV_IMPORT     // Importado desde CSV
}
```

Los registros con `source: AI_INFERRED` se muestran con un badge "IA" en el directorio y organigrama, con un boton de "Confirmar" o "Rechazar".

---

## F. Mejoras al Directorio de Personas

### F.1 Vista de Tabla (default)

Reemplazar el grid de cards actual por una tabla ordenable y filtrable. La vista de cards se mantiene como alternativa toggleable.

**Columnas de la tabla:**

| Columna | Ancho | Ordenable | Descripcion |
|---------|-------|-----------|-------------|
| Foto | 48px | No | Avatar circular pequeno |
| Nombre | flex | Si | Nombre completo, link a perfil |
| Cargo | 200px | Si | Rol en la organizacion |
| Departamento | 160px | Si | Con chip de color |
| Reporta a | 180px | Si | Nombre del jefe, link a su perfil |
| Email | 200px | Si | Email con icono de copiar |
| Estado | 100px | Si | Badge: Activo/Inactivo/Vacante |
| Acciones | 48px | No | Menu de tres puntos |

### F.2 Filtros Avanzados

Barra de filtros debajo del header:

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Buscar nombre, cargo, email...]  [Departamento ▼]  [Estado ▼]     │
│                                   [Reporta a ▼]     [Limpiar todo] │
└─────────────────────────────────────────────────────────────────────┘
```

- **Busqueda global:** busca en nombre, cargo, departamento, email
- **Departamento:** multi-select con chips de color
- **Estado:** Activo / Inactivo / Vacante
- **Reporta a:** dropdown con busqueda para filtrar por jefe
- **Limpiar todo:** resetear todos los filtros

### F.3 Vistas Toggleables

Tres vistas disponibles via botones de toggle en el header:

1. **Tabla** (default): vista compacta con muchas columnas, ideal para busqueda y operaciones masivas
2. **Grid de cards**: vista actual mejorada, ideal para reconocimiento visual rapido (mantener compatibilidad)
3. **Organigrama**: link directo a la vista de organigrama

### F.4 Import/Export CSV

**Exportar:**
1. Boton "Exportar CSV" en el header del directorio
2. Exporta todas las personas (o las filtradas) en formato CSV:
   ```csv
   nombre,cargo,departamento,email,telefono,reporta_a,estado,codigo_empleado,fecha_ingreso
   "Juan Perez","Gerente de Ops","Operaciones","juan@empresa.cl","+56912345678","Maria Lopez","ACTIVE","EMP-001","2024-03-15"
   ```
3. Descarga automatica del archivo

**Importar:**
1. Boton "Importar CSV" en el header
2. Dialog con:
   - Zona de drag & drop para archivo CSV
   - Preview de las primeras 5 filas
   - Mapeo de columnas (auto-detectar por nombre de header, permitir ajuste manual)
   - Opciones: "Actualizar existentes por email" / "Solo crear nuevos" / "Crear y actualizar"
3. Vista de validacion: mostrar errores (emails duplicados, campos faltantes)
4. Boton "Importar N personas"
5. Feedback: "Se crearon 12 personas, se actualizaron 5, 2 errores"

### F.5 Perfil Detallado de Persona

Al hacer click en una persona (tanto en directorio como en organigrama), se navega a `/personas/:id` con vista detallada:

```
┌────────────────────────────────────────────────────────────┐
│  ← Volver al directorio                                   │
│                                                            │
│  ┌──────────┐                                              │
│  │          │  Juan Perez                      [Editar]    │
│  │  (foto)  │  Gerente de Operaciones                      │
│  │          │  Operaciones                                 │
│  └──────────┘  juan@empresa.cl | +56 9 1234 5678           │
│                Ingreso: 15 Mar 2024 | Codigo: EMP-001      │
│                                                            │
│  ┌──────────────────────────┐ ┌───────────────────────────┐│
│  │  Reporta a               │ │  Reportes directos (3)    ││
│  │  ┌──┐ Maria Lopez        │ │  ┌──┐ Pedro Soto          ││
│  │  │ML│ Directora de Ops   │ │  │PS│ Jefe de Planta      ││
│  │  └──┘                    │ │  └──┘                     ││
│  │                          │ │  ┌──┐ Ana Ruiz            ││
│  │                          │ │  │AR│ Coord. de Calidad   ││
│  │                          │ │  └──┘                     ││
│  │                          │ │  ┌──┐ Luis Torres         ││
│  │                          │ │  │LT│ Coord. Logistica    ││
│  │                          │ │  └──┘                     ││
│  └──────────────────────────┘ └───────────────────────────┘│
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Notas                                               │  │
│  │  Contacto principal para el proyecto de              │  │
│  │  automatizacion de planta.                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Actividad reciente                    [futuro v2]   │  │
│  │  - Participante en entrevista "Diagnostico Ops"      │  │
│  │  - Mencionado en Knowledge Base "Procesos Q1"        │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## G. Mockups ASCII

### G.1 Vista de Directorio (Tabla)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                                  │
│         │  Personas                                          [+ Nueva]     │
│ Dashboard                                                                  │
│ Asistente│  ┌────────────┐ ┌─────────────┐                                │
│ Docs     │  │ Directorio │ │ Organigrama │                                │
│ Contab.  │  └═══════════─┘ └─────────────┘                                │
│ Calendario                                                                 │
│ ▶Personas│  ┌──────────────────────────────────────────────┐ [Importar]   │
│ Int.Org. │  │🔍 Buscar...   [Departamento▼] [Estado▼]     │ [Exportar]   │
│ Marketing│  └──────────────────────────────────────────────┘  ☷ ▦ ≡      │
│          │                                                                 │
│          │  ┌─────┬────────────────┬──────────────────┬────────────┬─────┐ │
│          │  │     │ Nombre    ↕    │ Cargo       ↕    │ Depto  ↕   │ ... │ │
│          │  ├─────┼────────────────┼──────────────────┼────────────┼─────┤ │
│          │  │(JM) │ Juan Martinez  │ CEO              │ ●Direccion │ ... │ │
│          │  │(AG) │ Ana Gonzalez   │ CTO              │ ●Tecnologia│ ... │ │
│          │  │(PS) │ Pedro Soto     │ Dev Lead         │ ●Tecnologia│ ... │ │
│          │  │(MR) │ Maria Ruiz     │ QA Lead          │ ●Tecnologia│ ... │ │
│          │  │(RD) │ Roberto Diaz   │ COO              │ ●Operac.   │ ... │ │
│          │  │(JP) │ Juan Perez     │ Ger. de Planta   │ ●Operac.   │ ... │ │
│          │  │(LT) │ Luis Torres    │ Ger. Logistica   │ ●Logistica │ ... │ │
│          │  │     │ VACANTE        │ CFO              │ ●Finanzas  │ ... │ │
│          │  └─────┴────────────────┴──────────────────┴────────────┴─────┘ │
│          │                                                                 │
│          │  Mostrando 1-8 de 8 personas                   < 1 >            │
└────────────────────────────────────────────────────────────────────────────┘

Leyenda:
  (JM) = avatar con iniciales
  ● = chip de color de departamento
  ↕ = columna ordenable
  ☷ ▦ ≡ = toggle de vista (tabla / grid / organigrama)
  ... = columnas adicionales (Reporta a, Email, Estado, Acciones)
```

### G.2 Vista de Directorio (Grid de Cards)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                                  │
│         │  Personas                                          [+ Nueva]     │
│         │                                                                  │
│         │  ┌────────────┐ ┌─────────────┐                                 │
│         │  │ Directorio │ │ Organigrama │                                 │
│         │  └════════════┘ └─────────────┘                                 │
│         │                                                                  │
│         │  ┌──────────────────────────────────────┐            ☷ ▦ ≡      │
│         │  │🔍 Buscar...                          │                       │
│         │  └──────────────────────────────────────┘                       │
│         │                                                                  │
│         │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│         │  │ ┌──┐ Juan Martiz │ │ ┌──┐ Ana Gonzalez│ │ ┌──┐ Pedro Soto │ │
│         │  │ │JM│ CEO         │ │ │AG│ CTO          │ │ │PS│ Dev Lead   │ │
│         │  │ └──┘ Direccion   │ │ └──┘ Tecnologia  │ │ └──┘ Tecnologia │ │
│         │  │     juan@emp.cl  │ │     ana@emp.cl   │ │     pedro@emp.cl│ │
│         │  │              ⋯  │ │              ⋯   │ │              ⋯  │ │
│         │  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│         │  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ │
│         │  │ ┌──┐ Maria Ruiz  │ │ ┌──┐ Roberto Diaz│ │ ┌──┐ Juan Perez │ │
│         │  │ │MR│ QA Lead     │ │ │RD│ COO          │ │ │JP│ Ger.Planta │ │
│         │  │ └──┘ Tecnologia  │ │ └──┘ Operaciones │ │ └──┘ Operaciones│ │
│         │  │              ⋯  │ │              ⋯   │ │              ⋯  │ │
│         │  └──────────────────┘ └──────────────────┘ └──────────────────┘ │
│         │                                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### G.3 Vista de Organigrama

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                                  │
│         │  Personas                                          [+ Nueva]     │
│         │                                                                  │
│         │  ┌────────────┐ ┌═════════════┐                                 │
│         │  │ Directorio │ │ Organigrama │                                 │
│         │  └────────────┘ └═════════════┘                                 │
│         │                                                                  │
│         │  ┌──────────────────┐ [Departamento ▼] [Auto-layout] [Exportar] │
│         │  │🔍 Buscar persona │                                           │
│         │  └──────────────────┘                                           │
│         │ ┌──────────────────────────────────────────────────────────────┐ │
│         │ │                                                              │ │
│         │ │                    ┌──────────────────┐                      │ │
│         │ │                    │(JM) Juan Martinez │                     │ │
│         │ │                    │     CEO           │                     │ │
│         │ │                    │     ●Direccion    │                     │ │
│         │ │                    └────────┬─────────┘                      │ │
│         │ │              ┌─────────────┼─────────────┐                   │ │
│         │ │              │             │             │                   │ │
│         │ │    ┌─────────┴────┐ ┌──────┴──────┐ ┌───┴──────────┐       │ │
│         │ │    │(AG) Ana Gonz │ │ - VACANTE - │ │(RD) Roberto D│       │ │
│         │ │    │     CTO      │ │   CFO       │ │     COO      │       │ │
│         │ │    │     ●Tecno   │ │   ●Finanzas │ │     ●Operac  │       │ │
│         │ │    │     3 rep ▼  │ │             │ │     2 rep ▼  │       │ │
│         │ │    └──────┬───────┘ └─────────────┘ └──────┬───────┘       │ │
│         │ │      ┌────┼────┐                      ┌────┼────┐          │ │
│         │ │      │    │    │                      │         │          │ │
│         │ │    ┌─┴──┐┌┴──┐┌┴──┐                ┌─┴──┐   ┌─┴──┐       │ │
│         │ │    │ PS ││ MR││VAC│                │ JP │   │ LT │       │ │
│         │ │    │Dev ││QA ││Fro│                │Ger.│   │Ger.│       │ │
│         │ │    │Lead││Lea││ntd│                │Pla.│   │Log.│       │ │
│         │ │    └────┘└───┘└───┘                └────┘   └────┘       │ │
│         │ │                                                              │ │
│         │ │  ┌───┐                                    ┌──────────────┐  │ │
│         │ │  │ + │ zoom                               │  ▪ minimap   │  │ │
│         │ │  │85%│                                    │  ▫ ▫ ▫       │  │ │
│         │ │  │ - │                                    │  ▪            │  │ │
│         │ │  │ ⛶ │                                    └──────────────┘  │ │
│         │ │  └───┘                                                      │ │
│         │ └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

### G.4 Organigrama con Panel Lateral Abierto

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                                  │
│         │  Personas                                          [+ Nueva]     │
│         │  ┌────────────┐ ┌═════════════┐                                 │
│         │  │ Directorio │ │ Organigrama │                                 │
│         │  └────────────┘ └═════════════┘                                 │
│         │ ┌──────────────────────────────────────┐┌───────────────────────┐│
│         │ │                                      ││ Juan Martinez    [✕]  ││
│         │ │                                      ││                      ││
│         │ │        ┌──────────────────┐          ││ ┌──────────┐         ││
│         │ │        │(JM) Juan Martinez│◄─selected││ │          │         ││
│         │ │        │     CEO          │          ││ │  (foto)  │         ││
│         │ │        │     ●Direccion   │          ││ │          │         ││
│         │ │        └────────┬─────────┘          ││ └──────────┘         ││
│         │ │           ┌─────┼─────┐              ││                      ││
│         │ │           │     │     │              ││ Cargo: CEO           ││
│         │ │          ...   ...   ...             ││ Depto: Direccion     ││
│         │ │                                      ││ Email: juan@emp.cl   ││
│         │ │                                      ││ Tel: +56 9 1234 5678 ││
│         │ │                                      ││                      ││
│         │ │                                      ││ Reporta a: —         ││
│         │ │                                      ││                      ││
│         │ │                                      ││ Reportes directos (3)││
│         │ │                                      ││  (AG) Ana Gonzalez   ││
│         │ │                                      ││  (--) VACANTE CFO    ││
│         │ │                                      ││  (RD) Roberto Diaz   ││
│         │ │                                      ││                      ││
│         │ │                                      ││ [Editar] [+ Subord.] ││
│         │ │                                      ││ [Ver perfil]         ││
│         │ └──────────────────────────────────────┘└───────────────────────┘│
└────────────────────────────────────────────────────────────────────────────┘
```

### G.5 Dialog de Crear/Editar Persona (Ampliado)

```
┌───────────────────────────────────────────────────────┐
│  Nueva Persona                                   [✕]  │
│  Crea un nuevo perfil para vincular a entrevistas     │
│  y al organigrama.                                    │
│                                                       │
│  Nombre *                                             │
│  ┌─────────────────────────────────────────────┐      │
│  │ Nombre completo                             │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Cargo                         Departamento           │
│  ┌──────────────────────┐      ┌──────────────────┐   │
│  │ Ej: Gerente de Ops   │      │ Ej: Operaciones ▼│   │
│  └──────────────────────┘      └──────────────────┘   │
│                                 (autocompletado)      │
│                                                       │
│  Email                         Telefono               │
│  ┌──────────────────────┐      ┌──────────────────┐   │
│  │ correo@empresa.cl    │      │ +56 9 1234 5678  │   │
│  └──────────────────────┘      └──────────────────┘   │
│                                                       │
│  Reporta a                                            │
│  ┌─────────────────────────────────────────────┐      │
│  │ 🔍 Buscar persona...                    ▼  │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│  Codigo de empleado            Fecha de ingreso       │
│  ┌──────────────────────┐      ┌──────────────────┐   │
│  │ EMP-001              │      │ 📅 15/03/2024    │   │
│  └──────────────────────┘      └──────────────────┘   │
│                                                       │
│  [ ] Es una posicion vacante                          │
│                                                       │
│  Notas                                                │
│  ┌─────────────────────────────────────────────┐      │
│  │ Notas adicionales sobre esta persona        │      │
│  │                                             │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
│                          [Cancelar]    [Crear]         │
└───────────────────────────────────────────────────────┘
```

### G.6 Dialog de Confirmacion de Drag & Drop (Mover Persona)

```
┌───────────────────────────────────────────────────────┐
│  Mover persona                                   [✕]  │
│                                                       │
│  ┌──────────────────────────────────────────────┐     │
│  │                                              │     │
│  │    (PS) Pedro Soto                           │     │
│  │    Dev Lead                                  │     │
│  │                                              │     │
│  │    Jefe actual:  Ana Gonzalez (CTO)          │     │
│  │    Nuevo jefe:   Roberto Diaz (COO)          │     │
│  │                                              │     │
│  └──────────────────────────────────────────────┘     │
│                                                       │
│  [ ] Mover tambien sus subordinados (2 personas)      │
│                                                       │
│  ⚠ Pedro Soto pasara del departamento Tecnologia      │
│    al area de Roberto Diaz (Operaciones).             │
│    ¿Deseas actualizar su departamento tambien?        │
│                                                       │
│  ( ) Mantener departamento actual (Tecnologia)        │
│  (●) Cambiar a Operaciones                            │
│                                                       │
│                          [Cancelar]  [Confirmar]      │
└───────────────────────────────────────────────────────┘
```

### G.7 Vista de Perfil Individual

```
┌────────────────────────────────────────────────────────────────────────────┐
│ SIDEBAR │                                                                  │
│         │  ← Directorio de personas                                        │
│         │                                                                  │
│         │  ┌───────────────────────────────────────────────────────────┐   │
│         │  │                                                           │   │
│         │  │   ┌──────────┐                                            │   │
│         │  │   │          │  Juan Perez                    [Editar]    │   │
│         │  │   │  (foto)  │  Gerente de Operaciones                   │   │
│         │  │   │  grande  │  ●Operaciones                              │   │
│         │  │   └──────────┘                                            │   │
│         │  │   juan@empresa.cl  |  +56 9 1234 5678                    │   │
│         │  │   Codigo: EMP-042  |  Ingreso: 15 Mar 2024              │   │
│         │  │   Estado: ●Activo                                        │   │
│         │  │                                                           │   │
│         │  └───────────────────────────────────────────────────────────┘   │
│         │                                                                  │
│         │  ┌──────────────────────┐  ┌────────────────────────────────┐   │
│         │  │ Reporta a            │  │ Reportes directos (3)         │   │
│         │  │                      │  │                                │   │
│         │  │ ┌──┐ Maria Lopez     │  │ ┌──┐ Pedro Soto    Dev Lead   │   │
│         │  │ │ML│ Dir. de Ops     │  │ │PS│ Tecnologia               │   │
│         │  │ └──┘ → Ver perfil    │  │ └──┘ → Ver perfil             │   │
│         │  │                      │  │                                │   │
│         │  │                      │  │ ┌──┐ Ana Ruiz     QA Lead     │   │
│         │  │                      │  │ │AR│ Tecnologia               │   │
│         │  │                      │  │ └──┘ → Ver perfil             │   │
│         │  │                      │  │                                │   │
│         │  │                      │  │ ┌──┐ Luis Torres  Coord.Log.  │   │
│         │  │                      │  │ │LT│ Logistica                │   │
│         │  │                      │  │ └──┘ → Ver perfil             │   │
│         │  │                      │  │                                │   │
│         │  │                      │  │             [+ Agregar]        │   │
│         │  └──────────────────────┘  └────────────────────────────────┘   │
│         │                                                                  │
│         │  ┌─────────────────────────────────────────────────────────┐    │
│         │  │ Notas                                                    │    │
│         │  │                                                          │    │
│         │  │ Contacto principal para el proyecto de automatizacion    │    │
│         │  │ de planta norte. Participante clave en diagnostico Q1.  │    │
│         │  └─────────────────────────────────────────────────────────┘    │
│         │                                                                  │
│         │  ┌─────────────────────────────────────────────────────────┐    │
│         │  │ Participacion en entrevistas                             │    │
│         │  │                                                          │    │
│         │  │ 📋 Diagnostico Operacional Q1     12 Mar 2026           │    │
│         │  │ 📋 Revision de Procesos Planta    28 Feb 2026           │    │
│         │  │ 📋 Onboarding Nuevo Sistema       15 Ene 2026           │    │
│         │  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

### G.8 Importacion CSV

```
┌───────────────────────────────────────────────────────┐
│  Importar personas desde CSV                     [✕]  │
│                                                       │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   │
│  │                                                │   │
│  │   Arrastra un archivo CSV aqui                 │   │
│  │   o haz click para seleccionar                 │   │
│  │                                                │   │
│  │   Formatos: .csv, .tsv                         │   │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘   │
│                                                       │
│  ── Despues de cargar archivo ──                      │
│                                                       │
│  Preview (primeras 5 filas):                          │
│  ┌────────────────┬──────────────┬──────────┐         │
│  │ nombre         │ cargo        │ depto    │         │
│  ├────────────────┼──────────────┼──────────┤         │
│  │ Juan Perez     │ Gerente Ops  │ Operac.  │         │
│  │ Ana Gonzalez   │ CTO          │ Tecno.   │         │
│  │ ...            │ ...          │ ...      │         │
│  └────────────────┴──────────────┴──────────┘         │
│                                                       │
│  Mapeo de columnas:                                   │
│  CSV "nombre"  → Campo [Nombre    ▼]                  │
│  CSV "cargo"   → Campo [Cargo     ▼]                  │
│  CSV "depto"   → Campo [Departamento ▼]               │
│  CSV "email"   → Campo [Email     ▼]                  │
│                                                       │
│  Modo de importacion:                                 │
│  (●) Crear nuevos y actualizar existentes (por email) │
│  ( ) Solo crear nuevos                                │
│  ( ) Solo actualizar existentes                       │
│                                                       │
│  Resultado de validacion:                             │
│  ✓ 45 personas validas                                │
│  ⚠ 2 emails duplicados (se actualizaran)              │
│  ✕ 1 fila sin nombre (se omitira)                     │
│                                                       │
│                     [Cancelar]  [Importar 47 filas]   │
└───────────────────────────────────────────────────────┘
```

---

## Apendice: Resumen de Decisiones de Diseno

### Decisiones Clave

| Decision | Eleccion | Justificacion |
|----------|----------|---------------|
| Departamentos como campo texto vs entidad | Campo texto con autocompletado | Simplicidad. Si en el futuro se necesita metadata de departamento, se crea modelo separado |
| Posiciones de nodos | Calculadas por dagre + override manual persistido | Mejor de ambos mundos: auto-layout inteligente + flexibilidad manual |
| Vacantes | Status en PersonProfile vs modelo separado | Mismo modelo evita complejidad. El campo `status: VACANT` es suficiente |
| Organigrama editable por IA | Endpoints REST + campo `source` | Trazabilidad clara de quien hizo cada cambio. Los cambios IA requieren confirmacion humana |
| Multiples raices | Soportado | Organizaciones pueden tener co-CEOs o estructura flat con multiples lideres |
| Soft delete al eliminar jefe | Advertencia + opciones | Al eliminar un jefe, preguntar: reasignar subordinados al jefe del jefe, o dejar sin jefe |

### Prioridades de Implementacion Sugeridas

| Fase | Funcionalidad | Esfuerzo |
|------|--------------|----------|
| **Fase 1** | Modelo de datos ampliado (reportsToId, status) + migracion | Bajo |
| **Fase 1** | Nuevas rutas `/personas/*` + layout con tabs | Bajo |
| **Fase 1** | Directorio mejorado (tabla, filtros, ordenamiento) | Medio |
| **Fase 1** | Formulario ampliado (reporta a, departamento autocompletado) | Bajo |
| **Fase 2** | Organigrama basico (React Flow, custom nodes, auto-layout) | Alto |
| **Fase 2** | Panel lateral de detalle en organigrama | Medio |
| **Fase 2** | Busqueda y filtros en organigrama | Medio |
| **Fase 2** | Drag & drop para mover personas | Medio |
| **Fase 3** | API bulk + integracion con pipeline IA | Medio |
| **Fase 3** | Import/Export CSV | Medio |
| **Fase 3** | Perfil detallado de persona (/personas/:id) | Medio |
| **Fase 3** | Posiciones vacantes | Bajo |
| **Futuro** | Contratos, Vacaciones, Evaluaciones | Por definir |
