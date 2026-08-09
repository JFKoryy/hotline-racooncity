# Hotline RacoonCity

**Survival Horror Top-Down** | Python + JavaScript + HTML5 + CSS3

## Como ejecutar

### Opcion 1: Con servidor Python (recomendado)
```bash
python server.py
```
Abre http://localhost:8000 en tu navegador. El servidor Python procesa las funciones de logica (probabilidad de disparo, dano, inventario, documentos).

### Opcion 2: Solo frontend (sin Python)
Abre `index.html` directamente en el navegador. El juego funciona con logica local como fallback si el servidor Python no esta disponible.

## Controles
- **WASD** — Movimiento
- **Mouse** — Apuntar
- **Click Derecho** — Seleccionar objetivo (target)
- **Click Izquierdo** — Disparar / Atacar
- **E** — Interactuar
- **1 / 2** — Elegir arma

## Estructura
```
├── index.html    → Landing page + Game Design Document + Demo embebida
├── styles.css    → Estilos de la landing page
├── game.js       → Motor del juego (Canvas 2D, 5 funciones JS del documento)
├── server.py     → Servidor Python (5 funciones Python del documento como API)
└── README.md     → Este archivo
```

## Tecnologias
- **HTML5 Canvas** — Renderizado del juego
- **CSS3** — Interfaz y estilos de la landing page
- **JavaScript** — Motor del juego, input, IA, rendering
- **Python** — Backend con logica de juego expuesta como API REST
