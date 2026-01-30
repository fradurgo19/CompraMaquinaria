# Configuración de SonarCloud

Guía para activar el análisis de calidad y seguridad del código con **SonarCloud** (gratuito para repos públicos en GitHub). El proyecto ya incluye la configuración base; solo falta conectar tu cuenta y el repositorio.

> **Ver errores en el IDE sin abrir SonarCloud:** usa [SonarLint](SONARLINT_SETUP.md) para ver y corregir los mismos issues directamente en Cursor/VS Code.

**Próximos pasos (ya tienes el repo seleccionado en SonarCloud):**

1. En SonarCloud: **Set Up** → **With GitHub Actions**.
2. Copia el **token** que te muestra (solo se ve una vez).
3. En GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret** → nombre `SONAR_TOKEN`, valor = token.
4. El **Project key** en el repo es `fradurgo19_CompraMaquinaria`; debe coincidir con el de SonarCloud.
5. Haz commit y push; el análisis se ejecutará automáticamente (o en **Actions** → **SonarCloud** → **Run workflow**).

---

## 1. Crear / vincular cuenta en SonarCloud

1. Entra en **[sonarcloud.io](https://sonarcloud.io)**.
2. Inicia sesión con **GitHub** (Log in with GitHub).
3. Autoriza a SonarCloud para acceder a tu cuenta de GitHub.

---

## 2. Añadir el proyecto desde GitHub

1. En SonarCloud: **"+"** (arriba) → **Analyze new project**.
2. Elige la **organización** de GitHub (tu usuario o la org donde está el repo).
3. Marca el repositorio **CompraMaquinaria** (o el nombre real del repo).
4. Pulsa **Set Up** y luego **With GitHub Actions**.
5. SonarCloud te mostrará:
   - **Organization key** (ej: `fradurgo19`).
   - **Project key** (ej: `fradurgo19_CompraMaquinaria`).
   - Un **token** para GitHub Actions (solo se muestra una vez).

Anota el **token**; lo necesitas para el paso 4. Si el **Project key** que muestra SonarCloud es distinto al del repo, cópialo y actualiza `sonar-project.properties` (ver paso 3).

---

## 3. Configurar `sonar-project.properties`

En la raíz del proyecto está `sonar-project.properties`. **Ya está configurado** para la organización `fradurgo19` y el proyecto `fradurgo19_CompraMaquinaria`:

```properties
sonar.organization=fradurgo19
sonar.projectKey=fradurgo19_CompraMaquinaria
``` Guarda y haz commit.

---

## 4. Añadir el token en GitHub (Secret)

1. En GitHub: abre el **repositorio** → **Settings** → **Secrets and variables** → **Actions**.
2. Pulsa **New repository secret**.
3. **Name:** `SONAR_TOKEN`
4. **Value:** pega el **token** que te dio SonarCloud en el paso 2 (no lo compartas ni lo subas al repo).
5. Guarda el secret.

---

## 5. Ejecutar el análisis

- **Automático:** cada push o PR a `main`/`master` dispara el workflow **SonarCloud** (`.github/workflows/sonarcloud.yml`).
- **Manual:** en GitHub → pestaña **Actions** → workflow **SonarCloud** → **Run workflow**.

Tras unos minutos, el resultado aparecerá en SonarCloud y, si está configurado, como check en el PR.

---

## Resumen de archivos del proyecto

| Archivo | Uso |
|--------|-----|
| `sonar-project.properties` | Parámetros del análisis (fuentes, exclusiones, projectKey, organization). |
| `.github/workflows/sonarcloud.yml` | Workflow de GitHub Actions que ejecuta el escáner y envía los datos a SonarCloud. |

---

## Qué analiza SonarCloud

- **Bugs** y **vulnerabilidades** (seguridad).
- **Code smells** (mantenibilidad).
- **Duplicación** de código.
- **Cobertura de tests** (cuando añadas tests y generes un reporte `lcov`; ver comentarios en `sonar-project.properties`).

En el dashboard de SonarCloud podrás ver métricas, tendencias y listas de issues por archivo para priorizar mejoras.

---

## Enlaces útiles

- [Documentación SonarCloud – GitHub Actions](https://docs.sonarsource.com/sonarcloud/advanced-setup/ci-based-analysis/github-actions-for-sonarcloud/)
- [Parámetros de análisis](https://docs.sonarsource.com/sonarcloud/advanced-setup/analysis-parameters/)
