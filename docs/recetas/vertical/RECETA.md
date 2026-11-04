# Receta de fábrica: video vertical

Un video de 15 a 90 s en 9:16 para TikTok, Reels o Shorts: gancho en el primer
segundo, subtítulos grandes y ritmo rápido.

Se usa con `syka_receta action:usar slug:vertical`. `syka_plan` lleva el video:
brief, escenas (gancho, desarrollo, remate y cierre), construir y gate.

La receta define una **zona segura**: 8 % arriba, 20 % abajo, 6 % a la izquierda
y 15 % a la derecha, donde la app pone sus botones y su texto. El gate rechaza
las frases del plan que no se ven enteras dentro de esa zona. Las reglas
completas están en `receta.json`.
