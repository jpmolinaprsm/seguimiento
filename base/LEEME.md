# Base de Seguimiento (Supabase)

Preparado el 2/10/2026 por el agente Recomendaciones, para la salida a Railway (`seguimiento-agentes/PLAN-RAILWAY.md`,
secciones 3, 4 y 6; decisiones D3 y D5). **Todavía no existe la base:** el proyecto de Supabase lo crea Juan Pablo. Nada de esta
carpeta se conectó a la app todavía.

**2/10/2026:** el proyecto de PRUEBA (organización gratuita) ya existe, con las siete migraciones aplicadas. `almacen-supabase.js`
se probó contra esa base (37 de 37) y se hizo la carga inicial de `app/repositorio/`. La app sigue guardando en archivos.

- **D3:** base Supabase propia de Seguimiento, aparte de la de PAUTADOR, con copia semanal a BigQuery. La de prueba va en una
  organización gratuita de Supabase.
- **D5:** tipos de campaña y comentarios compartidos por proyecto, con autor y fecha.
- Usuarios y accesos los da PAUTADOR (`orquestacion/CONTRATOS/consulta-accesos.md`). **Esta base no tiene tabla de usuarios.**

## Qué hay

| Archivo | Qué es |
|---|---|
| `migraciones/001_base.sql` | Registro de migraciones, el candado "solo se agrega" y el corte de permisos públicos |
| `migraciones/002_recomendaciones.sql` | Recomendaciones del día, respuestas del equipo (historial) y estado actual de cada recomendación |
| `migraciones/003_comentarios_tipos_looker.sql` | Comentarios (a recomendaciones, a reglas y a pantallas), tipos de campaña (cambios y actual), links de Looker |
| `migraciones/004_lectura_temprana.sql` | Predicciones de la lectura al día 5 y resumen de cada corrida |
| `migraciones/005_nexo_solicitudes.sql` | Solicitudes a PAUTADOR y sus estados (formato de `nexo/`) |
| `migraciones/006_actualizaciones.sql` | Registro de cada actualización diaria y de la copia semanal a BigQuery |
| `migraciones/007_seguridad.sql` | Cierre: RLS en todas las tablas, permisos públicos afuera y un control que tiene que dar cero filas |
| `almacen.js` | La interfaz que usa el código (ver abajo) y los controles comunes |
| `almacen-archivo.js` | Implementación de hoy: los archivos de `app/repositorio/`, mismo formato |
| `almacen-supabase.js` | Implementación en la base. Probada contra la base de prueba el 2/10 |
| `verificar-base.js` | Solo lee: comprueba las siete migraciones y que la API vea las 14 tablas (13/10) |
| `cargar-inicial.js` | Carga `app/repositorio/` (recomendaciones, tipos, comentarios, predicciones). Prueba en seco por defecto; escribe con `--escribir-en <código>` (13/10) |
| `exportar-del-navegador.js` | Snippet para pegar en la consola del navegador: baja todas las claves `syo.*` a un .json (13/10) |
| `cargar-navegador.js` | Carga ese .json a la base resolviendo lo que la base rechaza (13/10) |
| `carga-comun.js` | Piezas comunes de las cargas |

### Las tablas

| Tabla | Qué guarda | Se lee por | ¿Solo se agrega? |
|---|---|---|---|
| `recomendaciones` | Lo que generó el agente cada día (hoy `repositorio/recomendaciones/AAAA-MM-DD.jsonl`) | proyecto, canal, día | No: cada día se reemplaza el del día |
| `respuestas` | Cada cambio del equipo sobre una recomendación: decisión, motivo, ¿sirve?, comentario, autor | proyecto, canal, fecha · recomendación | **Sí** |
| `recomendacion_estado` | Lo último de cada recomendación (lo mantiene la base sola) | proyecto, canal | Lo escribe solo el trigger |
| `comentarios` | Comentarios a recomendaciones, a reglas y a pantallas, con autor y fecha | proyecto, canal, objeto · regla | **Sí** (editar = agregar uno nuevo) |
| `tipos_campana_cambios` | Cada cambio de tipo de campaña, con quién lo cambió | proyecto, canal, campaña | **Sí** |
| `tipos_campana` | El tipo actual de cada campaña (lo mantiene la base sola) | proyecto, canal | Lo escribe solo el trigger |
| `looker_links` | Link de Looker por proyecto y canal, con quién lo cargó | proyecto, canal | No |
| `lectura_temprana_predicciones` | Predicciones al día 5 (hoy `predicciones.jsonl`) | cliente, canal, día 5 | **Sí** |
| `lectura_temprana_resumenes` | El resumen de cada corrida (hoy `resumen.json`); se usa el último | fecha | **Sí** |
| `nexo_solicitudes` | Solicitudes a PAUTADOR, id único (reintento = mismo id) | proyecto, canal · recomendación | **Sí** |
| `nexo_estados` (+ vista `nexo_ultimo_estado`) | Cada estado de cada solicitud | solicitud | **Sí** |
| `actualizaciones` | Cada corrida diaria: resultado, hasta qué día, duración, filas, GB, memoria, error | tipo, fecha | No (se completa al terminar) |

Reglas que pone la base, aunque el código se equivoque:
- **"Hecha a mano" y "descartada" sin motivo no entran** (motivo vacío o en blanco tampoco). La lista de motivos no se fija en la
  base: la de "hecha a mano" la decide Juan Pablo.
- **Sin autor no entra nada** del equipo, y el autor tiene que ser un mail en minúsculas. Solo la carga inicial de lo que ya hay
  (`origen = carga_inicial`) acepta "sin identificar", porque las 17 respuestas que existen hoy no tienen autor.
- Las tablas de historial **no se pueden cambiar, borrar ni vaciar**, ni siquiera con la clave de servicio (es un trigger, no un
  permiso). Para corregir algo, se agrega una fila nueva.
- Una solicitud del nexo con un estado que la base no conoce se rechaza: si el Nexo suma un estado, va con una migración.

## Cómo se aplican las migraciones

1. Juan Pablo crea el proyecto en Supabase (el de prueba, en la organización gratuita; el de producción, donde se decida).
2. En el panel del proyecto: **SQL Editor → New query**. Pegar y correr **un archivo por vez, en orden**: `001`, `002`, `003`, `004`,
   `005`, `006`, `007`. Cada uno termina anotándose en la tabla `migraciones`.
3. El `007` termina con un control: **tiene que devolver cero filas**. Si devuelve alguna, hay una tabla sin RLS o con una política, y
   no se sigue.
4. Comprobar: `select * from migraciones order by version;` tiene que mostrar las siete.
4b. Correr `notify pgrst, 'reload schema';`. Sin eso la API puede seguir sin ver las tablas nuevas ("no se encuentra la tabla en el
   esquema") aunque existan: pasó el 2/10 en la base de prueba y se arregló solo con esa línea.
5. Se pueden volver a correr sin romper nada (usan `if not exists` y reemplazan triggers y funciones). Una migración nueva se agrega
   como `008_...sql` y después se vuelve a correr el `007`.

No hace falta instalar nada para aplicarlas. Si se prefiere la terminal, sirve `psql` con la cadena de conexión del panel, pero esa
cadena tiene la contraseña de la base: no se guarda en ningún archivo.

## Variables

| Variable | Dónde | Para qué |
|---|---|---|
| `SUPABASE_URL` | Railway (y `.env` local si se prueba contra la base de prueba) | Dirección del proyecto de Supabase de Seguimiento |
| `SUPABASE_SERVICE_ROLE_KEY` | **Solo** Railway / `.env` local, nunca en el código ni en GitHub | Clave de servicio: es la única que lee y escribe |

- Si las dos están, `crearAlmacen()` usa la base; si falta alguna, usa los archivos de `app/repositorio/` como hoy.
- **La clave pública (anon) no se usa en ningún lado.** El navegador nunca habla directo con la base: le pide todo al servidor de
  Seguimiento, que revisa la sesión y el proyecto antes de leer o escribir.
- Usa el paquete `@supabase/supabase-js` (aprobado en D9), instalado el 2/10 en el `package.json` propio de Seguimiento.

## Seguridad

- **RLS activado en todas las tablas y ninguna política.** Con la clave pública o con un usuario de Supabase no se ve ni se escribe
  nada. La clave de servicio saltea RLS (así funciona Supabase), por eso solo la tiene el servidor.
- Además, los roles públicos de Supabase (`anon`, `authenticated`) no tienen ningún permiso sobre las tablas, ni sobre las que se
  creen después. Si alguien crea una política por error, igual no alcanza.
- La vista del nexo está marcada para respetar los permisos de quien la lee.
- Las funciones de la base fijan su `search_path` (no se pueden engañar con otra tabla del mismo nombre).

### Mails

- El mail aparece solo donde hace falta saber quién hizo algo: `autor` (respuestas, comentarios, tipos de campaña, Looker) y
  `pedida_por` del nexo (viaja a PAUTADOR, que lo necesita). No hay mails en recomendaciones, lectura temprana ni actualizaciones.
- El autor sale **de la sesión** (login con Google del dominio), nunca de lo que mande el navegador: `guardarRespuesta` pisa el autor
  que venga en el pedido con el de la sesión.
- El mail nunca va en una URL (todo se manda en el cuerpo del pedido, como hace la consulta de accesos de PAUTADOR) ni en los
  registros del servidor.
- La base guarda los datos cifrados en disco (Supabase lo hace siempre) y queda cerrada a todo salvo el servidor.
- **Para la copia a BigQuery propongo no copiar el mail**: reemplazarlo por un código fijo por persona (el mismo mail da siempre el
  mismo código, pero del código no se puede volver al mail), calculado con una clave aparte en una variable
  (`SEGUIMIENTO_SAL_AUTOR`). Así en BigQuery se puede contar "cuántas decisiones tomó cada persona" sin tener la lista de mails.
  Queda como pregunta para Juan Pablo.

## La interfaz que usa el código (`almacen.js`)

Todos los métodos devuelven una promesa. Las dos implementaciones tienen los mismos.

| Para | Método |
|---|---|
| Recomendaciones del día | `guardarRecomendaciones(datosAl, filas)` · `leerRecomendaciones({ desde, hasta, proyecto, canal })` |
| Respuestas del equipo | `guardarRespuesta(reg, quien)` · `leerRespuestas(...)` · `leerEstados({ proyecto, canal })` · `leerComentarios(...)` · `leerTiposCampana(...)` |
| Looker | `guardarLooker({ proyecto, canal, url }, quien)` · `leerLookers({ proyectos })` |
| Lectura temprana | `leerPredicciones()` · `agregarPredicciones(nuevas)` · `guardarResumenLectura(resumen)` · `leerResumenLectura()` |
| Actualizaciones | `empezarActualizacion({ tipo })` · `terminarActualizacion(id, datos)` · `ultimaActualizacion({ tipo, resultado })` |
| Nexo | `almacen.nexo`: los mismos métodos que `nexo/repositorio.js`, con promesa |

`guardarRespuesta` acepta lo que manda hoy la app (`clase`: `recomendacion`, `regla`, `tipo_campana`) más `pantalla` (los comentarios
de pantalla que hoy quedan solo en el navegador). Si falta algo (motivo, autor, proyecto), devuelve `{ ok: false, error }` sin
escribir, para que el servidor conteste el error en vez de perder el dato.

### Qué cambia en cada archivo para pasar a la base (no se hizo todavía)

| Archivo | Dueño | Cambio |
|---|---|---|
| `app/redaccion.js` (`guardarRepositorio`) | Recomendaciones | Arma las mismas líneas y llama a `guardarRecomendaciones`. Pasa a devolver una promesa: `app/armar.js` (compartido) tiene que esperarla |
| `borrador/lectura-temprana.js` (`observar`) | Recomendaciones | Lee y agrega predicciones y guarda el resumen con el almacén en vez de `fs`. Pasa a ser asíncrona |
| `borrador/informe-semanal.js` | Recomendaciones | Puede leer con `leerRecomendaciones`, `leerRespuestas`, `leerResumenLectura` y `nexo.historial` |
| `app/servir.js` (`/api/respuesta`, `/api/respuestas`) | Recomendaciones (esas rutas) | `guardarRespuesta(reg, sesión)`; si no es `ok`, contestar 400 con el error. Leer solo los proyectos de la persona |
| `nexo/cliente.js` | Nexo | Usar `almacen.nexo` y **esperar (`await`) cada llamada al repositorio**. Ojo: sin `await`, `leerSolicitud` devuelve una promesa, que cuenta como "ya existe" |
| `app/logica.js` | Interfaz | Mandar comentarios de pantalla y links de Looker al servidor; leer estado, tipos y comentarios del servidor al abrir |

## Copia semanal a BigQuery (propuesta, no construida)

Con el mismo patrón que `pautador/src/services/bqRespaldo.js` (leído, no tocado):

- **Qué:** una carga (no una consulta) por tabla a `prsm-bq-media.automatizado.seguimiento_<tabla>`, en formato JSON por línea,
  **reemplazando la tabla entera** cada vez (`WRITE_TRUNCATE`): repetirla no duplica nada. Cargar no cuesta; el almacenamiento son
  pocos MB.
- **Cuáles:** todas las de arriba. Las columnas JSON (conjuntos, solicitud, resumen, detalle) van como texto. Con un esquema fijo
  por tabla en vez de que BigQuery lo adivine (PAUTADOR lo adivina; acá conviene fijarlo para que una semana sin filas no cambie
  los tipos).
- **Cuándo:** los lunes, después de la actualización diaria (por ejemplo 11:30, hora argentina), en el mismo proceso. Solo en
  Railway, nunca desde esta computadora.
- **Sin repetir:** se anota en `actualizaciones` con `tipo = respaldo_bq` y la fecha del lunes; la base no deja dos copias buenas la
  misma semana. Si falla, se reintenta en la próxima vuelta del mismo día.
- **Cómo lee:** de a 1.000 filas (nunca la tabla entera de una vez).
- **Mails:** reemplazados por el código fijo por persona (ver "Mails"), si Juan Pablo lo aprueba.
- **Credencial:** la cuenta de servicio de BigQuery que ya se carga como variable (D7), con el cliente propio de Seguimiento que
  arma Extracción.
- **Antes de construirla:** las tablas nuevas en `automatizado` se registran con el módulo Datos (pedido por `orquestacion/BUZON/`) y
  escribir en `automatizado` lo autoriza Juan Pablo.

## Pendiente

- **Pasos para la base real y para sacar lo del navegador: `Seguimiento/DESPLIEGUE.md`, sección "Base" (13/10).**

- Hecho el 2/10 en la base de PRUEBA: migraciones, prueba del almacén y carga inicial (323 recomendaciones de dos días, las 17
  respuestas, que son todas cambios de tipo de campaña, como `carga_inicial` y "sin identificar", y 390 predicciones; todo igual
  a los archivos). Quedan además filas de prueba marcadas (proyecto `PRUEBA`, ids `prueba-...`, día 2000-01-01). El
  `resumen.json` de lectura temprana no se cargó: lo vuelve a escribir la próxima corrida.
- La base de producción: repetir migraciones, `reload schema`, control de `007` y carga inicial (sin las filas de prueba).
- Conectar los archivos de la tabla de arriba.
