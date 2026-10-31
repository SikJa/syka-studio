# Encargo de auditoría y preparación de Syka Studio

Revisá el código público completo de Syka Studio, de la entrada de Electron hasta el editor, los servicios locales, los proveedores de agentes, los medios, la preview y el export. Detectá y corregí fallos reproducibles y riesgos concretos que puedan afectar a una persona que instale la aplicación en su propia computadora.

## Prioridades

1. Instalación limpia: detectar rutas del desarrollador, dependencias implícitas, archivos ausentes, directorios no escribibles, cambios de unidad, nombres con espacios/acentos, binarios de arquitectura incorrecta y diferencias entre desarrollo y distribución.
2. Estabilidad y datos: conservar proyectos, perfiles, credenciales e historial; revisar escrituras atómicas, cancelación, cierres, concurrencia, reconexión y recuperación ante fallos.
3. Rendimiento medido: medir procesos, CPU y memoria; localizar tareas innecesarias, listeners sin liberar, animaciones en segundo plano, cachés sin límite, recursos de medios retenidos y cargas anticipadas. Comparar antes/después con condiciones equivalentes.
4. Distribución preparada: dejar verificaciones reproducibles, documentación para una instalación nueva y una lista explícita de requisitos, dependencias opcionales y validaciones pendientes.

## Método y límites

- Consultá el grafo local y contrastá las decisiones relevantes con documentación oficial actual. El grafo no cubre todo el repositorio: completá el análisis con búsquedas directas del código público.
- Inventariá áreas y archivos para que la cobertura sea verificable. Separá inspección estática, pruebas simuladas, mediciones reales y validaciones en otras máquinas.
- No borres material personal, proyectos, perfiles, credenciales ni cambios existentes. No generes instaladores, no publiques y no ejecutes llamadas pagas a proveedores para probar el código.
- Mientras siga la restricción de espacio en F, no ejecutes Forge, staging de dependencias, Cargo ni copias completas de runtimes. Conservá la preparación en código y documentación; permití solamente chequeos y actualizaciones pequeñas necesarias para activar correcciones.
- Muse está retirado; conservá solamente la lectura del historial anterior.
- Agregá pruebas de regresión para fallos relevantes. No conviertas preferencias visuales o conjeturas en bugs confirmados.
- No prometas compatibilidad con Mac por pasar verificaciones en Windows. Si falta una máquina real, dejá ese límite y el procedimiento de comprobación escritos.
- Reiniciá servicios solamente según la preferencia del usuario y tras comprobar trabajos activos.

## Entregables

- Hallazgos con severidad, archivo/línea, causa, efecto, corrección y evidencia.
- Cambios implementados y pruebas ejecutadas, conservando el estado previo del trabajo.
- Informe de rendimiento con condiciones de medición y límites; no inventar porcentajes de mejora.
- Verificación de preparación para instalación sin generar el instalador.
- Lista concreta de riesgos o validaciones pendientes que realmente requieran otra máquina, hardware o decisión del usuario.

Referencia de rendimiento confirmada: 16 GB de RAM, SSD y gráficos integrados. Priorizar Windows y revisar estáticamente la compatibilidad con Mac hasta poder validarla en hardware real. El usuario autoriza reiniciar Syka durante esta revisión porque no está usándola; verificar igualmente el estado de los proyectos antes de cada reinicio. El objetivo es reducir trabajo innecesario y retención de recursos sin degradar la edición.
