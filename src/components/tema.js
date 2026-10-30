// Tema de la app: "claro" por defecto, "oscuro" opcional. Se guarda solo en este navegador.
export const CLAVE_TEMA = 'fenix_tema';
const COLOR = { claro: '#ffffff', oscuro: '#060b16' };

export function temaActual() {
  try {
    return document.documentElement.dataset.tema === 'oscuro' ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export function aplicarTema(t) {
  const tema = t === 'oscuro' ? 'oscuro' : 'claro';
  document.documentElement.dataset.tema = tema;
  try { localStorage.setItem(CLAVE_TEMA, tema); } catch {}
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', COLOR[tema]);
  return tema;
}

// Script que corre antes de pintar para evitar el parpadeo.
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CLAVE_TEMA}');document.documentElement.dataset.tema=t==='oscuro'?'oscuro':'claro';if(t==='oscuro'){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','${COLOR.oscuro}')}}catch(e){document.documentElement.dataset.tema='claro'}`;
