// Lo que la dueña ya explicó del negocio, listo para cargarse en la memoria de la IA con `npm run db:seed`.
// Todo se puede corregir después desde la app (Lo que he aprendido / Plantillas) o platicándole a la IA.
// Lo marcado "por confirmar" son dudas que aún están pendientes con ella.
// IMPORTANTE: aquí NO van números de tarjeta, CLABE ni datos bancarios.

export const RECUERDOS = [
  ['definicion', 'Folio = el «Número de guía» con el que se busca el paquete en PZ Express. Hay dos formatos: el ticket DIGITAL («Comprobante de envío», guía de unos 6 dígitos tipo «32 2283», con Recepción en fecha y hora) y la guía MANUAL («Guía servicio red de sucursales», número tipo «S55658», con la fecha escrita a mano). Los días se cuentan desde la fecha de Recepción/Fecha.'],
  ['regla', 'Los 14 días de PZ Express se cuentan desde la fecha de Recepción del ticket. El día de Recepción es el día 0 y el último día SIN multa es Recepción + 13 (ejemplo: recibido el 10 → vence el 23).'],
  ['regla', 'Multa de PZ Express: fija de $50, no sube. Se cobra al cumplir el día 14 y cubre el almacenamiento del día 14 al 59. Al cumplirse el día 60 la paquetería decomisa el paquete.'],
  ['preferencia', 'Avisarle de los folios por vencer en los días 10, 12 y 13 (confirmado por la dueña), y marcar los que ya cumplieron 14.'],
  ['dato', 'Se recogen más de 40 folios por semana, en 2 sucursales principales: Río y 5 y 10.'],
  ['definicion', 'Los tickets (con el folio para recoger) se los mandan clientes con trato directo y recolectores foráneos; los foráneos tienen sus propios clientes y ella solo rinde cuentas al recolector. Se duplican porque quien los manda no lleva control y reenvía el mismo ticket días después (ej. el 10 y otra vez el 16). Antes de registrar un folio hay que revisar si ya existe. Los avisos de vencimiento de un foráneo van dirigidos a su recolector.'],
  ['definicion', 'Etiqueta de entrega: «AYORA/nombre/número» identifica al recolector foráneo (número 1 a 11). Solo «AYORA» = entrega directo con ella. Quien no está registrado entrega a paquetería con destino sucursal RIO. En los tickets de ejemplo la etiqueta NO aparecía en remitente/destinatario; si el recolector no se identifica claro, preguntarle a la dueña y NO adivinar. Para saber quién es: buscar_recolectores.'],
  ['dato', 'Recolectores foráneos (etiqueta → ciudad): 1 Carreon (Iguala Gro), 2 Brenda (Ometepec Gro), 3 Rosa (Acapulco), 4 Mari (Frontera Tabasco), 5 Urzula (Acapulco), 6 Diana (San Luis Acatlán), 7 Karen (Veracruz), 8 Lupita (San Marcos y Las Vigas Gro), 9 Tina (Puerto Vallarta), 10 Karean (Acapulco), 11 Luna Mia (Chilpancingo y Acapulco).'],
  ['regla', 'Recolección: máximo 5 recolecciones (5 fines de semana) de almacenaje por caja; no se permiten más por garantía y responsabilidad. La primera recolección empieza al recibir el primer paquete (viernes). Se mandan fotos de los paquetes el mismo día.'],
  ['regla', 'Al finalizar la recolección, el cliente tiene 48 horas para verificar que su listado de compras esté completo. Si quiere envío inmediato, se cierra su caja y se cotiza.'],
  ['regla', 'Después de cotizar, el cliente tiene 3 semanas para pagar; si no paga, como recolectores tienen autorización de decomisar la caja por falta de pago.'],
  ['regla', 'Calendario de envíos (confirmado): cotiza sábado y domingo y las cajas salen de lunes a jueves según el día del pago. Lo ideal es que el cliente pague un día antes: pago domingo sale lunes; lunes→martes; martes→miércoles; miércoles→jueves. El último pago de la semana es el miércoles (sale el jueves). Clientes LOCALES de Ensenada: ella entrega personalmente en su domicilio de sábado a jueves, previa confirmación del horario.'],
  ['regla', 'El costo de envío incluye servicio, sello aduanal y guía. En terrestre, el agente aduanal puede determinar impuestos adicionales que corren por cuenta del cliente y se pagan de inmediato. La información de una caja solo se da al titular.'],
  ['regla', 'Peso volumétrico = largo x ancho x alto (cm) / 5000. El peso facturable es el mayor entre el real y el volumétrico, y se cobra por bloques de 5 kg (ejemplo: 62x46x48 = 27.4 kg → 30 kg). Los precios salen de su tabulador/tarifas: nunca inventarlos.'],
  ['dato', 'Paqueterías con las que envía: FedEx, DHL, Estafeta, Volaris y Paquete Express (PZ Express). Envía a todo México, por vía terrestre o aérea. Salidas de lunes a jueves. También envía pallets (pago de mercancía directo con bodega; el costo depende de la ciudad/estado).'],
  ['dato', 'Servicio en Ensenada: ella entrega personalmente de sábado a jueves, previa confirmación del horario, en Bustamante 739, Zaragoza (su domicilio). Se agrega al cliente a un grupo informativo de WhatsApp. Tarifa: 1 paquete tamaño 1 kilo volumétrico $20; más grandes según su volumen; 10 kilos o más: tabulador de Bajapack y paga solo el 50%.'],
  ['dato', 'La Ruta del Saldo (Ensenada–Tijuana–Rosarito): «Rafael Ayora y Fany Molina, tus recolectores de confianza. Compramos, recolectamos, enviamos». Contacto 646 103 1926. Redes: WhatsApp, Facebook y TikTok «Envios Ayora».'],
  ['dato', 'Nombre del negocio ante clientes: ENVIOS AYORA (FÉNIX Recolección y Envíos). Teléfonos: el principal es 646 103 1926; también 744 181 5753. Sitio: www.fenixrecoleccion.mx. Facebook de Rafael Ayora Barrientos.'],
  ['dato', 'En Tijuana trabajan en el distrito de recolección más importante, dentro del PUNTO en 5 y 10. Los clientes pueden comprar con todos los bazares independientes registrados en FÉNIX; el pago de mercancía es directo con cada bazar. Antes de pagar a un vendedor se verifica su credencial vigente de FÉNIX.'],
  ['persona', 'La dueña se presenta ante los clientes como Fany Ayora (con Rafael Ayora) en la dinámica; en la Ruta del Saldo aparece Fany Molina. El nombre del negocio que se usa es ENVIOS AYORA.'],
  ['preferencia', 'Textos para publicar: mezcla entre formal y cercano, ni muy formal ni gracioso. Por ahora solo publica en Facebook; también tiene Instagram y TikTok. Ejemplos y textos fijos están en las plantillas.'],
  ['regla', 'Cuando la etiquetan en una publicación pidiendo información: responde «te dejo información en tu inbox», pone su imagen informativa y en el inbox pega el mensaje de la dinámica (plantilla dinamica_recoleccion). Pide el WhatsApp del cliente y qué artículos le interesan.'],
  ['regla', 'Pagos: cada semana manda a sus clientes el total y la fecha límite (ej. jueves 2:00 pm). Revisa en Messenger si ya subieron el comprobante; si está, lo quita de pendientes, empaca y entrega el viernes; si no, les escribe pidiendo el comprobante (plantilla pedir_comprobante). La IA no ve Messenger ni verifica depósitos.'],
  ['regla', 'La IA no contesta sola en WhatsApp ni Facebook: deja el mensaje listo para que la dueña lo copie y pegue. Los datos bancarios los adjunta ella misma como imagen; la IA nunca los escribe.'],
  ['regla', 'Tabulador 2026 de cotización: de 1 a 60 kg en escalones de 5 kg, con precio aéreo, terrestre y Baja Pack Express (solo clientes de zona fronteriza); zona extendida suma $280 una vez; más de 60 kg es cotización especial a mano. Siempre se cotiza con la herramienta cotizar, nunca de memoria.'],
  ['regla', 'Lectura de tickets: del ticket digital se toma Número de guía, Recepción, Sucursal (origen), Remitente, Destinatario, Destino, Tamaño y Precio. De la guía manual: No., Fecha (manuscrita), Cedi origen y destino, Envía, Recibe y las notas escritas (ej. «Cajón 29 envíos Ayora»). Lo manuscrito se confirma siempre con la dueña antes de guardar.'],
];

const DINAMICA = `Dinámica de Recolección y Envíos — FÉNIX ENVIOS AYORA

1. Proceso de Compra y Envío
Compra directa: Usted realiza la compra y el pago directamente con el bazar de su elección.

Consolidación: El bazar nos entrega sus productos para resguardarlos y preparar su paquete en el tiempo solicitado sin exceder las 5 semanas continuas de recolección.

Identificación con el bazar: Al realizar su compra, indique al vendedor que su recolectora es FANY AYORA en FÉNIX y envíele la imagen de servicio adjunta en este chat.

Cobertura de envío: Enviamos a todo México por paquetería privada, con opciones de servicio terrestre o aéreo.

2. Tiempos, Seguimiento y Beneficios
Período de recolección: Puede acumular sus compras durante un máximo de 5 semanas. Si prefiere recibir sus productos antes, puede solicitar el envío desde la primera semana.

Compartir caja: Tiene la opción de invitar a familiares y amigos a realizar sus compras para consolidarlas en la misma caja y compartir el costo del envío.

Reporte en tiempo real: Al recibir su primer paquete en FENIX ENVIOS AYORA, le proporcionaremos un enlace y su código de cliente para que pueda consultar el estado de su recolección en tiempo real.

Grupos de compra exclusivos: Si lo desea, podemos agregarle a grupos de compras donde bazares aliados ofrecen mercancía americana a excelentes precios con entregas directas en FENIX ENVIOS AYORA.

3. Calendario de Pagos y Salida de Cajas
Para coordinar el despacho de su caja, el esquema de atención funciona de la siguiente manera:

Pago en Domingo: Salida a destino Lunes
Pago en Lunes: Salida a destino Martes
Pago en Martes: Salida a destino el Miércoles
Pago en Miércoles: Salida a destino el Jueves
(El miércoles es el último día de pago de la semana.)

⚠️ Aviso de Seguridad Imprescindible
Antes de realizar cualquier pago al vendedor, verifique que este cuente con su credencial vigente de FÉNIX.
Quedamos a sus órdenes para cualquier duda o consulta.
Atentamente.

Rafael Ayora y Fany Ayora
FÉNIX Recolección y Envíos

Dinámica: Podrás comprar con vendedores sin limitarte si están registrados en múltiples proyectos. Lo importante es que estén registrados en FENIX RECOLECCION Y ENVIOS.

Estamos ubicados en el distrito de recolección más importante de Tijuana, dentro del PUNTO en 5 & 10.

Cualquier duda contactarme en mi WhatsApp.

Es importante me compartas tu número de WhatsApp habilitado para recibir tu información de manera directa y se genera tu referencia de usuario para acceso al seguimiento en tiempo real de tu recolección y rastreo de guías.

No olvides comentarme qué artículos son de tu interés para presentarte a todo el mundo de vendedores activos.

(Adjuntar la imagen de precios.)`;

const COTIZACION = `Hola {{nombre_cliente}}, ¿qué tal? Te dejo cotización de envío.

{{cajas}} caja(s) · Peso real {{peso_real}} kg
Medidas: {{largo}}x{{ancho}}x{{alto}} cm · Vol. {{peso_vol}} kg
Peso facturable: {{peso_facturable}} kg

Aéreo: {{precio_aereo}}
Terrestre: {{precio_terrestre}}

El pago debe quedar a más tardar el día miércoles para que tu envío salga en la misma semana.

Pago:
Domingo sale lunes
Lunes sale martes
Martes sale miércoles
Miércoles sale jueves

Tu cotización ya incluye la boleta mínima de aduana para que tu caja pueda salir a destino. Sin embargo, todos los envíos terrestres son susceptibles de ser revisados en la aduana y que el agente aduanal determine pagos de impuestos adicionales; estos corren totalmente por tu cuenta y se deben pagar de manera inmediata para que tu caja siga su curso.

Adjunto la imagen de la cuenta y política de envío.`;

const COMPROBANTE = `Hola, buenas noches. Por favor me confirma su pago para poder entregar mañana a su recolector.`;

const VISUAL = `Imagen informativa de la dinámica (se manda junto con el mensaje de la dinámica):
Fany Ayora, recolectora del Proyecto FÉNIX.
- Puedes comprar con TODOS LOS BAZARES INDEPENDIENTES registrados en Tijuana.
- El pago de mercancía es directo con cada uno de ellos.
- Te puedo almacenar máximo 5 recolecciones (5 fines de semana).
- Si deseas envío inmediato, cerramos tu caja y cotizamos sin problema.
- No se permiten más de 5 recolecciones por temas de garantía y responsabilidad.
- La primera recolección inicia cuando recibimos tu primer paquete (viernes).
- Enviamos fotos de tus paquetes el mismo día.
- Cotizamos su caja en sábado para que salga a envío lunes, martes y miércoles.
- Puedes compartir tu caja con algún amigo o familiar (solo me avisas para saber quiénes son).
- También enviamos pallets (pago de mercancía directo con bodega y costo de envío depende de la Ciudad/Estado).
- La información solo se brinda al titular de la caja.
- El costo de envío incluye servicio, sello aduanal y guía.
- Una vez que iniciamos tu recolección, al finalizar tienes 48 hrs para verificar que tu listado de compras esté completo.`;

const ENSENADA = `FÉNIX Recolección y Envíos — ENSENADA

Horario y cobertura de entrega
Entregamos de sábado a jueves (previa confirmación del horario).
Dirección de entrega: Bustamante 739, Zaragoza.

Comunicación
Se te agrega a un grupo de WhatsApp informativo.

Tarifas de envío
1 paquete, tamaño 1 kilo vol.: $20.00
Paquetes de mayor tamaño: según su volumen.
10 kilos o más: precio de tabulador Bajapack. ¡Pagas solo el 50%!`;

const VENDEDORES = `Un servicio extraordinario que supera cualquier expectativa. No es el precio, es el valor y la excelencia.

- Recolección confiable y dedicada a domicilio.
- Envíos seguros y puntuales a TODO MÉXICO.
- Alianzas estratégicas para comercios: ¡Regístrate y crece!
- Atención al cliente de excelencia: cada paquete importa.
- Red nacional amplia y monitoreo en tiempo real.

¡Envíos Ayora con FÉNIX Recolección y Envíos! Registra tu comercio y transforma tu logística.
WhatsApp 744 181 5753 · www.fenixrecoleccion.mx`;

const RUTA = `LA RUTA DEL SALDO — Ensenada · Tijuana · Rosarito
Rafael Ayora y Fany Molina, tus recolectores de confianza.
Compramos · Recolectamos · Enviamos.
Agrégate a nuestro grupo de WhatsApp y perfil de Facebook. Entregamos personalmente.
Si eres foráneo te enviamos a cualquier ubicación de la República Mexicana.
Paqueterías: FedEx, DHL, Estafeta, Volaris y Paquete Express.
«Confianza en cada compra y envío».
Contacto: 646 103 1926 · Redes: WhatsApp, Facebook y TikTok (Envios Ayora).`;

const ALBUM = `Publicación compartida — Envíos Ayora (texto para cuando comparte un álbum)
• Recolección semanal.
• Reporte de recolección en tu propio sitio digital directamente con tu código de cliente, fotos y listas.
• Envíos aéreo y terrestre.
• Envíos de lunes a jueves.
• Asesoría en compras.
• Amplio portafolio de proveedores.
• Atención continua.
• Bodega con cámaras de seguridad 24/7.
Gracias.`;

const ETIQUETA = `Imagen de servicio para el vendedor (una por recolector):
ENTREGAR A MI RECOLECTORA DE FÉNIX: {{ciudad}}
AYORA/{{nombre}}/{{numero}}
Escribir mi nombre tal como está en mi Facebook.
Si no estás registrado en FÉNIX, entregar a paquetería con destino sucursal RIO.
Asegúrese de copiar exactamente: "AYORA/{{nombre}}/{{numero}}".
Gracias.
(Para la entrega directa con ella la etiqueta es solo «AYORA».)`;

export const PLANTILLAS = [
  ['dinamica_recoleccion', 'Mensaje de la dinámica de recolección y envíos (se pega en el inbox cuando la etiquetan).', DINAMICA],
  ['cotizacion', 'Cotización de envío con peso volumétrico. Los precios los pone ella; nunca se inventan.', COTIZACION],
  ['pedir_comprobante', 'Mensaje con el que pide el comprobante de pago (su texto).', COMPROBANTE],
  ['dinamica_visual', 'Texto de la imagen informativa (transcrito tal cual; el calendario vigente está en la memoria).', VISUAL],
  ['ensenada_servicio', 'Servicio en Ensenada: horario, dirección de entrega y tarifas.', ENSENADA],
  ['servicio_vendedores', 'Mensaje para atraer comercios y vendedores a registrarse.', VENDEDORES],
  ['ruta_del_saldo', 'Texto de La Ruta del Saldo (Ensenada–Tijuana–Rosarito).', RUTA],
  ['publicacion_album', 'Texto de «Publicación compartida Envíos Ayora» para cuando comparte un álbum.', ALBUM],
  ['etiqueta_entrega', 'Texto de la imagen de servicio con la etiqueta AYORA/nombre/número.', ETIQUETA],
];

export const RECOLECTORES = [
  [null, 'AYORA (directo)', 'Tijuana', 'directo'],
  [1, 'Carreon', 'Iguala, Gro.', 'foraneo'],
  [2, 'Brenda', 'Ometepec, Gro.', 'foraneo'],
  [3, 'Rosa', 'Acapulco', 'foraneo'],
  [4, 'Mari', 'Frontera, Tabasco', 'foraneo'],
  [5, 'Urzula', 'Acapulco', 'foraneo'],
  [6, 'Diana', 'San Luis Acatlán', 'foraneo'],
  [7, 'Karen', 'Veracruz', 'foraneo'],
  [8, 'Lupita', 'San Marcos y Las Vigas, Gro.', 'foraneo'],
  [9, 'Tina', 'Puerto Vallarta', 'foraneo'],
  [10, 'Karean', 'Acapulco', 'foraneo'],
  [11, 'Luna Mia', 'Chilpancingo y Acapulco', 'foraneo'],
];

// Textos de versiones anteriores de esta semilla (huella sha256 abreviada). El seed los reemplaza solo si
// siguen EXACTAMENTE igual en la base, así nunca pisa algo que la dueña corrigió.
export const OBSOLETOS_RECUERDOS = ['47f4c3c0f10f9d55', 'e59bd1f9b127359c', 'de1bc84069b60383', 'fbde14ca7e19e274', 'a3869423ec519c7d', '19759c24b3a556ad', '7a234d18968ea97b', 'f7a9d1d956527312', 'c57d64bc60a17f75', '5d6d47e27cd594e6', 'f048e9148c51bbe1'];
export const PLANTILLAS_ANTERIORES = { dinamica_recoleccion: '9c8a05213e791408', pedir_comprobante: 'b964cf443a3d252b', ensenada_servicio: 'e396d69a9a1f1b28', dinamica_visual: 'f51ca76567a1d2bf' };
