# Release

Zeru usa [Semantic Versioning](https://semver.org/) y [Conventional Commits](https://www.conventionalcommits.org/) para versionado y releases automáticos.

## Flujo estándar

1. **Desarrollo** en `feature/*` → PR a `develop`
2. **Integración** en `develop` → cuando estés listo para release
3. **Release branch** (opcional): `release/x.y.z` desde `develop` para QA final
4. **Merge a main** → dispara release automático

## Qué pasa al mergear a main

1. **semantic-release** analiza los commits desde el último tag `v*`
2. Determina el bump (major/minor/patch) por tipos de commit
3. Actualiza `package.json` (root + apps) y `CHANGELOG.md`
4. Crea tag `vX.Y.Z` y GitHub Release
5. **Build** de imágenes Docker con tag = versión
6. **Deploy** a producción (solo si hubo release nuevo)

## Conventional Commits

Los commits deben seguir el formato para que semantic-release determine la versión:

| Tipo   | Bump  | Ejemplo                    |
|--------|-------|----------------------------|
| `feat` | minor | `feat(api): add endpoint`  |
| `fix`  | patch | `fix(web): resolve layout` |
| `BREAKING CHANGE` | major | Ver nota abajo   |
| `docs`, `chore`, `style`, `refactor`, etc. | - | No afectan versión |

**Breaking change:** usa `!` o footer `BREAKING CHANGE:`:
```
feat(api)!: remove deprecated endpoint
```

## Deploy manual

Para deployar una versión específica sin correr semantic-release:

1. Actions → Release & Deploy → Run workflow
2. En "Deploy specific tag" ingresa ej. `v0.2.0`
3. Se construye y deploya ese tag directamente

## Bump manual (fallback)

Si necesitas hacer bump sin CI:

```bash
./scripts/bump-version.sh patch   # 0.2.0 → 0.2.1
./scripts/bump-version.sh minor   # 0.2.0 → 0.3.0
./scripts/bump-version.sh major   # 0.2.0 → 1.0.0
```

Luego commit, tag y push manualmente. Preferir el flujo automático cuando sea posible.

## Setup inicial (ya hecho)

Para que semantic-release funcione correctamente, el tag `v0.2.0` debe existir en main como punto de partida. Esto se hace una sola vez al mergear el release branch:

```bash
git checkout main
git merge release/0.2.0
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main --follow-tags
```

A partir de ahí, semantic-release maneja todo automáticamente.
