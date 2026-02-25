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
  skillPath: string; // path within repo to the skill folder (may be "")
}

interface FetchedSkill {
  name: string;
  description: string;
  version?: string;
  content: string; // SKILL.md body (without frontmatter)
  files: { path: string; content: string }[]; // references/ and scripts/
}

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── URL parsing ────────────────────────────────────────────────────────────

  parseGitHubUrl(rawUrl: string): ParsedGitHubUrl {
    let url: URL;
    try {
      url = new URL(
        rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`,
      );
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
      skillPath: rest.join('/'),
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

  async fetchSkillFromGitHub(parsed: ParsedGitHubUrl): Promise<FetchedSkill> {
    const { owner, repo, branch, skillPath } = parsed;

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

    const prefix = skillPath ? `${skillPath}/` : '';

    // 2. Find SKILL.md
    const skillMdPath = `${prefix}SKILL.md`;
    const skillMdItem = treeData.tree.find(
      (item) => item.type === 'blob' && item.path === skillMdPath,
    );

    if (!skillMdItem) {
      throw new BadRequestException(
        `No se encontró SKILL.md en ${skillMdPath}. Verifica la URL del skill.`,
      );
    }

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

    return {
      name,
      description,
      version,
      content: body,
      files: refFiles,
    };
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  async install(tenantId: string, repoUrl: string) {
    // Normalise URL (strip trailing slash)
    const normalizedUrl = repoUrl.trim().replace(/\/$/, '');

    // Check for duplicates
    const existing = await this.prisma.agentSkill.findUnique({
      where: { tenantId_repoUrl: { tenantId, repoUrl: normalizedUrl } },
    });
    if (existing) {
      throw new BadRequestException(
        `El skill de ${normalizedUrl} ya está instalado`,
      );
    }

    const parsed = this.parseGitHubUrl(normalizedUrl);
    const fetched = await this.fetchSkillFromGitHub(parsed);

    const skill = await this.prisma.$transaction(async (tx) => {
      const created = await tx.agentSkill.create({
        data: {
          tenantId,
          repoUrl: normalizedUrl,
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

  /** Returns the system prompt block with all active skills for a tenant */
  async getActiveSkillsPrompt(tenantId: string): Promise<string> {
    const skills = await this.prisma.agentSkill.findMany({
      where: { tenantId, isActive: true },
      include: { files: { select: { path: true } } },
      orderBy: { createdAt: 'asc' },
    });

    if (skills.length === 0) return '';

    const blocks = skills.map((skill) => {
      const refList =
        skill.files.length > 0
          ? [
              '### Archivos de referencia disponibles',
              `Usa get_skill_reference con skill_name="${skill.name}" y la ruta del archivo para cargar:`,
              ...skill.files.map((f) => `- ${f.path}`),
              '',
            ].join('\n')
          : '';

      return [
        `## Skill: ${skill.name}`,
        skill.description ? skill.description : '',
        '',
        refList,
        '### Instrucciones',
        skill.content,
      ]
        .join('\n')
        .trim();
    });

    return blocks.join('\n\n---\n\n');
  }

  /** Returns the content of a specific reference file for a skill */
  async getSkillReference(
    tenantId: string,
    skillName: string,
    filePath: string,
  ): Promise<string> {
    const skill = await this.prisma.agentSkill.findFirst({
      where: { tenantId, name: skillName, isActive: true },
      include: {
        files: { where: { path: filePath } },
      },
    });

    if (!skill) {
      return `Error: No se encontró un skill activo con nombre "${skillName}"`;
    }

    if (skill.files.length === 0) {
      return `Error: El skill "${skillName}" no tiene un archivo en la ruta "${filePath}"`;
    }

    return skill.files[0].content;
  }
}
