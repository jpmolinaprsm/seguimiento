# Despliegue del Tablero de optimización en Railway

Para Juan Pablo. Acá van solo **nombres** de variables y para qué sirven. Los valores se cargan en el panel de Railway (pestaña Variables) y **nunca** en un chat, un archivo ni GitHub.

## Qué es lo que se despliega
- El servidor es `server.js` (script `npm start`). Pide inicio de sesión con Google en todas las rutas, salvo `/salud` (sin datos) y la pantalla "Entrar con Google".
- Cada persona recibe una página armada **solo con sus proyectos y canales**: lo demás no sale del servidor.
- `app/servir.js` sigue siendo el servidor local de tu compu (sin login); no se usa en Railway.
- El HTML armado (`app/Seguimiento y Optimizacion.html`) **no está en GitHub** (pesa ~48 MB). Lo deja en el volumen la actualización diaria (la arma Extracción). Hasta que exista, el servidor arranca y muestra "Sin datos todavía" (o, si ya hay una actualización en curso, "Se están armando los datos. Volvé en unos minutos." con la hora de inicio). Para la primera prueba hay que copiarlo al volumen a mano.

## Pasos en Railway
1. En Railway (cuenta de la empresa): **New Project → Deploy from GitHub repo** → `prosumia-op/optimizacion-pauta` (repo privado; Railway pide autorizar el acceso a ese repo).
2. En el servicio: **Settings → Root Directory** = la raíz del repo (`Seguimiento/` es el repo; si en GitHub quedara dentro de una subcarpeta, poner esa subcarpeta). Build: automático (`npm ci`). Start: `npm start`.
3. **Volumen:** Service → **Volumes → New Volume**, punto de montaje `/data`. Sirve para el HTML armado y, mientras no esté la base, para respuestas y pedidos. Cargar `DATOS_DIR=/data/repositorio` y `HTML_ARMADO=/data/armado/Seguimiento y Optimizacion.html`.
4. **Variables:** cargar las de la tabla de abajo. Después **Apply changes / Deploy**.
5. **Dominio:** Settings → Networking → **Generate Domain** (o un dominio propio). Con esa dirección completar `URL_BASE` (con `https://`, sin barra al final) y volver a desplegar.
6. **Google Cloud Console → Credenciales → cliente OAuth** (tipo "Aplicación web"; conviene uno propio de este módulo): en **URI de redireccionamiento autorizados** agregar `URL_BASE` + `/auth/google/callback`. En local de prueba no hace falta (se usa el modo prueba).
7. **Salud:** abrir `URL_BASE/salud` → tiene que decir `{"ok":true}`. Después entrar a `URL_BASE`: te lleva a "Entrar con Google".
8. Ambiente de prueba (staging) con `NEXO_ENVIO` sin cargar y solo tu mail en la lista de accesos, antes de abrirlo al equipo.

## Variables
| Variable | Para qué | Obligatoria |
|---|---|---|
| `NODE_ENV` | Poner `production`. Con eso se apaga el modo prueba y la cookie queda solo para https | Sí |
| `URL_BASE` | Dirección pública del tablero (arma el regreso de Google) | Sí |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente OAuth de Google para el inicio de sesión | Sí |
| `AUTH_DOMINIO` | Dominio de la empresa: solo entran mails de ese dominio | Sí |
| `SESSION_SECRET` | Firma de la cookie de sesión: texto al azar de 32 caracteres o más. Si se cambia, todos tienen que volver a entrar | Sí |
| `DATOS_DIR` | Carpeta (del volumen) donde se guardan respuestas y pedidos mientras no esté la base | Sí, con volumen |
| `HTML_ARMADO` | Ruta (del volumen) del HTML armado del día | Sí, con volumen |
| `NEXO_URL` | Dirección de PAUTADOR para la consulta de accesos y los pedidos | Sí |
| `NEXO_MODO` | `real` para consultar accesos a PAUTADOR (sin esto, solo la lista provisoria) | Sí |
| `NEXO_CLAVE` | Clave compartida con PAUTADOR (la misma que `SERVICIO_CLAVE_SEGUIMIENTO` allá) | Sí |
| `NEXO_ENVIO` | **Arranca sin cargar.** Con `1` se envían pedidos de cambio a PAUTADOR; sin cargar, el botón "pedir un cambio" queda en "solo ver" y explica por qué. Se prende cuando Auditoría lo apruebe | No (hasta el visto bueno) |
| `NEXO_ACCESOS_JSON` | Plan B: lista provisoria de accesos (con mails), con el formato `{ "generada_el": "AAAA-MM-DD", "accesos": [...] }`. Se usa si la consulta a PAUTADOR está apagada o no contesta (timeout, error 5xx, demasiadas consultas), pero **solo si `generada_el` es de hace 7 días o menos**; sin fecha o vencida, nadie entra. Si PAUTADOR rechaza la clave (401/403) tampoco se usa. Se descarta al conectar | Solo plan B |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Base de Seguimiento: si están, las respuestas del equipo van a la base; si no, a archivos del volumen | Cuando exista la base |
| `ACTUALIZACION_AUTOMATICA` | `0` apaga el disparo automático de la actualización diaria; `1` lo prende; sin cargar, queda prendido solo con `NODE_ENV=production` | No |
| `BQ_CREDENTIALS_JSON`, `SHEETS_CREDENTIALS_JSON` | Claves de BigQuery y Sheets: no las usa el servidor web sino la actualización diaria, que el servidor lanza como proceso aparte (hereda estas variables) | Para la actualización diaria |

`PORT` lo pone Railway solo. Variable que no existe o está vacía = esa función apagada. Si falta alguna obligatoria, el servidor **no arranca** y el registro dice cuáles faltan.

## Quién ve qué
1. Entra con Google (solo `AUTH_DOMINIO`). 2. El servidor le pregunta a PAUTADOR qué proyectos y canales tiene ese mail (memoria de 5 minutos) y ve **solo implementadores y administradores**. 3. Si PAUTADOR no contesta, usa la lista provisoria (`NEXO_ACCESOS_JSON`); si tampoco hay, nadie ve nada. Si PAUTADOR contesta "dado de baja", no entra aunque esté en la lista. Una baja se nota en 5 minutos como mucho (no hace falta que vuelva a iniciar sesión).

## Para probar en la compu (sin Google)
Con `NODE_ENV` distinto de `production`: `MODO_PRUEBA_USUARIO=un-mail@dominio`, `SESSION_SECRET`, `HTML_ARMADO` si hace falta, y `NEXO_ACCESOS_ARCHIVO`/`NEXO_ACCESOS_JSON` con ese mail → `npm start` → abrir `/prueba/entrar`. En producción esa ruta no existe.
Pruebas: `npm run test:servidor` (o `node app/pruebas/servidor.js` desde `app/`).

<!-- ===== SECCIÓN: Base (agente Recomendaciones, 13/10/2026) ===== -->
## Base

La base real de Seguimiento es un proyecto de Supabase propio, aparte de la de PAUTADOR. Todo lo de "en PowerShell" se hace en una ventana
abierta en `C:\Users\juan.pablo.molina\Desktop\Automatizaciones\Seguimiento`.

**Regla de oro: ninguna clave va a un archivo, a un chat ni a un mail.** Se pegan en el panel de Supabase, en el de Railway, o en
PowerShell con `Read-Host` (no queda en el historial). Si una clave se pega donde no corresponde, se rota.

### A. Crear la base (navegador, unos 10 minutos)
1. supabase.com, organización **Pautador PRO** → **New project**. Nombre `seguimiento`. Región: la de PAUTADOR (si no te acordás, South America (São Paulo)).
2. "Database password": **Generate a password** y guardarla en el gestor de contraseñas. No se usa en ningún otro lado.
3. Esperar a que el proyecto esté listo.
4. **SQL Editor → New query**. Abrir `base\todas-las-migraciones.sql` con el Bloc de notas, copiar **todo**, pegar y **Run**.
   Si pregunta por cambios de permisos, confirmar (es el cierre de seguridad). Al final tiene que mostrar una tabla **sin filas**; si muestra alguna, **frenar y avisar**.
5. En otra consulta: `select version from migraciones order by version;` → tienen que salir **siete** filas (`001_base` a `007_seguridad`).
6. Anotar el **código del proyecto**: lo que va antes de `.supabase.co` en la dirección (Project Settings → General, Reference ID).
7. En Project Settings → API Keys está la clave **secreta** (a veces se llama `service_role`). No se copia a ningún lado todavía.

### B. Comprobar la base (PowerShell)
```powershell
cd C:\Users\juan.pablo.molina\Desktop\Automatizaciones\Seguimiento
$env:SUPABASE_URL = "https://CODIGO.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host "Pegá la clave secreta y Enter"
node base/verificar-base.js
```
Tiene que terminar en `Todo bien: migraciones completas y tablas visibles.` Si dice que la API no ve las tablas, correr en el SQL Editor
`notify pgrst, 'reload schema';` y repetir. Las variables valen solo en esa ventana (cerrarla al terminar). **No usar `--env-file=.env`**:
ese archivo es de la base de PRUEBA.

### C. Carga inicial de `app\repositorio\` (recomendaciones, tipos de campaña, comentarios a reglas, predicciones)
Primero la prueba en seco (no escribe, cuenta lo que haría):
```powershell
node base/cargar-inicial.js
```
Con los archivos del 13/10 debería decir: recomendaciones de 4 días (165, 158, 153, 126), `respuestas.jsonl` de 27 líneas (26 tipos de campaña y 1 decisión) y 579 predicciones.
Si está bien, escribir con el freno `--escribir-en` (el código del paso A6; si no coincide con la dirección de las variables, no escribe):
```powershell
node base/cargar-inicial.js --escribir-en CODIGO
node base/verificar-base.js
```
Se puede repetir sin duplicar. Los días de recomendaciones que la base ya tiene no se pisan (para forzar, `--reemplazar-dias`).

### D. Lo que vive solo en el navegador (decisiones `syo.st`, comentarios de pantalla `syo.comments`, tipos `syo.tipos`, Looker `syo.looker`, firma `syo.autor`)
**Antes: no borrar datos del sitio ni cambiar de navegador o usar ventana privada hasta terminar.** Para cada navegador usado (el tuyo en `localhost:4330` y el de cada compañero con la copia de claude.ai):
1. Con la app abierta, **F12 → Consola**. Si avisa por pegar, escribir `allow pasting` y Enter.
2. Pegar todo `base\exportar-del-navegador.js` y Enter. Pregunta tu mail de trabajo (firma lo que se suba). Baja `syo-export-AAAA-MM-DD.json`.
   (En la copia de claude.ai, la consola tiene que estar en el cuadro de la copia: el menú "top" de la consola se cambia por ese cuadro.)
3. Guardarlo en `app\repositorio\exportaciones-navegador\` (fuera de Git). Tiene comentarios internos: pasarlo por un medio privado.
4. Prueba en seco, y si está bien, escribir con el mismo freno:
```powershell
node base/cargar-navegador.js app\repositorio\exportaciones-navegador\syo-export-AAAA-MM-DD.json
node base/cargar-navegador.js app\repositorio\exportaciones-navegador\syo-export-AAAA-MM-DD.json --escribir-en CODIGO
```

Qué hace con lo que la base rechaza (**propuestas pendientes de Juan Pablo**: lo de `(general)` y el motivo fijo):

| Caso | Qué pasa |
|---|---|
| Autor que no es un mail | Va el mail escrito al exportar; el nombre queda como nombre. Sin mail, "sin identificar" |
| "Hecha a mano" o "descartada" sin motivo (decisiones viejas) | Entra con "Sin motivo registrado (decisión anterior a que el motivo fuera obligatorio)" |
| Decisión de una recomendación que ya no está en ningún día guardado | No se carga (no se sabe el proyecto); queda en `…sin-destino.json` junto al export |
| Comentario de "Mis proyectos" o "Cómo leer", o de un proyecto que no es de la app | Va al proyecto `(general)`, con la pantalla original como referencia |
| Comentario de una pestaña que ya no existe (p. ej. "resumen") | Pasa al paso General (`Proyecto · Canal · general`) del mismo proyecto y canal, con una aclaración al principio |
| Tipo de campaña / link de Looker de algo que no es proyecto de la app | No se carga; queda en `…sin-destino.json` |
| Decisión o tipo que el servidor local ya tenía igual | No se repite |
| Link de `datastudio.google.com` | Se guarda como `lookerstudio.google.com` |
| Proyecto y canal que ya tienen link de Looker en la base | No se pisa |

Los comentarios viejos guardados como `… · campañas` desde General se mezclaron con Detalle y no se pueden separar: quedan en campañas.

Lo cargado no se puede borrar (tablas de solo agregar): conviene decidir las propuestas **antes** de escribir. Se cambian en `base\carga-comun.js`.

### E. Cierre
1. Cerrar la ventana de PowerShell.
2. Copiar `app\repositorio\` completa fuera de `Seguimiento` (por ejemplo, al Drive de la empresa), con la fecha en el nombre.
3. `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` para Railway se cargan **en el panel de Railway**, nunca por chat (punto 7 de `seguimiento-agentes\LANZAMIENTO-20-10.md`).
4. Avisar al Orquestador para que Auditoría compare la base con los archivos.

Si algo falla: `Faltan las variables` (paso B); `--escribir-en dice "x" pero…` (código equivocado, es el freno); `fetch failed`/`ENOTFOUND` (dirección mal o proyecto pausado: **Restore project** en el panel).
<!-- ===== FIN SECCIÓN: Base ===== -->

<!-- ===== SECCIÓN: Actualización diaria (Extracción) ===== -->
## Actualización diaria

Un solo comando, `node actualizar.js` (desde `Seguimiento/`), hace todo: verifica que ayer esté completo en DataJunta, extrae, trae los presupuestos, arma la app y, si los controles pasan, cambia de versión. Corre solo cada mañana. Si algo falla, el servidor sigue sirviendo la versión anterior.

### Qué hace, paso a paso
1. **Ayer completo:** mira los dos canales de DataJunta. Ayer cuenta como completo si hay filas y gastó al menos el 30 % de lo habitual de la semana (el mismo criterio que usa la app para decidir hasta qué día llegan los datos). Si no está: queda registrado **"sin dato de hoy"**, no baja ni arma nada y el servidor sigue con la versión anterior. Sale con código 0 (no es un error del programa).
2. **Extrae** (`borrador/_extraer.js`), **presupuestos** (`presupuestos/activos.js`), **rendimiento por pieza** (`salidas/rendimiento-piezas.js`) y **arma** (`app/armar.js`). Todo se arma en archivos aparte, sin tocar lo que se está sirviendo.
3. **Controles** antes de cambiar: parches de markup N de N; la prueba de contrato en `problemas 0`; los 14 proyectos × canal con campañas (ninguno que tenía datos puede quedar vacío); y ningún bloque de la extracción con una caída de filas de más del 30 % contra la última corrida buena.
4. **Cambio de versión atómico:** cada archivo se copia al lado de su destino con otro nombre y después se renombra encima. Renombrar es atómico: quien lee ve el archivo viejo entero o el nuevo entero, nunca uno a medio escribir. El HTML se cambia **al final**.
5. Si cualquier paso falla, no se cambia nada (los presupuestos se restituyen) y queda el error registrado. Un candado evita dos corridas a la vez; otra corrida el mismo día se saltea si ya hubo una buena (`--forzar` la repite; `--manual` la anota como manual; `--solo-verificar` solo mira DataJunta).
6. Tras el cambio, arma el resumen por activo del módulo Activos (`presupuestos/resumen-activos.js`); si falla, lo anota pero la corrida sigue siendo buena.

### Dónde deja las cosas
Con `HTML_ARMADO` cargada (Railway), todo va a **la misma carpeta que el HTML** (ej. `/data/armado/`):

| Archivo | Qué es |
|---|---|
| `Seguimiento y Optimizacion.html` | El HTML armado que sirve `server.js` (se cambia de forma atómica) |
| `_proyectos.json` | Los datos del día (~260 MB). Nunca va a GitHub |
| `rendimiento-piezas.json` | Salida para Creatividades |
| `actualizacion/actualizaciones.jsonl` | **Registro de cada corrida**, una línea por corrida: fecha, resultado, datos hasta, versión, duración, filas por bloque, GB de BigQuery, memoria, error y el detalle de cada paso |
| `actualizacion/estado.json` | Cómo quedó: `datos_hasta`, `version`, `sin_dato_de_hoy`, `aviso` (texto "Sin dato de hoy: los números son al DD/MM" cuando lo servido es de antes de ayer), `ultima_corrida` |

Sin `HTML_ARMADO` (en la compu), todo queda en los lugares de siempre y el registro en `Seguimiento/infra/registro/` (no va a Git).

Si la base de Seguimiento está configurada (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`), cada corrida se anota **además** en la tabla `actualizaciones` (migración 006); si no, solo en el archivo. Si la base falla, se avisa por consola y la corrida sigue.

### Cómo dispararlo en Railway
El volumen de Railway se conecta **a un solo servicio**, y el HTML tiene que quedar en ese volumen. Por eso:

- **Recomendado: dentro del servicio web.** `server.js` revisa cada minuto si ya son las 10:30 de Argentina (13:30 UTC) y hoy no hay una corrida buena (`estado.json`, campo `ultimo_ok_dia`); si es así, lanza `node actualizar.js` como proceso aparte (`child_process.spawn`, sin esperar). Repite a las 12:00 y a las 14:00 si el primer intento dio "sin dato de hoy" (DataJunta puede cargar tarde). **Hecho (13/10, Interfaz):** `servidor/actualizacion.js`, apagable con `ACTUALIZACION_AUTOMATICA=0`; deja registro en `disparador.jsonl` (junto a `estado.json`) y en el registro del servidor. Si el servidor arranca después de las 10:30 y no hay corrida buena de hoy, lanza al arrancar (hasta las 18:00). Un error de la corrida (no "sin dato de hoy") no se reintenta solo. Arriba de la página se muestra el `aviso` de `estado.json` cuando `sin_dato_de_hoy` es true. Una corrida que ya hay en curso o ya buena se saltea sola, así que lanzarlo de más no hace daño.
- **Alternativa (no recomendada): un segundo servicio con cron** (Settings → Cron Schedule, en UTC, ej. `30 13 * * *`). Ese servicio no ve el volumen del servicio web, así que el HTML tendría que viajar por otro lado (por ejemplo Supabase Storage). Se descartó en el plan (sección 1).
- **A mano, por si hace falta:** en el servicio, `node actualizar.js --manual --forzar`.

### Cuánto tarda y cuánto usa (corrida completa local del 13/10/2026, datos al 12/10)
| Paso | Duración | Memoria máxima | BigQuery |
|---|---|---|---|
| Verificar ayer | 6 s | — | 0,06 GB |
| Extraer | 5 min 53 s | 2,3 GB | 5,82 GB (25 consultas) |
| Presupuestos | 17 s | 0,2 GB | 0,59 GB |
| Rendimiento por pieza | 6 s | 1,3 GB | 0 |
| Armar | 1 min 6 s | **3,6 GB** | 0 |
| Prueba de contrato | **8 min 24 s** | 2,6 GB | 0 |
| Resumen por activo | 7 s | 1,2 GB | 0 |
| **Total** | **16 min** | **3,6 GB (el pico de un paso)** | **6,48 GB (unos USD 0,04)** |

- Los pasos corren **uno después del otro**, cada uno en su proceso, así que la memoria no se suma: el pico es el del armado (3,6 GB). Hay que sumarle lo que use el servidor web mientras tanto (mantener el HTML de ~50 MB y las sesiones: poco, pero conviene medirlo en Railway). Hobby da hasta 8 GB.
- Es el 6,48 GB que estima BigQuery por cada consulta (dry run). Cada consulta queda por debajo de 1,5 GB, que es el tope del cliente.
- La mitad del tiempo es la prueba de contrato (recorre 13.500 vistas). Si hace falta bajar a menos de 10 minutos, se puede acotar con Interfaz.
- Pasa lo de siempre con el reloj: DataJunta carga a las 8:00, las tablas programadas a las 9:10 y 9:20; el cron de las 10:30 queda con margen.

### Qué queda fuera, a propósito
- **Mail de aviso** cuando falla (D14): no está. El registro y `estado.json` dejan todo escrito para que lo mande quien se ocupe del servicio (por HTTPS; Railway bloquea SMTP).
- **Repositorio de recomendaciones y lectura temprana:** el armado todavía los escribe en `app/repositorio/` del código, que en Railway se borra al reiniciar. Pasarlos a la base es de Recomendaciones.
- **El aviso en pantalla** "Sin dato de hoy": la app todavía no lee `estado.json`; lo muestra Interfaz.
<!-- ===== FIN SECCIÓN: Actualización diaria ===== -->

<!-- ===== SECCIÓN: Rearmado al desplegar código nuevo (Interfaz, 15/10/2026) ===== -->
## Rearmado al desplegar código nuevo

Para que un cambio de la app se vea enseguida, sin esperar a las 10:30 ni gastar BigQuery:
- Cuando el servidor arranca (por ejemplo, tras un despliegue), compara la **versión del código** con la que quedó anotada en `estado.json` (campo `codigo_version`: es el `RAILWAY_GIT_COMMIT_SHA`; en la compu, el hash de git; si no hay ninguno, un hash de los archivos de `app/` y `borrador/`).
- Si hay HTML armado y datos guardados (`_proyectos.json`) pero el código es otro, lanza **una vez** `node actualizar.js --solo-armar` como proceso aparte. Rearma con los datos que ya están en el volumen, corre los mismos controles (parches N de N, proyectos con campañas, prueba de contrato en `problemas 0`) y cambia el HTML de forma atómica. **Mientras tanto se sigue sirviendo la versión anterior**; si algo falla, queda la versión anterior y el error en el registro.
- No se lanza si ya corre otra actualización, ni si `ACTUALIZACION_AUTOMATICA=0`, ni si ese mismo código ya falló al rearmar (para no repetirlo en cada reinicio; se mira el error y se vuelve a intentar con el siguiente despliegue, o a mano). Si toca la actualización completa (después de las 10:30 sin corrida buena de hoy), sale esa, que ya arma todo. Sin datos guardados, sigue la lógica de siempre (actualización completa).
- A mano: `node actualizar.js --solo-armar` en el servicio. Tarda unos **8 minutos** (armado 1 min; la prueba de contrato, 7 min), con un pico de **3,4 GB** de memoria, y **0 GB de BigQuery** (medido en la compu el 15/10).
- Deja rastro en `estado.json` (`codigo_version`, `version`, y `ultimo_solo_armar` con resultado y error) y una línea `tipo: "solo-armar"` en `actualizaciones.jsonl` (solo archivo, no la tabla de la base). No toca `ultimo_ok_dia` ni `ultima_corrida`, así que no cuenta como corrida del día. El rearmado no vuelve a hacer `rendimiento-piezas.json` (no depende de la app).
- `/salud` suma `actualizacion: { corriendo, ultima: { resultado, termino, datos_hasta } }` (más `tipo` y `desde` mientras corre). Sin errores, rutas ni consumo. `resultado` es `ok`, `fallo` o `sin_dato_de_hoy`.
<!-- ===== FIN SECCIÓN: Rearmado al desplegar código nuevo ===== -->

## Si PAUTADOR falla (accesos)
- **Clave rechazada (401/403):** nadie entra; el registro del servidor dice "PAUTADOR rechazó la clave del servicio" y `/salud` muestra `"accesos":"degradado"`. Revisar `NEXO_CLAVE` y la del lado de PAUTADOR.
- **No contesta (timeout, 5xx, 429 después de un reintento):** entra solo quien esté en la lista provisoria, si esa lista tiene 7 días o menos; si no, nadie.
- **Baja en PAUTADOR:** se respeta siempre (la lista no la pisa).
- **Vaciar la memoria de 5 minutos de accesos** (cuando cambian permisos en PAUTADOR y no se quiere esperar): un administrador global hace `POST /api/admin/accesos/vaciar` estando logueado.
