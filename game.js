// ========================================
// HOTLINE RACOONCITY - Demo Jugable
// Motor del juego: Canvas 2D puro
// ========================================

// --- PYTHON BACKEND API ---
// Estas funciones llaman al servidor Python (server.py)
// que implementa las 5 funciones Python del documento.
// Si el servidor no esta disponible, usa fallback local.
const API_BASE = 'http://localhost:8000';
let pythonBackendActive = false;

async function checkPythonBackend() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        if (res.ok) {
            pythonBackendActive = true;
            console.log('[BACKEND] Servidor Python conectado.');
        }
    } catch (e) {
        pythonBackendActive = false;
        console.log('[BACKEND] Servidor Python no disponible. Usando logica local.');
    }
}

// Llama a calcular_probabilidad_acierto() en Python
async function apiCalcularProbabilidad(nivel) {
    if (!pythonBackendActive) return 0.40 + (nivel - 1) * 0.04;
    try {
        const res = await fetch(`${API_BASE}/api/probabilidad`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nivel_experiencia: nivel })
        });
        const data = await res.json();
        return data.probabilidad;
    } catch (e) { return 0.40; }
}

// Llama a intentar_disparo() en Python
async function apiIntentarDisparo(probabilidad) {
    if (!pythonBackendActive) return { acierto: Math.random() <= probabilidad };
    try {
        const res = await fetch(`${API_BASE}/api/disparo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ probabilidad: probabilidad })
        });
        return await res.json();
    } catch (e) { return { acierto: Math.random() <= probabilidad }; }
}

// Llama a gestionar_inventario() en Python
async function apiGestionarInventario(armaNueva, armaActual) {
    if (!pythonBackendActive) {
        if (!armaActual) return { accion: 'tomar', arma_equipada: armaNueva };
        return { accion: 'elegir', opciones: ['mantener', 'cambiar'] };
    }
    try {
        const res = await fetch(`${API_BASE}/api/inventario`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arma_nueva: armaNueva, arma_actual: armaActual })
        });
        return await res.json();
    } catch (e) { return { accion: 'tomar', arma_equipada: armaNueva }; }
}

// Llama a cargar_documento() en Python
async function apiCargarDocumento(idDocumento) {
    if (!pythonBackendActive) return null;
    try {
        const res = await fetch(`${API_BASE}/api/documento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_documento: idDocumento })
        });
        return await res.json();
    } catch (e) { return null; }
}

// Llama a calcular_dano() en Python
async function apiCalcularDano(arma, enemigo) {
    if (!pythonBackendActive) {
        const dano = Math.max(1, arma.dano - (enemigo.resistencia || 0));
        return { dano_infligido: dano, hp_restante: Math.max(0, enemigo.hp - dano), eliminado: (enemigo.hp - dano) <= 0 };
    }
    try {
        const res = await fetch(`${API_BASE}/api/dano`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ arma: arma, enemigo: enemigo })
        });
        return await res.json();
    } catch (e) {
        const dano = Math.max(1, arma.dano - (enemigo.resistencia || 0));
        return { dano_infligido: dano, hp_restante: Math.max(0, enemigo.hp - dano), eliminado: (enemigo.hp - dano) <= 0 };
    }
}

// --- CONFIGURACION ---
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 500,
    TILE_SIZE: 40,
    PLAYER_SPEED: 120,
    ZOMBIE_SPEED: 45,
    BULLET_SPEED: 400,
    HIT_PROBABILITY: 0.40,
    KNIFE_RANGE: 50,
    KNIFE_DAMAGE: 40,
    GUN_DAMAGE: 35,
    ZOMBIE_HP: 100,
    ZOMBIE_DAMAGE: 15,
    ZOMBIE_ATTACK_COOLDOWN: 1.0,
    PLAYER_HP: 100,
    INTERACTION_RANGE: 60
};


// --- ESTADO DEL JUEGO ---
const GameState = {
    TITLE: 'title',
    INTRO: 'intro',
    PLAYING: 'playing',
    DOCUMENT: 'document',
    WEAPON_CHOICE: 'weapon_choice',
    COMBAT: 'combat',
    GAME_OVER: 'game_over',
    WIN: 'win'
};

let state = GameState.TITLE;
let introStep = 0;
let introTimer = 0;


// --- TILEMAP (Recepcion de comisaria) ---
// 0 = piso, 1 = pared, 2 = mostrador, 3 = puerta entrada, 4 = puerta pasillo
// 5 = escritorio, 6 = silla, 7 = cuerpo agente M, 8 = carta LSK
const ROOM_COLS = 20;
const ROOM_ROWS = 12;
const tilemap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,6,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,2,2,2,2,2,2,2,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,2,8,0,0,0,0,2,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,7,0,0,0,0,0,0,0,0,0,0,0,5,6,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];


// --- JUGADOR ---
let player = {
    x: 9.5 * CONFIG.TILE_SIZE,
    y: 9.5 * CONFIG.TILE_SIZE,
    rotation: -Math.PI / 2,
    radius: 14,
    hp: CONFIG.PLAYER_HP,
    weapon: null, // 'pistol' o 'knife'
    target: null,
    attackCooldown: 0,
    isAttacking: false,
    attackTimer: 0,
    knifeSwing: 0
};

// --- ENEMIGOS ---
let zombies = [];
let zombiesSpawned = false;

// --- BALAS ---
let bullets = [];

// --- OBJETOS INTERACTUABLES ---
let interactables = [];
let nearInteractable = null;

// --- INPUT ---
let keys = {};
let mouse = { x: 0, y: 0 };
let documentRead = false;
let weaponChosen = false;
let agentInspected = false;

// --- PARTICULAS Y EFECTOS ---
let particles = [];
let screenShake = 0;
let messages = [];


// --- CANVAS SETUP ---
let canvas, ctx;
let lastTime = 0;

function init() {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    canvas.width = CONFIG.CANVAS_WIDTH;
    canvas.height = CONFIG.CANVAS_HEIGHT;

    // Verificar si el servidor Python esta activo
    checkPythonBackend();

    // Input listeners
    document.addEventListener('keydown', (e) => {
        keys[e.key.toLowerCase()] = true;
        handleKeyPress(e.key.toLowerCase());
    });
    document.addEventListener('keyup', (e) => {
        keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        mouse.x = (e.clientX - rect.left) * scaleX;
        mouse.y = (e.clientY - rect.top) * scaleY;
    });
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleRightClick();
    });
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) handleLeftClick();
        if (e.button === 2) {
            e.preventDefault();
            handleRightClick();
        }
    });

    // Setup interactables
    setupInteractables();

    // Start game loop
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}


function setupInteractables() {
    interactables = [
        {
            id: 'agent_m',
            x: 3 * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            y: 7 * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            radius: 20,
            type: 'body',
            inspected: false,
            label: 'Agente M'
        },
        {
            id: 'carta_lsk',
            x: 7 * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            y: 5 * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
            radius: 15,
            type: 'document',
            inspected: false,
            label: 'Documento'
        }
    ];
}

function spawnZombies() {
    if (zombiesSpawned) return;
    zombiesSpawned = true;
    // 3 zombies entran por el pasillo (parte superior)
    const spawnPositions = [
        { x: 5 * CONFIG.TILE_SIZE, y: 1.5 * CONFIG.TILE_SIZE },
        { x: 10 * CONFIG.TILE_SIZE, y: 1.5 * CONFIG.TILE_SIZE },
        { x: 15 * CONFIG.TILE_SIZE, y: 1.5 * CONFIG.TILE_SIZE }
    ];
    spawnPositions.forEach((pos, i) => {
        zombies.push({
            x: pos.x,
            y: pos.y,
            rotation: Math.PI / 2,
            radius: 14,
            hp: CONFIG.ZOMBIE_HP,
            maxHp: CONFIG.ZOMBIE_HP,
            speed: CONFIG.ZOMBIE_SPEED + (i * 5),
            attackCooldown: 0,
            hitFlash: 0,
            isDead: false,
            deathTimer: 0,
            id: i
        });
    });
    addMessage("Escuchas pasos arrastrándose...", 3);
}


// --- INPUT HANDLERS ---
function handleKeyPress(key) {
    if (state === GameState.TITLE && key === 'enter') {
        state = GameState.INTRO;
        introTimer = 0;
        return;
    }
    if (state === GameState.DOCUMENT && key === 'e') {
        // Al cerrar la nota, solo vuelve a jugar.
        // Los zombies aparecen cuando ya eligio arma Y leyo la nota.
        if (weaponChosen && !zombiesSpawned) {
            spawnZombies();
            state = GameState.COMBAT;
        } else {
            state = GameState.PLAYING;
        }
        return;
    }
    if (state === GameState.WEAPON_CHOICE) {
        if (key === '1') {
            player.weapon = 'pistol';
            weaponChosen = true;
            addMessage("Has tomado la Pistola M19. [40% acierto]", 3);
            // Los zombies aparecen solo si ya leyo la nota tambien
            if (documentRead && !zombiesSpawned) {
                spawnZombies();
                state = GameState.COMBAT;
            } else {
                state = GameState.PLAYING;
                addMessage("Hay un documento sobre el mostrador...", 3);
            }
            return;
        }
        if (key === '2') {
            player.weapon = 'knife';
            weaponChosen = true;
            addMessage("Has tomado el Cuchillo Táctico. [100% acierto, cuerpo a cuerpo]", 3);
            if (documentRead && !zombiesSpawned) {
                spawnZombies();
                state = GameState.COMBAT;
            } else {
                state = GameState.PLAYING;
                addMessage("Hay un documento sobre el mostrador...", 3);
            }
            return;
        }
    }
    if ((state === GameState.PLAYING || state === GameState.COMBAT) && key === 'e') {
        tryInteract();
    }
    if (state === GameState.WIN && key === 'enter') {
        state = GameState.TITLE;
        resetGame();
    }
    if (state === GameState.GAME_OVER && key === 'enter') {
        state = GameState.TITLE;
        resetGame();
    }
}


function handleRightClick() {
    if (state !== GameState.COMBAT && state !== GameState.PLAYING) return;
    if (player.weapon !== 'pistol') return;
    // Seleccionar target: zombie mas cercano al cursor
    let closest = null;
    let closestDist = Infinity;
    zombies.forEach(z => {
        if (z.isDead) return;
        const dx = z.x - mouse.x;
        const dy = z.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 60 && dist < closestDist) {
            closest = z;
            closestDist = dist;
        }
    });
    player.target = closest;
    if (closest) {
        addMessage("Objetivo seleccionado", 1.5);
    }
}

function handleLeftClick() {
    if (state !== GameState.COMBAT && state !== GameState.PLAYING) return;
    if (!player.weapon) return;
    if (player.attackCooldown > 0) return;

    if (player.weapon === 'pistol') {
        shootPistol();
    } else if (player.weapon === 'knife') {
        swingKnife();
    }
}


function shootPistol() {
    if (!player.target || player.target.isDead) {
        addMessage("Sin objetivo. Click derecho para apuntar.", 2);
        return;
    }
    player.attackCooldown = 0.5;
    screenShake = 0.15;

    // Usa la funcion Python intentar_disparo() via API
    // (con fallback local si el servidor no esta activo)
    apiIntentarDisparo(CONFIG.HIT_PROBABILITY).then(result => {
        const hit = result.acierto;

        // Crear bala visual
        const angle = Math.atan2(
            player.target.y - player.y,
            player.target.x - player.x
        );

        if (hit) {
            bullets.push({
                x: player.x,
                y: player.y,
                dx: Math.cos(angle) * CONFIG.BULLET_SPEED,
                dy: Math.sin(angle) * CONFIG.BULLET_SPEED,
                targetX: player.target.x,
                targetY: player.target.y,
                hit: true,
                target: player.target,
                life: 1
            });
            spawnMuzzleFlash(player.x, player.y, angle);
        } else {
            // Bala que falla - se desvia
            const missAngle = angle + (Math.random() - 0.5) * 0.8;
            bullets.push({
                x: player.x,
                y: player.y,
                dx: Math.cos(missAngle) * CONFIG.BULLET_SPEED,
                dy: Math.sin(missAngle) * CONFIG.BULLET_SPEED,
                hit: false,
                target: null,
                life: 0.5
            });
            addMessage("¡Fallo!", 1);
            spawnMuzzleFlash(player.x, player.y, missAngle);
        }
    });
}


function swingKnife() {
    player.attackCooldown = 0.4;
    player.isAttacking = true;
    player.attackTimer = 0.3;
    player.knifeSwing = 1;

    // Checar si hay zombie en rango
    zombies.forEach(z => {
        if (z.isDead) return;
        const dx = z.x - player.x;
        const dy = z.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.KNIFE_RANGE) {
            damageZombie(z, CONFIG.KNIFE_DAMAGE);
            spawnBloodParticles(z.x, z.y);
            screenShake = 0.1;
        }
    });
}

function damageZombie(zombie, damage) {
    // Usa la funcion Python calcular_dano() via API
    const armaData = player.weapon === 'pistol'
        ? { nombre: 'Pistola M19', dano: CONFIG.GUN_DAMAGE }
        : { nombre: 'Cuchillo Tactico', dano: CONFIG.KNIFE_DAMAGE };
    const enemyData = { hp: zombie.hp, resistencia: 0 };

    apiCalcularDano(armaData, enemyData).then(result => {
        zombie.hp = result.hp_restante;
        zombie.hitFlash = 0.2;
        if (result.eliminado) {
            zombie.isDead = true;
            zombie.deathTimer = 2;
            spawnBloodParticles(zombie.x, zombie.y);
            addMessage("Zombie eliminado", 2);
            if (player.target === zombie) {
                player.target = null;
            }
            const alive = zombies.filter(z => !z.isDead);
            if (alive.length === 0 && zombiesSpawned) {
                setTimeout(() => { state = GameState.WIN; }, 1500);
            }
        }
    });
}


function tryInteract() {
    if (!nearInteractable) return;
    const obj = nearInteractable;

    if (obj.id === 'agent_m' && !obj.inspected) {
        obj.inspected = true;
        agentInspected = true;
        state = GameState.WEAPON_CHOICE;
        addMessage("Encuentras el arma y cuchillo del Agente M.", 3);
    } else if (obj.id === 'carta_lsk' && !obj.inspected) {
        obj.inspected = true;
        documentRead = true;
        state = GameState.DOCUMENT;
    }
}

function addMessage(text, duration) {
    messages.push({ text, timer: duration, alpha: 1 });
}

function resetGame() {
    player.x = 9.5 * CONFIG.TILE_SIZE;
    player.y = 9.5 * CONFIG.TILE_SIZE;
    player.hp = CONFIG.PLAYER_HP;
    player.weapon = null;
    player.target = null;
    player.attackCooldown = 0;
    zombies = [];
    bullets = [];
    particles = [];
    messages = [];
    zombiesSpawned = false;
    documentRead = false;
    weaponChosen = false;
    agentInspected = false;
    setupInteractables();
}


// --- PARTICULAS ---
function spawnMuzzleFlash(x, y, angle) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x + Math.cos(angle) * 20,
            y: y + Math.sin(angle) * 20,
            dx: Math.cos(angle + (Math.random() - 0.5) * 0.5) * (100 + Math.random() * 100),
            dy: Math.sin(angle + (Math.random() - 0.5) * 0.5) * (100 + Math.random() * 100),
            life: 0.2 + Math.random() * 0.1,
            maxLife: 0.3,
            color: `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 30}%)`,
            size: 2 + Math.random() * 3
        });
    }
}

function spawnBloodParticles(x, y) {
    for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
            x: x,
            y: y,
            dx: Math.cos(angle) * (30 + Math.random() * 60),
            dy: Math.sin(angle) * (30 + Math.random() * 60),
            life: 0.5 + Math.random() * 0.3,
            maxLife: 0.8,
            color: `hsl(0, ${70 + Math.random() * 30}%, ${20 + Math.random() * 20}%)`,
            size: 2 + Math.random() * 4
        });
    }
}


// --- GAME LOOP ---
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
}

// --- UPDATE ---
function update(dt) {
    if (state === GameState.INTRO) {
        introTimer += dt;
        if (introTimer > 4) {
            state = GameState.PLAYING;
            addMessage("Pulsa E para interactuar con objetos.", 4);
        }
        return;
    }

    if (state !== GameState.PLAYING && state !== GameState.COMBAT) return;

    // Update cooldowns
    if (player.attackCooldown > 0) player.attackCooldown -= dt;
    if (player.attackTimer > 0) {
        player.attackTimer -= dt;
        player.knifeSwing = player.attackTimer / 0.3;
    } else {
        player.isAttacking = false;
    }

    // Movimiento jugador
    movePlayer(dt);

    // --- Funcion JS #2 del documento: rotarHaciaCursor(jugador, mouseX, mouseY) ---
    player.rotation = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // Check interactables cercanos
    nearInteractable = null;
    interactables.forEach(obj => {
        if (obj.inspected) return;
        const dx = obj.x - player.x;
        const dy = obj.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.INTERACTION_RANGE) {
            nearInteractable = obj;
        }
    });

    // Update zombies
    updateZombies(dt);

    // Update bullets
    updateBullets(dt);

    // Update particles
    updateParticles(dt);

    // Update messages
    messages = messages.filter(m => {
        m.timer -= dt;
        m.alpha = Math.min(1, m.timer);
        return m.timer > 0;
    });

    // Screen shake decay
    if (screenShake > 0) screenShake -= dt * 2;

    // Check game over
    if (player.hp <= 0) {
        state = GameState.GAME_OVER;
    }
}


// --- Funcion JS #1 del documento: moverJugador(jugador, teclas, deltaTime) ---
function movePlayer(dt) {
    let dx = 0, dy = 0;
    if (keys['w']) dy = -1;
    if (keys['s']) dy = 1;
    if (keys['a']) dx = -1;
    if (keys['d']) dx = 1;

    // Normalizar diagonal
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }

    const newX = player.x + dx * CONFIG.PLAYER_SPEED * dt;
    const newY = player.y + dy * CONFIG.PLAYER_SPEED * dt;

    // Colision con tiles
    if (!isSolid(newX, player.y)) player.x = newX;
    if (!isSolid(player.x, newY)) player.y = newY;
}

function isSolid(x, y) {
    const col = Math.floor(x / CONFIG.TILE_SIZE);
    const row = Math.floor(y / CONFIG.TILE_SIZE);
    if (row < 0 || row >= ROOM_ROWS || col < 0 || col >= ROOM_COLS) return true;
    const tile = tilemap[row][col];
    return tile === 1 || tile === 2;
}

// --- Funcion JS #5 del documento: moverZombieHacia(zombie, objetivo, deltaTime) ---
function updateZombies(dt) {
    zombies.forEach(z => {
        if (z.isDead) {
            z.deathTimer -= dt;
            return;
        }
        if (z.hitFlash > 0) z.hitFlash -= dt;
        if (z.attackCooldown > 0) z.attackCooldown -= dt;

        // Mover hacia jugador
        const dx = player.x - z.x;
        const dy = player.y - z.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 30) {
            const dirX = dx / dist;
            const dirY = dy / dist;
            const newX = z.x + dirX * z.speed * dt;
            const newY = z.y + dirY * z.speed * dt;
            if (!isSolid(newX, z.y)) z.x = newX;
            if (!isSolid(z.x, newY)) z.y = newY;
        }

        z.rotation = Math.atan2(dy, dx);

        // Atacar jugador si esta cerca
        if (dist < 30 && z.attackCooldown <= 0) {
            player.hp -= CONFIG.ZOMBIE_DAMAGE;
            z.attackCooldown = CONFIG.ZOMBIE_ATTACK_COOLDOWN;
            screenShake = 0.2;
            spawnBloodParticles(player.x, player.y);
            addMessage("¡Te han golpeado!", 1);
        }
    });
}


// --- Funcion JS #3 del documento: detectarColision(entidadA, entidadB) ---
function updateBullets(dt) {
    bullets.forEach(b => {
        b.x += b.dx * dt;
        b.y += b.dy * dt;
        b.life -= dt;

        // Si la bala acierta y llega al target
        if (b.hit && b.target) {
            const dx = b.x - b.target.x;
            const dy = b.y - b.target.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < b.target.radius + 5) {
                damageZombie(b.target, CONFIG.GUN_DAMAGE);
                spawnBloodParticles(b.target.x, b.target.y);
                b.life = 0;
            }
        }
    });
    bullets = bullets.filter(b => b.life > 0);
}

function updateParticles(dt) {
    particles.forEach(p => {
        p.x += p.dx * dt;
        p.y += p.dy * dt;
        p.dx *= 0.95;
        p.dy *= 0.95;
        p.life -= dt;
    });
    particles = particles.filter(p => p.life > 0);
}


// --- RENDER ---
function render() {
    ctx.save();

    // Screen shake
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake * 20;
        const shakeY = (Math.random() - 0.5) * screenShake * 20;
        ctx.translate(shakeX, shakeY);
    }

    // Limpiar
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    if (state === GameState.TITLE) {
        renderTitle();
        ctx.restore();
        return;
    }

    if (state === GameState.INTRO) {
        renderIntro();
        ctx.restore();
        return;
    }

    // Renderizar escena
    renderTilemap();
    renderInteractables();
    renderZombies();
    renderPlayer();
    renderBullets();
    renderParticles();
    renderUI();

    // Overlays
    if (state === GameState.DOCUMENT) renderDocumentOverlay();
    if (state === GameState.WEAPON_CHOICE) renderWeaponChoice();
    if (state === GameState.GAME_OVER) renderGameOver();
    if (state === GameState.WIN) renderWin();

    ctx.restore();
}


// --- RENDER FUNCTIONS ---
function renderTitle() {
    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Scanlines effect
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let i = 0; i < CONFIG.CANVAS_HEIGHT; i += 3) {
        ctx.fillRect(0, i, CONFIG.CANVAS_WIDTH, 1);
    }

    // Title
    ctx.textAlign = 'center';
    ctx.font = 'bold 48px "Special Elite", serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('HOTLINE', CONFIG.CANVAS_WIDTH / 2, 180);
    ctx.fillStyle = '#b30000';
    ctx.font = 'bold 56px "Special Elite", serif';
    ctx.fillText('RACOON CITY', CONFIG.CANVAS_WIDTH / 2, 240);

    // Subtitle
    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('SURVIVAL HORROR • TOP-DOWN', CONFIG.CANVAS_WIDTH / 2, 290);

    // Press enter
    const alpha = 0.5 + Math.sin(Date.now() / 500) * 0.5;
    ctx.globalAlpha = alpha;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#b30000';
    ctx.fillText('PRESIONA ENTER PARA COMENZAR', CONFIG.CANVAS_WIDTH / 2, 380);
    ctx.globalAlpha = 1;
}

function renderIntro() {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillStyle = '#999';

    const lines = [
        "La ciudad ha caído.",
        "Buscas refugio en la comisaría del distrito.",
        "Al entrar a la recepción, el silencio lo dice todo...",
        ""
    ];

    const alpha = Math.min(1, introTimer / 2);
    ctx.globalAlpha = alpha;
    lines.forEach((line, i) => {
        ctx.fillText(line, CONFIG.CANVAS_WIDTH / 2, 200 + i * 30);
    });
    ctx.globalAlpha = 1;
}


function renderTilemap() {
    for (let row = 0; row < ROOM_ROWS; row++) {
        for (let col = 0; col < ROOM_COLS; col++) {
            const tile = tilemap[row][col];
            const x = col * CONFIG.TILE_SIZE;
            const y = row * CONFIG.TILE_SIZE;

            switch (tile) {
                case 0: // Piso
                    ctx.fillStyle = '#2a2520';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    // Detalle de baldosa
                    ctx.strokeStyle = '#1f1b17';
                    ctx.strokeRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    // Variacion sutil
                    if ((row + col) % 3 === 0) {
                        ctx.fillStyle = 'rgba(0,0,0,0.1)';
                        ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    }
                    break;
                case 1: // Pared
                    ctx.fillStyle = '#4a4035';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    // Borde inferior de pared (profundidad)
                    ctx.fillStyle = '#3a3025';
                    ctx.fillRect(x, y + CONFIG.TILE_SIZE - 6, CONFIG.TILE_SIZE, 6);
                    // Linea de moldura
                    ctx.fillStyle = '#5a5045';
                    ctx.fillRect(x, y + CONFIG.TILE_SIZE - 8, CONFIG.TILE_SIZE, 2);
                    break;
                case 2: // Mostrador
                    ctx.fillStyle = '#2a2520';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.fillStyle = '#5c3d2e';
                    ctx.fillRect(x + 2, y + 2, CONFIG.TILE_SIZE - 4, CONFIG.TILE_SIZE - 4);
                    ctx.fillStyle = '#6b4a38';
                    ctx.fillRect(x + 4, y + 4, CONFIG.TILE_SIZE - 8, CONFIG.TILE_SIZE - 8);
                    break;
                case 3: // Puerta entrada
                    ctx.fillStyle = '#2a2520';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.fillStyle = '#1a3a1a';
                    ctx.fillRect(x + 4, y, CONFIG.TILE_SIZE - 8, CONFIG.TILE_SIZE);
                    // Manija
                    ctx.fillStyle = '#aa8833';
                    ctx.beginPath();
                    ctx.arc(x + CONFIG.TILE_SIZE / 2 + 8, y + CONFIG.TILE_SIZE / 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 5: // Escritorio
                    ctx.fillStyle = '#2a2520';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.fillStyle = '#4a3828';
                    ctx.fillRect(x + 3, y + 5, CONFIG.TILE_SIZE - 6, CONFIG.TILE_SIZE - 10);
                    ctx.fillStyle = '#3a2818';
                    ctx.fillRect(x + 5, y + 8, CONFIG.TILE_SIZE - 10, CONFIG.TILE_SIZE - 16);
                    break;
                case 6: // Silla
                    ctx.fillStyle = '#2a2520';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
                    ctx.fillStyle = '#333';
                    ctx.beginPath();
                    ctx.arc(x + CONFIG.TILE_SIZE / 2, y + CONFIG.TILE_SIZE / 2, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#222';
                    ctx.beginPath();
                    ctx.arc(x + CONFIG.TILE_SIZE / 2, y + CONFIG.TILE_SIZE / 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                default:
                    ctx.fillStyle = '#2a2520';
                    ctx.fillRect(x, y, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE);
            }
        }
    }
}


function renderInteractables() {
    interactables.forEach(obj => {
        if (obj.inspected) return;

        if (obj.type === 'body') {
            // Agente M - cuerpo en el suelo
            ctx.save();
            ctx.translate(obj.x, obj.y);
            // Cuerpo acostado
            ctx.fillStyle = '#1a2a4a'; // Uniforme azul oscuro
            ctx.fillRect(-15, -6, 30, 12);
            // Cabeza (piel oscura)
            ctx.fillStyle = '#4a3228';
            ctx.beginPath();
            ctx.arc(-18, 0, 6, 0, Math.PI * 2);
            ctx.fill();
            // Charco de sangre
            ctx.fillStyle = 'rgba(120, 0, 0, 0.6)';
            ctx.beginPath();
            ctx.ellipse(5, 8, 12, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Indicador E si esta cerca
            if (nearInteractable === obj) {
                renderInteractHint(obj.x, obj.y - 25);
            }
        }

        if (obj.type === 'document') {
            // Carta sobre mostrador
            ctx.save();
            ctx.translate(obj.x, obj.y);
            // Papel
            ctx.fillStyle = '#d4c87a';
            ctx.fillRect(-8, -10, 16, 20);
            // Lineas de texto
            ctx.fillStyle = '#8a7a3a';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(-5, -6 + i * 5, 10, 1);
            }
            ctx.restore();

            if (nearInteractable === obj) {
                renderInteractHint(obj.x, obj.y - 20);
            }
        }
    });
}

function renderInteractHint(x, y) {
    const pulse = 0.7 + Math.sin(Date.now() / 300) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('[E]', x, y);
    ctx.globalAlpha = 1;
}


function renderPlayer() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.rotation);

    // Cuerpo
    ctx.fillStyle = '#3a5a3a'; // Chaqueta verde oscuro (civil)
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // Detalle cuerpo interior
    ctx.fillStyle = '#2a4a2a';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius - 4, 0, Math.PI * 2);
    ctx.fill();

    // Cabeza
    ctx.fillStyle = '#c4a882';
    ctx.beginPath();
    ctx.arc(4, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    // Arma
    if (player.weapon === 'pistol') {
        ctx.fillStyle = '#333';
        ctx.fillRect(12, -2, 12, 4);
        ctx.fillStyle = '#222';
        ctx.fillRect(22, -1.5, 4, 3);
    } else if (player.weapon === 'knife') {
        // Knife con swing animation
        const swingAngle = player.knifeSwing * 0.8;
        ctx.save();
        ctx.rotate(swingAngle);
        ctx.fillStyle = '#888';
        ctx.fillRect(12, -1.5, 14, 3);
        // Filo
        ctx.fillStyle = '#bbb';
        ctx.beginPath();
        ctx.moveTo(26, -1.5);
        ctx.lineTo(30, 0);
        ctx.lineTo(26, 1.5);
        ctx.fill();
        ctx.restore();
    }

    // Indicador de direccion (triangulito frontal)
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(player.radius + 2, 0);
    ctx.lineTo(player.radius - 4, -4);
    ctx.lineTo(player.radius - 4, 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // HP bar encima del jugador
    const hpPercent = player.hp / CONFIG.PLAYER_HP;
    ctx.fillStyle = '#333';
    ctx.fillRect(player.x - 15, player.y - 25, 30, 4);
    ctx.fillStyle = hpPercent > 0.5 ? '#4a4' : hpPercent > 0.25 ? '#aa4' : '#a44';
    ctx.fillRect(player.x - 15, player.y - 25, 30 * hpPercent, 4);
}


function renderZombies() {
    zombies.forEach(z => {
        if (z.deathTimer <= 0 && z.isDead) return;

        ctx.save();
        ctx.translate(z.x, z.y);

        if (z.isDead) {
            // Cuerpo muerto
            ctx.globalAlpha = Math.min(1, z.deathTimer);
            ctx.fillStyle = '#3a2020';
            ctx.beginPath();
            ctx.ellipse(0, 0, 14, 8, z.rotation, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(80,0,0,0.5)';
            ctx.beginPath();
            ctx.ellipse(3, 3, 10, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }

        ctx.rotate(z.rotation);

        // Hit flash
        if (z.hitFlash > 0) {
            ctx.fillStyle = '#ff4444';
        } else {
            ctx.fillStyle = '#4a5a3a'; // Piel zombie verdosa
        }
        
        // Cuerpo
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();

        // Ropa desgarrada
        ctx.fillStyle = z.hitFlash > 0 ? '#ff6666' : '#3a3a2a';
        ctx.beginPath();
        ctx.arc(0, 0, z.radius - 4, 0, Math.PI * 2);
        ctx.fill();

        // Cabeza zombie
        ctx.fillStyle = z.hitFlash > 0 ? '#ff8888' : '#6a7a5a';
        ctx.beginPath();
        ctx.arc(5, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // Ojos rojos
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(8, -2, 1.5, 0, Math.PI * 2);
        ctx.arc(8, 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Brazos extendidos (pose zombie)
        ctx.fillStyle = z.hitFlash > 0 ? '#ff6666' : '#5a6a4a';
        ctx.fillRect(8, -8, 10, 3);
        ctx.fillRect(8, 5, 10, 3);

        ctx.restore();

        // HP bar
        if (z.hp < z.maxHp) {
            const hpPercent = z.hp / z.maxHp;
            ctx.fillStyle = '#333';
            ctx.fillRect(z.x - 12, z.y - 22, 24, 3);
            ctx.fillStyle = '#b30000';
            ctx.fillRect(z.x - 12, z.y - 22, 24 * hpPercent, 3);
        }

        // Target indicator
        if (player.target === z) {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(z.x, z.y, z.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineWidth = 1;
        }
    });
}


function renderBullets() {
    bullets.forEach(b => {
        ctx.fillStyle = b.hit ? '#ffcc00' : '#ff6600';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        // Trail
        ctx.fillStyle = b.hit ? 'rgba(255,200,0,0.3)' : 'rgba(255,100,0,0.3)';
        ctx.beginPath();
        ctx.arc(b.x - b.dx * 0.01, b.y - b.dy * 0.01, 2, 0, Math.PI * 2);
        ctx.fill();
    });
}

function renderParticles() {
    particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}


function renderUI() {
    // HUD superior
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, 35);

    ctx.textAlign = 'left';
    ctx.font = '12px Inter, sans-serif';

    // HP
    ctx.fillStyle = '#888';
    ctx.fillText('VIDA:', 10, 22);
    const hpPercent = Math.max(0, player.hp / CONFIG.PLAYER_HP);
    ctx.fillStyle = '#333';
    ctx.fillRect(50, 14, 100, 12);
    ctx.fillStyle = hpPercent > 0.5 ? '#4a4' : hpPercent > 0.25 ? '#aa4' : '#a44';
    ctx.fillRect(50, 14, 100 * hpPercent, 12);

    // Arma actual
    ctx.fillStyle = '#888';
    ctx.fillText('ARMA:', 170, 22);
    ctx.fillStyle = '#fff';
    if (player.weapon === 'pistol') {
        ctx.fillText('Pistola M19 [40% acierto]', 210, 22);
    } else if (player.weapon === 'knife') {
        ctx.fillText('Cuchillo Táctico [100% melee]', 210, 22);
    } else {
        ctx.fillText('Ninguna', 210, 22);
    }

    // Zombies restantes
    if (zombiesSpawned) {
        const alive = zombies.filter(z => !z.isDead).length;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#b30000';
        ctx.fillText(`ZOMBIES: ${alive}/3`, CONFIG.CANVAS_WIDTH - 10, 22);
    }

    // Target indicator
    if (player.weapon === 'pistol' && state === GameState.COMBAT) {
        ctx.textAlign = 'right';
        ctx.fillStyle = player.target ? '#ff4444' : '#666';
        ctx.fillText(player.target ? '◎ OBJETIVO FIJADO' : '◎ Click Der. para apuntar', CONFIG.CANVAS_WIDTH - 10, CONFIG.CANVAS_HEIGHT - 10);
    }

    // Mensajes
    ctx.textAlign = 'center';
    messages.forEach((m, i) => {
        ctx.globalAlpha = m.alpha;
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = '#ffcc00';
        ctx.fillText(m.text, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT - 40 - i * 20);
    });
    ctx.globalAlpha = 1;

    // Interact hint
    if (nearInteractable && !nearInteractable.inspected) {
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#aaa';
        ctx.fillText(`Presiona E: ${nearInteractable.label}`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT - 15);
    }
}


// --- Funcion JS #4 del documento: mostrarDocumento(contenido, callback) ---
function renderDocumentOverlay() {
    // Fondo oscuro
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Papel
    const paperX = CONFIG.CANVAS_WIDTH / 2 - 200;
    const paperY = 60;
    const paperW = 400;
    const paperH = 350;

    ctx.fillStyle = '#f4e8c1';
    ctx.fillRect(paperX, paperY, paperW, paperH);
    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(paperX + 5, paperY + 5, paperW, paperH);
    ctx.fillStyle = '#f4e8c1';
    ctx.fillRect(paperX, paperY, paperW, paperH);

    // Borde desgastado
    ctx.strokeStyle = '#c4a87a';
    ctx.strokeRect(paperX, paperY, paperW, paperH);

    // Texto del documento
    ctx.textAlign = 'left';
    ctx.font = '14px "Special Elite", serif';
    ctx.fillStyle = '#2a2a1a';

    const docLines = [
        "NOTA URGENTE",
        "",
        "Si alguien lee esto:",
        "",
        "El Agente M no lo logro. Yo fui tras ellos.",
        "Trata de salir por la puerta trasera de la",
        "comisaria; imagino que la entrada debe estar",
        "llena de ellos.",
        "",
        "Busca la llave en la oficina del segundo",
        "piso. Si llegas ahi, tal vez nos",
        "encontremos.",
        "",
        "",
        "",
        "",
        "",
        "                              — LSK"
    ];

    docLines.forEach((line, i) => {
        if (i === 0) {
            ctx.font = 'bold 16px "Special Elite", serif';
            ctx.fillStyle = '#8a0000';
        } else {
            ctx.font = '14px "Special Elite", serif';
            ctx.fillStyle = '#2a2a1a';
        }
        ctx.fillText(line, paperX + 30, paperY + 40 + i * 18);
    });

    // Hint para cerrar
    ctx.textAlign = 'center';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#ffcc00';
    const pulse = 0.5 + Math.sin(Date.now() / 400) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.fillText('Presiona E para cerrar', CONFIG.CANVAS_WIDTH / 2, paperY + paperH + 30);
    ctx.globalAlpha = 1;
}


function renderWeaponChoice() {
    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.font = '18px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Encuentras las armas del Agente M.', CONFIG.CANVAS_WIDTH / 2, 150);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Solo puedes llevar una. Elige sabiamente.', CONFIG.CANVAS_WIDTH / 2, 180);

    // Opcion 1: Pistola
    const opt1X = CONFIG.CANVAS_WIDTH / 2 - 150;
    const opt2X = CONFIG.CANVAS_WIDTH / 2 + 50;
    const optY = 220;
    const optW = 120;
    const optH = 150;

    // Card pistola
    ctx.fillStyle = '#1a1a2a';
    ctx.strokeStyle = '#4a4a6a';
    ctx.fillRect(opt1X, optY, optW, optH);
    ctx.strokeRect(opt1X, optY, optW, optH);

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('[1] PISTOLA', opt1X + optW / 2, optY + 25);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Rango: Largo', opt1X + optW / 2, optY + 50);
    ctx.fillText('Acierto: 40%', opt1X + optW / 2, optY + 68);
    ctx.fillStyle = '#b30000';
    ctx.fillText('Puedes fallar', opt1X + optW / 2, optY + 90);

    // Dibujo pistola
    ctx.fillStyle = '#555';
    ctx.fillRect(opt1X + 40, optY + 105, 40, 8);
    ctx.fillRect(opt1X + 55, optY + 108, 10, 18);

    // Card cuchillo
    ctx.fillStyle = '#1a2a1a';
    ctx.strokeStyle = '#4a6a4a';
    ctx.fillRect(opt2X, optY, optW, optH);
    ctx.strokeRect(opt2X, optY, optW, optH);

    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('[2] CUCHILLO', opt2X + optW / 2, optY + 25);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Rango: Melee', opt2X + optW / 2, optY + 50);
    ctx.fillText('Acierto: 100%', opt2X + optW / 2, optY + 68);
    ctx.fillStyle = '#b30000';
    ctx.fillText('Debes acercarte', opt2X + optW / 2, optY + 90);

    // Dibujo cuchillo
    ctx.fillStyle = '#888';
    ctx.fillRect(opt2X + 45, optY + 105, 30, 5);
    ctx.fillStyle = '#553311';
    ctx.fillRect(opt2X + 40, optY + 103, 12, 9);
}


function renderGameOver() {
    ctx.fillStyle = 'rgba(80,0,0,0.85)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.font = 'bold 48px "Special Elite", serif';
    ctx.fillStyle = '#ff0000';
    ctx.fillText('HAS MUERTO', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 20);

    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('La comisaría cobra otra víctima.', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 20);

    const pulse = 0.5 + Math.sin(Date.now() / 500) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText('Presiona ENTER para reintentar', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 70);
    ctx.globalAlpha = 1;
}

function renderWin() {
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    ctx.textAlign = 'center';
    ctx.font = 'bold 36px "Special Elite", serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('AREA DESPEJADA', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 - 40);

    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('La recepción está segura... por ahora.', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 10);
    ctx.fillText('LSK mencionó el segundo piso...', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 35);

    ctx.font = 'bold 20px "Special Elite", serif';
    ctx.fillStyle = '#b30000';
    ctx.fillText('CONTINUARÁ...', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 80);

    const pulse = 0.5 + Math.sin(Date.now() / 500) * 0.5;
    ctx.globalAlpha = pulse;
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('Presiona ENTER para volver al título', CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2 + 120);
    ctx.globalAlpha = 1;
}

// --- INICIALIZAR ---
window.addEventListener('load', init);
