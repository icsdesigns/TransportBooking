# TransportBooking · Tren o bus Salamanca–Madrid (PWA)

## Qué hay en esta carpeta
- `index.html`: la interfaz.
- `data.js`: los datos (paradas oficiales; horarios y ocupación de ejemplo). La usan la página y el service worker.
- `sw.js`: el service worker. Permite abrir la app sin conexión, muestra las notificaciones en Android y revisa los avisos en segundo plano.
- `manifest.webmanifest` e `icons/`: el nombre, los colores y los iconos de la app instalada.

## 1. Publicarla con HTTPS
Android solo instala la app y permite notificaciones si se abre desde una dirección `https://`.
Hay que subir la carpeta **entera**, no solo index.html.

**Opción A. Netlify Drop (la más rápida)**
1. Entra en https://app.netlify.com/drop e inicia sesión (basta la cuenta gratuita).
2. Arrastra esta carpeta `pwa` a la página.
3. Te dará una dirección del tipo `https://nombre.netlify.app`. Esa es tu app.

**Opción B. GitHub Pages**
1. Crea un repositorio y sube el contenido de esta carpeta.
2. En Settings → Pages, elige la rama `main` y la carpeta raíz.
3. La app queda en `https://TU_USUARIO.github.io/NOMBRE_REPO/`.

## 2. Instalarla en el móvil
1. Abre la dirección en **Chrome** para Android.
2. Pulsa «Instalar app» en la cabecera, o en el menú ⋮ elige «Instalar aplicación».
3. El icono aparecerá en la pantalla de inicio.

## 3. Activar las notificaciones
1. Abre la app, busca una salida completa y pulsa «Completo · Avísame».
2. Acepta el permiso de notificaciones, o pulsa «Activar notificaciones del sistema» en «Mis avisos».
3. Para probarlo, pulsa «Probar aviso» en «Mis avisos» y sal a la pantalla de inicio. Te llegará la notificación, y al tocarla se abrirá la app en esa salida.

## Cuándo llegan los avisos
| Situación | ¿Avisa? |
|---|---|
| App abierta | Sí, revisa cada 20 segundos |
| App en segundo plano durante poco tiempo | Sí, hasta que Android la pausa (unos minutos) |
| App cerrada | Solo cuando Android permite la revisión en segundo plano. En apps instaladas y de uso frecuente suele ser unas pocas veces al día |
| App cerrada con aviso inmediato | Necesita un servidor de notificaciones push (ver abajo) |

## Siguiente paso: avisos inmediatos con la app cerrada
El service worker ya está preparado para recibir notificaciones push (evento `push` en `sw.js`).
Falta un servidor pequeño, por ejemplo un Cloudflare Worker o una función de Netlify con tarea programada, que:
1. guarde la suscripción push de tu móvil y tus avisos;
2. consulte cada pocos minutos las plazas en Renfe y Monbus (hace falta una fuente de datos real);
3. envíe la notificación push cuando se libere una plaza.

Mientras los datos sean de ejemplo, las cancelaciones son simuladas.
