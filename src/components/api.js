// Pequeño ayudante para llamar a la API desde las pantallas.
export async function api(url, opciones = {}) {
  const r = await fetch(url, {
    ...opciones,
    headers: { 'content-type': 'application/json', ...(opciones.headers || {}) },
  });
  const datos = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.startsWith('/api/login')) {
    window.location.href = '/login';
    throw new Error('Su sesión venció.');
  }
  if (!r.ok) throw new Error(datos.error || 'Algo salió mal. Intente de nuevo.');
  return datos;
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const t = document.createElement('textarea');
      t.value = texto;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(t);
      return ok;
    } catch {
      return false;
    }
  }
}

export function abrirWhatsapp(texto) {
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
}

export function fechaCorta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy.getTime() - 86400000).toDateString() === d.toDateString();
  const hora = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  if (mismoDia) return `Hoy, ${hora}`;
  if (ayer) return `Ayer, ${hora}`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
