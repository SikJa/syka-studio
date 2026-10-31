# Graphify local de Syka

La skill oficial está en `.codex/skills/graphify/SKILL.md` (Graphify 0.9.76).
Usar el ejecutable `.runtime/graphify/Scripts/graphify.exe`; no requiere PATH global.
Consultar primero la herramienta `syka_code_graph` (`query`, `relations`, `status`, `search`). El bundle atómico `graphify-out/code-index.json` contiene grafo, hashes y generación coherentes. `graph.json` y `source-manifest.json` son exportaciones de compatibilidad; el HTML anterior puede quedar desactualizado. El grafo refleja `scripts/graphify-scope.json`, no todo el repositorio ni decisiones del usuario. Si falta cobertura o vigencia, usar búsqueda directa acotada y decirlo.
El host del agente mantiene automáticamente el grafo con el worker local `scripts/graphify-runtime.py`: debounce, reconciliación al abrir, bloqueo de una sola ejecución y último índice íntegro ante fallos. Esto fue autorizado expresamente el 2026-10-07. Para actualización manual usar `scripts/refresh-graphify.ps1`; comparte el bloqueo. AST local sin API, semántica, hooks ni cloud.
No escanear documentos, medios, proyectos personales, otros worktrees, referencias o credenciales. No convertir aristas INFERRED en preferencias del usuario.
