# Organigrama y Personas -- Perspectiva UX/UI alternativa

**Autor:** Diseñador 2 (enfoque mobile-first, onboarding, hub de navegación, IA colaborativa)
**Fecha:** 2026-03-28
**Estado:** Propuesta de diseño

---

## 0. Punto de partida: lo que ya existe

Hoy `PersonProfile` tiene: name, role, department, email, phone, avatarS3Key, notes. No hay campo `reportsTo` ni relación jerárquica explícita. El knowledge graph (`OrgEntity` + `OrgRelation`) ya modela DEPARTMENT, ROLE, BELONGS_TO, etc. pero es un grafo paralelo desconectado de PersonProfile. La navegación actual ubica "Personas" como sub-item de "Inteligencia Org."

Este documento NO repite la estructura de datos ni los flujos de CRUD básico. Se concentra en las capas que faltan: experiencia móvil, onboarding vacío, el organigrama como hub central, visualizaciones alternativas, colaboración humano-IA, y microinteracciones.

---

## A. Experiencia mobile-first

### A.1 El problema

Un organigrama tipo árbol top-down no cabe en 375px de ancho. Hacer zoom/pan en un canvas con dedos es torpe. La mayoría de consultores que usan Zeru están en terreno con el celular, no frente a un escritorio.

### A.2 Principio de diseño

**En móvil el organigrama NO es un canvas. Es una lista jerárquica navegable.**

### A.3 Vista móvil: "Drill-down jerárquico"

```
┌─────────────────────────────┐
│  ← Organigrama              │
│                              │
│  Organización                │
│  ┌─────────────────────────┐│
│  │ 👤 María Paz Soto       ││
│  │    Gerente General       ││
│  │    3 reportes directos → ││
│  └─────────────────────────┘│
│                              │
│  Al tocar "3 reportes →"    │
│  se navega un nivel abajo:  │
│                              │
│  ← María Paz Soto           │
│                              │
│  ┌─────────────────────────┐│
│  │ 👤 Rodrigo Rojas        ││
│  │    Dir. Operaciones      ││
│  │    5 reportes directos → ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ 👤 Carolina Muñoz       ││
│  │    Dir. Finanzas         ││
│  │    2 reportes directos → ││
│  └─────────────────────────┘│
│  ┌─────────────────────────┐│
│  │ 👤 Felipe Araya         ││
│  │    Dir. Tecnología       ││
│  │    4 reportes directos → ││
│  └─────────────────────────┘│
│                              │
│  [breadcrumb: Org > María]  │
└─────────────────────────────┘
```

**Comportamiento:**
- Cada tarjeta muestra avatar, nombre, cargo, conteo de reportes directos
- Tocar la tarjeta abre el perfil-resumen (slide-up sheet)
- Tocar "N reportes directos" navega al siguiente nivel (animación slide-left)
- Breadcrumb fijo arriba permite saltar niveles
- Búsqueda sticky arriba: al escribir "Rodrigo", el breadcrumb se construye automáticamente mostrando el path hasta Rodrigo

### A.4 Vista tablet (768px+)

En tablet se puede mostrar un "árbol indentado colapsable" -- cada nivel es un indent con líneas de conexión. Similar a un file explorer. Funciona bien hasta ~50 personas. Si hay más, colapsar los niveles profundos por defecto.

### A.5 Vista desktop (1024px+)

Canvas con tree layout. Pero SIEMPRE ofrecer el toggle "Vista lista / Vista canvas" porque algunos usuarios prefieren la lista incluso en desktop.

### A.6 Responsive breakpoints

| Ancho        | Vista por defecto       | Alternativa disponible |
|-------------|------------------------|----------------------|
| < 768px     | Drill-down jerárquico  | No (canvas no funciona aquí) |
| 768-1023px  | Árbol indentado        | Drill-down jerárquico |
| >= 1024px   | Canvas tree (top-down) | Árbol indentado, tabla |

---

## B. Onboarding: construir el organigrama desde cero

### B.1 El problema real

La pantalla vacía de "Personas" es intimidante. El usuario tiene que crear uno por uno. Peor aún: no hay campo `reportsTo`, así que incluso si crea 20 personas, no hay organigrama posible.

### B.2 Flujo de onboarding progresivo (wizard de 3 pasos)

**Paso 1: "¿Cómo quieres empezar?"**

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   Construye tu organigrama                           │
│                                                      │
│   Elige cómo quieres comenzar:                       │
│                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│   │  📋 Manual  │  │  📄 Importar│  │  🤖 Desde   │ │
│   │             │  │  CSV/Excel  │  │  entrevistas │ │
│   │  Agrega     │  │             │  │              │ │
│   │  personas   │  │  Sube un    │  │  La IA arma  │ │
│   │  una a una  │  │  archivo    │  │  el org con  │ │
│   │  y conecta  │  │  con la     │  │  lo que ya   │ │
│   │  las líneas │  │  estructura │  │  sabe de las │ │
│   │  de reporte │  │             │  │  entrevistas │ │
│   └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Opción A - Manual (paso 2):**

No es simplemente "crear personas". Es un mini-wizard:

1. "¿Quién lidera la organización?" -> crear el nodo raíz (nombre + cargo)
2. "¿Quiénes le reportan directamente?" -> crear N nodos, automáticamente conectados
3. "¿Quieres profundizar algún área?" -> seleccionar un nodo y repetir el paso 2
4. En cualquier momento: "Listo por ahora" -> se guarda lo que haya

Esto es fundamentalmente diferente a un CRUD de personas. El wizard construye la estructura jerárquica de forma natural, guiando al usuario de arriba hacia abajo.

**Opción B - Importar CSV/Excel (paso 2):**

Template descargable con columnas:
```
nombre | cargo | departamento | email | reporta_a
```

La columna `reporta_a` acepta nombre o email. El sistema hace fuzzy match.

Pantalla de preview post-import:
```
┌──────────────────────────────────────────────────────┐
│  Vista previa de importación                         │
│                                                      │
│  ✅ 23 personas reconocidas                          │
│  ✅ 18 relaciones de reporte detectadas              │
│  ⚠️  5 personas sin jefe asignado (sin "reporta_a") │
│  ❌ 2 conflictos: "reporta_a" no encontrado          │
│     - "Juan Pérez" reporta a "M. Soto" (no existe)  │
│     - "Ana López" reporta a "Carlos R." (ambiguo:    │
│       ¿Carlos Rojas o Carlos Riquelme?)              │
│                                                      │
│  [Resolver conflictos]  [Importar de todos modos]    │
└──────────────────────────────────────────────────────┘
```

**Opción C - Desde entrevistas existentes (paso 2):**

Si ya hay entrevistas procesadas con knowledge graph, el sistema propone:

```
┌──────────────────────────────────────────────────────┐
│  Organigrama sugerido por IA                         │
│                                                      │
│  Basado en 4 entrevistas, detectamos:                │
│                                                      │
│  12 personas mencionadas                             │
│   8 relaciones de reporte inferidas                  │
│   3 departamentos identificados                      │
│                                                      │
│  [Vista previa del organigrama]                      │
│                                                      │
│  Cada nodo tiene un indicador de confianza:          │
│  🟢 Alta (mencionado explícitamente)                 │
│  🟡 Media (inferido por contexto)                    │
│  🔴 Baja (mencionado una sola vez)                   │
│                                                      │
│  [Aprobar y editar]  [Descartar y empezar manual]    │
└──────────────────────────────────────────────────────┘
```

### B.3 Auto-detección de jerarquía

Cuando el usuario ya tiene personas creadas (con role y department pero sin reportsTo), el sistema puede sugerir una estructura:

Heurísticas:
- Si alguien tiene cargo "Gerente General" o "CEO" -> candidato a raíz
- Si hay un "Director de X" y varias personas en departamento "X" -> relación de reporte probable
- Si un cargo contiene "Jefe" o "Coordinador" -> nivel intermedio
- Estas sugerencias se presentan como propuestas editables, nunca se aplican automáticamente

```
┌──────────────────────────────────────────────────────┐
│  💡 Sugerencia automática                            │
│                                                      │
│  Detectamos que ya tienes 15 personas con cargo y    │
│  departamento. ¿Quieres que armemos un organigrama   │
│  borrador?                                           │
│                                                      │
│  [Sí, armar borrador]  [No, prefiero hacerlo manual] │
└──────────────────────────────────────────────────────┘
```

---

## C. El organigrama como hub de navegación

### C.1 Concepto

El organigrama no es un diagrama estático. Es el mapa interactivo de la organización. Cada nodo es una puerta de entrada a todo lo que Zeru sabe sobre esa persona.

### C.2 Click en un nodo -> Panel lateral de contexto

Al hacer click en un nodo del organigrama (o tocar en móvil), se abre un panel lateral (slide-over en desktop, bottom sheet en móvil):

```
┌────────────────────────────────────────┐
│ ← Rodrigo Rojas                   [×] │
│                                        │
│  [foto grande]                         │
│  Director de Operaciones               │
│  Departamento: Operaciones             │
│  Reporta a: María Paz Soto            │
│  4 reportes directos                   │
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│  📋 Entrevistas (2)                    │
│  ┌──────────────────────────────────┐  │
│  │ Entrevista 31/03 - Proyecto X   │  │
│  │ Entrevista 15/03 - Onboarding   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  🧠 En el Knowledge Graph              │
│  ┌──────────────────────────────────┐  │
│  │ Mencionado en 8 entidades       │  │
│  │ • Ejecuta: Proceso de despacho  │  │
│  │ • Usa: SAP MM, WMS             │  │
│  │ • Reportó: 2 problemas         │  │
│  │ [Ver todas →]                   │  │
│  └──────────────────────────────────┘  │
│                                        │
│  📊 Indicadores                        │
│  ┌──────────────────────────────────┐  │
│  │ Span of control: 4 directos     │  │
│  │ Profundidad: nivel 2            │  │
│  │ Cobertura entrevistas: 100%     │  │
│  └──────────────────────────────────┘  │
│                                        │
│  [Abrir perfil completo]               │
│  [Editar persona]                      │
└────────────────────────────────────────┘
```

### C.3 Indicadores visuales sobre los nodos del organigrama

Los nodos del organigrama no son solo nombre+cargo. Pueden mostrar capas de información contextual activables con toggles.

**Capa: Cobertura de entrevistas**
```
Nodo con borde verde = persona entrevistada
Nodo con borde gris punteado = no entrevistada aún
Nodo con borde amarillo = mencionada por otros pero no entrevistada directamente
```

**Capa: Personas clave / SPOF (Single Point of Failure)**
```
Nodo con ícono de alerta rojo = persona identificada como SPOF
  (solo ella conoce un proceso crítico, detectado por IA en entrevistas)
Nodo con ícono de estrella = persona clave
  (mencionada frecuentemente por otros en entrevistas)
```

**Capa: Carga de reportes**
```
Heatmap en los nodos:
  Azul frío = 1-3 reportes directos
  Amarillo = 4-6 reportes directos
  Rojo caliente = 7+ reportes directos (span of control preocupante)
```

**Capa: Departamentos (color coding)**
```
Cada departamento tiene un color asignado.
Los nodos muestran un tag o borde del color del departamento.
```

### C.4 Barra de capas (layer toggle)

```
┌──────────────────────────────────────────────────────┐
│  Capas:  [Entrevistas ✓] [SPOF] [Carga] [Deptos ✓]  │
└──────────────────────────────────────────────────────┘
```

Solo se activa una capa a la vez para evitar ruido visual, o se permite combinar máximo 2.

---

## D. Visualizaciones alternativas

### D.1 Cuatro vistas, un dataset

El organigrama tiene múltiples representaciones. No hay que elegir una sola. Se ofrecen como pestañas o selector de vista.

### D.2 Vista 1: Árbol clásico (default en desktop)

```
                    [CEO]
                      │
          ┌───────────┼───────────┐
       [Dir.Ops]   [Dir.Fin]  [Dir.TI]
          │           │           │
       ┌──┼──┐        │        ┌──┼──┐
      [J1] [J2]     [J3]     [J4] [J5]
```

- Layout top-down con Dagre o ELK
- Nodos expandibles/colapsables
- Zoom/pan con rueda del mouse y drag
- Minimap en esquina inferior derecha
- Auto-fit al cargar

**Cuándo usar:** Vista general de la estructura jerárquica. Default para organizaciones de hasta ~100 personas.

### D.3 Vista 2: Burbujas por departamento

```
    ┌─────────────────────────────┐
    │         Operaciones         │
    │    ┌───┐  ┌───┐  ┌───┐     │
    │    │ R │  │ A │  │ P │     │
    │    └───┘  └───┘  └───┘     │
    │       ┌───┐  ┌───┐         │
    │       │ M │  │ L │         │
    │       └───┘  └───┘         │
    └─────────────────────────────┘
         ┌────────────┐
         │  Finanzas   │
         │  ┌───┐┌───┐ │
         │  │ C ││ J │ │
         │  └───┘└───┘ │
         └────────────┘
```

- Cada departamento es un circle-pack
- El tamaño del círculo del departamento es proporcional al headcount
- Las personas dentro son círculos más pequeños (con iniciales o foto)
- Hover sobre una persona muestra tooltip con nombre+cargo
- Líneas entre departamentos si hay relaciones inter-departamentales
- El jefe del departamento aparece con un anillo dorado

**Cuándo usar:** Para entender proporciones entre áreas. Útil cuando la pregunta es "¿qué tan grande es cada área?" y no "¿quién reporta a quién?"

### D.4 Vista 3: Tabla jerárquica (tree table)

```
┌──┬────────────────────┬──────────────────┬──────────────┬──────────┐
│  │ Nombre             │ Cargo            │ Departamento │ Estado   │
├──┼────────────────────┼──────────────────┼──────────────┼──────────┤
│▼ │ María Paz Soto     │ Gerente General  │ Dirección    │ 🟢 Entr. │
│  │ ▼ Rodrigo Rojas    │ Dir. Operaciones │ Operaciones  │ 🟢 Entr. │
│  │   · Ana Méndez     │ Jefa Despacho    │ Operaciones  │ 🟡 Menc. │
│  │   · Pedro Lagos    │ Jefe Bodega      │ Operaciones  │ ⚪ Pend. │
│  │ ▶ Carolina Muñoz   │ Dir. Finanzas    │ Finanzas     │ 🟢 Entr. │
│  │ ▼ Felipe Araya     │ Dir. Tecnología  │ Tecnología   │ ⚪ Pend. │
│  │   · Luis Vera      │ Dev Lead         │ Tecnología   │ ⚪ Pend. │
│  │   · Marta Silva    │ Soporte TI       │ Tecnología   │ 🟡 Menc. │
└──┴────────────────────┴──────────────────┴──────────────┴──────────┘
```

- Expandir/colapsar con ▼/▶
- Sorteable por cualquier columna (al sortear se pierde la jerarquía, se advierte)
- Filtrable por departamento, estado, etc.
- Bulk actions: seleccionar varios y asignar departamento, agendar entrevistas
- Export a CSV/Excel

**Cuándo usar:** Para gestión y operaciones. Cuando el usuario necesita filtrar, buscar, exportar. La más práctica para organizaciones grandes (100+). Funciona perfecto en tablet.

### D.5 Vista 4: Red de conexiones (network graph)

```
         [Rodrigo] ─── usa ──→ [SAP]
             │                    ↑
         reporta             usa │
             │                    │
         [María] ← reporta ─ [Carolina]
             │
         conoce
             │
         [Proveedor X]
```

- No solo muestra jerarquía, sino TODAS las relaciones del knowledge graph
- Personas son nodos principales, pero también aparecen sistemas, procesos, proveedores
- Force-directed layout (d3-force o similar)
- Filtro por tipo de relación: [Reporte ✓] [Usa sistema] [Ejecuta proceso] [Conoce]
- Útil para descubrir dependencias no obvias

**Cuándo usar:** Para análisis avanzado. Cuando la pregunta es "¿cómo se conecta todo?" No es la vista default porque es densa y requiere contexto. Se ofrece como "Vista avanzada" o dentro de la Knowledge Base.

### D.6 Selector de vistas

```
┌──────────────────────────────────────────────────────┐
│  [🌳 Árbol]  [🫧 Burbujas]  [📊 Tabla]  [🕸 Red]    │
└──────────────────────────────────────────────────────┘
```

- En desktop: las 4 opciones disponibles
- En tablet: Árbol, Tabla, Burbujas
- En móvil: se reemplaza por el drill-down jerárquico (sección A), con opción de "Ver tabla" como alternativa

---

## E. Interacción humano-IA en el organigrama

### E.1 El escenario

El agente IA procesa una entrevista con Rodrigo Rojas. En la transcripción, Rodrigo dice: "Yo le reporto a la María Paz, ella es la gerente general". El agente extrae esto como una relación de reporte.

El problema: ¿cómo comunicar este descubrimiento al usuario sin que sea invasivo, pero sin que pase desapercibido?

### E.2 Dos canales de comunicación

**Canal 1: Notificación contextual (inmediata, no bloqueante)**

Cuando el usuario entra al módulo de Personas o al Organigrama, aparece un banner en la parte superior:

```
┌──────────────────────────────────────────────────────┐
│  🤖 Sugerencias de la IA (3 nuevas)                  │
│                                                      │
│  Basado en la entrevista con Rodrigo Rojas (31/03):  │
│  • Rodrigo reporta a María Paz Soto                  │
│  • Ana Méndez es Jefa de Despacho en Operaciones     │
│  • Pedro Lagos trabaja en Bodega                     │
│                                                      │
│  [Revisar sugerencias]           [Ignorar por ahora] │
└──────────────────────────────────────────────────────┘
```

**Canal 2: Cola de revisión (asíncrona, detallada)**

Página dedicada `/personas/sugerencias-ia` o panel lateral accesible desde un badge en la navegación:

```
┌──────────────────────────────────────────────────────┐
│  Sugerencias pendientes de la IA                     │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📎 Rodrigo Rojas reporta a María Paz Soto      │  │
│  │                                                  │  │
│  │ Fuente: Entrevista 31/03, min 04:23             │  │
│  │ "...yo le reporto directo a la María Paz,       │  │
│  │  ella como gerente general..."                  │  │
│  │                                                  │  │
│  │ Confianza: 🟢 Alta (mención explícita)           │  │
│  │                                                  │  │
│  │ [✓ Aprobar]  [✏️ Editar]  [✗ Rechazar]           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ 📎 Nueva persona: Ana Méndez                    │  │
│  │    Cargo: Jefa de Despacho                      │  │
│  │    Departamento: Operaciones                    │  │
│  │                                                  │  │
│  │ Fuente: Entrevista 31/03, min 12:45             │  │
│  │ "...la Ana Méndez que está a cargo de           │  │
│  │  despacho..."                                   │  │
│  │                                                  │  │
│  │ Confianza: 🟡 Media (inferido)                   │  │
│  │                                                  │  │
│  │ ¿Coincide con persona existente?                │  │
│  │ [Es nueva persona]  [Es "A. Méndez" existente] │  │
│  │                                                  │  │
│  │ [✓ Aprobar]  [✏️ Editar]  [✗ Rechazar]           │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Aprobar todas las de alta confianza (2)]           │
└──────────────────────────────────────────────────────┘
```

### E.3 Diff visual del organigrama

Cuando hay sugerencias pendientes, el organigrama puede mostrar un "modo diff":

```
Nodo existente:           Borde sólido normal
Nodo nuevo sugerido:      Borde punteado azul + etiqueta "Nuevo"
Línea existente:          Línea sólida normal
Línea nueva sugerida:     Línea punteada azul + etiqueta "Sugerido"
Nodo a modificar:         Borde punteado amarillo + etiqueta "Cambio"
```

Toggle: `[Ver organigrama actual] [Ver con sugerencias de IA]`

Esto permite al usuario ver el "antes y después" sin que nada se haya aplicado aún.

### E.4 Flujo de aprobación

```
Entrevista procesada
       │
       ▼
IA extrae relaciones ──→ Se crean "OrgSuggestion" en DB
       │                    (status: PENDING)
       ▼
Usuario entra al organigrama
       │
       ▼
Banner muestra conteo de sugerencias
       │
       ▼
Usuario revisa ──┬── Aprueba ──→ Se crea/modifica PersonProfile + reportsTo
                 │                 Se registra auditoría (quién aprobó, cuándo)
                 │                 OrgSuggestion.status = APPROVED
                 │
                 ├── Edita ────→ Abre formulario pre-llenado con la sugerencia
                 │                 Usuario ajusta y guarda
                 │                 OrgSuggestion.status = APPROVED_MODIFIED
                 │
                 └── Rechaza ──→ OrgSuggestion.status = REJECTED
                                  Se registra razón (opcional)
                                  IA aprende a no sugerir lo mismo
```

### E.5 Regla de oro

**La IA NUNCA modifica el organigrama directamente. Siempre propone. El humano siempre aprueba.**

Excepción futura (opt-in): "Auto-aprobar sugerencias de alta confianza" como setting del tenant. Pero esto es V2+.

---

## F. Microinteracciones

### F.1 Expandir/colapsar subárboles

- Al hacer click en el toggle de un nodo, los hijos aparecen con una animación de 200ms:
  - Los nodos hijos se desplazan desde la posición del padre (scale 0 -> 1 + translate)
  - Las líneas de conexión se dibujan progresivamente (SVG stroke-dashoffset animation)
  - Los nodos hermanos se reposicionan suavemente para hacer espacio (300ms ease-out)
- Al colapsar: inverso. Los hijos se encogen hacia el padre.
- El nodo padre muestra un badge con "+N" cuando está colapsado

### F.2 Buscar persona -> highlight del path

Cuando el usuario busca "Rodrigo" en la barra de búsqueda del organigrama:

1. El canvas hace zoom automático hasta centrar a Rodrigo (animación 400ms ease-in-out)
2. Se highlight el path completo desde la raíz hasta Rodrigo (nodos y líneas en azul brillante, el resto en opacity 0.3)
3. El highlight se desvanece después de 3 segundos, el canvas vuelve a la normalidad
4. Si hay múltiples coincidencias, aparece un "N de M" con flechas para navegar entre resultados

### F.3 Tooltips ricos en hover

Al pasar el mouse sobre un nodo (delay 300ms para evitar tooltips accidentales):

```
┌──────────────────────────┐
│  [foto 48x48] Rodrigo    │
│               Rojas      │
│                          │
│  Dir. Operaciones        │
│  rodrigo@empresa.cl      │
│  +56 9 1234 5678         │
│                          │
│  5 reportes directos     │
│  2 entrevistas           │
│                          │
│  Click para ver más →    │
└──────────────────────────┘
```

- El tooltip sigue al cursor con un offset fijo
- Tiene sombra y flecha apuntando al nodo
- Se cierra al mover el mouse fuera del tooltip Y del nodo

### F.4 Drag & drop para reorganizar

El usuario puede arrastrar un nodo para cambiar su relación de reporte:

1. **Inicio del drag:** El nodo se eleva (box-shadow más pronunciado, scale 1.05). La línea al padre actual se vuelve punteada roja ("desconectando de...")
2. **Durante el drag:** Los posibles nodos destino (nuevos padres) se iluminan con un halo verde. Los nodos inválidos (el propio nodo, sus descendientes) se atenúan.
3. **Drop:** Animación de "conexión" -- una línea verde se dibuja desde el nuevo padre al nodo. Confirmación:

```
┌──────────────────────────────────────────┐
│  ¿Mover a Rodrigo Rojas?                │
│                                          │
│  Antes: reportaba a María Paz Soto       │
│  Ahora: reportará a Carlos Mendoza       │
│                                          │
│  Esto también moverá sus 5 reportes      │
│  directos bajo la nueva línea.           │
│                                          │
│  [Confirmar]  [Cancelar]                 │
└──────────────────────────────────────────┘
```

4. **Post-confirmación:** Reflow animado del árbol completo (500ms). Los nodos se reubican suavemente a sus nuevas posiciones.

### F.5 Nodo recién creado

Cuando se agrega una persona nueva al organigrama:
- El nodo aparece con una animación de "pop" (scale 0 -> 1.1 -> 1.0, 300ms)
- Tiene un borde brillante verde por 2 segundos ("recién agregado")
- El canvas se centra automáticamente en el nuevo nodo

### F.6 Estados de carga

- Al cargar el organigrama por primera vez: skeleton animado en forma de árbol (3 niveles de rectángulos grises pulsando)
- Al expandir un subárbol con muchos nodos: spinner en el nodo padre + "Cargando equipo..."
- Al guardar un cambio: el nodo afectado muestra un check animado que desaparece en 1.5s

---

## G. Navegación: Personas como módulo principal

### G.1 Propuesta de reestructuración del sidebar

Actualmente:
```
Inteligencia Org.
  ├── Proyectos
  ├── Personas        <-- sub-item
  └── Knowledge Base
```

Propuesto:
```
Personas              <-- módulo principal, ícono de personas
  ├── Directorio      <-- lo que hoy es la lista de personas
  ├── Organigrama     <-- NUEVO, vista gráfica
  └── Sugerencias IA  <-- cola de revisión (badge con conteo)

Inteligencia Org.
  ├── Proyectos
  └── Knowledge Base
```

### G.2 Justificación

"Personas" es un concepto que todo usuario entiende sin contexto previo. "Inteligencia Organizacional" es abstracto. Al separar Personas como módulo top-level, se logra:

- Acceso directo al directorio y organigrama sin navegar dentro de un submenú
- El organigrama se convierte en feature de primera clase, no algo escondido
- "Inteligencia Org." queda como módulo avanzado (proyectos, knowledge base, análisis)
- La cola de sugerencias IA es visible desde la navegación, incentivando la revisión

### G.3 Deep linking

Cada vista del organigrama es una URL compartible:
```
/personas                     -> Directorio (lista/grid de personas)
/personas/organigrama         -> Organigrama (vista default)
/personas/organigrama?vista=burbujas  -> Vista de burbujas
/personas/organigrama?vista=tabla     -> Vista de tabla
/personas/organigrama?vista=red       -> Vista de red
/personas/organigrama?focus=uuid      -> Centrado en persona específica
/personas/[id]                -> Perfil completo de una persona
/personas/sugerencias         -> Cola de sugerencias IA
```

---

## H. Accesibilidad

### H.1 Navegación por teclado en el organigrama

- Tab: mueve entre nodos (orden: padre -> primer hijo -> siguiente hijo -> siguiente padre)
- Enter: abre el panel de contexto del nodo seleccionado
- Espacio: expande/colapsa subárbol
- Flechas: navegar entre hermanos (←→) y entre niveles (↑↓)
- Escape: cierra panel de contexto / sale del modo búsqueda
- Ctrl+F: abre búsqueda en organigrama

### H.2 Screen readers

- Cada nodo tiene aria-label: "Rodrigo Rojas, Director de Operaciones, reporta a María Paz Soto, 5 reportes directos"
- El estado expandido/colapsado se comunica con aria-expanded
- La vista de tabla es la más accesible por naturaleza -- ofrecerla como alternativa preferida para screen readers
- Anunciar cambios: "Rodrigo Rojas movido bajo Carlos Mendoza" con aria-live

### H.3 Contraste y tamaño

- Los indicadores de colores (capas) siempre van acompañados de íconos o texto
- El tamaño mínimo de nodo clickeable es 44x44px (WCAG 2.2 target size)
- Los tooltips tienen fondo opaco, no semi-transparente

---

## I. Extensibilidad a RRHH futuro

### I.1 Campos que NO agregar ahora pero preparar el modelo para ellos

El modelo actual de PersonProfile es minimalista. Para RRHH futuro se necesitará:

- `hireDate` / `terminationDate`
- `contractType` (indefinido, plazo fijo, honorarios)
- `salary` (con permisos granulares)
- `location` / `workMode` (presencial, remoto, híbrido)
- `skills` (array o tabla relacionada)
- `evaluations` (tabla relacionada)

**Recomendación:** NO agregar estos campos ahora. Usar un campo `metadata: Json?` en PersonProfile para datos extensibles sin migración. Cuando haya suficientes campos RRHH para justificar estructura, se migran desde metadata a columnas propias.

### I.2 El organigrama como plataforma

El organigrama, una vez construido, se convierte en infraestructura para:
- **Onboarding:** Mostrar al nuevo empleado su equipo, su jefe, sus pares
- **Evaluaciones 360:** Saber quién evalúa a quién basado en la estructura
- **Planificación de sucesión:** Identificar personas clave y sus posibles reemplazos
- **Análisis de span of control:** Alertas automáticas cuando alguien tiene demasiados reportes directos
- **Simulaciones de reestructuración:** "¿Qué pasa si movemos Logística bajo Operaciones?" -- sandbox del organigrama

Estas funcionalidades NO se construyen ahora, pero el diseño del organigrama debe ser lo suficientemente flexible para soportarlas. Por eso la importancia de que el organigrama sea editable, tenga historial de cambios, y soporte múltiples tipos de relaciones.

---

## J. Resumen de priorización

| Funcionalidad | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|
| Campo `reportsTo` en PersonProfile | Crítico (sin esto no hay organigrama) | Bajo | P0 |
| Vista de árbol clásico (desktop) | Alto | Medio | P0 |
| Drill-down jerárquico (móvil) | Alto | Medio | P0 |
| Personas como módulo principal en nav | Medio | Bajo | P0 |
| Wizard de onboarding (manual) | Alto | Medio | P1 |
| Import CSV/Excel | Alto | Medio | P1 |
| Panel lateral de contexto | Alto | Medio | P1 |
| Capas de indicadores | Medio | Medio | P1 |
| Cola de sugerencias IA | Alto | Alto | P1 |
| Vista de tabla jerárquica | Medio | Bajo | P1 |
| Tooltips ricos | Medio | Bajo | P2 |
| Drag & drop reorganización | Medio | Alto | P2 |
| Vista de burbujas | Bajo | Alto | P2 |
| Vista de red | Bajo | Alto | P2 |
| Organigrama desde entrevistas | Alto | Alto | P2 |
| Diff visual de sugerencias IA | Medio | Alto | P3 |
| Animaciones de expand/collapse | Bajo | Bajo | P3 |
| Auto-detección de jerarquía | Medio | Medio | P3 |
| Navegación por teclado completa | Medio | Medio | P3 |
