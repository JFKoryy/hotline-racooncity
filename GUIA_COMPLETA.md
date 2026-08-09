# GUIA COMPLETA - Hotline RacoonCity
## Explicacion de todo el codigo del proyecto

---

## INDICE
1. [Arquitectura General](#1-arquitectura-general)
2. [server.py — Backend Python](#2-serverpy--backend-python)
3. [game.js — Motor del Juego](#3-gamejs--motor-del-juego)
4. [Flujo del Juego Paso a Paso](#4-flujo-del-juego-paso-a-paso)
5. [Las 5 Funciones Python (detalladas)](#5-las-5-funciones-python)
6. [Las 5 Funciones JavaScript (detalladas)](#6-las-5-funciones-javascript)
7. [Como se conectan Python y JavaScript](#7-como-se-conectan-python-y-javascript)

---

## 1. ARQUITECTURA GENERAL

El proyecto tiene 2 partes que se comunican:


```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR                                │
│                                                                  │
│  index.html ──── styles.css ──── game.js                        │
│  (estructura)    (visual)        (motor del juego)              │
│                                                                  │
│  game.js hace peticiones HTTP (fetch) al servidor Python:       │
│       fetch('http://localhost:8000/api/disparo')                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (fetch)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      server.py (Python)                          │
│                                                                  │
│  Servidor HTTP que escucha en puerto 8000                       │
│  Recibe peticiones JSON → ejecuta funciones → responde JSON     │
│                                                                  │
│  Endpoints:                                                      │
│    POST /api/probabilidad  → calcular_probabilidad_acierto()    │
│    POST /api/disparo       → intentar_disparo()                 │
│    POST /api/inventario    → gestionar_inventario()             │
│    POST /api/documento     → cargar_documento()                 │
│    POST /api/dano          → calcular_dano()                    │
└─────────────────────────────────────────────────────────────────┘
```

**¿Por que esta separacion?**
- El profesor pide usar AMBAS tecnologias (Python + JS)
- Python maneja la LOGICA de negocio (calculos, datos, reglas)
- JavaScript maneja la PRESENTACION (dibujar, animar, input del usuario)
- Se comunican por HTTP/JSON (como una app web real)

**¿Que pasa si no corro el servidor Python?**
- El juego sigue funcionando porque game.js tiene funciones "fallback"
  que hacen lo mismo localmente. Esto es un patron llamado "graceful degradation".

---

## 2. SERVER.PY — BACKEND PYTHON

### ¿Que es este archivo?
Un servidor web escrito en Python puro (sin frameworks externos).
Usa `http.server` que viene incluido en Python (no necesitas instalar nada).

### ¿Como funciona?


```python
# 1. Importamos lo necesario
from http.server import HTTPServer, BaseHTTPRequestHandler  # Servidor web
import json    # Para convertir datos a/desde JSON
import random  # Para generar numeros aleatorios (probabilidad de disparo)
```

Cuando corres `python server.py`:
1. Se crea un servidor HTTP en el puerto 8000
2. El servidor queda "escuchando" peticiones
3. Cuando game.js hace un `fetch()`, el servidor lo recibe
4. Ejecuta la funcion Python correspondiente
5. Devuelve el resultado como JSON

### Clase GameHandler
```python
class GameHandler(BaseHTTPRequestHandler):
```
- `BaseHTTPRequestHandler` es una clase que Python ya trae
- La heredamos (extendemos) para crear nuestro manejador personalizado
- Tiene metodos como `do_GET()` y `do_POST()` que se llaman automaticamente
  segun el tipo de peticion HTTP que llegue

### CORS Headers
```python
def _set_cors_headers(self):
    self.send_header('Access-Control-Allow-Origin', '*')
```
- CORS = Cross-Origin Resource Sharing
- El navegador bloquea peticiones entre diferentes origenes por seguridad
- Esto le dice al navegador "permite que cualquier pagina me hable"
- Sin esto, game.js no podria comunicarse con server.py

---

## 3. GAME.JS — MOTOR DEL JUEGO

### Estructura general del archivo (en orden):


```
game.js (1400+ lineas)
│
├── PYTHON API (lineas 1-95)
│   Funciones que llaman al servidor Python
│
├── CONFIGURACION (lineas 97-120)
│   Constantes del juego (velocidad, daño, probabilidad, etc.)
│
├── ESTADOS DEL JUEGO (lineas 122-135)
│   Maquina de estados: TITLE, INTRO, PLAYING, COMBAT, etc.
│
├── TILEMAP (lineas 137-160)
│   Mapa de la recepcion como matriz de numeros
│
├── VARIABLES GLOBALES (lineas 162-200)
│   Jugador, zombies, balas, particulas, input
│
├── INICIALIZACION (lineas 202-240)
│   Funcion init(): configura canvas, listeners, arranca el loop
│
├── INTERACTUABLES (lineas 242-300)
│   Agente M, carta LSK, spawn de zombies
│
├── INPUT (lineas 302-420)
│   Teclado, mouse, clicks — toda la entrada del usuario
│
├── DISPARO Y COMBATE (lineas 422-520)
│   shootPistol(), swingKnife(), damageZombie()
│
├── LOGICA DE JUEGO (lineas 522-600)
│   tryInteract(), addMessage(), resetGame()
│
├── PARTICULAS (lineas 602-650)
│   Efectos visuales: sangre, fuego de arma
│
├── GAME LOOP (lineas 652-750)
│   gameLoop(), update(), movePlayer(), updateZombies()
│
├── RENDERIZADO (lineas 752-1400+)
│   Todo lo que se DIBUJA en pantalla
│
└── window.addEventListener('load', init)
    Se ejecuta cuando la pagina carga
```

### ¿Que es un Game Loop?
Es el corazon de cualquier videojuego. Es un ciclo que se repite ~60 veces por segundo:

```javascript
function gameLoop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;  // Tiempo entre frames en segundos
    lastTime = timestamp;

    update(dt);    // 1. Actualizar logica (mover cosas, checar colisiones)
    render();      // 2. Dibujar todo en pantalla

    requestAnimationFrame(gameLoop);  // 3. Repetir
}
```

- `requestAnimationFrame` le dice al navegador "llamame de nuevo en el proximo frame"
- `dt` (deltaTime) es crucial: hace que el juego se mueva IGUAL sin importar los FPS
- Si un frame tarda mas, dt es mayor, y las cosas se mueven proporcionalmente

### ¿Que es deltaTime (dt)?
Imagina que el juego corre a 60 FPS:
- Cada frame dura ~0.016 segundos (1/60)
- Si un zombie se mueve a 45 pixeles/segundo:
- Por frame: 45 * 0.016 = 0.72 pixeles de movimiento
- En 1 segundo completo: 0.72 * 60 = ~45 pixeles ✓

Si por algun lag un frame tarda 0.032 segundos:
- Movimiento: 45 * 0.032 = 1.44 pixeles (el doble, compensa el lag)
- El zombie sigue moviendose a la misma velocidad real

### ¿Que es Canvas 2D?


Canvas es un elemento HTML que te da un "lienzo" para dibujar con JavaScript:

```html
<canvas id="game-canvas" width="800" height="500"></canvas>
```

```javascript
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');  // Contexto 2D para dibujar

// Dibujar un rectangulo rojo
ctx.fillStyle = '#ff0000';
ctx.fillRect(x, y, ancho, alto);

// Dibujar un circulo
ctx.beginPath();
ctx.arc(x, y, radio, 0, Math.PI * 2);
ctx.fill();

// Dibujar texto
ctx.font = '14px Arial';
ctx.fillText('Hola', x, y);
```

Todo lo que ves en el juego son combinaciones de estas operaciones basicas.

### ¿Que es la Maquina de Estados?

El juego tiene diferentes "pantallas" o "momentos". Usamos una variable `state`
para saber en cual estamos:

```javascript
const GameState = {
    TITLE: 'title',           // Pantalla de titulo
    INTRO: 'intro',           // Texto introductorio
    PLAYING: 'playing',       // Explorando la recepcion
    DOCUMENT: 'document',     // Leyendo la nota de LSK
    WEAPON_CHOICE: 'weapon_choice',  // Eligiendo arma
    COMBAT: 'combat',         // Peleando contra zombies
    GAME_OVER: 'game_over',   // Moriste
    WIN: 'win'                // Ganaste
};
```

Esto controla TODO:
- `update()` solo mueve cosas si estamos en PLAYING o COMBAT
- `render()` dibuja diferentes cosas segun el estado
- `handleKeyPress()` reacciona diferente segun donde estemos

### ¿Que es el Tilemap?

La "recepcion" esta definida como una MATRIZ (array de arrays) de numeros:

```javascript
const tilemap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // fila 0
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],  // fila 1
    ...
];
```

Cada numero representa un tipo de "baldosa":
- `0` = Piso (se puede caminar)
- `1` = Pared (solida, no se puede pasar)
- `2` = Mostrador (solido)
- `3` = Puerta de entrada
- `5` = Escritorio
- `6` = Silla
- `7` = Donde esta el cuerpo del Agente M
- `8` = Donde esta la carta de LSK

Para convertir posicion del mundo → posicion en la matriz:
```javascript
const col = Math.floor(x / TILE_SIZE);  // x en pixeles → columna
const row = Math.floor(y / TILE_SIZE);  // y en pixeles → fila
```

---

## 4. FLUJO DEL JUEGO PASO A PASO


```
TITULO (state = TITLE)
    │ Jugador presiona ENTER
    ▼
INTRO (state = INTRO)
    │ Texto narrativo aparece durante 4 segundos
    ▼
PLAYING (state = PLAYING)
    │ Jugador se mueve libremente
    │ Ve el cuerpo del Agente M y la carta de LSK
    │
    ├── Jugador se acerca al Agente M → presiona E
    │       │
    │       ▼
    │   WEAPON_CHOICE (state = WEAPON_CHOICE)
    │       │ Presiona 1 (pistola) o 2 (cuchillo)
    │       ▼
    │   Vuelve a PLAYING con arma equipada
    │
    ├── Jugador se acerca a la carta → presiona E
    │       │
    │       ▼
    │   DOCUMENT (state = DOCUMENT)
    │       │ Lee la nota. Presiona E para cerrar.
    │       ▼
    │   Si ya eligio arma → COMBAT
    │   Si no → vuelve a PLAYING
    │
    ▼ (Cuando AMBOS estan hechos: arma elegida + nota leida)

COMBAT (state = COMBAT)
    │ 3 zombies aparecen y persiguen al jugador
    │ Jugador dispara (click der. target + click izq. disparo)
    │ o ataca con cuchillo (click izq.)
    │
    ├── Jugador muere (HP = 0)
    │       ▼
    │   GAME_OVER → ENTER para reiniciar
    │
    └── Todos los zombies mueren
            ▼
        WIN → "CONTINUARA..." → ENTER para volver al titulo
```

---

## 5. LAS 5 FUNCIONES PYTHON (detalladas)

### FUNCION 1: calcular_probabilidad_acierto()

**¿Que hace?** Calcula que tan probable es que un disparo acierte, basado
en cuanta experiencia tiene el jugador.

**¿Por que existe?** El protagonista es un civil sin experiencia.
Al inicio le pega a los zombies solo el 40% de las veces. Conforme avanza
(en la version completa), mejora hasta un 80%.

```python
def calcular_probabilidad_acierto(nivel_experiencia):
    base = 0.40           # 40% — probabilidad inicial
    incremento = 0.04     # +4% por cada nivel ganado
    maximo = 0.80         # Nunca mas de 80% (no es un francotirador)
    probabilidad = base + (nivel_experiencia - 1) * incremento
    return min(probabilidad, maximo)  # min() para no pasar del tope
```

**Conceptos que usa:**
- `min()` — funcion built-in de Python, retorna el menor de dos valores
- Aritmetica basica de probabilidad
- Parametros con valor fijo vs calculado

**Ejemplo:**
```
Nivel 1:  0.40 + (1-1) * 0.04 = 0.40 (40%)
Nivel 5:  0.40 + (5-1) * 0.04 = 0.56 (56%)
Nivel 11: 0.40 + (11-1) * 0.04 = 0.80 (tope)
```

---

### FUNCION 2: intentar_disparo()

**¿Que hace?** Simula un disparo. Genera un numero aleatorio y lo compara
con la probabilidad de acierto. Si el numero es menor o igual, acierta.

```python
import random

def intentar_disparo(probabilidad):
    resultado = random.random()       # Float aleatorio entre 0.0 y 1.0
    acierto = resultado <= probabilidad
    return {
        "acierto": acierto,           # True o False
        "resultado": round(resultado, 4),
        "probabilidad": probabilidad
    }
```

**Conceptos que usa:**
- `random.random()` — genera un numero entre 0 y 1 (distribucion uniforme)
- Comparacion logica (`<=`)
- Diccionarios (retornar multiples valores como JSON)
- `round()` — redondear decimales

**¿Como funciona la probabilidad?**
- Si probabilidad = 0.40, random debe caer entre 0 y 0.40 para acertar
- Eso pasa el 40% de las veces (porque random es uniforme entre 0-1)
- Es como tirar un dado de 100 caras y necesitar sacar 40 o menos

---

### FUNCION 3: gestionar_inventario()


**¿Que hace?** Implementa la regla de "solo un arma a la vez".
Si no tienes arma, la tomas. Si ya tienes una, te da opciones.

```python
def gestionar_inventario(arma_nueva, arma_actual):
    if arma_actual is None:  # No tiene arma
        return {
            "accion": "tomar",
            "mensaje": f"Has tomado: {arma_nueva['nombre']}",
            "arma_equipada": arma_nueva
        }
    else:  # Ya tiene un arma
        return {
            "accion": "elegir",
            "mensaje": "Ya tienes un arma equipada.",
            "actual": arma_actual,
            "nueva": arma_nueva,
            "opciones": ["mantener", "cambiar"]
        }
```

**Conceptos que usa:**
- `is None` — comparar con None (nulo) en Python
- `f"..."` — f-strings, para interpolar variables dentro de texto
- Diccionarios como estructuras de datos
- Condicional `if/else`
- Acceso a diccionarios con `['key']`

**¿Por que es importante para el juego?**
Esta funcion es la que decide si el jugador puede o no recoger un arma.
En la demo solo se usa una vez (al inspeccionar a M), pero en la version
completa se usaria cada vez que encuentras un arma nueva.

---

### FUNCION 4: cargar_documento()

**¿Que hace?** Busca un documento narrativo por su ID en la "base de datos"
del juego. Los documentos son las notas de LSK.

```python
DOCUMENTOS_DB = {
    "nota_recepcion": {
        "autor": "LSK",
        "texto": "Si alguien lee esto: el Agente M no lo logro...",
        "pista": "Busca la llave en la oficina del segundo piso."
    },
    "nota_oficina": {
        "autor": "LSK",
        "texto": "La llave estaba aqui. Voy al sotano...",
        "pista": "El sotano esconde algo."
    }
}

def cargar_documento(id_documento):
    documento = DOCUMENTOS_DB.get(id_documento)  # Buscar por ID
    if documento:
        return {
            "encontrado": True,
            "autor": documento["autor"],
            "contenido": documento["texto"],
            "pista": documento.get("pista", None)
        }
    return {"encontrado": False, "mensaje": "Documento ilegible..."}
```

**Conceptos que usa:**
- `dict.get(key)` — busca una clave sin error si no existe (retorna None)
- `dict.get(key, default)` — lo mismo pero con valor por defecto
- Diccionarios anidados (diccionario dentro de diccionario)
- Patron de acceso a "base de datos" (aunque aqui es un dict en memoria)

**¿Por que no usar una base de datos real?**
Para la demo un diccionario es suficiente. En la version completa
se podria usar SQLite o un archivo JSON externo.

---

### FUNCION 5: calcular_dano()

**¿Que hace?** Cuando un disparo acierta o un cuchillazo conecta,
esta funcion calcula cuanto daño se hace realmente.

```python
def calcular_dano(arma, enemigo):
    dano_base = arma["dano"]             # Ej: pistola = 35
    resistencia = enemigo.get("resistencia", 0)  # Ej: zombie normal = 0
    dano_real = max(1, dano_base - resistencia)  # Minimo 1 de daño

    hp_restante = max(0, enemigo["hp"] - dano_real)
    eliminado = hp_restante <= 0

    return {
        "dano_infligido": dano_real,
        "hp_restante": hp_restante,
        "eliminado": eliminado
    }
```

**Conceptos que usa:**
- `max()` — retorna el mayor de los valores (garantiza minimo 1 de daño)
- Aritmetica de combate (base - resistencia)
- Booleanos como resultado (`eliminado`)
- Patron de "formula de daño" comun en videojuegos

**Ejemplo:**
```
Pistola (daño 35) vs Zombie (HP 100, resistencia 0):
  dano_real = max(1, 35 - 0) = 35
  hp_restante = max(0, 100 - 35) = 65
  eliminado = 65 <= 0 → False

Segundo disparo:
  hp_restante = max(0, 65 - 35) = 30
  eliminado = False

Tercer disparo:
  hp_restante = max(0, 30 - 35) = 0
  eliminado = True  ← Zombie muere al 3er disparo
```

---

## 6. LAS 5 FUNCIONES JAVASCRIPT (detalladas)

### FUNCION JS 1: movePlayer() — Movimiento del jugador


**¿Que hace?** Lee las teclas WASD que el jugador tiene presionadas
y mueve al personaje en esa direccion, con colision contra paredes.

```javascript
function movePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys['w']) dy = -1;   // Arriba (en canvas, Y crece hacia ABAJO)
    if (keys['s']) dy = 1;    // Abajo
    if (keys['a']) dx = -1;   // Izquierda
    if (keys['d']) dx = 1;    // Derecha

    // Normalizar diagonal
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;   // 1/√2 ≈ 0.707
        dy *= 0.707;
    }

    const newX = player.x + dx * CONFIG.PLAYER_SPEED * dt;
    const newY = player.y + dy * CONFIG.PLAYER_SPEED * dt;

    // Solo mover si no hay pared
    if (!isSolid(newX, player.y)) player.x = newX;
    if (!isSolid(player.x, newY)) player.y = newY;
}
```

**Conceptos que usa:**
- `keys` es un objeto que se actualiza con keydown/keyup
- `dt` (deltaTime) para movimiento independiente del FPS
- Normalizacion diagonal: si vas en diagonal, la distancia seria √2 veces
  mas rapida (pitagoras). Se multiplica por 0.707 para compensar.
- Colision separada por eje (X e Y independientes) — esto permite "deslizarse"
  contra las paredes en vez de quedarse pegado.

**¿Que es isSolid()?**
```javascript
function isSolid(x, y) {
    const col = Math.floor(x / CONFIG.TILE_SIZE);
    const row = Math.floor(y / CONFIG.TILE_SIZE);
    if (row < 0 || row >= ROOM_ROWS || col < 0 || col >= ROOM_COLS) return true;
    const tile = tilemap[row][col];
    return tile === 1 || tile === 2;  // Paredes y mostradores son solidos
}
```
Convierte una posicion en pixeles → posicion en el tilemap, y checa si ese
tile es solido.

---

### FUNCION JS 2: Rotacion hacia el cursor

**¿Que hace?** Calcula el angulo entre el jugador y el mouse,
para que el personaje siempre "mire" hacia donde apuntas.

```javascript
// En update():
player.rotation = Math.atan2(mouse.y - player.y, mouse.x - player.x);
```

**Conceptos que usa:**
- `Math.atan2(dy, dx)` — funcion trigonometrica que retorna el angulo
  en radianes entre dos puntos. Es la forma estandar de calcular "hacia
  donde mira algo" en juegos 2D.
- El resultado se usa luego en render con `ctx.rotate(player.rotation)`

**¿Por que Math.atan2 y no Math.atan?**
- `Math.atan` solo funciona en 2 cuadrantes (pierde informacion de signo)
- `Math.atan2` funciona en los 4 cuadrantes (360 grados completos)
- Siempre usar atan2 para calcular angulos en juegos

---

### FUNCION JS 3: Deteccion de colision (balas vs zombies)

**¿Que hace?** Checa si una bala llego al zombie objetivo, calculando
la distancia entre ellos.

```javascript
// En updateBullets():
if (b.hit && b.target) {
    const dx = b.x - b.target.x;
    const dy = b.y - b.target.y;
    const dist = Math.sqrt(dx * dx + dy * dy);  // Distancia euclidiana
    if (dist < b.target.radius + 5) {
        // ¡Colision! La bala llego al zombie
        damageZombie(b.target, CONFIG.GUN_DAMAGE);
        spawnBloodParticles(b.target.x, b.target.y);
        b.life = 0;  // Destruir la bala
    }
}
```

**Conceptos que usa:**
- Formula de distancia euclidiana: √(dx² + dy²)
- Colision circular: si la distancia entre centros < suma de radios, chocan
- `Math.sqrt()` — raiz cuadrada

**¿Por que colision circular y no rectangular?**
- Los personajes son "redondos" (circulos), no cuadrados
- Se siente mas natural al jugar
- Es mas simple de calcular (una sola comparacion)

---

### FUNCION JS 4: Mostrar documento (nota de LSK)


**¿Que hace?** Dibuja un overlay (capa encima del juego) que muestra
la nota de LSK como si fuera un papel viejo.

```javascript
function renderDocumentOverlay() {
    // 1. Fondo oscuro semi-transparente (pausa visual)
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // 2. Dibujar el "papel"
    ctx.fillStyle = '#f4e8c1';  // Color papel viejo/amarillento
    ctx.fillRect(paperX, paperY, paperW, paperH);

    // 3. Escribir el texto linea por linea
    docLines.forEach((line, i) => {
        ctx.fillText(line, paperX + 30, paperY + 40 + i * 18);
    });

    // 4. Hint pulsante "Presiona E para cerrar"
    const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.fillText('Presiona E para cerrar', ...);
}
```

**Conceptos que usa:**
- `rgba()` — color con transparencia (alpha). rgba(0,0,0,0.85) = negro al 85%
- `forEach()` — iterar sobre un array
- `Math.sin()` — para crear efecto pulsante (oscila entre -1 y 1)
- `Date.now()` — milisegundos desde 1970, usado para animaciones basadas en tiempo
- `ctx.globalAlpha` — transparencia global del canvas

**¿Como funciona el efecto pulsante?**
```
Math.sin(Date.now() / 400)  → oscila entre -1 y 1
* 0.5                        → oscila entre -0.5 y 0.5
+ 0.5                        → oscila entre 0 y 1
```
Esto hace que el texto "respire" (aparece y desaparece suavemente).

---

### FUNCION JS 5: IA del zombie (moverZombieHacia)

**¿Que hace?** Cada zombie persigue al jugador en linea recta,
se mueve hacia el, y lo ataca si esta lo suficientemente cerca.

```javascript
function updateZombies(dt) {
    zombies.forEach(z => {
        if (z.isDead) return;  // Saltar zombies muertos

        // Calcular direccion hacia el jugador
        const dx = player.x - z.x;
        const dy = player.y - z.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 30) {  // Si no esta encima del jugador, moverse
            const dirX = dx / dist;  // Normalizar (vector unitario)
            const dirY = dy / dist;
            z.x += dirX * z.speed * dt;
            z.y += dirY * z.speed * dt;
        }

        z.rotation = Math.atan2(dy, dx);  // Mirar al jugador

        // Atacar si esta cerca
        if (dist < 30 && z.attackCooldown <= 0) {
            player.hp -= CONFIG.ZOMBIE_DAMAGE;
            z.attackCooldown = CONFIG.ZOMBIE_ATTACK_COOLDOWN;
        }
    });
}
```

**Conceptos que usa:**
- Normalizacion de vector: dividir (dx, dy) entre la distancia da un
  vector de longitud 1 que apunta hacia el objetivo. Multiplicar por
  velocidad da el movimiento correcto.
- `attackCooldown` — temporizador para que no ataque cada frame (seria
  instakill). Espera 1 segundo entre ataques.
- `forEach` con arrow function
- `return` dentro de forEach = "continue" (salta al siguiente)

**¿Por que normalizar?**
Sin normalizar, un zombie mas lejos se moveria MAS RAPIDO (porque dx y dy
serian mas grandes). Al normalizar, todos se mueven a la misma velocidad
sin importar la distancia.

---

## 7. COMO SE CONECTAN PYTHON Y JAVASCRIPT

### El patron: API REST con fetch()

JavaScript (frontend) habla con Python (backend) asi:


```javascript
// En game.js — Llamar a Python para saber si un disparo acierta
async function apiIntentarDisparo(probabilidad) {
    const res = await fetch('http://localhost:8000/api/disparo', {
        method: 'POST',                              // Tipo de peticion
        headers: { 'Content-Type': 'application/json' },  // Envio JSON
        body: JSON.stringify({ probabilidad: 0.40 })  // Datos
    });
    const data = await res.json();  // Leer respuesta como JSON
    return data;  // { acierto: true/false, resultado: 0.xxxx }
}
```

```python
# En server.py — Python recibe y procesa
def do_POST(self):
    body = self.rfile.read(content_length)
    data = json.loads(body)  # Convertir JSON → diccionario Python
    
    if self.path == '/api/disparo':
        prob = data.get('probabilidad', 0.40)
        response = intentar_disparo(prob)  # Ejecutar la funcion
    
    self.wfile.write(json.dumps(response).encode())  # Responder JSON
```

### Flujo completo de un disparo:

```
1. Jugador hace click izquierdo
2. game.js llama a shootPistol()
3. shootPistol() llama a apiIntentarDisparo(0.40)
4. fetch() envia POST a localhost:8000/api/disparo con {probabilidad: 0.40}
5. server.py recibe la peticion
6. Python ejecuta intentar_disparo(0.40)
7. random.random() genera un numero (ej: 0.27)
8. 0.27 <= 0.40 → True (¡acierto!)
9. Python responde: {"acierto": true, "resultado": 0.27}
10. game.js recibe la respuesta
11. Como acierto = true, crea una bala que va HACIA el zombie
12. La bala viaja, colisiona con el zombie
13. Se llama a apiCalcularDano()
14. Python calcula el daño y responde
15. El zombie pierde HP, se muestra efecto de sangre
```

### ¿Que es async/await?

```javascript
// SIN async/await (promesas puras, mas complicado):
fetch(url).then(res => res.json()).then(data => { ... });

// CON async/await (se lee como codigo normal):
async function miFuncion() {
    const res = await fetch(url);    // Espera a que termine
    const data = await res.json();   // Espera a que parsee
    return data;                     // Retorna el resultado
}
```

`await` le dice a JavaScript: "para aqui, espera a que esto termine,
y luego sigue". Sin await, el codigo seguiria sin esperar la respuesta.

### ¿Que es el fallback local?

```javascript
async function apiIntentarDisparo(probabilidad) {
    if (!pythonBackendActive) {
        // Si Python no esta corriendo, hacer el calculo aqui mismo
        return { acierto: Math.random() <= probabilidad };
    }
    // Si Python esta corriendo, pedirle a el
    try {
        const res = await fetch(...);
        return await res.json();
    } catch (e) {
        // Si hay error de red, usar calculo local
        return { acierto: Math.random() <= probabilidad };
    }
}
```

Esto significa:
- Si corres `python server.py` → Python hace los calculos (ideal para demo)
- Si solo abres index.html → JavaScript hace lo mismo localmente (funciona igual)
- Ambos caminos producen el mismo resultado

---

## RESUMEN RAPIDO PARA EXPLICAR EN CLASE


### Si te preguntan "¿Que hace Python?"
> "Python es el servidor backend. Maneja toda la logica del juego:
> calcula si los disparos aciertan usando probabilidad, gestiona
> el inventario (solo un arma a la vez), busca los documentos
> narrativos, y calcula el daño contra enemigos. JavaScript le
> hace peticiones HTTP y Python le responde con los resultados."

### Si te preguntan "¿Que hace JavaScript?"
> "JavaScript es el motor del juego en el navegador. Dibuja todo
> en un Canvas 2D, lee las teclas del jugador, mueve al personaje
> y los zombies, detecta colisiones, y muestra la interfaz.
> Tambien se comunica con el servidor Python para obtener los
> resultados de las funciones de logica."

### Si te preguntan "¿Que hace HTML/CSS?"
> "HTML da la estructura: el Canvas donde se dibuja el juego, y la
> landing page con toda la documentacion. CSS le da estilo a la
> landing page — el tema oscuro, las cards, la tipografia, los
> colores rojos del tema horror."

### Si te preguntan "¿Como funciona la probabilidad del disparo?"
> "El protagonista es un civil sin experiencia. Cuando dispara,
> Python genera un numero aleatorio entre 0 y 1. Si ese numero
> es menor a 0.40 (40%), el disparo acierta. Si no, falla y
> la bala se desvia visualmente. Conforme avanza la historia,
> ese 40% sube hasta 80% maximo."

### Si te preguntan "¿Por que vista top-down?"
> "Es la combinacion de Hotline Miami (vista cenital, controles
> tipo twin-stick) con Resident Evil (narrativa, tension, puzzles).
> La vista top-down permite ver toda la habitacion pero genera
> tension porque no sabes que hay detras de las paredes."

### Si te preguntan "¿Por que solo un arma?"
> "Es una decision de diseño. Obliga al jugador a ELEGIR: ¿quiero
> seguridad a distancia pero con 40% de fallar? ¿O quiero certeza
> pero tengo que acercarme peligrosamente? Esa tension de elegir
> ES el juego."

---

## GLOSARIO DE TERMINOS TECNICOS

| Termino | Significado |
|---------|-------------|
| **Canvas** | Elemento HTML que permite dibujar graficos 2D con JavaScript |
| **ctx** | Contexto de dibujo del canvas (el "pincel") |
| **Game Loop** | Ciclo infinito: actualizar logica → dibujar → repetir |
| **deltaTime (dt)** | Tiempo entre frames, para movimiento consistente |
| **Tilemap** | Mapa representado como matriz de numeros |
| **Sprite** | Imagen/dibujo de un personaje u objeto |
| **State Machine** | Patron donde el juego tiene "estados" (menu, jugando, etc.) |
| **Collision Detection** | Detectar si dos objetos se estan tocando |
| **Normalizacion** | Convertir un vector a longitud 1 (direccion pura) |
| **API REST** | Forma estandar de comunicacion entre frontend y backend via HTTP |
| **fetch()** | Funcion JS para hacer peticiones HTTP |
| **JSON** | Formato de datos (texto) que tanto JS como Python entienden |
| **async/await** | Sintaxis JS para manejar operaciones que toman tiempo |
| **CORS** | Permisos del navegador para peticiones entre origenes diferentes |
| **Fallback** | Plan B si algo falla (ej: si Python no esta, usar calculo local) |
| **FPS** | Frames per second — cuantas veces se dibuja por segundo |
| **Radianes** | Unidad de angulo (2π = 360 grados) |
| **atan2()** | Funcion que calcula el angulo entre dos puntos |
| **Overlay** | Capa visual que se dibuja ENCIMA de todo |
| **Cooldown** | Tiempo de espera entre acciones (evita spam) |
| **HP** | Hit Points / Health Points — vida del personaje |
