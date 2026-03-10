# LinkedIn Mentions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable @mentions of people and organizations in LinkedIn posts, supporting both direct URN format and profile URL resolution.

**Architecture:** Add a `processCommentaryMentions()` pipeline in the posts service that transforms mention syntax before publishing. Add a `search_linkedin_person` agent tool that accepts a LinkedIn profile URL and returns the person URN. Update the agent system prompt with mention instructions.

**Tech Stack:** NestJS, LinkedIn REST API (v202504), OpenAI function tools

---

### Task 1: Add `resolvePersonByVanityUrl()` to LinkedIn API Service

**Files:**
- Modify: `apps/api/src/modules/linkedin/services/linkedin-api.service.ts:14-58`

**Step 1: Add the method after the existing `request()` method (line 58)**

```typescript
async resolvePersonByVanityUrl(
  tenantId: string,
  vanityName: string,
): Promise<{ personUrn: string; firstName: string; lastName: string } | null> {
  try {
    const headers = await this.getHeaders(tenantId);
    const encodedVanity = encodeURIComponent(`https://www.linkedin.com/in/${vanityName}`);
    const response = await fetch(
      `${LINKEDIN_API_BASE}/rest/people/(vanityName:${vanityName})`,
      { method: 'GET', headers },
    );

    if (!response.ok) {
      this.logger.warn(`Could not resolve vanity URL "${vanityName}": ${response.status}`);
      return null;
    }

    const data = await response.json() as { id?: string; firstName?: string; lastName?: string };
    if (!data.id) return null;

    return {
      personUrn: `urn:li:person:${data.id}`,
      firstName: data.firstName ?? '',
      lastName: data.lastName ?? '',
    };
  } catch (error) {
    this.logger.warn(`Failed to resolve vanity URL "${vanityName}":`, error);
    return null;
  }
}
```

**Step 2: Run build to verify no compilation errors**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/api/src/modules/linkedin/services/linkedin-api.service.ts
git commit -m "feat(linkedin): add resolvePersonByVanityUrl to API service"
```

---

### Task 2: Add `processCommentaryMentions()` to Posts Service

**Files:**
- Modify: `apps/api/src/modules/linkedin/services/linkedin-posts.service.ts:180-198`

**Step 1: Add the processing method before the `publish()` method**

Add this method to `LinkedInPostsService`:

```typescript
private async processCommentaryMentions(tenantId: string, commentary: string): Promise<string> {
  // Pattern: @[linkedin.com/in/vanity-name] -> resolve to @[Name](urn:li:person:xxx)
  const urlMentionPattern = /@\[(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)\]/g;

  let processed = commentary;
  const matches = [...commentary.matchAll(urlMentionPattern)];

  for (const match of matches) {
    const fullMatch = match[0];
    const vanityName = decodeURIComponent(match[1]);

    const person = await this.apiService.resolvePersonByVanityUrl(tenantId, vanityName);
    if (person) {
      const displayName = `${person.firstName} ${person.lastName}`.trim();
      processed = processed.replace(fullMatch, `@[${displayName}](${person.personUrn})`);
    } else {
      // Could not resolve - strip the mention syntax, leave as plain text
      processed = processed.replace(fullMatch, vanityName);
    }
  }

  return processed;
}
```

**Step 2: Integrate into `publish()` method**

In the `publish()` method (line 187), after getting the post and before the API calls, add mention processing. Change line 188 from:

```typescript
      let result: { postId: string | null };
```

to:

```typescript
      const processedContent = await this.processCommentaryMentions(tenantId, post.content);
      let result: { postId: string | null };
```

Then replace all `post.content` references in the publish method (lines 193, 195, 197) with `processedContent`.

**Step 3: Run build to verify**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/api/src/modules/linkedin/services/linkedin-posts.service.ts
git commit -m "feat(linkedin): add mention processing pipeline before publish"
```

---

### Task 3: Add `search_linkedin_person` Agent Tool Definition

**Files:**
- Modify: `apps/api/src/modules/linkedin/tools/linkedin-tools.ts:293-295` (before memory_store)

**Step 1: Add tool definition to LINKEDIN_TOOLS array**

Insert before the `memory_store` tool (line 296):

```typescript
{
  type: 'function',
  name: 'search_linkedin_person',
  description:
    'Busca una persona de LinkedIn por URL de perfil para obtener su URN. Usa esto cuando necesites mencionar a alguien en un post. El usuario debe proporcionar la URL del perfil (ej: linkedin.com/in/nombre).',
  parameters: {
    type: 'object',
    properties: {
      profile_url: {
        type: 'string',
        description: 'URL del perfil de LinkedIn (ej: "linkedin.com/in/juan-perez" o "https://www.linkedin.com/in/juan-perez").',
      },
    },
    required: ['profile_url'],
    additionalProperties: false,
  },
  strict: true,
},
```

**Step 2: Add label to LINKEDIN_TOOL_LABELS**

Add to the labels object:

```typescript
search_linkedin_person: 'Buscando persona en LinkedIn',
```

**Step 3: Run build to verify**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add apps/api/src/modules/linkedin/tools/linkedin-tools.ts
git commit -m "feat(linkedin): add search_linkedin_person tool definition"
```

---

### Task 4: Add Tool Handler in Executor

**Files:**
- Modify: `apps/api/src/modules/linkedin/tools/linkedin-tool-executor.ts:36-81`

**Step 1: Add case in the switch statement**

Add after the `get_skill_reference` case (before `default:` at line 79):

```typescript
case 'search_linkedin_person':
  return await this.searchLinkedInPerson(args, tenantId);
```

**Step 2: Inject LinkedInApiService**

Add `LinkedInApiService` to the constructor imports (line 6) and constructor (line 19):

```typescript
import { LinkedInApiService } from '../services/linkedin-api.service';
```

Add to constructor:

```typescript
private readonly apiService: LinkedInApiService,
```

**Step 3: Add the handler method**

```typescript
private async searchLinkedInPerson(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
  const profileUrl = String(args.profile_url ?? '');

  // Extract vanity name from URL
  const vanityMatch = profileUrl.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)/);
  if (!vanityMatch) {
    return {
      success: false,
      data: null,
      summary: 'URL de perfil inválida. Usa el formato: linkedin.com/in/nombre-persona',
    };
  }

  const vanityName = decodeURIComponent(vanityMatch[1]);
  const person = await this.apiService.resolvePersonByVanityUrl(tenantId, vanityName);

  if (!person) {
    return {
      success: true,
      data: { resolved: false, vanityName },
      summary: `No se pudo resolver el perfil "${vanityName}". El usuario puede proporcionar el URN directamente o usar el formato @[Nombre](urn:li:person:xxx) en el post.`,
    };
  }

  const displayName = `${person.firstName} ${person.lastName}`.trim();
  return {
    success: true,
    data: {
      resolved: true,
      personUrn: person.personUrn,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName,
      mentionSyntax: `@[${displayName}](${person.personUrn})`,
    },
    summary: `Persona encontrada: ${displayName} (${person.personUrn}). Usa @[${displayName}](${person.personUrn}) en el post para mencionarla.`,
  };
}
```

**Step 4: Run build to verify**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 5: Commit**

```bash
git add apps/api/src/modules/linkedin/tools/linkedin-tool-executor.ts
git commit -m "feat(linkedin): add search_linkedin_person handler in tool executor"
```

---

### Task 5: Update Agent System Prompt with Mention Instructions

**Files:**
- Modify: `apps/api/src/modules/linkedin/services/linkedin-agent.service.ts:13-94`

**Step 1: Add mention section to LINKEDIN_SYSTEM_PROMPT**

Insert before the `## Cuándo usar ask_user_question` section (before line 70):

```
## Menciones (@mentions)

Puedes mencionar personas y organizaciones en los posts de LinkedIn. Las menciones aparecen como enlaces clicables al perfil de la persona/organización.

### Sintaxis
- Personas: \`@[Nombre](urn:li:person:xxx)\`
- Organizaciones: \`@[Nombre Org](urn:li:organization:xxx)\`

### Flujo para mencionar a alguien
1. Cuando el usuario quiera mencionar a alguien, pide la URL de su perfil de LinkedIn
2. Usa la herramienta \`search_linkedin_person\` con la URL para obtener el URN
3. Si se resuelve correctamente, inserta la mención en el post con el formato \`@[Nombre](urn:li:person:xxx)\`
4. Si no se resuelve, pide al usuario el URN directamente o sugiere usar el formato manual

### Cuándo usar menciones
- Cuando el usuario lo pida explícitamente
- Cuando se hable de una persona específica y el usuario quiera etiquetarla
- No agregues menciones por tu cuenta sin que el usuario lo solicite

### Formato URL de perfil
También puedes usar \`@[linkedin.com/in/nombre]\` en el contenido del post. El sistema lo resolverá automáticamente al publicar.
```

**Step 2: Run build to verify**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add apps/api/src/modules/linkedin/services/linkedin-agent.service.ts
git commit -m "feat(linkedin): update agent system prompt with mention instructions"
```

---

### Task 6: Final Verification

**Step 1: Full build check**

Run: `cd apps/api && npx tsc --noEmit --pretty`
Expected: No errors

**Step 2: Verify all changes are committed**

Run: `git status`
Expected: Clean working tree

**Step 3: Squash or verify commits**

Run: `git log main..HEAD --oneline`
Expected: Original commit + 5 new commits for mentions feature
