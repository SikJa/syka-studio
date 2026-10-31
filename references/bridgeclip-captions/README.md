# Subtítulos de BridgeClip: referencias y adaptación nativa

13 presets, definiciones de preview, funciones de estilo del engine y 7 fuentes usadas por captions, con sus 5 avisos OFL. Código MIT: conservar LICENSE.BridgeClip.txt al distribuir derivados. Fuentes intactas: conservar sus avisos individuales. Procedencia y hash en PROVENANCE.json.

El catálogo estático refleja las definiciones del picker de BridgeClip, con una frase española compartida; no es una captura del export ASS ni prueba de equivalencia con Diffusion. Ahora están integrados Subtle, Editorial, Boxed y Spotlight en el selector nativo de Syka. Los otros nueve siguen como referencia. Los nombres Spotlight/Paper ya existen en Syka pero corresponden a implementaciones distintas; usar IDs prefijados bridgeclip- al adaptar.

Integrados: `bridgeclip-subtle` para entrevistas, `bridgeclip-boxed` para fondos difíciles, `bridgeclip-spotlight` para resaltar palabras y `bridgeclip-editorial` para relatos. Prueba reabrible: Pruebas Syka/12-subtitulos-bridgeclip. Sweep requiere barrido progresivo por palabra; Glow/Neon requieren probar blur/export; Punch/Impact necesitan un nuevo agrupado de palabras y tamaños seguros para cada formato.
