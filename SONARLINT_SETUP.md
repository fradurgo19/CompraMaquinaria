# SonarLint - Análisis local (mismo que SonarCloud)

Permite ver y corregir issues de SonarCloud **directamente en Cursor/VS Code**, sin hacer push ni abrir la web.

## 1. Instalar extensión

1. Abre **Extensiones** (Ctrl+Shift+X)
2. Busca **SonarLint** o **SonarQube for IDE**
3. Instala la extensión de **SonarSource**

O acepta la recomendación del proyecto cuando abras el workspace.

## 2. Conectar a SonarCloud (una sola vez)

1. En la **barra lateral**, haz clic en el icono de **SonarQube Setup**
2. En **Connected Mode**, haz clic en **Connect to SonarQube Cloud**
3. Configura:
   - **Token**: genera uno en [sonarcloud.io/account/security](https://sonarcloud.io/account/security)
   - **Organization**: `fradurgo19`
   - **Connection Name**: puedes usar `fradurgo19` o el que prefieras
4. Pulsa **Save Connection**
5. Si no está vinculado, haz clic en **Add Project Binding** y selecciona **CompraMaquinaria**

## 3. Uso diario

- Los issues aparecen en **Problems** (Ctrl+Shift+M)
- Subrayados en el código al pasar el cursor
- Quick Fix en muchos casos con clic derecho
- Panel **SonarQube Findings** en la barra inferior

No hace falta hacer push para ver los mismos problemas que SonarCloud.

## 4. Análisis completo por línea de comandos (opcional)

```powershell
$env:SONAR_TOKEN = "tu_token_de_sonarcloud"
npm run sonar
```

El resultado se sube a SonarCloud. El token debe tener permisos de análisis. La dependencia `sonarqube-scanner` ya está en el proyecto.

## 5. Troubleshooting

| Problema | Solución |
|----------|----------|
| No aparecen issues | Revisa que el proyecto esté vinculado en Connected Mode |
| "Connection failed" | Comprueba token y organización |
| Java no encontrado | SonarLint requiere Java 17+ para el language server |
