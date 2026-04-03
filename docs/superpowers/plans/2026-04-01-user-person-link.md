# User-Person Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link PersonProfile to User with optional FK, add UserType enum (HUMAN/SERVICE), and enable creating user accounts directly from the directory UI.

**Architecture:** Add `UserType` enum and `type` field to User model, add nullable `userId` FK to PersonProfile with per-tenant uniqueness. New endpoint `POST /persons/:id/create-user` reuses existing `UsersService.create()`. Frontend adds badge + create-user dialog to directory cards.

**Tech Stack:** Prisma migration, NestJS (Zod DTOs), Next.js (React), existing `UsersService`

---

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma:53-83` (User model)
- Modify: `apps/api/prisma/schema.prisma:889-919` (PersonProfile model)

- [ ] **Step 1: Add UserType enum and update User model**

In `apps/api/prisma/schema.prisma`, add the enum before the User model (around line 52):

```prisma
enum UserType {
  HUMAN
  SERVICE
}
```

Add field to User model (after line 60 `superAdmin`):

```prisma
  type       UserType @default(HUMAN)
```

Add relation to User model (after line 80 `notificationPreferences`):

```prisma
  personProfiles PersonProfile[]
```

- [ ] **Step 2: Add userId to PersonProfile model**

In PersonProfile model (after line 919 `tenant`), add before the closing brace:

```prisma
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
```

Add the unique constraint (after the existing `@@index` lines, before `@@map`):

```prisma
  @@unique([userId, tenantId])
```

- [ ] **Step 3: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_user_type_and_person_user_link
```

- [ ] **Step 4: Generate Prisma Client**

```bash
cd apps/api && npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/ && git commit -m "feat: add UserType enum and PersonProfile-User link migration"
```

---

### Task 2: Shared Types

**Files:**
- Modify: `packages/shared/src/types/user.ts`

- [ ] **Step 1: Add UserType to shared types**

At the top of `packages/shared/src/types/user.ts` (after line 1 `UserRole`), add:

```typescript
export type UserType = 'HUMAN' | 'SERVICE';
```

Add `type` field to the `User` interface (after `lastName` field, around line 8):

```typescript
  type: UserType;
```

- [ ] **Step 2: Build shared package**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/ && git commit -m "feat: add UserType to shared types"
```

---

### Task 3: Backend - Update DTOs

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/dto/index.ts`

- [ ] **Step 1: Add userId to updatePersonProfileSchema**

In `dto/index.ts`, add `userId` to `updatePersonProfileSchema` (around line 143, before the closing `)`):

```typescript
  userId: z.string().uuid().nullable().optional(),
```

- [ ] **Step 2: Add createUserFromPersonSchema**

After the `orgchartQuerySchema` (around line 161), add:

```typescript
export const createUserFromPersonSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'ACCOUNTANT', 'VIEWER']).optional().default('VIEWER'),
});

export type CreateUserFromPersonDto = z.infer<typeof createUserFromPersonSchema>;
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/org-intelligence/dto/ && git commit -m "feat: add userId and create-user DTOs for person profiles"
```

---

### Task 4: Backend - Update Service

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/services/person-profiles.service.ts`

- [ ] **Step 1: Add user include to findAll and findOne queries**

In `findAll` method, add `user` to the Prisma select/include. Find the `include` or `select` block that currently includes `department` and `reportsTo`, and add:

```typescript
user: { select: { id: true, email: true, isActive: true, type: true } },
```

Do the same in `findOne` method.

- [ ] **Step 2: Update the update method to handle userId**

In the `update` method, when building the Prisma `data` object, handle `userId`:
- If `userId` is a string UUID: validate user exists in tenant, then set it
- If `userId` is `null`: disconnect the relation (set to null)

Add this validation before the Prisma update call:

```typescript
if (dto.userId !== undefined) {
  if (dto.userId !== null) {
    // Verify user belongs to tenant
    const membership = await this.prisma.userTenant.findFirst({
      where: { userId: dto.userId, tenantId },
    });
    if (!membership) {
      throw new NotFoundException('User not found in this tenant');
    }
  }
}
```

- [ ] **Step 3: Add createUserFromPerson method**

Add to the service class. Inject `UsersService` in the constructor:

```typescript
import { UsersService } from '../../users/users.service';

// In constructor:
constructor(
  private readonly prisma: PrismaService,
  private readonly usersService: UsersService,
  // ... existing deps
) {}
```

Add the method:

```typescript
async createUserFromPerson(
  tenantId: string,
  personId: string,
  role: 'OWNER' | 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' = 'VIEWER',
) {
  const person = await this.prisma.personProfile.findFirst({
    where: { id: personId, tenantId, deletedAt: null },
  });

  if (!person) {
    throw new NotFoundException('Person not found');
  }

  if (person.userId) {
    throw new ConflictException('Person already has a linked user account');
  }

  if (!person.email) {
    throw new BadRequestException('Person must have an email to create a user account');
  }

  // Split name into firstName/lastName
  const nameParts = person.name.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || firstName;

  // Reuse existing user creation flow (creates User + UserTenant + sends email)
  const user = await this.usersService.create(tenantId, {
    email: person.email,
    firstName,
    lastName,
    role,
  });

  // Link person to user
  const updated = await this.prisma.personProfile.update({
    where: { id: personId },
    data: { userId: user.id },
    include: {
      department: true,
      reportsTo: { select: { id: true, name: true, role: true } },
      user: { select: { id: true, email: true, isActive: true, type: true } },
    },
  });

  return updated;
}
```

Import the needed exceptions at the top:

```typescript
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/org-intelligence/ && git commit -m "feat: add createUserFromPerson service method and user include in queries"
```

---

### Task 5: Backend - Update Module and Controller

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/org-intelligence.module.ts`
- Modify: `apps/api/src/modules/org-intelligence/controllers/person-profiles.controller.ts`

- [ ] **Step 1: Import UsersModule in OrgIntelligenceModule**

Add `UsersModule` to the imports array of `OrgIntelligenceModule`:

```typescript
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // ... existing imports
    UsersModule,
  ],
  // ...
})
```

Make sure `UsersModule` exports `UsersService`. Check `apps/api/src/modules/users/users.module.ts` and add `UsersService` to exports if not already there.

- [ ] **Step 2: Add create-user endpoint to controller**

In `person-profiles.controller.ts`, add the new endpoint (after the `update` method, around line 85):

```typescript
@Post(':id/create-user')
@UseGuards(JwtAuthGuard, TenantGuard)
async createUser(
  @CurrentTenant() tenantId: string,
  @Param('id') id: string,
  @Body(new ZodPipe(createUserFromPersonSchema)) dto: CreateUserFromPersonDto,
) {
  return this.personProfilesService.createUserFromPerson(tenantId, id, dto.role);
}
```

Add imports at the top:

```typescript
import { createUserFromPersonSchema, CreateUserFromPersonDto } from '../dto';
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/ && git commit -m "feat: add POST /persons/:id/create-user endpoint"
```

---

### Task 6: Frontend - Directory UI Updates

**Files:**
- Modify: `apps/web/app/(dashboard)/personas/directorio/page.tsx`

- [ ] **Step 1: Update PersonProfile interface**

Add the `user` field to the `PersonProfile` interface (around line 59):

```typescript
interface PersonProfile {
  // ... existing fields
  user?: {
    id: string;
    email: string;
    isActive: boolean;
    type: string;
  } | null;
}
```

- [ ] **Step 2: Add user badge to person cards**

In the card rendering section, add a badge next to the person's name or below their info. Find where `Badge` is used for "Externo"/"Contratista" and add:

```tsx
{person.user && (
  <Badge variant={person.user.isActive ? "default" : "destructive"} className="text-[10px]">
    {person.user.isActive ? "Usuario activo" : "Usuario inactivo"}
  </Badge>
)}
```

- [ ] **Step 3: Add create-user and unlink actions to dropdown**

In the `DropdownMenu` for each person card, add new menu items:

```tsx
{!person.user && (
  <DropdownMenuItem
    onClick={() => openCreateUserDialog(person)}
    disabled={!person.email}
  >
    {person.email ? "Crear cuenta de usuario" : "Sin email — no se puede crear cuenta"}
  </DropdownMenuItem>
)}
{person.user && (
  <DropdownMenuItem onClick={() => handleUnlinkUser(person)}>
    Desvincular usuario
  </DropdownMenuItem>
)}
```

- [ ] **Step 4: Add create-user dialog state and handler**

Add state variables:

```typescript
const [createUserPerson, setCreateUserPerson] = useState<PersonProfile | null>(null);
const [createUserRole, setCreateUserRole] = useState<string>("VIEWER");
const [creatingUser, setCreatingUser] = useState(false);
```

Add handlers:

```typescript
function openCreateUserDialog(person: PersonProfile) {
  setCreateUserPerson(person);
  setCreateUserRole("VIEWER");
}

async function handleCreateUser() {
  if (!createUserPerson) return;
  setCreatingUser(true);
  try {
    await api.post(
      `/org-intelligence/persons/${createUserPerson.id}/create-user`,
      { role: createUserRole },
      { headers: { [TENANT_HEADER]: tenantId } },
    );
    toast.success(`Cuenta creada para ${createUserPerson.name}`);
    setCreateUserPerson(null);
    fetchPersons();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al crear cuenta";
    toast.error(msg);
  } finally {
    setCreatingUser(false);
  }
}

async function handleUnlinkUser(person: PersonProfile) {
  if (!confirm(`¿Desvincular el usuario de ${person.name}?`)) return;
  try {
    await api.patch(
      `/org-intelligence/persons/${person.id}`,
      { userId: null },
      { headers: { [TENANT_HEADER]: tenantId } },
    );
    toast.success("Usuario desvinculado");
    fetchPersons();
  } catch {
    toast.error("Error al desvincular");
  }
}
```

- [ ] **Step 5: Add create-user dialog JSX**

Add the dialog at the end of the component, before the closing fragment:

```tsx
<Dialog open={!!createUserPerson} onOpenChange={(open) => !open && setCreateUserPerson(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Crear cuenta de usuario</DialogTitle>
      <DialogDescription>
        Se creará una cuenta y se enviará una invitación por email.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Nombre</Label>
        <p className="text-sm font-medium">{createUserPerson?.name}</p>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-xs">Email</Label>
        <p className="text-sm font-medium">{createUserPerson?.email}</p>
      </div>
      <div className="space-y-2">
        <Label>Rol en la organización</Label>
        <Select value={createUserRole} onValueChange={setCreateUserRole}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="OWNER">Propietario</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="ACCOUNTANT">Contador</SelectItem>
            <SelectItem value="VIEWER">Solo lectura</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setCreateUserPerson(null)}>
        Cancelar
      </Button>
      <Button onClick={handleCreateUser} disabled={creatingUser}>
        {creatingUser ? "Creando..." : "Crear cuenta y enviar invitación"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/ && git commit -m "feat: add create-user from directory and user badge in person cards"
```

---

### Task 7: Lint and Verify

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Fix any errors.

- [ ] **Step 2: Verify API builds**

```bash
cd apps/api && npx nest build
```

- [ ] **Step 3: Final commit if needed**

```bash
git add -A && git commit -m "fix: lint and build fixes for user-person link"
```
