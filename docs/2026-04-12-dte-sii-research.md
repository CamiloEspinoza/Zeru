# Investigación: Integración DTE/SII para Zeru

**Fecha:** 2026-04-12
**Branch:** feature/dte-sii-integration
**Objetivo:** Integrar facturación electrónica de mercado del SII directamente en Zeru

---

## 1. Marco Legal

### Normativa principal
- **Ley 19.799 (2002)**: Firma electrónica — establece validez jurídica de documentos electrónicos
- **Ley 20.727 (2014)**: Obligatoriedad de factura electrónica para todos los contribuyentes
- **Ley 19.983**: Cesión de facturas y acuse de recibo comercial (mérito ejecutivo)
- **Resolución Exenta SII N°80/2014**: Normas y procedimientos de facturación electrónica de mercado
- **Res. Ex. N°74/2020 y N°76/2020**: Obligatoriedad boleta electrónica (desde 1 marzo 2021)

### Obligaciones del contribuyente
- Emitir facturas, boletas, NC, ND y guías de despacho electrónicamente
- Enviar DTEs al SII y al receptor
- Enviar RCOF diario (boletas electrónicas)
- Almacenar XMLs originales por **6 años** mínimo
- Validar RCV mensualmente

### Penalidades (Art. 97 Código Tributario)
| Infracción | Sanción |
|------------|---------|
| No emisión de DTE | 50%-500% del monto, mín 2 UTM, clausura 1-20 días |
| No cumplir requisitos | Misma que no emisión |
| Atraso envío información | 1 UTM a 1 UTA |
| Declaraciones falsas | 50%-300% impuesto + presidio |

---

## 2. Tipos de DTE (Códigos SII)

| Código | Documento |
|--------|-----------|
| 33 | Factura Electrónica |
| 34 | Factura No Afecta o Exenta Electrónica |
| 39 | Boleta Electrónica |
| 41 | Boleta Exenta Electrónica |
| 43 | Liquidación-Factura Electrónica |
| 46 | Factura de Compra Electrónica |
| 52 | Guía de Despacho Electrónica |
| 56 | Nota de Débito Electrónica |
| 61 | Nota de Crédito Electrónica |
| 110 | Factura de Exportación Electrónica |
| 111 | Nota de Débito de Exportación Electrónica |
| 112 | Nota de Crédito de Exportación Electrónica |

---

## 3. Ambientes del SII

| Ambiente | Host | Uso |
|----------|------|-----|
| Certificación | `maullin.sii.cl` | Pruebas y certificación |
| Producción | `palena.sii.cl` | Operación real |
| API REST Boletas (Cert) | `apicert.sii.cl` | API REST boletas test |
| API REST Boletas (Prod) | `api.sii.cl` | API REST boletas real |
| WS Reclamo (Cert) | `ws2.sii.cl` | Registro reclamo DTE test |
| WS Reclamo (Prod) | `ws1.sii.cl` | Registro reclamo DTE real |
| Libros CV | `zeus.sii.cl` | Información compras/ventas |

---

## 4. Endpoints y Web Services

### 4.1 SOAP/WSDL (Facturas, Notas, Guías)

| # | Servicio | Certificación | Producción |
|---|----------|---------------|------------|
| 1 | CrSeed (semilla) | `https://maullin.sii.cl/DTEWS/CrSeed.jws?WSDL` | `https://palena.sii.cl/DTEWS/CrSeed.jws?WSDL` |
| 2 | GetTokenFromSeed | `https://maullin.sii.cl/DTEWS/GetTokenFromSeed.jws?WSDL` | `https://palena.sii.cl/DTEWS/GetTokenFromSeed.jws?WSDL` |
| 3 | DTEUpload | `https://maullin.sii.cl/cgi_dte/UPL/DTEUpload` | `https://palena.sii.cl/cgi_dte/UPL/DTEUpload` |
| 4 | QueryEstUp (estado upload) | `https://maullin.sii.cl/DTEWS/QueryEstUp.jws?WSDL` | `https://palena.sii.cl/DTEWS/QueryEstUp.jws?WSDL` |
| 5 | QueryEstDte (estado DTE) | `https://maullin.sii.cl/DTEWS/QueryEstDte.jws?WSDL` | `https://palena.sii.cl/DTEWS/QueryEstDte.jws?WSDL` |
| 6 | QueryEstDteAv (avanzado) | `https://maullin.sii.cl/DTEWS/services/QueryEstDteAv?wsdl` | `https://palena.sii.cl/DTEWS/services/QueryEstDteAv?wsdl` |
| 7 | wsDTECorreo (reenvío) | `https://maullin.sii.cl/DTEWS/services/wsDTECorreo?wsdl` | `https://palena.sii.cl/DTEWS/services/wsDTECorreo?wsdl` |
| 8 | RegistroReclamoDTE | `https://ws2.sii.cl/WSREGISTRORECLAMODTECERT/registroreclamodteservice?wsdl` | `https://ws1.sii.cl/WSREGISTRORECLAMODTE/registroreclamodteservice?wsdl` |

### 4.2 API REST (Solo Boletas tipos 39/41)

| Endpoint | Método | URL Base |
|----------|--------|----------|
| Semilla | GET | `/recursos/v1/boleta.electronica.semilla` |
| Token | POST | `/recursos/v1/boleta.electronica.token` |
| Envío (max 50) | POST | `/recursos/v1/boleta.electronica.envio` |
| Estado envío | GET | `/recursos/v1/boleta.electronica.envio/{rut}-{dv}-{trackid}` |
| Estado boleta | GET | `/recursos/v1/boleta.electronica/{rut}-{dv}-{tipo}-{folio}/estado` |

**Rate limiting:** 600 requests/hora. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

### 4.3 Registro Aceptación/Reclamo DTE — Métodos

| Método | Descripción |
|--------|-------------|
| `ingresarAceptacionReclamoDoc` | Registrar aceptación o reclamo |
| `listarEventosHistDoc` | Historial de eventos del documento |
| `consultarDocDteCedible` | Consultar si DTE es cedible |

**Acciones disponibles:** `ACD` (Acepta), `RCD` (Reclamo contenido), `ERM` (Recibo mercaderías), `RFP` (Reclamo falta parcial), `RFT` (Reclamo falta total)

---

## 5. Flujo de Autenticación (Semilla/Token)

```
1. GET CrSeed.getSeed() → semilla (vigencia 2 min)
2. Firmar semilla con XMLDSig (RSA-SHA1, certificado digital)
3. POST GetTokenFromSeed.getToken(semillaFirmada) → TOKEN (vigencia ~60 min)
4. Usar TOKEN como Cookie HTTP o parámetro SOAP
```

**Algoritmos requeridos:**
- Canonicalización: `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`
- Firma: `http://www.w3.org/2000/09/xmldsig#rsa-sha1`
- Transform: `http://www.w3.org/2000/09/xmldsig#enveloped-signature`

**Códigos de error del token:**
- `00`: OK | `04`: No Signature | `05`: Firma inválida | `06`: No Semilla | `12`: Error certificado

---

## 6. Flujo Completo de Emisión

```
PREPARACIÓN
├── Obtener certificado digital (prestador acreditado)
├── Inscribirse como emisor electrónico en SII
└── Solicitar CAF (folios autorizados, vigencia 6 meses)

EMISIÓN
├── Construir XML del DTE según esquema XSD
├── Generar TED (timbre) con clave privada del CAF
├── Firmar documento con certificado digital (XMLDSig)
└── Generar representación impresa con PDF417

ENVÍO AL SII
├── Obtener token de autenticación
├── Armar sobre EnvioDTE (Carátula + SetDTE + DTEs firmados)
├── Enviar vía HTTPS POST multipart
├── Recibir TrackID
└── Consultar estado hasta obtener DOK/RCH

ENVÍO AL RECEPTOR
├── Obtener email de intercambio del receptor
├── Enviar EnvioDTE al receptor
└── Esperar acuses de recibo

ACUSE DE RECIBO (Receptor, plazo 8 días)
├── RecepcionDTE → confirma recepción del XML
├── ResultadoDTE → acepta o rechaza comercialmente
└── EnvioRecibos → recibo mercaderías (Ley 19.983)

POST-EMISIÓN
├── Almacenar XML por 6 años mínimo
├── Validar RCV mensualmente
└── Cesión electrónica (opcional, factoring)
```

---

## 7. Estructura XML del DTE

### Esquemas XSD (4 archivos coordinados)
1. **EnvioDTE_v10.xsd** — Archivo principal de envío
2. **DTE_v10.xsd** — Descripción del documento
3. **SiiTypes_v10.xsd** — Tipos de datos
4. **xmldsignature_v10.xsd** — Firma digital

### Estructura simplificada de un DTE

```xml
<DTE version="1.0">
  <Documento ID="F33T123">
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>123</Folio>
        <FchEmis>2026-04-12</FchEmis>
        <FmaPago>1</FmaPago>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76123456-7</RUTEmisor>
        <RznSoc>Empresa SpA</RznSoc>
        <GiroEmis>Desarrollo de Software</GiroEmis>
        <Acteco>620100</Acteco>
        <DirOrigen>Av. Principal 123</DirOrigen>
        <CmnaOrigen>Santiago</CmnaOrigen>
      </Emisor>
      <Receptor>
        <RUTRecep>77654321-K</RUTRecep>
        <RznSocRecep>Cliente Ltda</RznSocRecep>
        <GiroRecep>Comercio</GiroRecep>
        <DirRecep>Calle 456</DirRecep>
        <CmnaRecep>Providencia</CmnaRecep>
      </Receptor>
      <Totales>
        <MntNeto>100000</MntNeto>
        <TasaIVA>19</TasaIVA>
        <IVA>19000</IVA>
        <MntTotal>119000</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NroLinDet>1</NroLinDet>
      <NmbItem>Servicio de consultoría</NmbItem>
      <QtyItem>1</QtyItem>
      <PrcItem>100000</PrcItem>
      <MontoItem>100000</MontoItem>
    </Detalle>
    <TED version="1.0">
      <DD>
        <RE>76123456-7</RE>       <!-- RUT Emisor -->
        <TD>33</TD>               <!-- Tipo DTE -->
        <F>123</F>                <!-- Folio -->
        <FE>2026-04-12</FE>       <!-- Fecha Emisión -->
        <RR>77654321-K</RR>       <!-- RUT Receptor -->
        <RSR>Cliente Ltda</RSR>   <!-- Razón Social Receptor -->
        <MNT>119000</MNT>         <!-- Monto Total -->
        <IT1>Servicio de consultoría</IT1> <!-- Primer Ítem -->
        <FRMA algoritmo="SHA1withRSA">...</FRMA> <!-- Firma con clave CAF -->
      </DD>
    </TED>
    <TmstFirma>2026-04-12T10:30:00</TmstFirma>
  </Documento>
  <Signature>...</Signature> <!-- XMLDSig del emisor -->
</DTE>
```

### Doble firma del DTE
1. **Firma TED (Timbre)**: Con clave privada del CAF → valida que el folio fue autorizado por el SII
2. **Firma XMLDSig**: Con certificado digital del contribuyente → identidad del emisor + integridad

### Estructura del EnvioDTE (sobre de envío)

```xml
<EnvioDTE version="1.0">
  <SetDTE ID="SetDoc">
    <Caratula version="1.0">
      <RutEmisor>76123456-7</RutEmisor>
      <RutEnvia>12345678-9</RutEnvia>
      <RutReceptor>60803000-K</RutReceptor> <!-- RUT del SII -->
      <FchResol>2014-08-22</FchResol>
      <NroResol>80</NroResol>
      <TmstFirmaEnv>2026-04-12T10:35:00</TmstFirmaEnv>
      <SubTotDTE>
        <TpoDTE>33</TpoDTE>
        <NroDTE>5</NroDTE>
      </SubTotDTE>
    </Caratula>
    <DTE>...</DTE> <!-- DTEs firmados -->
  </SetDTE>
  <Signature>...</Signature> <!-- Firma del sobre -->
</EnvioDTE>
```

### Upload HTTP (DTEUpload)

**Headers requeridos:**
```
POST /cgi_dte/UPL/DTEUpload HTTP/1.0
Content-Type: multipart/form-data; boundary={boundary}
User-Agent: Mozilla/4.0 (compatible; PROG 1.0; Windows NT 5.0; ...)
Cookie: TOKEN={token}
```

**IMPORTANTE:** User-Agent debe contener `PROG 1.0` para que la respuesta sea XML.

**Campos multipart:** `rutSender`, `dvSender`, `rutCompany`, `dvCompany`, `archivo` (XML firmado)

**Códigos de status upload:** 0=OK, 1=Sin permiso, 2=Error tamaño, 5=No autenticado, 6=No autorizado, 7=Schema inválido, 8=Error firma

---

## 8. Estados del SII

### Estado de Envío (QueryEstUp)
| Estado | Descripción |
|--------|-------------|
| REC | Envío recibido |
| EPR | Envío procesado |
| SOK | Schema validado |
| FOK | Firma OK |
| RSC | Rechazado por schema |
| RCT | Rechazado por carátula |
| RFR | Rechazado por firma |
| RCH | Rechazado |

### Estado de DTE Individual (QueryEstDte)
| Estado | Descripción |
|--------|-------------|
| DOK | DTE aceptado |
| DNK | Datos no coinciden |
| FAU/FNA | DTE no recibido |
| FAN | Documento anulado |
| ANC | Existe nota de crédito |
| AND | Existe nota de débito |

---

## 9. Intercambio entre Contribuyentes

```
EMISOR                              RECEPTOR
  │                                    │
  │─── EnvioDTE (factura) ────────────>│
  │                                    │
  │<── RecepcionDTE (acuse recibo) ────│  (confirma recepción XML)
  │                                    │
  │<── ResultadoDTE (acepta/rechaza) ──│  (aprobación/rechazo comercial)
  │                                    │
  │<── EnvioRecibos (Ley 19.983) ──────│  (recibo de mercaderías, plazo 8 días)
  │                                    │
```

Si no hay reclamo en **8 días**, la factura se entiende **tácitamente aceptada**.

---

## 10. Boleta Electrónica vs Factura

| Aspecto | Factura (33) | Boleta (39) |
|---------|-------------|-------------|
| Receptor | Contribuyente con RUT | Consumidor final (anónimo) |
| IVA | Desglosado (neto + IVA) | Incluido en total |
| Crédito fiscal | Sí | No |
| Envío al SII | Cada DTE individualmente | RCOF diario (resumen) |
| Intercambio | Protocolo con receptor | No requiere |
| Cesión | Puede cederse (factoring) | No cedible |
| Acuse de recibo | Aplica Ley 19.983 | No aplica |
| API SII | SOAP/WSDL | **API REST** (moderna) |

### RCOF (Reporte de Consumo de Folios)
- Envío **diario** obligatorio al SII
- Resume boletas emitidas y anuladas del día
- Debe enviarse antes de medianoche o antes de la primera boleta del día siguiente

---

## 11. Cesión Electrónica (Factoring)

- Regulada por Ley 19.983
- Requiere acuse de recibo o aceptación tácita (8 días)
- Se registra en el RPETC (Registro Público Electrónico de Transferencias de Crédito)
- Permite cesiones sucesivas (re-cesión)
- Portal certificación: `https://maullin.sii.cl/dte/RTC/RTCAnotaciones.html`
- Portal producción: `https://palena.sii.cl/rtc/RTC/RTCMenu.html`

---

## 12. Proceso de Certificación (6 Etapas)

| Etapa | Descripción |
|-------|-------------|
| 1. Set de Prueba | SII entrega datos únicos, generar DTEs sin rechazos. Receptor: RUT `60803000-K` |
| 2. Set de Simulación | Documentos con datos representativos de operación real |
| 3. Intercambio | SII envía DTEs, verificar acuses de recibo y respuestas |
| 4. Muestras Impresas | Hasta 20 documentos con timbre PDF417 |
| 5. Declaración Cumplimiento | Procedimientos auditables: folios, respaldos, contingencias |
| 6. Registro Emisor | Publicación de resolución, autorización legal |

**Documentos mínimos:** Factura (33), Nota de Crédito (61), Nota de Débito (56)
**6 meses sin actividad = eliminación** del sistema de certificación

---

## 13. Stack Técnico Recomendado

### Librerías npm

| Librería | Versión | Uso | Descargas/sem |
|----------|---------|-----|---------------|
| `xml-crypto` | 6.1.2 | Firma XMLDSig | ~1.36M |
| `node-forge` | 1.4.0 | Parseo certificados .p12/PKCS#12 | Millones |
| `soap` | 1.8.0 | Cliente SOAP para WSDL del SII | Alta |
| `fast-xml-parser` | 5.5.11 | Parseo rápido XML ↔ JS | Alta |
| `bwip-js` | 4.9.0 | Generación código de barras PDF417 | Alta |
| `@xmldom/xmldom` | — | DOM XML | Alta |
| `cockatiel` | 3.2.0 | Circuit breaker + retry | — |
| `wsdl-tsclient` | 1.7.1 | Generar tipos TS desde WSDL | — |

### Librería existente: @devlas/dte-sii (REVISIÓN PROFUNDA)

**Datos generales:**
- **npm:** `@devlas/dte-sii` v2.5.16 (abril 2026) | **GitHub:** devlas-cl/dte-sii
- **Autor:** Devlas SpA | **Licencia:** MIT
- **Edad:** 3 semanas (creado 20 mar 2026), 26 commits, 1 star, ~2,981 downloads/mes
- **Lenguaje:** JavaScript puro (CommonJS) con `.d.ts` de ~600 líneas
- **Node requerido:** >= 18.0.0

**Arquitectura interna (60 archivos):**
- `Certificado.js` — Manejo de PFX/P12 con node-forge
- `CAF.js` — Parser de Códigos de Autorización de Folios
- `DTE.js` — Generación XML, timbraje (TED) y firma XMLDSig
- `Signer.js` — Firma XML-DSig para EnvioDTE (SetDTE)
- `Envio.js` — EnvioBOLETA y EnvioDTE (sobres XML)
- `EnviadorSII.js` — Comunicación REST + SOAP con SII (~1300 líneas, god object)
- `ConsumoFolio.js` — RCOF (Resumen Consumo de Folios)
- `LibroCompraVenta.js` / `LibroGuia.js` — Libros electrónicos
- `FolioService.js` + `CafSolicitor.js` — Scraping del portal SII para solicitar CAFs
- `SiiSession.js` + `SiiPortalAuth.js` — Sesiones HTTP con mTLS
- `cert/` (20 archivos) — Automatización completa del proceso de certificación SII
- `utils/` (18 archivos) — C14N, cálculos, endpoints, errores, logger, RUT, XML

**Firma XMLDSig:** Implementación propia manual (NO usa xml-crypto internamente):
1. C14N manual en `utils/c14n.js`
2. Digest SHA-1 → base64
3. Firma RSA-SHA1 con `crypto.createSign()` nativo
4. KeyInfo con RSAKeyValue + X509Certificate

**Timbre electrónico (TED):** Correcto — firma DD con clave privada del CAF (SHA1withRSA, encoding latin1)

**API principal (encadenable):**
```
const dte = new DTE({ tipo: 33, folio: 123, ... });
dte.generarXML().timbrar(caf).firmar(cert);
const xml = dte.getXML();

const envio = new EnvioDTE({ ... });
envio.agregar(dte).setCaratula({ ... }).generar();

const enviador = new EnviadorSII(cert, 'certificacion');
const result = await enviador.enviarDteSoap(envio);
const estado = await enviador.consultarEstadoSoap(trackId, rutEmisor);
```

**Lo que funciona bien:**
- Protocolo DTE completo (generación → firma → envío → consulta estado)
- Todos los tipos DTE (33, 34, 39, 41, 43, 46, 52, 56, 61)
- Errores tipados (22 códigos con `DteSiiError`)
- Cache de tokens en memoria (TTL 55min)
- Retry con backoff exponencial configurable
- Multi-tenant por diseño (sin globals)
- Automatización de certificación SII (único en npm)
- Solicitud automática de CAFs (scraping portal SII)

**Red flags para producción enterprise:**
| Problema | Severidad |
|----------|-----------|
| Sin tests (cero) | Crítico |
| Puppeteer como dep directa (300MB+) | Crítico |
| 3 semanas de vida, 26 commits, 1 star | Alto |
| JavaScript puro, `.d.ts` incompleto | Medio |
| 3 deps muertas: xml-crypto, xml-c14n, soap (importadas pero no usadas) | Medio |
| EnviadorSII monolítico (~1300 líneas) | Medio |
| FolioRegistry persiste en archivo JSON | Medio |
| Console.log de debug sueltos | Bajo |
| Sin validación XSD antes de enviar | Bajo |

### Estrategia: FORK + WRAP (Puppeteer incluido)

Puppeteer ya será dependencia del proyecto (se usará también para scraping bancario), por lo que el concern de los 300MB desaparece. Esto habilita usar el módulo `cert/` de la librería para automatizar la certificación.

1. **Fork** del repo → limpiar deps muertas (xml-crypto, xml-c14n, soap no se usan), mantener puppeteer y `cert/`
2. **Wrappear** clases core en módulo NestJS (`@zeru/dte`)
3. **Reemplazar** FolioRegistry (JSON) por tabla Prisma (multi-instancia)
4. **Agregar tests** propios contra ambiente de certificación (maullin)
5. **Completar tipado** TypeScript
6. **Automatizar certificación** usando `cert/CertRunner.js` como base

Construir desde cero tomaría 4-6 semanas solo en firma XMLDSig + comunicación SII. Esta librería ya tiene eso resuelto y funcionando.

### Uso de Puppeteer en el contexto DTE/SII

| Funcionalidad | ¿Necesita Puppeteer? | Razón |
|---------------|---------------------|-------|
| Solicitar folios CAF | NO | Formularios CGI clásicos, HTTP + mTLS basta |
| Emitir/firmar DTEs | NO | SOAP/REST directo |
| Consultar estado SII | NO | SOAP/REST directo |
| Autenticación SII | NO | mTLS directo a herculesr.sii.cl |
| **Certificación: subir intercambio** | **SÍ** | Portal GWT en www4.sii.cl/pfeInternet |
| **Certificación: muestras impresas** | **SÍ** | Portal ExtJS en www4.sii.cl/pdfdteInternet |
| **Certificación: boletas** | **SÍ** | Portal GWT en www4.sii.cl/certBolElectDteInternet |
| **Generar PDFs de muestras** | **SÍ** | HTML → PDF rendering |

### Proyectos de referencia
- **LibreDTE** (PHP) — El más maduro y documentado, 113+ estrellas
- **lib-cl-sii-python** — Buen modelado de datos y tipos
- **HTTP-DTE** — API HTTP que encapsula LibreDTE en Docker
- **FacTronica** (C#) — 53 repos con ejemplos completos

### Alternativas comerciales (API REST de terceros)
- SimpleAPI (simpleapi.cl)
- BaseAPI (baseapi.cl)
- API Gateway (apigateway.cl)
- OpenFactura (openfactura.cl)
- Bsale (bsale.cl)

---

## 14. Arquitectura Propuesta para Zeru

### 14.1 Módulos NestJS

```
apps/api/src/modules/dte/
├── dte.module.ts                    # Orquestador principal
├── constants/
│   ├── dte-types.constants.ts       # Códigos SII (33, 34, 39, etc.)
│   ├── sii-endpoints.constants.ts   # URLs WSDL Maullin/Palena
│   └── queue.constants.ts           # Nombres de colas BullMQ
├── controllers/
│   ├── dte.controller.ts            # CRUD DTEs, emisión, anulación
│   ├── dte-config.controller.ts     # Configuración emisor por tenant
│   ├── folio.controller.ts          # Gestión CAFs
│   ├── certificate.controller.ts    # Upload/gestión certificados
│   ├── exchange.controller.ts       # Intercambio entre contribuyentes
│   └── dte-reports.controller.ts    # Libros de compra/venta
├── services/
│   ├── dte-builder.service.ts       # Construcción XML del DTE
│   ├── dte-emission.service.ts      # Orquestación: build → sign → send
│   ├── dte-config.service.ts        # Config emisor (razón social, giro)
│   ├── dte-validation.service.ts    # Validación reglas de negocio
│   ├── dte-pdf.service.ts           # Generación PDF (representación impresa)
│   └── dte-reports.service.ts       # Libros electrónicos
├── sii/
│   ├── sii-auth.service.ts          # Semilla → Token
│   ├── sii-sender.service.ts        # Envío EnvioDTE al SII
│   ├── sii-status.service.ts        # Consulta estado DTE/envío
│   ├── sii-token-cache.service.ts   # Cache tokens en Redis (TTL 50min)
│   └── sii-circuit-breaker.service.ts
├── certificate/
│   ├── certificate.service.ts       # CRUD certificados
│   └── certificate-parser.service.ts # Parseo .p12
├── folio/
│   ├── folio.service.ts             # Gestión rangos CAF
│   └── folio-allocation.service.ts  # Asignación atómica (FOR UPDATE SKIP LOCKED)
├── signature/
│   ├── xml-signature.service.ts     # Firma XMLDSig con xml-crypto
│   ├── ted-signature.service.ts     # Timbre Electrónico (TED)
│   └── envelope-signature.service.ts
├── exchange/
│   ├── exchange.service.ts          # Envío/recepción entre contribuyentes
│   ├── exchange-validation.service.ts
│   └── exchange-response.service.ts
├── processors/
│   ├── dte-emission.processor.ts    # Worker BullMQ: emisión asíncrona
│   ├── sii-status-check.processor.ts # Worker BullMQ: polling estado
│   └── exchange-send.processor.ts
├── dto/
│   ├── create-dte.dto.ts
│   ├── dte-config.dto.ts
│   ├── upload-certificate.dto.ts
│   └── upload-caf.dto.ts
└── interfaces/
    ├── dte-document.interface.ts
    ├── sii-response.interface.ts
    └── caf.interface.ts
```

### 14.2 Modelos Prisma

**Enums:**
- `DteType` — 33, 34, 39, 41, 43, 46, 52, 56, 61, 110, 111, 112
- `DteStatus` — DRAFT, SIGNED, SENT, ACCEPTED, ACCEPTED_WITH_OBJECTION, REJECTED, VOIDED, ERROR
- `DteEnvironment` — CERTIFICATION, PRODUCTION
- `DteLogAction` — CREATED, SIGNED, SENT_TO_SII, ACCEPTED, REJECTED, VOIDED, etc.
- `ExchangeStatus` — PENDING_SEND, SENT, RECEIPT_CONFIRMED, ACCEPTED, REJECTED, CLAIMED
- `CertificateStatus` — ACTIVE, EXPIRED, REVOKED

**Modelos:**
| Modelo | Descripción |
|--------|-------------|
| `DteConfig` | Configuración emisor por tenant (RUT, razón social, giro, resolución, ambiente) |
| `DteCertificate` | Certificados digitales (.p12 encriptado, fingerprint, expiración) |
| `DteFolio` | Rangos CAF por tipo DTE (rangeFrom/To, nextFolio, encryptedCafXml) |
| `Dte` | Documento tributario (tipo, folio, receptor, montos, XML, trackId, status) |
| `DteItem` | Líneas de detalle del DTE |
| `DteDetailReference` | Referencias a otros documentos (para NC/ND) |
| `DteLog` | Log inmutable de eventos del ciclo de vida |
| `DteExchange` | Intercambio entre contribuyentes |
| `DteExchangeEvent` | Eventos del intercambio (RECEIPT, ACCEPTANCE, REJECTION) |

**Constraint clave:** `@@unique([tenantId, dteType, folio])` — unicidad de folio por tenant y tipo

### 14.3 Colas BullMQ

| Cola | Reintentos | Backoff | Concurrencia | Uso |
|------|-----------|---------|-------------|-----|
| `dte-emission` | 5 | Exponencial 3s | 5 | Emisión individual |
| `dte-status-check` | 10 | Exponencial 10s | 3 | Polling estado SII |
| `dte-exchange` | 5 | Exponencial 5s | 3 | Envío intercambio |
| `dte-bulk-boleta` | 3 | Exponencial 5s | 10 | Emisión masiva boletas |

### 14.4 Patrones de arquitectura
- **Circuit breaker** (`cockatiel`): 5 fallos consecutivos → abrir circuito, retry cada 30s
- **Event-driven**: Eventos `dte.accepted`, `dte.rejected`, `dte.folio.low_stock`, etc.
- **Integración contable**: `AccountingModule` escucha `dte.accepted` para crear asientos automáticos
- **Multi-tenancy**: Cada tenant con su propia config SII, certificados y folios
- **Cache tokens**: Redis con TTL 50min (token SII dura ~60min)
- **Asignación atómica de folios**: `FOR UPDATE SKIP LOCKED` para concurrencia

### 14.5 Seguridad
- Archivos .p12 encriptados con `EncryptionService` existente (AES-256-CBC)
- Clave privada se extrae solo en memoria al firmar, se descarta inmediatamente
- Cada acceso a certificado se registra en `AuditLog`
- Permisos granulares: `dte:emit`, `dte:void`, `dte:certificate:upload`, etc.

### 14.6 Integración con módulos existentes
- **AccountingModule** → Asientos contables automáticos al aceptar DTE
- **BillingModule** → Asociar DTE a conceptos facturados
- **LegalEntitiesModule** → Receptor = LegalEntity (cliente/proveedor)
- **AuditModule** → Log de cada acción
- **NotificationModule** → Alertas folios, certificados, rechazos
- **EncryptionModule** → Encriptar certificados y CAFs
- **RedisModule** → Cache tokens SII, colas BullMQ

---

## 15. Plan de Implementación

### Fase 0 — Setup y fork de @devlas/dte-sii
1. Fork del repo `devlas-cl/dte-sii` → `zeru/dte-sii`
2. Limpiar dependencias muertas (xml-crypto, xml-c14n, soap no se usan internamente)
3. Instalar fork como dependencia en `apps/api`
4. Crear `apps/api/src/modules/dte/dte.module.ts` como wrapper NestJS
5. Configurar Puppeteer como dependencia compartida (DTE + bank scraping)

### Fase 1 — Infraestructura base
6. Modelos Prisma + migración (DteConfig, DteCertificate, DteFolio, Dte, DteItem, DteDetailReference, DteLog, DteExchange, DteExchangeEvent)
7. CertificateModule (upload .p12, parseo con node-forge, encriptación con EncryptionService)
8. DteConfigService (CRUD configuración emisor por tenant: RUT, razón social, giro, resolución)
9. Reemplazar FolioRegistry (JSON) por FolioService con Prisma (asignación atómica con FOR UPDATE SKIP LOCKED)

### Fase 2 — Emisión core
10. Wrapper de `DTE` class (generación XML, timbraje TED, firma XMLDSig)
11. Wrapper de `EnvioDTE` / `EnvioBOLETA` (sobres de envío)
12. Wrapper de `EnviadorSII` (autenticación semilla/token, envío SOAP/REST, consulta estado)
13. SiiTokenCacheService (cache tokens en Redis, TTL 50min)
14. DteEmissionProcessor (cola BullMQ: build → sign → send → track)
15. Soporte inicial: Factura (33), Nota de Crédito (61), Nota de Débito (56)

### Fase 3 — Gestión de folios
16. Upload manual de CAF (parseo, validación, encriptación, almacenamiento)
17. Solicitud automática de CAFs al SII (wrapper de CafSolicitor — HTTP + mTLS, sin Puppeteer)
18. Alertas automáticas: folios por agotarse, CAFs por vencer (6 meses)
19. Soporte para todos los tipos DTE (33, 34, 39, 41, 46, 52, 56, 61)

### Fase 4 — Ciclo completo de vida
20. SiiStatusService (polling estado con backoff, interpretar todos los códigos)
21. Circuit breaker (cockatiel) para llamadas al SII
22. DteLog completo (log inmutable de cada transición de estado)
23. Generación PDF representación impresa (bwip-js para PDF417 + pdfmake o Puppeteer)
24. Emisión masiva de boletas (cola dte-bulk-boleta, pre-asignación de folios en bloque)

### Fase 5 — Intercambio y reportes
25. ExchangeModule: envío de DTEs al receptor (email de intercambio)
26. Recepción y validación de DTEs de proveedores
27. Generación de respuestas: RecepcionDTE, ResultadoDTE, EnvioRecibos (Ley 19.983)
28. ConsumoFolio / RCOF diario (wrapper de ConsumoFolio class)
29. Libros electrónicos: LibroCompraVenta, LibroGuia (wrappers de LibroBase)
30. Integración contable automática (evento dte.accepted → asiento en AccountingModule)

### Fase 6 — Certificación automatizada ante el SII
31. Adaptar `cert/CertRunner.js` como servicio NestJS (CertificationService)
32. **Etapa 1 — Set de prueba**: Generar DTEs con datos del SII, enviar sin rechazos (SetBasico, SetExenta, SetCompra, SetGuia)
33. **Etapa 2 — Simulación**: Emitir documentos con datos reales del contribuyente
34. **Etapa 3 — Intercambio**: Recibir DTEs del SII, enviar acuses de recibo (usa Puppeteer para portal GWT www4.sii.cl/pfeInternet)
35. **Etapa 4 — Muestras impresas**: Generar PDFs con PDF417, subir al portal (usa Puppeteer para portal ExtJS www4.sii.cl/pdfdteInternet)
36. **Etapa 5 — Declaración de cumplimiento**: Formulario en portal SII
37. **Etapa 6 — Registro como emisor**: Publicación de resolución
38. Certificación de boleta electrónica (usa Puppeteer para portal GWT www4.sii.cl/certBolElectDteInternet)
39. Dashboard de progreso de certificación en el frontend (Next.js)

### Fase 7 — UI Frontend (Next.js)
40. Configuración emisor (formulario DteConfig)
41. Gestión de certificados digitales (upload .p12, estado, expiración)
42. Gestión de folios/CAF (upload, solicitar al SII, estado, alertas)
43. Emisión de DTEs (formulario factura/boleta/NC/ND/guía)
44. Bandeja de DTEs emitidos/recibidos (tabla con filtros, estado SII)
45. Detalle de DTE (XML, PDF, historial de estados, intercambio)
46. Reportes: libro de ventas, libro de compras, RCOF
47. Panel de certificación SII (progreso 6 etapas, acciones por etapa)

---

## 16. Documentación Oficial del SII — Enlaces

### Manuales PDF
| Documento | URL |
|-----------|-----|
| Modelo de Operación | https://www.sii.cl/factura_electronica/factura_mercado/modelo_operacion.pdf |
| Manual Certificación | https://www.sii.cl/factura_electronica/factura_mercado/manual_certificacion.pdf |
| Instrucciones Set de Prueba | https://www.sii.cl/servicios_online/docs/inst_set_pruebas.pdf |
| Instructivo Emisión DTE | https://www.sii.cl/factura_electronica/factura_mercado/instructivo_emision.pdf |
| Manual Muestras Impresas | https://www.sii.cl/factura_electronica/factura_mercado/manual_muestras_impresas.pdf |
| Autenticación Automática | https://www.sii.cl/factura_electronica/factura_mercado/autenticacion.pdf |
| Envío Automático DTE | https://www.sii.cl/factura_electronica/factura_mercado/envio.pdf |
| Estado Envío | https://www.sii.cl/factura_electronica/factura_mercado/estado_envio.pdf |
| Estado DTE | https://www.sii.cl/factura_electronica/factura_mercado/estado_dte.pdf |
| Estado DTE Avanzado | https://www.sii.cl/factura_electronica/factura_mercado/OIFE2006_QueryEstDteAv_MDE.pdf |
| Registro Reclamo DTE | https://www.sii.cl/factura_electronica/Webservice_Registro_Reclamo_DTE_V1.1.pdf |
| Formato DTE v2.4.2 | https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_201911.pdf |
| Formato DTE 2026 | https://www.sii.cl/factura_electronica/factura_mercado/formato_dte_202602.pdf |
| Formato Boletas v4.00 | https://www.sii.cl/factura_electronica/factura_mercado/formato_boletas_elec_202306.pdf |
| Formato Intercambio | https://www.sii.cl/factura_electronica/factura_mercado/formato_ic.pdf |
| Formato IECV | https://www.sii.cl/factura_electronica/factura_mercado/formato_iecv.pdf |
| Consumo de Folios | https://www.sii.cl/factura_electronica/consumo_folios.pdf |

### Esquemas XSD descargables
| Esquema | URL |
|---------|-----|
| DTE (principal) | https://www.sii.cl/factura_electronica/factura_mercado/schema_dte.zip |
| Intercambio contribuyentes | https://www.sii.cl/factura_electronica/factura_mercado/schema_ic.zip |
| Recibo Ley 19.983 | https://www.sii.cl/factura_electronica/factura_mercado/schema19983.zip |
| IECV | https://www.sii.cl/factura_electronica/factura_mercado/schema_iecv.zip |
| Boletas | https://www.sii.cl/factura_electronica/factura_mercado/schema_envio_bol.zip |
| Libro Boletas | https://www.sii.cl/factura_electronica/factura_mercado/schema_libro_bol.zip |
| Consumo Folios | https://www.sii.cl/factura_electronica/factura_mercado/ConsumoFolio_v10.xsd |
| Respuesta SII | https://www.sii.cl/factura_electronica/factura_mercado/schema_resp.zip |
| Libro Guías Despacho | https://www.sii.cl/factura_electronica/factura_mercado/schema_lgd.zip |
| Libros CV (No DTE) | https://zeus.sii.cl/IVA2000/Static/LibroCVS_v10.zip |

### Portales
| Portal | URL |
|--------|-----|
| Instructivo Técnico | https://www.sii.cl/factura_electronica/factura_mercado/instructivo.htm |
| Proceso Certificación | https://www.sii.cl/factura_electronica/factura_mercado/proceso_certificacion.htm |
| Postulación | https://www.sii.cl/factura_electronica/factura_mercado/proc_postulacion.htm |
| Ambiente Certificación | https://maullin.sii.cl/cvc/dte/certificacion.html |
| Menú DTE Certificación | https://maullin.sii.cl/dte/menu.html |
| Menú DTE Producción | https://palena.sii.cl/dte/menu.html |
| API REST Boletas | https://www4c.sii.cl/bolcoreinternetui/api/ |
| Certificado Digital | https://www.sii.cl/factura_electronica/certificado_digital.htm |

---

## 17. Solicitud de Folios/CAF — NO hay API oficial

### El SII NO tiene web service ni API REST para solicitar folios

La solicitud de CAF se hace **exclusivamente por el portal web** (CGI scripts) usando **mutual TLS (mTLS)** — el certificado digital se presenta a nivel de conexión TLS, no con el mecanismo semilla/token de los WSDL.

### Endpoints CGI del portal web (descubiertos por scraping)

| Función | Certificación | Producción |
|---------|---------------|------------|
| Solicitar folios | `https://maullin.sii.cl/cvc_cgi/dte/of_solicita_folios` | `https://palena.sii.cl/cvc_cgi/dte/of_solicita_folios` |
| Generar folio | `https://maullin.sii.cl/cvc_cgi/dte/of_genera_folio` | `https://palena.sii.cl/cvc_cgi/dte/of_genera_folio` |
| Re-obtener folios | `https://maullin.sii.cl/cvc_cgi/dte/rf_reobtencion2_folios` | `https://palena.sii.cl/cvc_cgi/dte/rf_reobtencion2_folios` |
| Menú timbraje | `https://maullin.sii.cl/dte/mn_timbraje.html` | `https://palena.sii.cl/dte/mn_timbraje.html` |

### Flujo de scraping (usado por todas las soluciones del mercado)

```
1. Configurar HTTP client con certificado PFX (mTLS, NO semilla/token)
2. GET of_solicita_folios → HTML con formulario
3. POST of_genera_folio con: RUT empresa, tipo DTE, cantidad folios
   Content-Type: application/x-www-form-urlencoded
   Headers: User-Agent (browser-like), Referer
4. Parsear respuesta HTML → extraer link/contenido XML CAF
5. Almacenar CAF encriptado en BD
```

**Nota técnica:** Los certificados del SII usan claves RSA de 1024-bit, lo que requiere `@SECLEVEL=1` en OpenSSL / `minVersion: 'TLSv1.2'` en Node.js.

### Estructura del archivo CAF (XML entregado por el SII)

```xml
<?xml version="1.0"?>
<AUTORIZACION>
  <CAF version="1.0">
    <DA>
      <RE>76123456-7</RE>          <!-- RUT Emisor -->
      <RS>EMPRESA SPA</RS>         <!-- Razón Social -->
      <TD>33</TD>                  <!-- Tipo DTE -->
      <RNG>
        <D>3127</D>                <!-- Folio Desde -->
        <H>3171</H>                <!-- Folio Hasta -->
      </RNG>
      <FA>2026-04-12</FA>          <!-- Fecha Autorización -->
      <RSAPK>                      <!-- Clave Pública RSA (SII) -->
        <M>base64...</M>
        <E>Aw==</E>
      </RSAPK>
      <IDK>300</IDK>               <!-- ID Clave SII -->
    </DA>
    <FRMA algoritmo="SHA1withRSA">base64...</FRMA>  <!-- Firma del SII -->
  </CAF>
  <RSASK>-----BEGIN RSA PRIVATE KEY-----
  ...clave privada generada por SII (para firmar TED)...
  -----END RSA PRIVATE KEY-----</RSASK>
  <RSAPUBK>-----BEGIN PUBLIC KEY-----
  ...clave pública...
  -----END PUBLIC KEY-----</RSAPUBK>
</AUTORIZACION>
```

**Importante:** El SII genera un par de claves RSA **por cada solicitud de folios** (no se reutilizan). La clave privada `RSASK` se usa para firmar el TED (timbre electrónico) de cada DTE.

### Estrategia para Zeru (3 fases)

**Fase 1 (inmediata):** Upload manual de CAF
- El usuario descarga CAF del portal SII y lo sube a Zeru
- Endpoint: `POST /api/dte/folios/upload` (acepta XML)
- Se parsea, valida, encripta y almacena en `DteFolio`
- Alertas automáticas cuando folios se agotan o están por vencer (6 meses)

**Fase 2 (posterior):** Auto-scraping con mTLS
- Implementar servicio que haga scraping del portal SII
- Usar `undici` o `node:https` con opciones `pfx`/`cert`+`key` para mTLS
- Parsear HTML con `cheerio` o `linkedom`
- Solicitar automáticamente nuevos folios cuando se alcance umbral de alerta

**Fase 3 (alternativa):** API de tercero
- Si el scraping propio resulta frágil, integrar con API Gateway (apigateway.cl, ~3 UF/mes)
- 6 endpoints REST para CAF: solicitar, descargar XML, consultar estado, anular, listar, filtrar

### Proyectos de referencia para scraping

| Proyecto | Lenguaje | URL |
|----------|----------|-----|
| Sii.DescargaFolio | .NET 8 | https://github.com/sergioocode/Sii.DescargaFolio |
| folios-SII | Python/Django | https://github.com/PabloMunozP/folios-SII |
| Gist scraping SII | Ruby | https://gist.github.com/nelyj/cf457b120f42e708caca426bcdae65cf |
| SimpleFolios | C# (comercial) | https://www.simpleapi.cl/Productos/SimpleFolios |
| API Gateway CAF | REST (comercial) | https://www.apigateway.cl/academy/integracion-para-la-emision-de-dte/emision-de-documentos/caf-api-module |
