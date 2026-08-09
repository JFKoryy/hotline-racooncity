"""
HOTLINE RACOONCITY - Backend Python
Servidor que expone las funciones de logica del juego como API REST.
Las 5 funciones Python del documento se implementan aqui y son consumidas por el frontend.
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import random

# ============================================================
# FUNCION 1: calcular_probabilidad_acierto(nivel_experiencia)
# Calcula la probabilidad de que un disparo acierte segun el
# progreso del jugador.
# ============================================================
def calcular_probabilidad_acierto(nivel_experiencia):
    """
    Calcula la probabilidad de acierto basada en la experiencia.
    Nivel 1 = 40%, incrementa hasta 80% en nivel 10.
    """
    base = 0.40
    incremento = 0.04  # 4% por nivel
    maximo = 0.80
    probabilidad = base + (nivel_experiencia - 1) * incremento
    return min(probabilidad, maximo)


# ============================================================
# FUNCION 2: intentar_disparo(probabilidad)
# Simula un disparo y determina si acierta o falla.
# ============================================================
def intentar_disparo(probabilidad):
    """
    Simula un disparo. Retorna True si acierta, False si falla.
    Usa random.random() que genera un float entre 0 y 1.
    """
    resultado = random.random()
    acierto = resultado <= probabilidad
    return {
        "acierto": acierto,
        "resultado": round(resultado, 4),
        "probabilidad": probabilidad
    }


# ============================================================
# FUNCION 3: gestionar_inventario(inventario, arma_nueva, arma_actual)
# Implementa el sistema de arma unica.
# ============================================================
def gestionar_inventario(arma_nueva, arma_actual):
    """
    Gestiona el sistema de arma unica.
    Si el jugador no tiene arma, la toma automaticamente.
    Si ya tiene una, retorna las opciones para elegir.
    """
    if arma_actual is None:
        return {
            "accion": "tomar",
            "mensaje": f"Has tomado: {arma_nueva['nombre']}",
            "arma_equipada": arma_nueva
        }
    else:
        return {
            "accion": "elegir",
            "mensaje": "Ya tienes un arma equipada.",
            "actual": arma_actual,
            "nueva": arma_nueva,
            "opciones": ["mantener", "cambiar"]
        }


# ============================================================
# FUNCION 4: cargar_documento(id_documento, documentos_db)
# Busca y retorna un documento narrativo desde la base de datos.
# ============================================================
DOCUMENTOS_DB = {
    "nota_recepcion": {
        "autor": "LSK",
        "texto": ("Si alguien lee esto: el Agente M no lo logro. "
                  "Yo fui tras ellos. Trata de salir por la puerta "
                  "trasera de la comisaria; imagino que la entrada "
                  "debe estar llena de ellos. Busca la llave en la "
                  "oficina del segundo piso. Si llegas ahi, tal vez "
                  "nos encontremos."),
        "pista": "Busca la llave en la oficina del segundo piso."
    },
    "nota_oficina": {
        "autor": "LSK",
        "texto": "La llave estaba aqui. Voy al sotano. Hay algo abajo.",
        "pista": "El sotano esconde algo."
    }
}


def cargar_documento(id_documento):
    """
    Busca un documento por su ID en la base de datos.
    Retorna el contenido si existe, o un mensaje de error.
    """
    documento = DOCUMENTOS_DB.get(id_documento)
    if documento:
        return {
            "encontrado": True,
            "autor": documento["autor"],
            "contenido": documento["texto"],
            "pista": documento.get("pista", None)
        }
    return {"encontrado": False, "mensaje": "Documento ilegible..."}


# ============================================================
# FUNCION 5: calcular_dano(arma, enemigo)
# Calcula el dano infligido considerando tipo de arma y
# resistencia del enemigo.
# ============================================================
def calcular_dano(arma, enemigo):
    """
    Calcula el dano real aplicado a un enemigo.
    Dano = dano_base del arma - resistencia del enemigo.
    Minimo 1 de dano (siempre hace algo si acierta).
    """
    dano_base = arma["dano"]
    resistencia = enemigo.get("resistencia", 0)
    dano_real = max(1, dano_base - resistencia)

    hp_restante = max(0, enemigo["hp"] - dano_real)
    eliminado = hp_restante <= 0

    return {
        "dano_infligido": dano_real,
        "hp_restante": hp_restante,
        "eliminado": eliminado
    }


# ============================================================
# SERVIDOR HTTP
# ============================================================
class GameHandler(BaseHTTPRequestHandler):
    """Maneja las peticiones del frontend del juego."""

    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        """Procesa peticiones POST con datos JSON."""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body) if body else {}

        response = None

        if self.path == '/api/probabilidad':
            nivel = data.get('nivel_experiencia', 1)
            prob = calcular_probabilidad_acierto(nivel)
            response = {"probabilidad": prob}

        elif self.path == '/api/disparo':
            prob = data.get('probabilidad', 0.40)
            response = intentar_disparo(prob)

        elif self.path == '/api/inventario':
            arma_nueva = data.get('arma_nueva')
            arma_actual = data.get('arma_actual')
            response = gestionar_inventario(arma_nueva, arma_actual)

        elif self.path == '/api/documento':
            id_doc = data.get('id_documento', '')
            response = cargar_documento(id_doc)

        elif self.path == '/api/dano':
            arma = data.get('arma')
            enemigo = data.get('enemigo')
            response = calcular_dano(arma, enemigo)

        else:
            self.send_response(404)
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Ruta no encontrada"}).encode())
            return

        self.send_response(200)
        self._set_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def do_GET(self):
        """Sirve archivos estaticos y la API."""
        if self.path == '/api/status':
            self.send_response(200)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "running",
                "juego": "Hotline RacoonCity",
                "funciones_disponibles": [
                    "calcular_probabilidad_acierto",
                    "intentar_disparo",
                    "gestionar_inventario",
                    "cargar_documento",
                    "calcular_dano"
                ]
            }).encode())
            return

        # Servir archivos estaticos
        file_path = self.path.lstrip('/')
        if file_path == '' or file_path == '/':
            file_path = 'index.html'

        content_types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg'
        }

        ext = '.' + file_path.split('.')[-1] if '.' in file_path else '.html'
        content_type = content_types.get(ext, 'text/plain')

        try:
            mode = 'rb' if ext in ['.png', '.jpg'] else 'r'
            with open(file_path, mode) as f:
                content = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            if isinstance(content, str):
                self.wfile.write(content.encode())
            else:
                self.wfile.write(content)
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')

    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, format, *args):
        """Log personalizado."""
        print(f"[SERVIDOR] {args[0]}")


def main():
    """Inicia el servidor en puerto 8000."""
    port = 8000
    server = HTTPServer(('localhost', port), GameHandler)
    print(f"╔══════════════════════════════════════════╗")
    print(f"║   HOTLINE RACOONCITY - Servidor Python   ║")
    print(f"║   http://localhost:{port}                  ║")
    print(f"╚══════════════════════════════════════════╝")
    print(f"\nFunciones Python activas:")
    print(f"  POST /api/probabilidad  → calcular_probabilidad_acierto()")
    print(f"  POST /api/disparo       → intentar_disparo()")
    print(f"  POST /api/inventario    → gestionar_inventario()")
    print(f"  POST /api/documento     → cargar_documento()")
    print(f"  POST /api/dano          → calcular_dano()")
    print(f"\nPresiona Ctrl+C para detener.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()


if __name__ == '__main__':
    main()
