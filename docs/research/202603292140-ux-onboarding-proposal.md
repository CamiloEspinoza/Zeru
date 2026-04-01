# Propuesta de Sistema de Educacion y Onboarding — Modulo de Inteligencia Organizacional

## Estado: PROPUESTA
## Fecha: 2026-03-28
## Autor: Analisis UX especializado

---

> **Nota sobre desarrollo en paralelo:** Esta propuesta considera tres cambios en desarrollo simultaneo:
> 1. **Menus de acciones (ux-flows-audit):** Se estan agregando menus de contexto (icono `...`) con opciones de editar/eliminar en proyectos, entrevistas y entidades. Incluyen dialogos de confirmacion para acciones destructivas.
> 2. **Perfiles de personas (impl-person-profiles):** Nuevo concepto `PersonProfile` con foto/avatar, pagina `/org-intelligence/persons`, y selector de persona al configurar speakers de entrevista. Componente `PersonAvatar` reutilizable.
> 3. **Flujo actualizado:** Crear Personas > Crear Proyecto > Crear Entrevista > Configurar Participantes (seleccionando personas del directorio) > Subir Audio > Procesar.

---

# A. Diagnostico de la UX Actual

## A.1 Lo que funciona bien

### HelpTooltip: un buen punto de partida
El componente `HelpTooltip` (`components/org-intelligence/help-tooltip.tsx`) es una implementacion solida. Usa el icono `?` en un circulo, se activa por hover, no interrumpe el flujo y tiene un ancho maximo razonable (`max-w-xs`). El componente `SectionHelp` que lo acompana combina titulo + tooltip de forma limpia.

**Donde se usa bien:**
- En el detalle de proyecto, un unico icono de ayuda al final de la barra de tabs consolida la explicacion de todas las secciones (Entrevistas, Analisis, Diagnostico, Plan de Accion, Configuracion) en un solo tooltip. Esto evita ruido visual — un tooltip por tab es excesivo y rompe la limpieza de la navegacion
- En los pasos del pipeline de procesamiento (UPLOADED, TRANSCRIBING, EXTRACTING, COMPLETED), cada paso tiene una descripcion clara de que esta ocurriendo
- En las metricas del tab de Analisis (total entidades, total problemas, confianza promedio), los tooltips explican que significa cada numero
- En la seccion de Participantes, el tooltip explica por que es importante configurarlos antes de procesar
- En el boton "Procesar", el tooltip describe que hara la IA y cuanto demora (3-5 minutos)

### Textos descriptivos integrados en la interfaz
La pagina de proyectos tiene una descripcion que explica el concepto: *"Cada proyecto agrupa las entrevistas y el analisis de una iniciativa de mejora continua."* Esta descripcion esta bien posicionada y usa un tono claro.

### StatusBadge y EntityTypeBadge: lenguaje visual consistente
Los badges de estado usan colores semanticos coherentes (gris=pendiente, amarillo=en proceso, verde=completado, rojo=error) y estan localizados al espanol. Los badges de tipo de entidad (Departamento, Rol, Proceso, Sistema, etc.) usan colores diferenciados que facilitan el escaneo visual.

### ConfidenceBadge: transparencia con la IA
Mostrar el porcentaje de confianza de la IA con codigo de colores (verde >80%, ambar 50-80%, rojo <50%) es una practica de transparencia que genera confianza en el usuario.

### Pipeline de procesamiento visual
La visualizacion paso-a-paso del procesamiento (Subido > Transcribiendo > Extrayendo > Completado) con circulos, lineas conectoras y colores de estado es un patron excelente que da visibilidad al progreso.

### Zona de upload con drag & drop
La zona de carga de audio tiene drag-and-drop, progress bar, formatos aceptados y tamano maximo. Cubre los basicos correctamente.

### Advertencia pre-upload de participantes
El banner amarillo que dice *"Se recomienda configurar los participantes antes de subir el audio"* es un ejemplo de educacion contextual bien aplicada: aparece solo cuando es relevante, no bloquea y da una razon clara.

---

## A.2 Lo que falta o esta incompleto

### 1. Empty states son funcionales pero no educativos
Los empty states actuales siguen un patron minimalista excesivo:

| Pantalla | Empty state actual |
|---|---|
| Lista de proyectos | "No hay proyectos todavia. Crea tu primer proyecto para comenzar." + boton |
| Entrevistas de proyecto | "No hay entrevistas todavia. Agrega tu primera entrevista." + boton |
| Participantes | "No hay participantes configurados." + texto menor + boton |
| Analisis | "Los datos de analisis estaran disponibles una vez procesadas las entrevistas." |
| Diagnostico | "El diagnostico estara disponible una vez procesadas las entrevistas." |
| Mejoras | "Las mejoras se generaran automaticamente tras el analisis." |
| Knowledge Base sin proyecto | "Selecciona un proyecto para explorar su base de conocimiento." |
| Entidades sin resultados | "No se encontraron entidades." |
| Procesos sin datos | "No se encontraron procesos en este proyecto." |

**Problema:** Ninguno de estos empty states explica *por que* el usuario deberia crear un proyecto, *que valor* va a obtener, o *que pasos* debe seguir. Un gerente que entra por primera vez ve "No hay proyectos todavia" y no tiene ni idea de que es un proyecto en este contexto, para que sirve, ni que va a pasar cuando cree uno.

### 2. No hay onboarding especifico del modulo
El onboarding existente de Zeru (`/onboarding`) configura API keys (OpenAI, AWS). No hay ningun flujo que presente el modulo de Inteligencia Organizacional, explique su proposito o guie al usuario por su primer proyecto. El usuario llega a `/org-intelligence/projects` y se enfrenta a una pantalla vacia sin contexto.

### 3. No hay concepto de "flujo recomendado" o "siguiente paso"
Cuando el usuario crea un proyecto, no hay indicacion de que el siguiente paso es crear una entrevista. Cuando crea una entrevista, no hay indicacion de que debe configurar participantes y luego subir audio. Las tabs Analisis/Diagnostico/Plan de Accion aparecen desde el primer momento aunque esten vacias, lo cual genera confusion: el usuario puede hacer clic en "Diagnostico" esperando ver algo y encontrarse con un mensaje generico.

### 4. El modal de crear proyecto es demasiado basico
El dialog de "Nuevo Proyecto" pide nombre, descripcion y fecha de inicio. No explica que es un "proyecto de inteligencia organizacional", no sugiere nombres de ejemplo, no indica que la descripcion deberia incluir el objetivo del levantamiento. Un consultor de mejora continua que nunca uso Zeru no sabe si esto es un proyecto de software, un proyecto de consultoria, o que.

### 5. Los tabs avanzados estan visibles prematuramente
Las 5 tabs del detalle de proyecto (Entrevistas, Analisis, Diagnostico, Plan de Accion, Configuracion) se muestran todas desde el momento 0. Un proyecto recien creado sin entrevistas muestra tabs de Analisis y Diagnostico que dicen "no hay datos". Esto viola el principio de progressive disclosure y genera la impresion de que algo esta roto.

### 6. No hay feedback de celebracion ni progreso
Cuando la primera entrevista se procesa exitosamente (un evento significativo que toma 3-5 minutos), la unica senal es que el status cambia a "Completado" en verde. No hay confetti, no hay mensaje que diga "Tu primera entrevista fue procesada. Ahora puedes ver el analisis en la pestana correspondiente." El usuario no sabe que hacer despues.

### 7. La Knowledge Base no tiene guia de uso
La busqueda semantica es una funcionalidad poderosa pero no obvia. El placeholder "Ej: 'problemas en logistica'" ayuda, pero no hay explicacion de que puede buscar, como funciona la busqueda semantica vs busqueda exacta, ni ejemplos de consultas utiles para su proyecto especifico.

### 8. Terminologia tecnica sin contexto
Terminos como "SPOF", "RICE", "confianza de la IA", "busqueda semantica", "entidades", "grafo de conocimiento" se usan en la interfaz pero nunca se definen de forma comprensible para un gerente no tecnico. Los HelpTooltips actuales ayudan parcialmente, pero algunos usan jerga tecnica en la propia explicacion (ej: "grafo organizacional").

### 9. Los errores fallan silenciosamente
Multiples `catch` blocks en el codigo usan `// silently fail`. Cuando la API falla, el usuario ve un estado de carga que nunca termina o un estado vacio sin explicacion. No hay toasts, banners de error ni guia de recuperacion.

### 10. No hay indicacion de costos o tiempo antes de procesar
Procesar una entrevista usa Deepgram y GPT-5.4 con 5 pasadas de analisis. Esto tiene un costo economico real. La interfaz no informa al usuario cuanto costara aproximadamente procesar el audio, solo dice "3-5 minutos" en un tooltip. Un gerente que administra presupuesto necesita esta informacion antes de hacer clic.

### 11. Menus de acciones ocultos (nuevo — en desarrollo)
Los menus de contexto con icono `...` (tres puntos) estan siendo agregados para editar/eliminar proyectos y entrevistas. Este es un patron estandar en SaaS, pero requiere educacion: muchos usuarios de perfil gerencial no conocen la convencion del icono "tres puntos" como menu de acciones. Si el usuario no sabe que puede editar o eliminar un proyecto, esas funciones son invisibles.

### 12. Perfiles de personas como concepto nuevo (nuevo — en desarrollo)
Se esta introduciendo un directorio de personas (`PersonProfile`) separado de las entrevistas. Esto agrega un paso previo al flujo (crear personas antes de asignarlas como speakers), lo cual es conceptualmente correcto pero aumenta la complejidad del onboarding. El usuario ahora necesita entender tres conceptos en secuencia: (1) personas del directorio, (2) proyectos como contenedor, (3) entrevistas con participantes asignados.

### 13. El flujo ahora es mas largo
Con los perfiles de personas, el flujo completo pasa de 5 a 7 pasos: Crear Personas > Crear Proyecto > Crear Entrevista > Asignar Participantes (seleccionando del directorio) > Subir Audio > Procesar > Revisar Resultados. Sin una guia explicita, el usuario puede perderse o saltar pasos.

---

## A.3 Puntos donde el usuario se perderia sin guia

### Momento critico 1: Primera visita al modulo
El usuario hace clic en "Inteligencia Org." en la sidebar y llega a una lista vacia de proyectos. No sabe que es esto, para que sirve, ni que hacer primero.

### Momento critico 2: Despues de crear un proyecto
El proyecto aparece en la lista con un badge "Borrador". El usuario entra y ve 5 tabs, la primera con una lista vacia de entrevistas. No sabe que el flujo es: crear entrevista > configurar participantes > subir audio > procesar > revisar resultados.

### Momento critico 3: Configurar participantes
La seccion "Participantes de la Entrevista" pide "speakerLabel" (un identificador tecnico) y tiene un checkbox "Es entrevistador". Un gerente no sabe que es un speakerLabel ni por que importa.

### Momento critico 4: Despues de procesar la primera entrevista
El estado cambia a "Completado" pero el usuario no sabe que ahora debe volver a las tabs de Analisis y Diagnostico. No hay link ni indicacion.

### Momento critico 5: Interpretar los resultados de Analisis
Las metricas (total entidades, total problemas, confianza promedio) aparecen sin contexto de "es bueno o malo este numero". 15 entidades, es poco o mucho? Confianza del 72%, debo preocuparme?

### Momento critico 6: Interpretar el Diagnostico
Los SPOFs y cuellos de botella son conceptos de gestion operacional, pero la interfaz asume que el usuario los entiende. Un consultor junior o un gerente de area no necesariamente sabe que un "punto unico de fallo" significa "si esta persona se enferma, el proceso se detiene".

### Momento critico 7: Descubrir el menu de acciones
El usuario quiere editar el nombre de un proyecto o eliminar una entrevista de prueba. No hay indicacion visible de que existe un menu con estas opciones detras del icono `...`. En la lista de proyectos, el cursor hover cambia de fondo pero no hay iconos de accion visibles. El usuario podria intentar hacer doble clic, buscar un boton "Editar" que no existe, o simplemente no saber que puede eliminar.

### Momento critico 8: Entender el directorio de personas
Antes de crear su primera entrevista, el usuario deberia ir a `/org-intelligence/persons` y crear los perfiles de las personas que va a entrevistar. Pero nada en la interfaz de Proyectos menciona que existe un directorio de personas ni por que deberia usarlo primero. El usuario probablemente creara la entrevista y al intentar agregar participantes se preguntara "de donde vienen estas personas?".

### Momento critico 9: Usar el Plan de Accion
La matriz esfuerzo-impacto y el framework RICE son herramientas de priorizacion. La interfaz los muestra pero no explica como leerlos ni como tomar decisiones con ellos. Los cuadrantes ("Quick Wins", "Estrategico", "Evitar") estan etiquetados pero no se explica la logica.

---

## A.4 Fricciones detectadas

1. **El modal de nueva entrevista no pide participantes.** El flujo es: crear entrevista (modal basico) > entrar al detalle > agregar participantes > subir audio. Pero nada guia al usuario por estos pasos.

2. **Los tabs no muestran contadores.** La tab "Entrevistas" dice "Entrevistas" a secas. Seria mas informativo mostrar "Entrevistas (3)" para que el usuario sepa que hay contenido sin hacer clic.

3. **No hay forma de volver al contexto.** Desde la Knowledge Base, si el usuario encuentra un problema interesante, no hay link para ir al proyecto o entrevista donde se detecto.

4. **El campo "Fecha de inicio" en el proyecto no explica que fecha es.** Es la fecha de inicio del levantamiento? La fecha de creacion de la empresa? La fecha de la primera entrevista?

5. **No hay confirmacion antes de procesar.** El boton "Procesar" lanza un pipeline costoso e irreversible sin pedir confirmacion.

6. **El directorio de personas no esta vinculado al flujo de proyectos.** El usuario puede crear un proyecto y entrevistas sin haber creado perfiles de personas primero. Luego, al asignar participantes, descubre que necesita ir a otra seccion a crear los perfiles. Esto interrumpe el flujo.

7. **No hay descubrimiento del menu `...` (tres puntos).** Las acciones de editar y eliminar estan escondidas detras de un icono que muchos usuarios de perfil gerencial no reconocen como menu contextual. La primera vez que el usuario quiera modificar algo, no sabra donde buscar.

---

# B. Gold Standard de Educacion en SaaS — Que Hacen los Mejores

## B.1 Analisis Comparativo de Patterns

### Notion: Progressive Disclosure + Templates
**Lo que hacen:** Cuando un usuario crea un nuevo workspace, Notion no muestra todas las funciones de golpe. Presenta templates especificos por caso de uso ("Project Management", "Engineering Wiki", "Meeting Notes"). Cada template viene pre-poblado con contenido educativo que muestra como usar las funciones en contexto real.

**Por que funciona:** El usuario no tiene que imaginar que puede hacer con la herramienta. Lo ve directamente con datos de ejemplo que puede modificar o eliminar.

**Aplica a Zeru:** Altamente. Podriamos ofrecer un "proyecto demo" pre-poblado con una entrevista procesada de ejemplo, entidades extraidas, diagnostico y plan de accion. El usuario ve el resultado final antes de crear su propio proyecto.

### Linear: Onboarding contextual + atajos rapidos
**Lo que hacen:** Linear no usa tours guiados tradicionales. En su lugar, muestra hotkeys y atajos en tooltips durante las primeras interacciones. Los empty states son educativos y especificos: explican exactamente que hacer y por que, con un CTA directo.

**Por que funciona:** No interrumpe el flujo de trabajo. La educacion ocurre dentro del contexto de la tarea que el usuario esta intentando hacer.

**Aplica a Zeru:** Parcialmente. No necesitamos hotkeys, pero el enfoque de educacion contextual sin interrupciones es ideal.

### Stripe: Documentacion in-context + checklists
**Lo que hacen:** Stripe muestra checklists de configuracion directamente en el dashboard ("Complete these steps to go live"). Cada paso tiene un link a documentacion detallada. Los conceptos tecnicos se explican con analogias simples y diagramas.

**Por que funciona:** El usuario sabe exactamente cuantos pasos faltan y puede avanzar a su ritmo. La documentacion esta a un clic, no en un portal externo.

**Aplica a Zeru:** Altamente. Un checklist de "Tu primer proyecto" es perfecto para guiar a traves de la creacion de proyecto > entrevista > audio > procesamiento.

### Figma: Onboarding con proyecto de ejemplo
**Lo que hacen:** Al crear una cuenta, Figma crea automaticamente un archivo de ejemplo que demuestra las funciones clave. El usuario puede explorar, modificar y aprender interactuando directamente con el producto.

**Por que funciona:** Elimina la barrera del "canvas en blanco". El usuario experimenta el valor del producto antes de invertir tiempo en crear su propio contenido.

**Aplica a Zeru:** Altamente. Un proyecto demo con datos procesados seria el equivalente al archivo de ejemplo de Figma.

### Intercom: Banners contextuales + mensajes in-app
**Lo que hacen:** Intercom muestra banners informativos no intrusivos cuando el usuario accede a una seccion nueva. Los banners se descartan y no vuelven a aparecer. Usan texto corto con un link a "Saber mas".

**Por que funciona:** No bloquean la interfaz, son relevantes al contexto, y respetan la curva de aprendizaje del usuario.

**Aplica a Zeru:** Altamente. Los banners educativos son perfectos para las tabs vacias de Analisis y Diagnostico.

### Loom: Celebracion de hitos
**Lo que hacen:** Al grabar el primer video, Loom muestra una animacion de celebracion y sugiere el siguiente paso ("Share it with your team"). Cada hito tiene una micro-celebracion.

**Por que funciona:** Refuerza comportamientos positivos y mantiene el momentum. El usuario siente progreso.

**Aplica a Zeru:** Moderadamente. La primera entrevista procesada es un hito clave que merece celebracion.

## B.2 Patterns que aplican a Zeru vs. los que no

### Aplican directamente:
1. **Proyecto de ejemplo pre-poblado** (Notion/Figma) — El "aha moment" del producto es ver un diagnostico organizacional completo. Mostrarlo de inmediato elimina incertidumbre.
2. **Checklist de progreso** (Stripe) — El flujo proyecto > entrevista > participantes > audio > procesamiento es lineal y se mapea naturalmente a un checklist.
3. **Empty states educativos** (Linear) — Cada estado vacio es una oportunidad de ensenanar, no solo de mostrar un mensaje generico.
4. **Banners contextuales** (Intercom) — Ideales para las secciones que se desbloquean progresivamente.
5. **Celebracion de hitos** (Loom) — La primera entrevista procesada, el primer diagnostico, el primer plan de accion.

### No aplican o aplican parcialmente:
1. **Tours guiados con spotlight** — Son invasivos y la tasa de completamiento es menor al 20% segun estudios de Pendo y Chameleon (2024). Ademas, el usuario de Zeru no necesita un tour porque la interfaz es lineal, no exploratoria.
2. **Videos embebidos** — Para una herramienta B2B usada ocasionalmente (levantamientos ocurren cada 6-12 meses), los videos se desactualizan rapidamente y consumen ancho de banda. Mejor usar texto + imagenes estaticas.
3. **Chatbot de ayuda** — Zeru ya tiene un asistente IA general. Duplicar esto con un chatbot de ayuda del modulo seria redundante y confuso.
4. **Gamificacion (achievements, badges)** — Esto es un producto de trabajo serio para ejecutivos y consultores. La gamificacion trivializa la herramienta. Una celebracion puntual esta bien; un sistema de logros no.

## B.3 Por que ciertos patterns son mejores para herramientas B2B complejas

Las herramientas B2B de analisis organizacional tienen una caracteristica unica: **el usuario necesita entender el dominio (mejora continua, diagnostico organizacional) ademas de la herramienta**. Esto las diferencia de herramientas B2B genericas (email, calendario, CRM).

**Implicaciones:**
- La educacion debe ser tanto sobre el *concepto* como sobre la *funcionalidad*. No basta con decir "haz clic aqui para crear un proyecto". Hay que decir "un proyecto agrupa las entrevistas de un levantamiento organizacional; al procesar las entrevistas, la IA extrae automaticamente el conocimiento que vive en las personas".
- Los tooltips deben usar lenguaje de negocio, no tecnico. "Cuello de botella" esta bien. "SPOF" necesita definicion. "Grafo organizacional" es inapropiado.
- Los empty states deben educar sobre el valor del resultado, no sobre la mecanica de la herramienta.

---

# C. Sistema de Educacion Propuesto para Zeru

## Nivel 1: Empty States Educativos

### Principio: Cada empty state es un mini-tutorial con 3 elementos
1. **Ilustracion o icono** que represente visualmente lo que aparecera cuando haya datos
2. **Texto educativo** que explique el valor (no la mecanica) de lo que se llenara
3. **CTA primario** que guie al siguiente paso + link a "saber mas"

### Empty state: Lista de proyectos (sin proyectos)

**Actual:** "No hay proyectos todavia. Crea tu primer proyecto para comenzar."

**Propuesta:**
```
[Icono de grafico organizacional o diagrama de flujo]

Mapea tu organizacion con inteligencia artificial

Un proyecto de Inteligencia Organizacional te permite:
- Entrevistar a tu equipo y grabar las conversaciones
- La IA transcribe, analiza y extrae conocimiento automaticamente
- Obtener un diagnostico con cuellos de botella, riesgos y oportunidades
- Generar un plan de accion priorizado para mejorar

[Boton primario: "Crear mi primer proyecto"]
[Link secundario: "Ver proyecto de ejemplo" -> abre un proyecto demo de solo lectura]

Tiempo estimado: 15 minutos para configurar. El procesamiento de cada entrevista toma 3-5 minutos.
```

### Empty state: Entrevistas dentro de un proyecto (sin entrevistas)

**Actual:** "No hay entrevistas todavia. Agrega tu primera entrevista."

**Propuesta:**
```
[Icono de microfono + ondas de audio]

Las entrevistas son la materia prima del analisis

Cada entrevista que subas sera procesada automaticamente:
1. Transcripcion con identificacion de quien habla
2. Extraccion de roles, procesos, sistemas y problemas
3. Deteccion de dependencias y riesgos

Puedes entrevistar gerentes, jefes de area, operarios — cada perspectiva
enriquece el diagnostico.

[Boton primario: "Agregar primera entrevista"]

Tip: Configura los participantes (nombre, cargo, area) antes de subir el
audio para obtener mejores resultados.
```

### Empty state: Tab de Analisis (sin datos procesados)

**Actual:** "Los datos de analisis estaran disponibles una vez procesadas las entrevistas."

**Propuesta:**
```
[Icono de grafico de barras con lupa]

Aqui veras el panorama completo de tu organizacion

Una vez procesadas las entrevistas, esta seccion mostrara:

- Cuantas entidades se detectaron (personas, departamentos, procesos, sistemas)
- Los principales problemas organizados por severidad
- La distribucion de conocimiento por tipo
- El nivel de confianza de la IA en la informacion extraida

[Indicador de progreso: "0 de X entrevistas procesadas"]

Para generar el analisis, ve a la pestana "Entrevistas" y procesa al menos
una grabacion.
```

### Empty state: Tab de Diagnostico (sin datos)

**Actual:** "El diagnostico estara disponible una vez procesadas las entrevistas."

**Propuesta:**
```
[Icono de estetoscopio o lupa sobre organigrama]

El diagnostico revela lo que no se ve a simple vista

Con los datos de las entrevistas, la IA detectara automaticamente:

- Cuellos de botella: Roles o procesos de los que dependen muchos otros.
  Si fallan, el impacto se multiplica.

- Puntos unicos de fallo (SPOF): Cuando todo el conocimiento de un
  proceso vive en una sola persona. Si esa persona se ausenta,
  el proceso se detiene.

- Contradicciones: Cuando dos personas describen el mismo proceso de
  forma diferente, lo cual puede indicar falta de estandarizacion.

Cuantas mas entrevistas proceses, mas preciso sera el diagnostico.
Recomendamos al menos 3 entrevistas de diferentes areas.
```

### Empty state: Tab de Plan de Accion (sin datos)

**Actual:** "Las mejoras se generaran automaticamente tras el analisis."

**Propuesta:**
```
[Icono de checklist con estrellas de priorizacion]

De los problemas a las soluciones, con priorizacion objetiva

A partir de los problemas detectados, la IA generara propuestas de mejora
evaluadas con el metodo RICE:

- Reach (Alcance): A cuantas personas o procesos impacta
- Impact (Impacto): Que tanto mejoraria las cosas
- Confidence (Confianza): Que tan segura esta la IA de la propuesta
- Effort (Esfuerzo): Cuantos recursos requiere implementarla

Las mejoras se visualizan en una matriz esfuerzo-impacto donde:
- Esquina superior izquierda = "Quick Wins" (alto impacto, bajo esfuerzo)
- Esquina superior derecha = "Estrategicas" (alto impacto, alto esfuerzo)
- Esquina inferior derecha = "Evitar" (bajo impacto, alto esfuerzo)

[Indicador: Procesa entrevistas para generar mejoras automaticamente]
```

### Empty state: Knowledge Base (sin proyecto seleccionado)

**Actual:** "Selecciona un proyecto para explorar su base de conocimiento."

**Propuesta:**
```
[Icono de red neuronal o grafo conectado]

La base de conocimiento es el cerebro digital de tu organizacion

Toda la informacion extraida de las entrevistas queda indexada y es
consultable con busqueda inteligente:

- Busca por significado, no solo palabras exactas
  Ej: "problemas de coordinacion" encuentra resultados aunque los
  entrevistados hayan dicho "falta de comunicacion" o "nos enteramos tarde"

- Explora entidades: departamentos, roles, procesos, sistemas
- Visualiza diagramas de flujo generados automaticamente
- Filtra por tipo y nivel de confianza

Selecciona un proyecto arriba para comenzar a explorar.
```

### Empty state: Directorio de Personas (`/org-intelligence/persons`) (nuevo)

**Propuesta:**
```
[Icono de grupo de personas con avatares]

Crea el directorio de tu equipo

Antes de comenzar las entrevistas, registra a las personas que participaran
en el levantamiento. Para cada persona, agrega:

- Nombre completo y foto (opcional)
- Cargo actual (ej: Gerente de Operaciones, Analista de Calidad)
- Area o departamento

Despues podras asignarlas como participantes de las entrevistas.
La IA usara esta informacion para vincular opiniones con cargos y areas.

[Boton primario: "Agregar primera persona"]

Tip: Comienza por las 3-5 personas clave que vas a entrevistar primero.
Puedes agregar mas personas en cualquier momento.
```

### Empty state: Participantes de entrevista (sin participantes asignados)

**Actual:** "No hay participantes configurados. Agregar participantes mejora la precision del analisis con IA."

**Propuesta:**
```
[Icono de grupo de personas con flechas de asignacion]

Asigna quienes participaron en esta entrevista

Selecciona personas del directorio para indicar quienes fueron entrevistados.
Esto ayuda a la IA a:
- Asignar correctamente lo que dice cada persona
- Vincular opiniones con el area y cargo correspondiente
- Cruzar perspectivas entre diferentes entrevistados

[Boton primario: "Seleccionar participantes"]
[Link secundario: "Ir al directorio de personas" — si necesitas agregar
personas nuevas]

Tip: Marca quien es el entrevistador y quien el entrevistado. Las
respuestas del entrevistado tienen mas peso en el analisis organizacional.
```

---

## Nivel 2: Onboarding Guiado (Primera Vez)

### El "Aha Moment" de Zeru
El aha moment del modulo de Inteligencia Organizacional es: **ver un diagnostico completo generado automaticamente a partir de una entrevista de audio**. El usuario entiende el valor cuando ve cuellos de botella, SPOFs, diagramas de flujo y propuestas de mejora que antes habria tardado semanas en producir manualmente.

Por lo tanto, el objetivo del onboarding es **llevar al usuario al primer diagnostico lo mas rapido posible**.

### Propuesta: Checklist "Tu Primer Levantamiento" (No tour guiado)

Cuando el usuario accede por primera vez al modulo, mostrar un banner/card sticky en la parte superior de la pagina de proyectos:

```
Tu Primer Levantamiento Organizacional

Completa estos pasos para obtener tu primer diagnostico automatico:

[ ] 1. Registra a las personas de tu equipo
      Ve al directorio de Personas y agrega a quienes vas a entrevistar
      con su nombre, cargo, area y foto (opcional).

[ ] 2. Crea un proyecto
      Ponle un nombre y describe el objetivo del levantamiento.

[ ] 3. Agrega una entrevista
      Define el titulo y la fecha de la conversacion.

[ ] 4. Asigna los participantes
      Selecciona del directorio quienes participaron en la entrevista.

[ ] 5. Sube el audio de la entrevista
      MP3, WAV, M4A u OGG. Maximo 500 MB.

[ ] 6. Procesa la entrevista con IA
      La IA transcribira, analizara y extraera conocimiento.
      Toma entre 3 y 5 minutos.

[ ] 7. Revisa los resultados
      Explora las pestanas de Analisis, Diagnostico y Plan de Accion.

[Link: "Prefiero explorar por mi cuenta" -> descarta el checklist]
```

**Comportamiento:**
- El checklist se muestra como una card destacada (borde primario, fondo ligeramente tintado) en la pagina de proyectos.
- Cada paso se marca como completado automaticamente cuando el usuario realiza la accion (detectado via API calls o navegacion).
- El paso 1 incluye un link directo a `/org-intelligence/persons` para ir al directorio de personas.
- El checklist persiste entre sesiones (guardado en localStorage o backend).
- El usuario puede descartarlo en cualquier momento.
- Al completar todos los pasos, el checklist se reemplaza por un mensaje de celebracion (ver Nivel 5).
- **Atajo:** Si el usuario ya creo personas, el paso 1 se marca automaticamente y el checklist sugiere "Crear proyecto" como siguiente accion.

**Por que un checklist y no un tour guiado:**
- Los tours guiados tienen tasas de completamiento del 15-20% segun datos de Pendo (2024) y UserPilot (2025). La mayoria de usuarios los cierra inmediatamente.
- Un checklist es visible pero no intrusivo. El usuario puede completar los pasos a su ritmo, incluso en diferentes sesiones.
- Un checklist funciona como referencia permanente; un tour es de una sola vez y si el usuario no presto atencion, se perdio.
- Stripe, Linear y Notion usan checklists. Los tours guiados son mas comunes en herramientas consumer (Slack, Canva).

### Proyecto de ejemplo (demo)

Al acceder por primera vez al modulo, ademas del checklist, ofrecer un proyecto de solo lectura llamado **"Proyecto Demo: Levantamiento Citolab"** que contenga:

- 1 entrevista procesada con transcripcion real (puede ser datos anonimizados del ejemplo de Rodrigo Rojas)
- Entidades extraidas visibles en la tab de Analisis
- Diagnostico con al menos 2 cuellos de botella y 1 SPOF
- Plan de accion con 3-4 mejoras priorizadas
- Diagramas de flujo de al menos 1 proceso

**Implementacion:** El proyecto demo puede ser un seed de datos que se crea automaticamente para cada tenant nuevo, marcado como `isDemo: true` con un badge especial.

**Valor:** El usuario ve exactamente que produce la herramienta antes de invertir tiempo y dinero en procesar sus propias entrevistas.

---

## Nivel 3: Educacion Contextual (Durante el Uso)

### 3.1 Banners educativos de primera vez

Mostrar banners informativos (descartables, aparecen solo una vez) en los siguientes momentos:

**Banner: Primera vez en la pagina de detalle de un proyecto**
Ubicacion: Debajo del header, antes de los tabs.
```
[Icono info] Este proyecto tiene 5 secciones. Comienza por "Entrevistas" para
agregar y procesar grabaciones. Las demas pestanas se llenaran automaticamente
a medida que la IA analice las entrevistas. [Entendido]
```

**Banner: Primera vez que se abre la tab de Knowledge Base**
Ubicacion: Encima de los filtros de entidades.
```
[Icono info] La busqueda semantica entiende el significado de tu consulta.
Prueba preguntas naturales como "quien se encarga de las compras" o
"que sistemas usa el area de produccion". [Entendido]
```

**Banner: Primera vez que se ve un diagnostico con datos**
Ubicacion: Encima del resumen ejecutivo.
```
[Icono info] Este diagnostico fue generado automaticamente cruzando la
informacion de todas las entrevistas. Revisa los cuellos de botella y SPOFs
con tu equipo para validar los hallazgos. [Entendido]
```

**Banner: Primera vez en la matriz esfuerzo-impacto**
Ubicacion: Encima del grafico scatter.
```
[Icono info] Los puntos en la esquina superior izquierda son "Quick Wins":
mejoras de alto impacto y bajo esfuerzo. Son el mejor punto de partida.
[Entendido]
```

### 3.2 Descubrimiento de menus de acciones (`...`)

Los menus de contexto (tres puntos) son un patron estandar en SaaS moderno pero no son auto-evidentes para usuarios de perfil gerencial. Propuesta de educacion:

**Primera vez que se renderiza una card con menu `...`:**
Agregar un micro-indicador pulsante (un dot azul o un anillo de animacion sutil) sobre el icono `...` la primera vez. Al hacer clic, el menu se abre normalmente y el indicador no vuelve a aparecer.

Alternativa menos tecnica: en el banner educativo de primera vez en la lista de proyectos, incluir la frase:
```
Tip: Haz clic en el icono ⋯ de cada proyecto para acceder a opciones
de edicion y eliminacion.
```

**En el checklist de onboarding:** No incluir los menus de acciones como paso. Son funcionalidades secundarias que el usuario descubrira naturalmente o mediante el banner contextual.

### 3.3 Mejoras al HelpTooltip existente

**Reescribir tooltips que usan jerga tecnica:**

| Tooltip actual | Tooltip propuesto |
|---|---|
| "Analisis cruzado de todas las entrevistas. Muestra entidades extraidas, problemas detectados y estadisticas generales." | "Resumen visual de todo lo que la IA encontro en las entrevistas: personas, departamentos, procesos, sistemas y problemas. Cuantas mas entrevistas proceses, mas completo sera." |
| "Diagnostico organizacional automatizado. Detecta cuellos de botella, puntos unicos de fallo (SPOF) y contradicciones entre entrevistados." | "Encuentra automaticamente los puntos criticos de tu organizacion: donde se acumula demasiada dependencia en una persona o proceso, y donde diferentes personas ven las cosas de forma contradictoria." |
| "Propuestas de mejora priorizadas con framework RICE (Reach, Impact, Confidence, Effort). Incluye matriz esfuerzo-impacto." | "Propuestas concretas de mejora ordenadas por impacto y facilidad de implementacion. Incluye un grafico que muestra cuales son las mejoras mas faciles y de mayor beneficio ('Quick Wins')." |
| "Entidades (roles, procesos, sistemas) de las que dependen muchas otras. Si fallan, afectan a multiples areas. Se detectan por el numero de dependencias entrantes en el grafo organizacional." | "Roles, procesos o sistemas de los que dependen muchas otras areas. Si alguno falla o se retrasa, el impacto se multiplica. Piensa en ellos como los 'cruces mas transitados' de tu organizacion." |

### 3.4 Cuando NO mostrar tooltips/banners

- No mostrar banners educativos en visitas posteriores (usar flag `firstVisit_{sectionId}` en localStorage)
- No mostrar tooltips en acciones que el usuario ya realizo 3+ veces
- No mostrar banners mientras el usuario esta en medio de una accion (ej: subiendo audio, esperando procesamiento)
- No apilar multiples banners. Maximo 1 banner educativo visible a la vez
- No mostrar tooltips en dispositivos moviles (el hover no funciona bien; usar un icono que abra un popover on tap)

---

## Nivel 4: Progressive Disclosure

### Principio: Revelar complejidad solo cuando el usuario esta listo

### 4.1 Tabs condicionados en el detalle de proyecto

**Estado actual:** Las 5 tabs siempre visibles.

**Propuesta:**

| Condicion del proyecto | Tabs visibles |
|---|---|
| Proyecto recien creado (0 entrevistas) | Entrevistas, Configuracion |
| Proyecto con entrevistas pero ninguna procesada | Entrevistas, Configuracion |
| Al menos 1 entrevista procesada (COMPLETED) | Entrevistas, Analisis, Configuracion |
| Al menos 2 entrevistas procesadas | Entrevistas, Analisis, Diagnostico, Configuracion |
| Al menos 1 mejora generada | Entrevistas, Analisis, Diagnostico, Plan de Accion, Configuracion |

**Alternativa menos agresiva (recomendada):** Mostrar todas las tabs pero con indicadores visuales:

```
Entrevistas (3)   Analisis ✓   Diagnostico ✓   Plan de Accion ✓   Configuracion
```

Las tabs sin datos tendrian un estilo atenuado y un icono de candado o indicador "pendiente":

```
Entrevistas (0)   Analisis (pendiente)   Diagnostico (pendiente)   Plan de Accion (pendiente)   Configuracion
```

De esta forma el usuario ve todo lo que existe pero entiende que hay un orden logico.

### 4.2 Progressive disclosure en la Knowledge Base

**Actual:** Los 3 sub-tabs (Entidades, Busqueda, Procesos) siempre visibles.

**Propuesta:** Mantener los 3 tabs visibles pero ordenar por complejidad creciente:
1. **Busqueda** (lo mas intuitivo: escribir una pregunta) — tab por defecto
2. **Entidades** (explorar la lista completa)
3. **Procesos** (diagramas de flujo, el mas avanzado)

Actualmente "Entidades" es el tab por defecto, lo cual es menos intuitivo que la busqueda.

### 4.3 Progressive disclosure en el formulario de participantes

**Actual:** El formulario muestra todos los campos de golpe (nombre, cargo, departamento, es entrevistador, etiqueta de hablante).

**Propuesta:**
- Mostrar primero solo: Nombre, Cargo, Departamento, Es entrevistador
- El campo "Etiqueta de hablante" (speakerLabel) debe estar oculto en una seccion "Avanzado" colapsable. Es un concepto tecnico que la mayoria de usuarios no necesita tocar.
- Pre-llenar speakerLabel automaticamente (ya se hace con `Speaker_0`, `Speaker_1`)

### 4.4 Navigation sidebar: ordenar por flujo de uso

Con la adicion del directorio de Personas, la sidebar del modulo deberia reflejar el flujo natural de uso:

```
Inteligencia Org. >
  Personas          <-- PRIMERO: crear el directorio
  Proyectos         <-- SEGUNDO: crear proyectos y entrevistas
  Knowledge Base    <-- TERCERO: explorar resultados
```

Este orden guia visualmente al usuario de arriba a abajo segun el flujo de trabajo. Si el usuario intenta crear una entrevista sin personas en el directorio, el sistema lo redirecciona con un mensaje amigable.

### 4.5 El modal de "Nuevo Proyecto" como wizard de 2 pasos

**Actual:** Un dialog simple con nombre, descripcion, fecha.

**Propuesta:** Convertir en un wizard de 2 pasos dentro del mismo dialog:

**Paso 1: Datos del proyecto**
```
Que vas a analizar?

Nombre del proyecto:
[Input con placeholder: "Ej: Levantamiento Operacional 2026"]

Objetivo del levantamiento:
[Textarea con placeholder: "Ej: Entender como funciona el area de
operaciones para identificar oportunidades de mejora y automatizacion"]

Fecha de inicio:
[Date picker]

[Siguiente]
```

**Paso 2: Primera entrevista (opcional)**
```
Quieres agregar tu primera entrevista ahora?

Esto es opcional. Puedes hacerlo despues desde el detalle del proyecto.

Titulo de la entrevista:
[Input con placeholder: "Ej: Entrevista con Gerente de Operaciones"]

Fecha de la entrevista:
[Date picker]

[Crear proyecto]  [Crear proyecto + entrevista]
```

Esto reduce la friccion del flujo: en lugar de crear proyecto > entrar > crear entrevista > entrar > configurar, el usuario puede crear proyecto con entrevista en un solo flujo.

---

## Nivel 5: Feedback y Celebracion

### 5.1 Celebracion de hitos

**Hito 1: Primera entrevista procesada exitosamente**

Cuando el polling detecta `processingStatus === "COMPLETED"` por primera vez en el proyecto:

- Mostrar un banner de exito destacado (verde, con icono de check grande) en la pagina de la entrevista:
```
[Check verde grande]
Tu primera entrevista fue procesada exitosamente

La IA identifico X entidades, Y problemas y Z procesos.
Ahora puedes explorar los resultados.

[Boton: "Ver Analisis"] [Boton: "Ver Diagnostico"]
```

- Este banner se muestra una sola vez (flag en localStorage) y es descartable.

**Hito 2: Primera vez que se ve el diagnostico con datos**

Agregar un texto de contexto antes del resumen ejecutivo:
```
Este es el primer diagnostico de tu proyecto. Se basa en X entrevistas
procesadas. Cuantas mas entrevistas agregues, mas preciso y completo sera
el analisis. Revisa los hallazgos con tu equipo para validar la informacion.
```

**Hito 3: Completar el checklist de onboarding**

Al completar los 6 pasos del checklist "Tu Primer Levantamiento":
```
[Icono de trofeo o estrella]
Felicidades! Completaste tu primer levantamiento organizacional

Tu proyecto tiene un diagnostico completo con:
- N entidades organizacionales detectadas
- N problemas identificados por severidad
- N propuestas de mejora priorizadas

Proximos pasos sugeridos:
- Agregar mas entrevistas para enriquecer el analisis
- Revisar los hallazgos con tu equipo
- Priorizar las mejoras "Quick Win" del plan de accion
- Exportar el diagnostico para compartirlo con la gerencia

[Boton: "Explorar mi proyecto"]
[Link: "Descartar"]
```

### 5.2 Indicadores de progreso del proyecto

Agregar un componente de progreso en la card del proyecto (lista de proyectos) y en el header del detalle:

```
Progreso del proyecto:
[==========----------] 50%
3 entrevistas procesadas | 2 pendientes de audio
```

El progreso se calcula como:
- 0% = Proyecto creado sin entrevistas
- 20% = Al menos 1 entrevista creada
- 40% = Al menos 1 audio subido
- 60% = Al menos 1 entrevista procesada (COMPLETED)
- 80% = Al menos 3 entrevistas procesadas
- 100% = Proyecto con diagnostico y plan de accion revisados

### 5.3 Notificaciones de estado de procesamiento

Cuando el usuario navega fuera de la pagina de la entrevista mientras se esta procesando, mostrar una notificacion (toast) cuando el procesamiento termine:

```
[Toast verde] "La entrevista 'Gerente de Operaciones' fue procesada
exitosamente. Ver resultados."
```

Esto es especialmente importante porque el procesamiento toma 3-5 minutos y el usuario probablemente navegara a otra seccion mientras espera.

---

## Nivel 6: Help Center / Documentacion In-App

### 6.1 Glosario contextual

Crear un componente `GlossaryTerm` que se use en toda la interfaz para terminos especializados. Al hacer clic/hover, muestra una definicion clara:

**Terminos a incluir:**
- **Levantamiento organizacional:** Proceso de documentar como funciona una organizacion entrevistando a sus miembros.
- **Entidad:** Cualquier elemento identificado en una entrevista: persona, departamento, proceso, sistema, etc.
- **Confianza de la IA:** Porcentaje que indica que tan segura esta la IA de la informacion extraida. 100% = mencionado explicitamente. <50% = inferido del contexto.
- **Cuello de botella:** Punto de la organizacion donde se concentran muchas dependencias. Si falla, afecta a multiples areas.
- **SPOF (Punto unico de fallo):** Cuando una sola persona concentra el conocimiento o responsabilidad de un proceso critico.
- **RICE:** Metodo de priorizacion que evalua Alcance, Impacto, Confianza y Esfuerzo de cada propuesta de mejora.
- **Quick Win:** Mejora de alto impacto y bajo esfuerzo. La primera que deberia implementarse.
- **Busqueda semantica:** Busqueda que entiende el significado de la consulta, no solo palabras exactas.
- **Contradiccion:** Cuando dos entrevistados describen el mismo tema de forma diferente.

### 6.2 Panel de ayuda lateral (no chatbot)

En lugar de un chatbot o documentacion externa, implementar un panel de ayuda deslizante (sheet) accesible desde un boton `?` fijo en la esquina inferior derecha. El panel muestra contenido contextual segun la pagina donde este el usuario:

**Si el usuario esta en `/org-intelligence/projects`:**
```
Ayuda: Proyectos

Un proyecto agrupa todas las entrevistas y el analisis de un
levantamiento organizacional.

Flujo tipico:
1. Crea un proyecto con nombre descriptivo
2. Agrega entrevistas (una por cada persona entrevistada)
3. Para cada entrevista: configura participantes > sube audio > procesa
4. Revisa analisis, diagnostico y plan de accion

Preguntas frecuentes:
- Cuantas entrevistas necesito? (recomendamos 3-5 de diferentes areas)
- Cuanto cuesta procesar una entrevista?
- Puedo agregar mas entrevistas despues?
```

**Si el usuario esta en la tab de Diagnostico:**
```
Ayuda: Diagnostico

El diagnostico se genera automaticamente cruzando la informacion
de todas las entrevistas procesadas.

Como leer los resultados:
- Cuellos de botella: Los que tienen mas dependencias son mas criticos
- SPOFs: Busca planes de contingencia para estos roles
- Contradicciones: Revisa con los involucrados para aclarar discrepancias

Recomendaciones:
- Comparte el diagnostico con tu equipo directivo
- Usa los hallazgos como base para una reunion de planificacion
- No tomes decisiones solo con los datos de la IA;
  siempre valida con las personas involucradas
```

### 6.3 Seccion "Como funciona" en el menu de ayuda

Dentro del panel lateral de ayuda, incluir una seccion permanente que explique el pipeline completo:

```
Como funciona la Inteligencia Organizacional

1. ENTREVISTAS
   Grabas conversaciones con miembros de tu equipo sobre como funcionan
   sus areas, procesos y desafios.

2. TRANSCRIPCION (Deepgram Nova-3)
   La IA convierte el audio a texto e identifica quien habla en cada
   momento.

3. EXTRACCION (GPT-5.4, 5 pasadas)
   La IA analiza la transcripcion y extrae: personas, roles, procesos,
   sistemas, problemas y dependencias.

4. BASE DE CONOCIMIENTO
   Toda la informacion queda indexada y es consultable con busqueda
   inteligente.

5. DIAGNOSTICO
   Al cruzar multiples entrevistas, se detectan cuellos de botella,
   puntos unicos de fallo y contradicciones.

6. PLAN DE ACCION
   Se generan propuestas de mejora priorizadas con el metodo RICE.
```

---

# D. Priorizacion

## D.1 Quick Wins (Semana 1-2) — Mayor impacto, menor esfuerzo

| # | Mejora | Impacto | Esfuerzo | Justificacion |
|---|--------|---------|----------|---------------|
| 1 | **Reescribir todos los empty states** con formato educativo (texto + CTA + tip) | Alto | Bajo | Solo son cambios de texto/layout en archivos existentes. Afecta la primera impresion de cada seccion. |
| 2 | **Reescribir los tooltips con lenguaje de negocio** (eliminar jerga tecnica) | Alto | Bajo | Solo cambios de texto en props de `HelpTooltip`. |
| 3 | **Agregar indicadores "(pendiente)" a los tabs sin datos** | Medio | Bajo | Un par de condicionales en el componente de tabs del detalle de proyecto. |
| 4 | **Ocultar "Etiqueta de hablante" en seccion avanzada** colapsable | Medio | Bajo | Envolver el campo existente en un collapsible. |
| 5 | **Agregar contadores a los tabs** (Entrevistas (3), etc.) | Medio | Bajo | Ya hay datos de `_count` disponibles. |
| 6 | **Cambiar tab por defecto de Knowledge Base** de Entidades a Busqueda | Medio | Bajo | Un cambio de `defaultValue="entities"` a `defaultValue="search"`. |

## D.2 Medio Plazo (Semana 3-4) — Impacto significativo

| # | Mejora | Impacto | Esfuerzo | Justificacion |
|---|--------|---------|----------|---------------|
| 7 | **Checklist de onboarding "Tu Primer Levantamiento" (7 pasos)** | Alto | Medio | Requiere un componente nuevo + persistencia de estado. Es la guia principal para usuarios nuevos. Ahora incluye el paso previo de crear personas en el directorio. |
| 8 | **Banners educativos de primera vez** (5-6 banners descartables) | Alto | Medio | Requiere componente `ContextualBanner` + logica de first-visit tracking. Incluir banner para directorio de personas y para menus de acciones. |
| 9 | **Celebracion de primera entrevista procesada** | Medio | Medio | Detectar primer COMPLETED + mostrar banner con links a tabs relevantes. |
| 10 | **Wizard de 2 pasos para crear proyecto** (con opcion de crear entrevista) | Medio | Medio | Refactorizar el dialog existente en un stepper. |
| 11 | **Toast de notificacion cuando procesamiento termina** | Medio | Medio | Integrar con el polling existente + sistema de toasts. |
| 12 | **Empty state educativo para directorio de Personas** | Alto | Bajo | Solo texto y layout. Primer punto de contacto del nuevo flujo con personas. |
| 13 | **Indicador de descubrimiento del menu `...`** (dot pulsante o banner) | Medio | Bajo | Componente wrapper sencillo con CSS animation + localStorage. Critico para que el usuario descubra editar/eliminar. |

## D.3 Largo Plazo (Mes 2+) — Requiere mas esfuerzo

| # | Mejora | Impacto | Esfuerzo | Justificacion |
|---|--------|---------|----------|---------------|
| 14 | **Proyecto demo pre-poblado** para cada tenant nuevo | Alto | Alto | Requiere seed de datos realista, flag `isDemo`, logica de solo lectura. Ahora deberia incluir personas de ejemplo en el directorio. |
| 15 | **Panel de ayuda lateral contextual** | Medio | Alto | Componente Sheet + contenido por ruta + logica de contexto. Incluir ayuda para Personas. |
| 16 | **Componente GlossaryTerm** con hover/click para definiciones | Medio | Medio | Componente nuevo + diccionario de terminos + refactorizar texto existente. |
| 17 | **Indicador de progreso del proyecto** (barra visual en cards y header) | Bajo | Medio | Logica de calculo de progreso + componente de barra. |
| 18 | **Confirmacion antes de procesar** con estimacion de costo y tiempo | Medio | Medio | Dialog de confirmacion + calculo de costo estimado basado en duracion del audio. |
| 19 | **Manejo de errores visible** (toasts, banners de error, retry) | Alto | Alto | Reemplazar todos los `// silently fail` con manejo de errores real + UI de error. |
| 20 | **PersonSelector integrado en flujo de entrevista** | Medio | Medio | Selector con busqueda, fallback a creacion rapida, vinculacion automatica persona-speaker. |

---

# E. Ejemplos Concretos para Cada Pantalla

## E.0 Directorio de Personas (`/org-intelligence/persons`) (nuevo)

### Estado vacio (sin personas):
- **Empty state educativo** (ver Nivel 1) con icono de grupo, explicacion de por que crear el directorio antes de las entrevistas, CTA "Agregar primera persona"
- Si el usuario llega desde el checklist de onboarding, mostrar un **banner de contexto**: "Paso 1 de 7: Registra a las personas que vas a entrevistar. Despues las podras asignar como participantes de cada entrevista."

### Estado con datos (personas existentes):
- Cada persona muestra su `PersonAvatar` (foto o iniciales como fallback), nombre, cargo y area
- Si se esta usando el checklist de onboarding, mostrar un link "Siguiente paso: Crear proyecto" cuando al menos 1 persona este creada
- En el menu de acciones `...` de cada persona, la primera vez mostrar un banner sutil o el indicador pulsante para descubrimiento (ver seccion 3.2)
- Agregar un HelpTooltip junto al titulo "Personas": "Directorio de personas de tu organizacion. Las personas que registres aqui podran ser asignadas como participantes de las entrevistas. Incluye nombre, cargo, area y foto opcional."

### Vinculacion con entrevistas:
- Cuando el usuario este en el detalle de una entrevista y quiera agregar participantes, el selector de personas debe mostrar las personas del directorio. Si el directorio esta vacio, mostrar un link directo: "No hay personas en el directorio. [Agregar personas]"
- Si hay personas en el directorio pero ninguna coincide con lo que el usuario busca, mostrar: "No encontraste a la persona? [Agregar nueva persona al directorio]"

## E.1 Lista de Proyectos (`/org-intelligence/projects`)

### Estado vacio (sin proyectos):
- **Empty state educativo** (ver Nivel 1) con icono, explicacion de valor, CTA "Crear mi primer proyecto" y link a "Ver proyecto de ejemplo"
- **Checklist de onboarding** visible arriba del empty state (ver Nivel 2)

### Estado con datos (proyectos existentes):
- En cada card de proyecto, debajo de los contadores actuales (entrevistas, entidades, problemas), agregar una **barra de progreso** indicando el estado del levantamiento
- Si el checklist de onboarding no se ha completado, mantenerlo visible como una card destacada arriba del grid de proyectos
- En el proyecto demo (si existe), mostrar un badge **"Demo"** con color especial (por ejemplo, indigo) y un tooltip: "Este es un proyecto de ejemplo de solo lectura. Puedes explorarlo para ver que resultados genera la plataforma."
- **Menu de acciones `...`**: La primera vez que se renderiza la lista con proyectos, agregar un banner educativo sutil: "Tip: Usa el menu ⋯ de cada proyecto para editarlo o eliminarlo." Este banner se descarta con "Entendido" y no reaparece.

## E.2 Crear Proyecto (modal/wizard)

### Paso 1:
- Placeholder del campo "Nombre" que diga: `Ej: Levantamiento Operacional 2026`
- Placeholder del campo "Descripcion" (renombrar a "Objetivo del levantamiento") que diga: `Ej: Entender como funciona el area de operaciones para identificar oportunidades de mejora`
- Agregar un HelpTooltip junto al titulo "Nuevo Proyecto" que diga: "Un proyecto agrupa todas las entrevistas de un levantamiento organizacional. Puedes crear un proyecto por area, por sede o por iniciativa de mejora."
- Agregar un texto guia bajo la descripcion: "Tip: Un buen objetivo describe que area o proceso quieres analizar y que esperas encontrar."

### Paso 2 (opcional — crear primera entrevista):
- Texto introductorio: "Puedes agregar tu primera entrevista ahora o hacerlo despues."
- Campos: titulo de entrevista + fecha
- Boton dual: "Solo crear proyecto" | "Crear proyecto + entrevista"

## E.3 Detalle de Proyecto (primera vez vs uso recurrente)

### Primera vez (proyecto recien creado):
- **Banner educativo** debajo del header: "Este proyecto tiene 5 secciones. Comienza por 'Entrevistas' para agregar y procesar grabaciones. Las demas pestanas se llenaran automaticamente."
- Los tabs de **Analisis, Diagnostico y Plan de Accion** deben mostrar un indicador visual de "pendiente" (texto gris, o un icono de reloj). Ejemplo: `Analisis (pendiente)`
- La tab de **Entrevistas** debe ser la activa por defecto (ya lo es)
- El **empty state de entrevistas** debe ser el educativo (ver Nivel 1)

### Uso recurrente (proyecto con datos):
- No mostrar banners educativos
- Los tabs con datos muestran contadores: `Entrevistas (5)`, `Analisis ✓`, `Diagnostico ✓`, `Plan de Accion (12 mejoras)`
- Agregar badge de progreso junto al StatusBadge del proyecto en el header

## E.4 Configuracion de Entrevista (participantes, contexto)

### Seccion de participantes (actualizada para selector de personas):
- **Empty state educativo** cuando no hay participantes asignados (ver Nivel 1). El CTA primario abre el selector de personas del directorio.
- El selector debe mostrar las personas registradas en el directorio con su `PersonAvatar` (foto o iniciales), nombre, cargo y area. El usuario selecciona personas de la lista.
- Si el directorio de personas esta vacio, el empty state del selector muestra: "No hay personas en el directorio. [Ir a crear personas]" con un link a `/org-intelligence/persons`.
- Al seleccionar una persona, pedir adicionalmente: Es entrevistador o entrevistado? (checkbox o toggle).
- El campo **"Etiqueta de hablante"** (speakerLabel) se mueve a una seccion colapsable "Configuracion avanzada" debajo de los campos principales, con un texto: "La etiqueta se asigna automaticamente. Solo modificala si necesitas que coincida con un identificador especifico de la transcripcion."
- Agregar tooltip junto a "Es entrevistador": "Marca esta opcion si esta persona es quien realiza las preguntas. Las respuestas del entrevistado tienen mas peso en el analisis organizacional."
- **Acceso directo:** Agregar un link "Agregar persona nueva" debajo de la lista del selector que abra un dialog rapido de creacion de persona (nombre, cargo, area) sin salir de la entrevista. Esto evita interrumpir el flujo.

### Seccion de audio (cuando ya hay participantes):
- El banner amarillo de advertencia cambia a un banner verde de confirmacion: "Participantes configurados correctamente. Puedes subir el audio ahora."

## E.5 Upload y Procesamiento de Audio

### Zona de upload:
- Agregar al texto de la zona de drag-and-drop: "Formatos: MP3, WAV, M4A, OGG, WebM. Maximo 500 MB."
- Debajo de la zona de upload, agregar texto informativo: "Tip: Asegurate de que el audio tenga buena calidad. Entrevistas con mucho ruido de fondo pueden afectar la precision de la transcripcion."

### Boton "Procesar":
- Antes de procesar, agregar un dialog de confirmacion: "Al procesar, la IA transcribira el audio (Deepgram Nova-3) y luego extraera conocimiento organizacional (GPT-5.4, 5 pasadas de analisis). Este proceso toma entre 3 y 5 minutos y tiene un costo de procesamiento de IA. Continuar?"
- Botones: "Cancelar" | "Procesar entrevista"

### Durante el procesamiento:
- La visualizacion de pipeline actual esta bien. Agregar un **texto de contexto** debajo de la barra de progreso segun el paso actual:
  - TRANSCRIBING: "Convirtiendo audio a texto. Esto suele tomar 1-2 minutos dependiendo de la duracion del audio."
  - EXTRACTING: "Analizando el texto para identificar personas, procesos, problemas y dependencias. Esto toma 2-3 minutos."

### Al completar:
- **Banner de celebracion** (ver Nivel 5) con link directo a tabs de Analisis y Diagnostico
- La transcripcion se muestra debajo. Agregar un texto introductorio: "Transcripcion generada automaticamente. Cada color representa un participante diferente. Puedes usar esta transcripcion como referencia; la IA ya extrajo el conocimiento relevante en las pestanas de Analisis y Diagnostico."

## E.6 Resultados de Transcripcion

### En la seccion de transcripcion:
- Agregar un legend/leyenda de colores de speakers arriba de los segmentos, no solo los badges inline. Con los nuevos `PersonAvatar`, la leyenda puede mostrar la foto/iniciales de cada participante:
  ```
  [Avatar + Badge azul] Maria Lopez — Gerente de Operaciones (Entrevistada)
  [Avatar + Badge verde] Camilo Espinoza — Entrevistador
  ```
  Esto vincula visualmente los colores con las personas del directorio y sus roles en la entrevista.

- Agregar un HelpTooltip junto al titulo "Transcripcion": "Esta transcripcion fue generada automaticamente por IA (Deepgram Nova-3). Puede contener errores menores, especialmente en nombres propios o terminos tecnicos especificos de tu industria."

## E.7 Knowledge Base

### Tab de Busqueda (propuesto como tab por defecto):
- Cambiar el placeholder del input a un placeholder rotativo o mas descriptivo: "Busca con preguntas naturales: 'Que problemas tiene logistica?', 'Quien usa SAP?', 'Como funciona el proceso de compras?'"
- Debajo del input, en lugar del texto actual, mostrar **ejemplos clicables**: "Prueba: [problemas de coordinacion] [procesos manuales] [sistemas sin integracion]". Al hacer clic, se auto-rellena el input y ejecuta la busqueda.

### Tab de Entidades:
- **Banner de primera vez**: "Cada entidad fue detectada automaticamente en las entrevistas. El tipo (Departamento, Rol, Proceso, etc.) y la confianza indican que tan segura esta la IA. Haz clic en una entidad para ver sus relaciones."
- El slider de confianza deberia tener marcas contextuales: "< 50%: Requiere validacion | 50-80%: Probable | > 80%: Alta confianza"

### Tab de Procesos:
- El empty state actual es bueno ("Los diagramas se generan cuando el entrevistado describe un proceso paso a paso..."). Mantenerlo y agregar: "Para obtener mejores diagramas, pide a los entrevistados que describan sus procesos paso a paso, mencionando quien hace cada actividad y que sistemas usa."

## E.8 Analisis y Diagnostico

### Tab de Analisis:
- **Contexto para las metricas**: Junto a "Total entidades: 45", mostrar un micro-texto: "Normal para X entrevistas". Esto da un benchmark al usuario. Si no es posible calcular un benchmark, al menos agregar: "Este numero crece con cada entrevista procesada."
- **Contexto para confianza promedio**: Junto al porcentaje, agregar un indicador visual: `72% — Buena (la mayoria de la informacion es confiable. Revisa entidades con confianza < 50%)`
- En la tabla de "Top 5 problemas", agregar una nota al pie: "Los problemas se detectan automaticamente de lo que dicen los entrevistados. Validalos con tu equipo antes de tomar acciones."

### Tab de Diagnostico:
- **Resumen ejecutivo**: Si no hay resumen del API, generar un texto placeholder que explique que se mostrara aqui.
- **Cuellos de botella**: Junto al titulo, cambiar el HelpTooltip actual (que usa "grafo organizacional") por: "Los cuellos de botella son como los cruces mas transitados de tu organizacion. Si uno se congestiona, muchas areas se ven afectadas. El numero de dependencias indica cuantas otras areas dependen de este punto."
- **SPOFs**: Reemplazar "SPOF" por "Riesgos de persona clave" en la interfaz visible (mantener SPOF solo como termino tecnico en tooltips). La card quedaria: "Riesgos de persona clave — Roles que participan en multiples procesos y cuyo conocimiento no esta documentado."
- **Contradicciones**: Agregar un texto introductorio: "Cuando dos personas describen el mismo tema de forma diferente, puede indicar falta de estandarizacion o diferentes interpretaciones. Revisa cada contradiccion con los involucrados."

## E.9 Plan de Accion (Mejoras)

### Tabla de mejoras:
- Agregar un **banner educativo de primera vez**: "Estas mejoras fueron generadas automaticamente por la IA a partir de los problemas detectados. Estan priorizadas con el metodo RICE: las que tienen mayor puntaje son las que combinan mas alcance, impacto y menor esfuerzo. Puedes cambiar el estado de cada mejora a medida que las implementes."
- En la columna "Prioridad", agregar un tooltip que explique el numero: "El puntaje de prioridad se calcula como (Alcance x Impacto x Confianza) / Esfuerzo. Mayor numero = mayor prioridad."

### Matriz esfuerzo-impacto:
- El **banner educativo de primera vez** (ver Nivel 3): "Los puntos en la esquina superior izquierda son 'Quick Wins': mejoras de alto impacto y bajo esfuerzo. Son el mejor punto de partida para generar resultados rapidos."
- Debajo de los labels de cuadrantes, agregar una leyenda mas descriptiva:
  - Quick Wins: "Empieza aqui. Alto impacto, poco esfuerzo."
  - Estrategico: "Importantes pero requieren planificacion."
  - Si hay tiempo: "Bajo impacto, poco esfuerzo. Pueden esperar."
  - Evitar: "No vale la pena. Mucho esfuerzo, poco impacto."

---

# F. Componentes Tecnicos Necesarios

## F.1 Componentes nuevos a construir

### `OnboardingChecklist`
**Ubicacion propuesta:** `components/org-intelligence/onboarding-checklist.tsx`
**Funcion:** Card de checklist con pasos del primer levantamiento. Muestra progreso, marca pasos completados automaticamente, persiste estado en localStorage.
**Props:**
- `projectId?: string` — si existe, vincula los pasos con el estado real del proyecto
- `onDismiss: () => void` — callback cuando el usuario descarta
- `onComplete: () => void` — callback cuando se completan todos los pasos

### `EducationalEmptyState`
**Ubicacion propuesta:** `components/org-intelligence/educational-empty-state.tsx`
**Funcion:** Reemplaza los empty states basicos. Muestra icono, titulo, descripcion educativa, CTA primario y tip opcional.
**Props:**
- `icon: ReactNode` — icono o ilustracion
- `title: string` — titulo del empty state
- `description: string | ReactNode` — texto educativo (puede incluir listas)
- `action: { label: string; onClick: () => void }` — boton CTA primario
- `secondaryAction?: { label: string; href: string }` — link secundario
- `tip?: string` — texto de tip opcional en la parte inferior

### `ContextualBanner`
**Ubicacion propuesta:** `components/org-intelligence/contextual-banner.tsx`
**Funcion:** Banner descartable que aparece solo la primera vez que el usuario visita una seccion. Se descarta con un boton "Entendido" y no vuelve a aparecer.
**Props:**
- `id: string` — identificador unico para tracking en localStorage
- `message: string | ReactNode` — contenido del banner
- `variant?: "info" | "success" | "tip"` — estilo visual
- `dismissLabel?: string` — texto del boton de descarte (default: "Entendido")

### `ProgressCelebration`
**Ubicacion propuesta:** `components/org-intelligence/progress-celebration.tsx`
**Funcion:** Banner de celebracion que aparece cuando se completa un hito. Incluye mensaje de exito, estadisticas del logro y CTAs para siguiente paso.
**Props:**
- `milestone: "first-interview" | "first-diagnosis" | "onboarding-complete"` — tipo de hito
- `stats?: Record<string, number>` — estadisticas relevantes (entidades, problemas, etc.)
- `onDismiss: () => void` — callback cuando el usuario descarta
- `actions: { label: string; href: string }[]` — botones de siguiente paso

### `ProjectProgressBar`
**Ubicacion propuesta:** `components/org-intelligence/project-progress-bar.tsx`
**Funcion:** Barra de progreso visual que indica el estado del levantamiento.
**Props:**
- `interviewsTotal: number`
- `interviewsProcessed: number`
- `hasAnalysis: boolean`
- `hasDiagnosis: boolean`
- `hasImprovements: boolean`

### `GlossaryTerm`
**Ubicacion propuesta:** `components/org-intelligence/glossary-term.tsx`
**Funcion:** Wrapper que convierte un termino en un link con tooltip/popover que muestra la definicion.
**Props:**
- `term: string` — clave del termino en el diccionario
- `children: ReactNode` — texto visible
- `inline?: boolean` — si true, usa tooltip inline; si false, usa popover con mas detalle

### `HelpPanel`
**Ubicacion propuesta:** `components/org-intelligence/help-panel.tsx`
**Funcion:** Panel lateral (Sheet) con contenido de ayuda contextual segun la ruta actual.
**Props:**
- `currentPath: string` — ruta actual para determinar contenido relevante

### `ProcessConfirmDialog`
**Ubicacion propuesta:** `components/org-intelligence/process-confirm-dialog.tsx`
**Funcion:** Dialog de confirmacion antes de lanzar el procesamiento de una entrevista. Muestra informacion sobre que hara la IA, tiempo estimado y costo.
**Props:**
- `interviewTitle: string`
- `audioDuration?: number` — duracion en segundos (si disponible)
- `onConfirm: () => void`
- `onCancel: () => void`

### `ActionMenuDiscovery`
**Ubicacion propuesta:** `components/org-intelligence/action-menu-discovery.tsx`
**Funcion:** Wrapper alrededor del icono `...` del DropdownMenu que muestra un indicador pulsante (dot animado) la primera vez que se renderiza. Se desactiva despues del primer clic o despues de que el usuario descarte el banner educativo general.
**Props:**
- `featureId: string` — identificador para tracking de first-use
- `children: ReactNode` — el DropdownMenuTrigger original

### `PersonSelector`
**Ubicacion propuesta:** `components/org-intelligence/person-selector.tsx`
**Funcion:** Componente de seleccion de personas del directorio para asignar como participantes de entrevista. Muestra PersonAvatar + nombre + cargo. Incluye busqueda, estado vacio con link al directorio, y opcion de crear persona rapida sin salir del contexto.
**Props:**
- `selectedPersonIds: string[]`
- `onSelectionChange: (ids: string[]) => void`
- `projectId?: string` — para filtrar personas relevantes si aplica

## F.2 Modificaciones a componentes existentes

### `HelpTooltip` (`help-tooltip.tsx`)
- Sin cambios estructurales. Solo actualizar los textos en los archivos que lo consumen.

### `StatusBadge` (`status-badge.tsx`)
- Agregar soporte para una variante "muted" o "pending" que muestre el badge en gris con texto "(pendiente)" para tabs sin datos.

### Dialog de Nuevo Proyecto (`projects/page.tsx`)
- Refactorizar de un dialog simple a un wizard de 2 pasos con estado `step: 0 | 1`.
- Agregar placeholder mejorados y tooltips en los campos.

### Dialog de Nuevo Participante (`interviews/[interviewId]/page.tsx`)
- Mover el campo `speakerLabel` a una seccion colapsable "Configuracion avanzada".
- Reordenar campos: Nombre > Cargo > Area > Es entrevistador > [Avanzado: speakerLabel].

### Tabs del detalle de proyecto (`projects/[id]/page.tsx`)
- Agregar contadores a los tabs (usar datos de `project._count`).
- Agregar indicadores "(pendiente)" para tabs sin datos procesados.

### Knowledge Base (`knowledge-base/page.tsx`)
- Cambiar `defaultValue` de "entities" a "search".
- Agregar ejemplos clicables debajo del input de busqueda.

## F.3 Hooks y utilidades necesarias

### `useFirstVisit(sectionId: string): { isFirstVisit: boolean; markVisited: () => void }`
**Funcion:** Hook que trackea si es la primera vez que el usuario visita una seccion. Usa localStorage con keys tipo `zeru_firstVisit_{sectionId}`.

### `useOnboardingProgress(): { steps: StepStatus[]; currentStep: number; complete: () => void }`
**Funcion:** Hook que gestiona el estado del checklist de onboarding. Lee/escribe en localStorage o en el backend.

### Diccionario de terminos del glosario
**Ubicacion propuesta:** `lib/org-intelligence/glossary.ts`
**Funcion:** Objeto con definiciones de todos los terminos especializados usados en la interfaz.

---

# Resumen Ejecutivo

## La situacion actual
El modulo de Inteligencia Organizacional de Zeru tiene una funcionalidad robusta pero carece de guia para el usuario. Los empty states son genericos, no hay onboarding del modulo, los tabs avanzados se muestran prematuramente, y la terminologia asume conocimiento previo que un gerente tipico no tiene. Con la adicion del directorio de personas y los menus de acciones (en desarrollo en paralelo), el flujo de uso se vuelve mas completo pero tambien mas largo (7 pasos), lo que hace la educacion del usuario aun mas critica.

## Lo que proponemos
Un sistema de educacion de 6 niveles: (1) empty states educativos que ensenen el valor (incluyendo el nuevo directorio de personas), (2) checklist de onboarding de 7 pasos + proyecto demo, (3) banners contextuales de primera vez + descubrimiento de menus de acciones, (4) progressive disclosure de tabs, campos y navegacion, (5) celebracion de hitos, (6) panel de ayuda contextual + glosario.

## Impacto esperado
- Reduccion del time-to-value de "dias" a "minutos" (con el proyecto demo, el usuario ve un diagnostico completo en su primera visita)
- Eliminacion de los momentos de confusion critica (9 puntos identificados, incluyendo el directorio de personas y los menus de acciones)
- Mejora en la tasa de activacion: mas usuarios completaran su primer levantamiento sin asistencia humana

## Primeras acciones
Las primeras 6 mejoras (reescribir empty states, tooltips, indicadores de tabs) no requieren componentes nuevos y pueden implementarse en 1-2 semanas. Los items 7-13 (checklist de onboarding, banners, empty state de personas, descubrimiento de menus) se suman en las semanas 3-4. El proyecto demo, help panel y PersonSelector integrado son inversiones de mayor plazo.

## Dependencias con trabajo en paralelo
- Los menus de acciones de `ux-flows-audit` deben estabilizarse antes de agregar el indicador de descubrimiento (`ActionMenuDiscovery`).
- El directorio de personas de `impl-person-profiles` debe estar funcional antes de construir el `PersonSelector` integrado en entrevistas y antes de finalizar el contenido del checklist de onboarding.
- Los empty states educativos del directorio de personas se pueden implementar en cuanto la pagina `/org-intelligence/persons` este disponible.
