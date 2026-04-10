# Vincular Personas con Usuarios + User Type

**Fecha:** 2026-04-01
**Estado:** Aprobado

---

## 1. Problema

`User` (cuenta de login) y `PersonProfile` (persona en el directorio organizacional) son entidades desconectadas. No se puede saber qué usuario del sistema corresponde a qué persona del organigrama, ni crear cuentas de usuario fácilmente desde el directorio.

Además, no todos los usuarios son personas — algunos son cuentas de servicio (ej: bridge FileMaker, bot de sincronización).

## 2. Decisiones de diseño

1. **User type**: Agregar `UserType` enum (HUMAN, SERVICE) al modelo `User`.
2. **Link PersonProfile→User**: Campo opcional `userId` en `PersonProfile` con constraint `@@unique([userId, tenantId])` — un usuario puede tener una persona por tenant (multi-tenancy).
3. **Crear usuario desde directorio**: Endpoint y botón en la UI del directorio para crear cuenta de usuario a partir de una persona existente.
4. **Service accounts** no se gestionan desde el directorio — se crean por API/settings.

## 3. Modelo de datos

### Nuevo enum

```prisma
enum UserType {
  HUMAN
  SERVICE
}
```

### Cambio en User

```prisma
model User {
  type    UserType @default(HUMAN)
  // nuevo campo, default HUMAN para backwards compatibility
  // ... resto sin cambios

  personProfiles PersonProfile[]  // nueva relación inversa
}
```

### Cambio en PersonProfile

```prisma
model PersonProfile {
  userId  String?
  user    User?    @relation(fields: [userId], references: [id])
  // ... resto sin cambios

  @@unique([userId, tenantId])  // un user puede tener max 1 persona por tenant
}
```

### Relación entre entidades

```
User (identidad global)
 ├── UserTenant (acceso por tenant: permisos, rol)
 └── PersonProfile (identidad organizacional por tenant: cargo, depto, organigrama)
```

- Un User puede tener 0..N PersonProfiles (una por tenant)
- Un PersonProfile puede tener 0..1 User (opcional)
- La constraint `@@unique([userId, tenantId])` evita duplicados por tenant

## 4. Backend

### Nuevo endpoint

```
POST /org-intelligence/persons/:id/create-user
Body: { role?: UserRole }  // rol en el tenant, default VIEWER
```

Lógica:
1. Verificar que la persona existe en el tenant y no tiene userId vinculado
2. Verificar que la persona tiene email (requerido para crear cuenta)
3. Llamar a `UsersService.create(tenantId, { email, firstName: name, role })` — reutiliza el flujo existente que crea User + UserTenant + envía email de bienvenida
4. Actualizar `PersonProfile.userId` con el ID del usuario creado/encontrado
5. Retornar la persona actualizada con datos del usuario vinculado

### Vincular usuario existente

```
PATCH /org-intelligence/persons/:id
Body: { userId: "uuid" }
```

Usar el endpoint PATCH existente, agregar `userId` como campo actualizable en el DTO. Validar que el usuario existe y pertenece al tenant.

### Desvincular

```
PATCH /org-intelligence/persons/:id
Body: { userId: null }
```

Solo desvincula la persona del usuario, no elimina el usuario ni el membership.

### Cambio en response de PersonProfile

Agregar al response:
```json
{
  "user": {
    "id": "...",
    "email": "...",
    "isActive": true
  }
}
```

Campo `user` es null si no tiene usuario vinculado. Incluir en findAll y findOne.

## 5. Frontend (Directorio)

### En la card de persona

- Si tiene usuario vinculado: badge verde "Usuario activo" (o rojo "Inactivo")
- Si no tiene usuario: sin badge

### En el dropdown de acciones

**Si NO tiene usuario vinculado:**
- "Crear cuenta de usuario" → Dialog:
  - Muestra: nombre, email de la persona
  - Campo: rol a asignar (select con UserRole, default VIEWER)
  - Botón: "Crear cuenta y enviar invitación"
  - Si la persona no tiene email: botón deshabilitado con tooltip "Agrega un email primero"

**Si YA tiene usuario vinculado:**
- "Desvincular usuario" → Confirmación → PATCH con userId: null

### En el form de edición de persona

- Campo opcional "Usuario vinculado" (select con usuarios del tenant que no estén vinculados a otra persona, o vacío)

## 6. Migración

1. Crear enum `UserType` y agregar campo `type` a `User` (default HUMAN, no breaking)
2. Agregar campo `userId` a `PersonProfile` (nullable, no breaking)
3. Agregar constraint `@@unique([userId, tenantId])`
4. No se necesita migración de datos — todos los users existentes quedan como HUMAN, todas las personas quedan sin userId

## 7. Fuera de alcance

- UI de gestión de service accounts
- Sync automático de campos entre User y PersonProfile
- Merge de PersonProfile cuando un usuario se une a un tenant que ya tiene su persona registrada
