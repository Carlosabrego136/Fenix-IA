# Fénix IA

Asistente de IA para administrar **Fénix Recolección y Envíos** (Ensenada).
App web instalable (PWA) hecha con Next.js. Lee los datos reales del sistema de envíos (solo lectura), redacta mensajes para WhatsApp y tiene memoria a largo plazo en su propia base de datos.

Creada por Faiiryz (Carlos Abrego Pavón), CEO de Teocalli Dev.

---

## Cómo funciona (resumen)

- **Datos del negocio**: la IA consulta la base `envios_ayora` con un usuario **de solo lectura**. No puede modificar nada.
- **Memoria**: base nueva y propia (`fenix_ia`) con chats, recuerdos y uso diario.
- **IA**: Claude (`claude-haiku-5-5`) por la API de Anthropic.
- **Conexiones**: sin pool. Cada consulta abre y cierra su propio `Client`, máximo 2 simultáneas (Aiven solo permite 20 para todas las bases).
- **Olvidar**: la IA siempre pide confirmación antes de borrar un recuerdo (se valida en el servidor, no solo en el prompt).
- Sin `ANTHROPIC_API_KEY` o sin `DATABASE_URL_LECTURA` funciona en **modo DEMO** con datos ficticios (aparece una etiqueta "DEMO").

---

## Paso 1. Subir a GitHub y Vercel

1. Descomprime el zip, crea un repositorio **privado** en GitHub y sube todo.
2. En Vercel: *Add New → Project → importa el repo*. Framework: Next.js (automático). Node 20.9 o mayor.
3. Todavía no despliegues; primero las variables (Paso 4). Si despliega antes, entra en modo DEMO y está bien para ver el diseño.

## Paso 2. Base de datos nueva en Aiven (memoria)

1. Aiven → tu servicio PostgreSQL → **Databases → Create database** → nombre `fenix_ia`.
2. Copia la cadena de conexión (Service URI) y cámbiale el final `/defaultdb` por `/fenix_ia`.
3. Esa cadena va en `DATABASE_URL_MEMORIA`.

## Paso 3. Usuario de solo lectura en `envios_ayora`

Conéctate a `envios_ayora` con el usuario administrador (consola de Aiven, DBeaver o `psql`) y ejecuta (cambia la contraseña):

```sql
CREATE USER fenix_lector WITH PASSWORD 'PON-UNA-CONTRASEÑA-LARGA';
GRANT CONNECT ON DATABASE envios_ayora TO fenix_lector;
GRANT USAGE ON SCHEMA public TO fenix_lector;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO fenix_lector;
ALTER ROLE fenix_lector SET default_transaction_read_only = on;
```

La cadena queda así y va en `DATABASE_URL_LECTURA`:

```
postgres://fenix_lector:CONTRASEÑA@HOST:PUERTO/envios_ayora
```

## Paso 4. API de Anthropic

1. Entra a <https://console.anthropic.com> y crea una cuenta/organización.
2. **Billing**: compra crédito prepagado (con 10 USD sobra para el primer mes). Desactiva la recarga automática.
3. **Limits**: pon un límite de gasto mensual de 10 USD.
4. **API Keys → Create key**. Cópiala una sola vez; va en `ANTHROPIC_API_KEY`.

## Paso 5. Variables de entorno en Vercel

| Variable | Valor |
|---|---|
| `ACCESS_PASSWORD` | La contraseña con la que ella entra a la app |
| `SESSION_SECRET` | Texto aleatorio de 24+ caracteres |
| `OWNER_NAME` | Cómo debe llamarla la IA (ej. `Doña Ayora`) |
| `ANTHROPIC_API_KEY` | La llave del Paso 4 |
| `ANTHROPIC_MODEL` | `claude-haiku-5-5` |
| `DAILY_MESSAGE_LIMIT` | `250` (opcional) |
| `DATABASE_URL_MEMORIA` | Paso 2 |
| `DATABASE_URL_LECTURA` | Paso 3 |
| `BUSINESS_NAME` / `ASSISTANT_NAME` / `BUSINESS_TZ` | Opcionales (zona por defecto `America/Tijuana`) |
| `DATABASE_CA_CERT` | Opcional: certificado CA de Aiven para validar SSL |

Hay un ejemplo en `.env.example`. Después de guardar, haz **Redeploy**.

## Paso 6. Preparar y verificar las bases

En tu computadora, con un `.env.local` con las mismas variables:

```bash
npm install
npm run db:setup   # crea las tablas en fenix_ia (es seguro repetirlo)
npm run db:check   # prueba la lectura de envios_ayora y valida las columnas
```

```bash
npm run db:seed    # carga lo que la dueña ya explicó: reglas, plantillas y recolectores (seguro repetirlo)
```

`db:seed` no duplica nada y, si una regla o plantilla sembrada cambió en una versión nueva, la reemplaza solo cuando nadie la ha modificado; con `npm run db:seed -- --forzar` vuelve a escribir las plantillas y los recolectores
con el texto original (guarda la versión anterior de cada plantilla).

Si `db:check` marca una columna distinta a la esperada, avísame y se ajusta en `src/lib/lectura.js`.
(Las tablas también se crean solas en la primera consulta.)

## Paso 7. Instalar en el celular

Abrir el link de Vercel en Chrome (Android) → menú ⋮ → **Instalar aplicación** / **Agregar a pantalla de inicio**. En iPhone: Safari → Compartir → **Agregar a pantalla de inicio**.

---

## Lo que incluye (etapa 2)

- **Folios de PZ Express** (`/folios`): la dueña manda a la IA la foto del ticket o una lista; la IA lee folio, fecha de recepción, sucursales y etiqueta `AYORA / nombre / número`, **propone** el registro, detecta duplicados (ya registrados o repetidos en la lista) y **solo guarda cuando ella confirma en un mensaje posterior** (lo hace cumplir el servidor, igual que "olvidar"). Calcula días y el último día sin multa (recepción + 13); avisa en 10, 12 y 13 días, marca multa probable desde el día 14 y decomiso a los 60. Las fotos se reducen en el celular, solo viajan en ese mensaje y **no se guardan**.
- **Pagos** (`/pagos`): control de quién mandó comprobante (pendiente → comprobante recibido → pagado). La IA no ve Messenger ni verifica depósitos.
- **Plantillas** (`/plantillas`): dinámica, cotización, servicios, publicaciones. La IA las usa tal cual. No se aceptan números de tarjeta ni CLABE.
- **Cotizaciones**: la IA calcula el peso volumétrico (largo × ancho × alto ÷ 5000) y arma el mensaje con la plantilla; **nunca inventa precios**.
- **Recolectores foráneos** 1–11 (para saber quién es quién en la etiqueta).
- Reglas confirmadas por la dueña: multa fija de $50 desde el día 14 (sin aumentos; decomiso a los 60); avisos en 10, 12 y 13; peso facturable por bloques de 5 kg; cotiza sábado y domingo y envía de lunes a jueves (último pago el miércoles); Ensenada local de sábado a jueves.
- Cotizaciones: la herramienta `cotizar` usa el tabulador 2026 de `cotizador.js` (1–60 kg en escalones de 5 kg, aéreo/terrestre/Baja Pack Express, zona extendida +$280; más de 60 kg es cotización especial). Si cambian los precios, se editan en `TABULADOR` de `src/lib/negocio.js`.
- Pendiente: imagen de precios nacional, dónde aparece la etiqueta del recolector foráneo en el ticket, ejemplos de publicaciones y qué destinos son zona extendida.

## Lo que el sistema NO tiene todavía

El sistema de envíos (`envios_ayora`) no guarda un estado de "guía recogida" ni las tarifas (las tarifas viven en el tabulador de la herramienta `cotizar`). La IA lo dice con honestidad. Los folios y pagos de esta etapa viven en la base `fenix_ia`.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # llenar valores, o dejar vacío para modo DEMO
npm run dev
```

## Seguridad

- Contraseña única + cookie de sesión JWT (httpOnly, 30 días).
- Límite de intentos de login por IP (en memoria, por instancia).
- Las fotos (foto, ine_foto, foto_credencial) nunca se consultan.
- La IA solo lee con consultas fijas; no ejecuta SQL libre.
