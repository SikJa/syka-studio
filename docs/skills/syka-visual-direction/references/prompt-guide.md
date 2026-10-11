# Del pedido libre a una receta nativa

La persona puede pedir «haceme un reel con este estilo». El agente resuelve el detalle desde el proyecto y pregunta únicamente decisiones relevantes que faltan. No obligues a completar un formulario ni a aprender estos términos.

- **Entregable:** tipo de pieza, formato, duración y material que debe conservarse.
- **Diseño:** marca, referencias, jerarquía, contraste, espaciado y ubicación respecto a caras/subtítulos.
- **Beats:** intervalos, propósito y contenido exacto. La transcripción manda cuando hay voz real.
- **Movimiento:** qué cambia, por qué, trayectoria, aceleración, lectura y salida. La continuidad puede conservar un objeto en lugar de encadenar tarjetas nuevas.
- **Recursos:** logo original, footage, imágenes, sonidos y ruta durable; proveedor realmente disponible.
- **Exclusiones:** sólo las solicitadas o las que preservan el material. «Sin voz» no equivale a «sin sonido».

Ejemplo de especificación, no una plantilla de estilo obligatoria:

> 0–3 s: el título «Un flujo, tres pasos» queda anclado arriba. Sobre el footage, tres nodos aparecen de izquierda a derecha a 0.4, 0.65 y 0.9 s; las conexiones se dibujan después de cada nodo. Dejá 1.5 s para leer. La cámara no se mueve porque distraería de la demostración. En 3–4 s conservá el nodo central y abrilo como panel de detalle. Un pop suave acompaña su apertura; mantené la voz original.

Traducí a Diffusion con nodos/secuencias o HTML manejado por su ticker, nombres y keys estables. Consultá `syka-editorial-motion` para ejemplos ejecutables y `syka-motion-transitions` para entradas/salidas. Un preset del catálogo HyperFrames puede aportar la técnica, pero sus atributos, lifecycle y comandos no son APIs de Syka.

Para retocar: identificá el momento y componente, conservá lo aprobado y describí el cambio puntual. Las capturas, dibujos y comentarios son contexto de revisión. Una receta registra decisiones y referencias; no cambia pesos del modelo.

Procedencia conceptual: [Prompt Guide](https://hyperframes.heygen.com/prompting/overview), [anatomía](https://hyperframes.heygen.com/prompting/anatomy), [movimiento](https://hyperframes.heygen.com/prompting/motion) y [Design](https://www.hyperframes.dev/design).
