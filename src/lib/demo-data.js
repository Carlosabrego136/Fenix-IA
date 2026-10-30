// Datos FICTICIOS de demostración. Se usan solo cuando no hay DATABASE_URL_LECTURA.
// Tienen la misma forma que la base real (envios_ayora) para poder enseñar la app sin conectar nada.
const DIA = 86400000;
const hace = (dias, horas = 0) => new Date(Date.now() - dias * DIA - horas * 3600000);

export function demoDatos() {
  const clientes = [
    { id: 'c1a2b3c4', nombre: 'María López', telefono: '646 555 0101', bloque: '24.2', activo: true },
    { id: 'c2a2b3c4', nombre: 'Juan Pérez', telefono: '646 555 0102', bloque: '24.2', activo: true },
    { id: 'c3a2b3c4', nombre: 'Rosa Hernández', telefono: '', bloque: '24.4', activo: true },
    { id: 'c4a2b3c4', nombre: 'Carlos Ruiz', telefono: '664 555 0104', bloque: '24.4', activo: true },
    { id: 'c5a2b3c4', nombre: 'Lupita Gómez', telefono: '646 555 0105', bloque: 'general', activo: true },
    { id: 'c6a2b3c4', nombre: 'Tienda La Esperanza', telefono: '646 555 0106', bloque: '24.8', activo: true },
  ];
  const vendedores = [
    { id: 'v1d2e3f4', registro: 1, nombre: 'Faby Aguirre (ejemplo)', alias: 'Faby Saldos', bloque: 'general', estatus: 'activo', activo: true, telefono: '646 555 0201', ingreso: '2026-01-10', vence: '2026-11-04', sin_foto_credencial: false },
    { id: 'v2d2e3f4', registro: 2, nombre: 'Ana Torres (ejemplo)', alias: 'Ana Ropa', bloque: '24.2', estatus: 'alerta_riesgo', activo: true, telefono: '646 555 0202', ingreso: '2026-02-02', vence: '2026-12-20', sin_foto_credencial: false },
    { id: 'v3d2e3f4', registro: 3, nombre: 'Luis Medina (ejemplo)', alias: 'Luis Tech', bloque: '24.4', estatus: 'activo', activo: true, telefono: '646 555 0203', ingreso: '2026-03-15', vence: '2026-11-01', sin_foto_credencial: true },
    { id: 'v4d2e3f4', registro: 4, nombre: 'Sofía Ramos (ejemplo)', alias: 'Sofi Outlet', bloque: '24.8', estatus: 'inactivo', activo: false, telefono: '', ingreso: '2025-11-20', vence: '2026-09-30', sin_foto_credencial: true },
  ];
  const P = (id, estado, cliente, vendedor, guia, paqueteria, capt, desde, notas = '') => ({
    id, estado, cliente, vendedor, guia, paqueteria, capturado_en: capt, en_estado_desde: desde, notas,
  });
  const paquetes = [
    P('p0000001', 'recibido', 'c1a2b3c4', 'v1d2e3f4', null, null, hace(1), hace(1)),
    P('p0000002', 'recibido', 'c2a2b3c4', 'v1d2e3f4', null, null, hace(1, 3), hace(1, 3)),
    P('p0000003', 'recibido', 'c3a2b3c4', 'v3d2e3f4', null, null, hace(2), hace(2)),
    P('p0000004', 'en_transito', 'c4a2b3c4', 'v3d2e3f4', '772100334455', 'Estafeta', hace(4), hace(2)),
    P('p0000005', 'en_transito', 'c5a2b3c4', 'v2d2e3f4', '772100334455', 'Estafeta', hace(4), hace(2)),
    P('p0000006', 'listo_entrega', 'c1a2b3c4', 'v2d2e3f4', '883300112233', 'Paquete Express', hace(8), hace(6)),
    P('p0000007', 'listo_entrega', 'c6a2b3c4', 'v1d2e3f4', '883300112233', 'Paquete Express', hace(8), hace(5), 'Cliente pidió avisar por la tarde'),
    P('p0000008', 'listo_entrega', 'c3a2b3c4', 'v3d2e3f4', '991144227788', 'FedEx', hace(9), hace(3)),
    P('p0000009', 'entregado', 'c2a2b3c4', 'v1d2e3f4', '551122993344', 'DHL', hace(10), hace(7)),
    P('p0000010', 'entregado', 'c4a2b3c4', 'v2d2e3f4', '551122993344', 'FedEx', hace(10), hace(6), 'Misma guía que otro paquete con otra paquetería (ejemplo)'),
    P('p0000011', 'recibido', 'c5a2b3c4', 'v4d2e3f4', null, null, hace(6), hace(6)),
  ];
  const historial = {};
  for (const p of paquetes) {
    const orden = ['recibido', 'en_transito', 'listo_entrega', 'entregado'];
    const hasta = orden.indexOf(p.estado);
    historial[p.id] = orden.slice(0, hasta + 1).map((estado, i) => ({
      estado,
      creado_en: i === hasta ? p.en_estado_desde : new Date(p.capturado_en.getTime() + i * 3600000 * 5),
    }));
  }
  const notificaciones = [
    { paquete: 'p0000006', estado_envio: 'enviado', error: null, enviado_en: hace(6) },
    { paquete: 'p0000007', estado_envio: 'enviado', error: null, enviado_en: hace(5) },
    { paquete: 'p0000008', estado_envio: 'error', error: 'El cliente no tiene teléfono registrado', enviado_en: hace(3) },
    { paquete: 'p0000005', estado_envio: 'error', error: 'Servicio de WhatsApp desconectado (ejemplo)', enviado_en: hace(2) },
  ];
  return { clientes, vendedores, paquetes, historial, notificaciones };
}
