import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

// Extensions considered text (safe to load into context)
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.ts',
  '.js',
  '.py',
  '.sh',
  '.sql',
  '.json',
  '.yaml',
  '.yml',
  '.csv',
  '.html',
  '.css',
  '.xml',
  '.toml',
  '.ini',
  '.prisma',
]);

// Top-level directories to include as skill files (besides SKILL.md itself)
const INCLUDE_DIRS = ['references', 'scripts'];

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  branch: string;
  skillPath: string; // path within repo to the skill folder ("" = discover from root)
  skillFilter?: string; // from --skill or @skill, used to filter discovered skills by name
}

interface FetchedSkill {
  name: string;
  description: string;
  version?: string;
  content: string; // SKILL.md body (without frontmatter)
  files: { path: string; content: string }[]; // references/ and scripts/
  /** Canonical GitHub URL including resolved path (for storage and sync) */
  resolvedRepoUrl?: string;
}

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── URL parsing ────────────────────────────────────────────────────────────

  /**
   * Normalises any supported skill input string into a canonical GitHub URL.
   *
   * Supported formats:
   *   1. Full GitHub URL (with or without /tree/…):
   *        https://github.com/owner/repo/tree/main/skill-path
   *   2. npx skills add command:
   *        npx skills add owner/repo@skill
   *        npx skills add https://github.com/owner/repo --skill skillname
   *   3. Short "owner/repo@skill" notation:
   *        owner/repo@skill-path
   *   4. Plain "owner/repo" (installs from repo root):
   *        owner/repo
   */
  normalizeSkillInput(raw: string): string {
    let input = raw.trim();

    // Strip CLI prefix variations
    for (const prefix of ['npx skills add ', 'skills add ']) {
      if (input.startsWith(prefix)) {
        input = input.slice(prefix.length).trim();
        break;
      }
    }

    // Handle "URL --skill skillname" flag form
    // Per npx skills CLI: --skill is a filter, NOT a path. Discovery runs from repo root.
    const skillFlagMatch = input.match(/^(.+?)\s+(?:--skill|-s)\s+(\S+)$/);
    if (skillFlagMatch) {
      const base = skillFlagMatch[1].trim().replace(/\/$/, '');
      const rawSkillName = skillFlagMatch[2].trim();
      const baseUrl = base.startsWith('http')
        ? base
        : `https://github.com/${base}`;
      // If value contains / it's a path; otherwise empty = discover from root (like npx skills)
      const skillPath = rawSkillName.includes('/') ? rawSkillName : '';
      const pathPart = skillPath ? `/${skillPath}` : '';
      return `${baseUrl}/tree/main${pathPart}`;
    }

    // Handle "owner/repo@skill" shorthand. Per npx skills: @value is skillFilter (by name) when
    // no slash; otherwise it's a path. Use root when filter so discovery runs.
    const atMatch = input.match(/^([^@:/]+\/[^@:/]+)@(.+)$/);
    if (atMatch) {
      const afterAt = atMatch[2];
      const pathPart = afterAt.includes('/') ? `/${afterAt}` : '';
      return `https://github.com/${atMatch[1]}/tree/main${pathPart}`;
    }

    // Ensure full URL for bare "owner/repo" or "owner/repo/tree/…"
    if (!input.startsWith('http') && /^[^/]+\/[^/]/.test(input)) {
      return `https://github.com/${input}`;
    }

    return input;
  }

  /** Extracts --skill or @skill value from raw input (for discovery filtering) */
  extractSkillFilter(raw: string): string | undefined {
    const input = raw.trim();

    // Strip CLI prefix if present, then fall through to flag matching
    let rest = input;
    for (const prefix of ['npx skills add ', 'skills add ']) {
      if (input.startsWith(prefix)) {
        rest = input.slice(prefix.length).trim();
        break;
      }
    }

    // --skill or -s flag anywhere in the string
    const flagMatch = rest.match(/(?:--skill|-s)\s+(\S+)/);
    if (flagMatch) return flagMatch[1].trim();

    // owner/repo@skill or https://github.com/owner/repo@skill
    const atMatch = rest.match(/[^@:]+\/[^@:]+\@([^/\s]+)/);
    if (atMatch) return atMatch[1].trim();

    return undefined;
  }

  parseGitHubUrl(rawUrl: string): ParsedGitHubUrl {
    const skillFilter = this.extractSkillFilter(rawUrl);
    const normalized = this.normalizeSkillInput(rawUrl);

    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      throw new BadRequestException(`URL inválida: ${rawUrl}`);
    }

    if (url.hostname !== 'github.com') {
      throw new BadRequestException('Solo se soportan URLs de github.com');
    }

    // pathname: /owner/repo  or  /owner/repo/tree/branch/path/to/skill
    const parts = url.pathname.replace(/^\//, '').split('/');
    if (parts.length < 2) {
      throw new BadRequestException(
        'La URL debe tener al menos owner y repositorio: github.com/owner/repo',
      );
    }

    const [owner, repo, keyword, branch, ...rest] = parts;

    if (keyword && keyword !== 'tree') {
      throw new BadRequestException(
        'Formato de URL no soportado. Usa https://github.com/owner/repo o https://github.com/owner/repo/tree/branch/path',
      );
    }

    return {
      owner,
      repo,
      branch: branch ?? 'main',
      skillPath: rest.filter(Boolean).join('/'),
      skillFilter,
    };
  }

  // ─── GitHub fetching ────────────────────────────────────────────────────────

  private rawUrl(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): string {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { Accept: 'text/plain' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} al obtener ${url}`);
    }
    return res.text();
  }

  /** Parsea el frontmatter YAML de un SKILL.md y devuelve el body sin frontmatter */
  private parseFrontmatter(raw: string): {
    name?: string;
    description?: string;
    version?: string;
    body: string;
  } {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      // No frontmatter — treat entire content as body
      return { body: raw.trim() };
    }
    const yaml = match[1];
    const body = match[2].trim();

    const extract = (key: string): string | undefined => {
      const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
    };

    return {
      name: extract('name'),
      description: extract('description'),
      version: extract('version') ?? extract('metadata.version'),
      body,
    };
  }

  private isTextFile(filePath: string): boolean {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return TEXT_EXTENSIONS.has(ext);
  }

  /**
   * Discovery order matches npx skills CLI: root first, then skills/, skills/.curated/, etc.
   */
  private skillPathPriority(path: string): number {
    if (path === 'SKILL.md') return 0;
    if (path.endsWith('/SKILL.md')) {
      const dir = path.slice(0, -8);
      if (dir === '') return 1;
      if (dir === 'skills') return 10;
      if (dir.startsWith('skills/')) {
        const sub = dir.slice(7);
        if (sub === '.curated') return 20;
        if (sub === '.experimental') return 21;
        if (sub === '.system') return 22;
        return 15;
      }
      return 50;
    }
    return 100;
  }

  async fetchSkillFromGitHub(parsed: ParsedGitHubUrl): Promise<FetchedSkill> {
    const { owner, repo, branch, skillPath, skillFilter } = parsed;

    // 1. Fetch the tree
    const treeRef = branch;
    const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeRef}?recursive=1`;
    const treeRes = await fetch(treeUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Zeru-App/1.0',
      },
    });

    if (!treeRes.ok) {
      if (treeRes.status === 404) {
        throw new BadRequestException(
          `Repositorio no encontrado: github.com/${owner}/${repo} (branch: ${branch})`,
        );
      }
      throw new BadRequestException(
        `Error al consultar la API de GitHub: HTTP ${treeRes.status}`,
      );
    }

    const treeData = (await treeRes.json()) as {
      tree: GitHubTreeItem[];
      truncated?: boolean;
    };

    let prefix: string;

    if (skillPath) {
      // Explicit path: use direct lookup
      prefix = `${skillPath}/`;
      const skillMdPath = `${prefix}SKILL.md`;
      const exists = treeData.tree.some(
        (item) => item.type === 'blob' && item.path === skillMdPath,
      );
      if (!exists) {
        throw new BadRequestException(
          `No se encontró SKILL.md en ${skillMdPath}. Verifica la URL del skill.`,
        );
      }
    } else {
      // Discovery mode (like npx skills add): find all SKILL.md, filter by name
      const allSkillPaths = treeData.tree
        .filter(
          (item) =>
            item.type === 'blob' &&
            (item.path === 'SKILL.md' || item.path.endsWith('/SKILL.md')),
        )
        .map((item) => item.path)
        .sort((a, b) => this.skillPathPriority(a) - this.skillPathPriority(b));

      const candidates: { path: string; name: string }[] = [];
      for (const p of allSkillPaths) {
        try {
          const raw = await this.fetchText(
            this.rawUrl(owner, repo, branch, p),
          );
          const { name } = this.parseFrontmatter(raw);
          if (name && raw) candidates.push({ path: p, name });
        } catch {
          /* skip */
        }
      }

      const filterLower = skillFilter?.toLowerCase();
      const match = filterLower
        ? (candidates.find(
            (c) =>
              c.name.toLowerCase() === filterLower ||
              c.name.toLowerCase().replace(/\s+/g, '-') === filterLower ||
              c.path.replace(/\/?SKILL\.md$/, '').split('/').pop()?.toLowerCase() === filterLower,
          ) ??
          candidates.find((c) =>
            c.name.toLowerCase().includes(filterLower),
          ))
        : candidates[0];

      if (!match) {
        const hint = skillFilter
          ? `Ningún skill con nombre "${skillFilter}"`
          : 'No se encontraron skills';
        throw new BadRequestException(
          `${hint}. Skills disponibles: ${candidates.map((c) => c.name).join(', ') || '(ninguno)'}`,
        );
      }

      prefix = match.path.replace(/SKILL\.md$/, '');
      if (prefix) prefix += '/';
    }

    const skillMdPath = `${prefix}SKILL.md`;

    // 3. Fetch SKILL.md content
    const skillMdRaw = await this.fetchText(
      this.rawUrl(owner, repo, branch, skillMdPath),
    );
    const { name, description, version, body } =
      this.parseFrontmatter(skillMdRaw);

    if (!name) {
      throw new BadRequestException(
        'El SKILL.md no tiene el campo "name" en el frontmatter',
      );
    }
    if (!description) {
      throw new BadRequestException(
        'El SKILL.md no tiene el campo "description" en el frontmatter',
      );
    }

    // 4. Collect reference and script files (exclude assets/)
    const refFiles: { path: string; content: string }[] = [];

    const candidateItems = treeData.tree.filter((item) => {
      if (item.type !== 'blob') return false;
      if (!item.path.startsWith(prefix)) return false;

      const relative = item.path.slice(prefix.length); // e.g. "references/api_docs.md"
      const topDir = relative.split('/')[0];

      return INCLUDE_DIRS.includes(topDir) && this.isTextFile(item.path);
    });

    // Fetch all ref files concurrently (but reasonably bounded)
    await Promise.all(
      candidateItems.map(async (item) => {
        try {
          const content = await this.fetchText(
            this.rawUrl(owner, repo, branch, item.path),
          );
          const relativePath = item.path.slice(prefix.length);
          refFiles.push({ path: relativePath, content });
        } catch {
          // Skip files that fail to fetch (non-fatal)
        }
      }),
    );

    const baseUrl = `https://github.com/${owner}/${repo}/tree/${branch}`;
    const pathPart = prefix.replace(/\/$/, '');
    const resolvedRepoUrl = pathPart ? `${baseUrl}/${pathPart}` : baseUrl;

    return {
      name,
      description,
      version,
      content: body,
      files: refFiles,
      resolvedRepoUrl,
    };
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async install(tenantId: string, repoUrl: string) {
    const parsed = this.parseGitHubUrl(repoUrl);
    const fetched = await this.fetchSkillFromGitHub(parsed);

    const urlToStore = fetched.resolvedRepoUrl ?? this.normalizeSkillInput(repoUrl).replace(/\/$/, '');

    // Check for duplicates
    const existing = await this.prisma.agentSkill.findUnique({
      where: { tenantId_repoUrl: { tenantId, repoUrl: urlToStore } },
    });
    if (existing) {
      throw new BadRequestException(
        `El skill de ${urlToStore} ya está instalado`,
      );
    }

    const skill = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agentSkill.create({
        data: {
          tenantId,
          repoUrl: urlToStore,
          name: fetched.name,
          description: fetched.description,
          version: fetched.version,
          content: fetched.content,
          isActive: true,
          files: {
            create: fetched.files.map((f) => ({
              path: f.path,
              content: f.content,
            })),
          },
        },
        include: { files: true },
      });
      return created;
    });

    return skill;
  }

  /**
   * Installs a skill directly from content (no GitHub fetch needed).
   * Used for bundled/default skills.
   */
  async installFromContent(tenantId: string, params: {
    name: string;
    description: string;
    repoUrl: string;
    content: string;
    version?: string;
  }) {
    const existing = await this.prisma.agentSkill.findUnique({
      where: { tenantId_repoUrl: { tenantId, repoUrl: params.repoUrl } },
    });
    if (existing) return existing;

    return this.prisma.agentSkill.create({
      data: {
        tenantId,
        repoUrl: params.repoUrl,
        name: params.name,
        description: params.description,
        version: params.version ?? '1.0.0',
        content: params.content,
        isActive: true,
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.agentSkill.findMany({
      where: { tenantId },
      include: {
        files: { select: { id: true, path: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggle(tenantId: string, skillId: string, isActive: boolean) {
    const skill = await this.prisma.agentSkill.findFirst({
      where: { id: skillId, tenantId },
    });
    if (!skill) throw new NotFoundException('Skill no encontrado');

    return this.prisma.agentSkill.update({
      where: { id: skillId },
      data: { isActive },
    });
  }

  async remove(tenantId: string, skillId: string) {
    const skill = await this.prisma.agentSkill.findFirst({
      where: { id: skillId, tenantId },
    });
    if (!skill) throw new NotFoundException('Skill no encontrado');

    await this.prisma.agentSkill.delete({ where: { id: skillId } });
    return { success: true };
  }

  async sync(tenantId: string, skillId: string) {
    const skill = await this.prisma.agentSkill.findFirst({
      where: { id: skillId, tenantId },
    });
    if (!skill) throw new NotFoundException('Skill no encontrado');

    const parsed = this.parseGitHubUrl(skill.repoUrl);
    const fetched = await this.fetchSkillFromGitHub(parsed);

    return this.prisma.$transaction(async (tx) => {
      // Delete existing files and recreate
      await tx.agentSkillFile.deleteMany({ where: { skillId } });

      return tx.agentSkill.update({
        where: { id: skillId },
        data: {
          name: fetched.name,
          description: fetched.description,
          version: fetched.version,
          content: fetched.content,
          files: {
            create: fetched.files.map((f) => ({
              path: f.path,
              content: f.content,
            })),
          },
        },
        include: { files: { select: { id: true, path: true } } },
      });
    });
  }

  // ─── Prompt & tool helpers ──────────────────────────────────────────────────

  /**
   * Returns only the skill index for the system prompt: name + description per skill.
   * Full instructions are loaded on demand via get_skill_reference (progressive disclosure).
   */
  async getActiveSkillsPrompt(tenantId: string): Promise<string> {
    const skills = await this.prisma.agentSkill.findMany({
      where: { tenantId, isActive: true },
      select: { name: true, description: true },
      orderBy: { createdAt: 'asc' },
    });

    if (skills.length === 0) return '';

    const lines = skills.map(
      (s) => `- **${s.name}**: ${s.description ?? ''}`,
    );

    return [
      'Tienes acceso a los siguientes skills especializados.',
      'Cuando necesites usar uno, llama primero a `get_skill_reference` con solo `skill_name` para cargar sus instrucciones completas.',
      'Si el skill tiene archivos de referencia, también puedes cargarlos con `get_skill_reference` indicando `file_path`.',
      '',
      ...lines,
    ].join('\n');
  }

  /**
   * Returns the content of a skill.
   * - Without file_path: returns the full SKILL.md instructions (main use case).
   * - With file_path: returns a specific references/ or scripts/ file.
   */
  async getSkillReference(
    tenantId: string,
    skillName: string,
    filePath?: string,
  ): Promise<string> {
    const skill = await this.prisma.agentSkill.findFirst({
      where: { tenantId, name: skillName, isActive: true },
      include: {
        files: filePath ? { where: { path: filePath } } : false,
      },
    });

    if (!skill) {
      return `Error: No se encontró un skill activo con nombre "${skillName}"`;
    }

    // No file_path → return full SKILL.md content
    if (!filePath) {
      return skill.content;
    }

    // With file_path → return specific reference file
    const files = (skill as typeof skill & { files?: { content: string }[] }).files ?? [];
    if (files.length === 0) {
      return `Error: El skill "${skillName}" no tiene un archivo en la ruta "${filePath}"`;
    }

    return files[0].content;
  }
}
