'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Emblema from './Emblema';
import Markdown from './Markdown';
import { api, abrirWhatsapp, copiarTexto, fechaCorta } from './api';

const SUGERENCIAS = [
  '¿Cómo vamos con los paquetes esta semana?',
  '¿Qué paquetes llevan mucho tiempo sin entregarse?',
  '¿Hay guías repetidas que me puedan causar problemas?',
  '¿Qué avisos de WhatsApp fallaron?',
];

const IconoMenu = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
const IconoMas = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
const IconoBasura = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" /></svg>
);
const IconoEnviar = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [activo, setActivo] = useState(null);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [info, setInfo] = useState(null);
  const [toast, setToast] = useState('');
  const [instalador, setInstalador] = useState(null);
  const [ayudaIos, setAyudaIos] = useState(false);
  const activoRef = useRef(null);
  const finRef = useRef(null);
  const areaRef = useRef(null);
  const cargaRef = useRef(0);

  const fijarActivo = useCallback((id) => {
    activoRef.current = id;
    setActivo(id);
  }, []);

  useEffect(() => {
    api('/api/uso').then(setInfo).catch(() => {});
    api('/api/chats').then((d) => setChats(d.chats)).catch((e) => setError(e.message));
    const antes = (e) => {
      e.preventDefault();
      setInstalador(e);
    };
    window.addEventListener('beforeinstallprompt', antes);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalada = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (ios && !instalada) setAyudaIos(true);
    return () => window.removeEventListener('beforeinstallprompt', antes);
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensajes, enviando]);

  useEffect(() => {
    const a = areaRef.current;
    if (!a) return;
    a.style.height = 'auto';
    a.style.height = Math.min(a.scrollHeight, 190) + 'px';
  }, [texto]);

  const avisar = (t) => {
    setToast(t);
    setTimeout(() => setToast(''), 1800);
  };

  async function abrirChat(id) {
    setMenu(false);
    setError('');
    fijarActivo(id);
    setMensajes([]);
    const mio = ++cargaRef.current;
    try {
      const d = await api(`/api/chats/${id}`);
      if (cargaRef.current === mio) setMensajes(d.mensajes);
    } catch (e) {
      if (cargaRef.current === mio) setError(e.message);
    }
  }

  function nuevoChat() {
    cargaRef.current++;
    fijarActivo(null);
    setMensajes([]);
    setError('');
    setMenu(false);
    setTimeout(() => areaRef.current?.focus(), 50);
  }

  async function enviar(contenido) {
    const msg = (contenido ?? texto).trim();
    if (!msg || enviando) return;
    setError('');
    setEnviando(true);
    const origen = activoRef.current;
    const temporal = { id: 'tmp-' + Date.now(), rol: 'user', contenido: msg };
    setMensajes((m) => [...m, temporal]);
    setTexto('');
    try {
      const d = await api('/api/chat', { method: 'POST', body: JSON.stringify({ chatId: origen, mensaje: msg }) });
      setChats((cs) => {
        const sin = cs.filter((c) => c.id !== d.chatId);
        return [{ id: d.chatId, titulo: d.titulo, actualizado_en: new Date().toISOString() }, ...sin];
      });
      if (activoRef.current === origen) {
        if (origen === null) fijarActivo(d.chatId);
        setMensajes((m) => [...m.filter((x) => x.id !== temporal.id), { id: d.usuarioId, rol: 'user', contenido: msg }, d.mensaje]);
      }
    } catch (e) {
      if (activoRef.current === origen) {
        setMensajes((m) => m.filter((x) => x.id !== temporal.id));
        setTexto(msg);
      }
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  function alTeclear(e) {
    const tactil = window.matchMedia('(pointer: coarse)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !tactil) {
      e.preventDefault();
      enviar();
    }
  }

  async function ejecutarBorrado() {
    const c = confirmar;
    setConfirmar(null);
    try {
      if (c.tipo === 'uno') {
        await api(`/api/chats/${c.id}`, { method: 'DELETE' });
        setChats((cs) => cs.filter((x) => x.id !== c.id));
        if (activoRef.current === c.id) nuevoChat();
      } else {
        await api('/api/chats', { method: 'DELETE', body: JSON.stringify({ confirmar: true }) });
        setChats([]);
        nuevoChat();
      }
      avisar('Chat borrado');
    } catch (e) {
      setError(e.message);
    }
  }

  const acciones = {
    copiar: async (t) => avisar((await copiarTexto(t)) ? 'Copiado ✓' : 'No se pudo copiar'),
    whatsapp: (t) => abrirWhatsapp(t),
  };

  const tituloActivo = chats.find((c) => c.id === activo)?.titulo;
  const demo = info?.modos && (info.modos.ia === 'demo' || info.modos.datos === 'demo');
  const nombre = info?.asistente || 'Fénix IA';
  const saludo = info?.['dueña'] ? `Hola, ${info['dueña']}` : 'Hola';

  return (
    <div className="app">
      <div className={`fondo-menu ${menu ? 'abierto' : ''}`} onClick={() => setMenu(false)} />
      <aside className={`lateral ${menu ? 'abierto' : ''}`}>
        <div className="lateral__cab">
          <Emblema tam={40} />
          <div>
            <h1>{nombre}</h1>
            <small>{info?.negocio || ''}</small>
          </div>
        </div>
        <div className="lateral__nuevo">
          <button className="btn" onClick={nuevoChat}>+ Nuevo chat</button>
        </div>
        <div className="lista">
          {chats.length === 0 && <div className="lista__vacia">Todavía no hay chats. Escriba su primera pregunta.</div>}
          {chats.map((c) => (
            <div key={c.id} className={`chat-item ${c.id === activo ? 'activo' : ''}`}>
              <button className="chat-item__abrir" onClick={() => abrirChat(c.id)}>
                <span className="chat-item__titulo">{c.titulo}</span>
                <span className="chat-item__fecha">{fechaCorta(c.actualizado_en)}</span>
              </button>
              <button className="chat-item__borrar" aria-label={`Borrar chat ${c.titulo}`} onClick={() => setConfirmar({ tipo: 'uno', id: c.id, titulo: c.titulo })}>
                <IconoBasura />
              </button>
            </div>
          ))}
        </div>
        <div className="lateral__pie">
          <Link href="/memoria" className="enlace-fila">🧠 Lo que he aprendido</Link>
          {instalador && (
            <button className="enlace-fila" onClick={async () => { instalador.prompt(); await instalador.userChoice; setInstalador(null); }}>
              📲 Instalar app en este celular
            </button>
          )}
          {ayudaIos && <div className="uso">Para instalar en iPhone: toque Compartir y luego “Agregar a pantalla de inicio”.</div>}
          {chats.length > 0 && (
            <button className="enlace-fila peligro" onClick={() => setConfirmar({ tipo: 'todos' })}>Borrar todos los chats</button>
          )}
          <button className="enlace-fila" onClick={async () => { await api('/api/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login'; }}>Salir</button>
          {info && !info.sinMemoria && (
            <div className="uso">Hoy: {Math.min(info.hoy?.mensajes ?? 0, info.limiteDiario)} de {info.limiteDiario} mensajes</div>
          )}
        </div>
      </aside>

      <main className="principal">
        <div className="barra">
          <button className="icono-btn" aria-label="Abrir menú" onClick={() => setMenu(true)}><IconoMenu /></button>
          <div className="barra__titulo">{tituloActivo || nombre}</div>
          {demo && <span className="pildora">DEMO</span>}
          <button className="icono-btn" aria-label="Nuevo chat" onClick={nuevoChat}><IconoMas /></button>
        </div>

        <div className="mensajes">
          {mensajes.length === 0 && !enviando ? (
            <div className="vacio">
              <Emblema tam={72} />
              <h2>{saludo}. ¿En qué le ayudo hoy?</h2>
              <p>Consulto sus envíos, le aviso de lo que se pueda volver problema y le redacto mensajes para sus clientes.</p>
              <div className="sugerencias">
                {SUGERENCIAS.map((s) => (
                  <button key={s} className="sugerencia" onClick={() => enviar(s)}>{s}</button>
                ))}
              </div>
              {demo && <p style={{ marginTop: 22, fontSize: '.85rem' }}>Modo demostración: se muestran datos de ejemplo.</p>}
            </div>
          ) : (
            <div className="mensajes__col">
              {mensajes.map((m) => (
                <div key={m.id} className={`msg ${m.rol}`}>
                  <div className="burbuja">{m.rol === 'assistant' ? <Markdown texto={m.contenido} alMensaje={acciones} /> : m.contenido}</div>
                  {m.rol === 'assistant' && (
                    <div className="acciones">
                      <button className="btn-mini" onClick={() => acciones.copiar(m.contenido)}>Copiar respuesta</button>
                      <button className="btn-mini btn-wa" onClick={() => acciones.whatsapp(m.contenido)}>WhatsApp</button>
                    </div>
                  )}
                </div>
              ))}
              {enviando && (
                <div className="msg assistant">
                  <div className="burbuja pensando"><span className="puntos"><span /><span /><span /></span> Consultando su negocio…</div>
                </div>
              )}
              <div ref={finRef} />
            </div>
          )}
        </div>

        <div className="compositor">
          {error && <div className="aviso-error" role="alert">{error}</div>}
          <div className="compositor__fila">
            <textarea
              ref={areaRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={alTeclear}
              placeholder="Escriba su pregunta…"
              rows={1}
              maxLength={4000}
              aria-label="Mensaje"
            />
            <button className="btn" onClick={() => enviar()} disabled={enviando || !texto.trim()} aria-label="Enviar"><IconoEnviar /></button>
          </div>
          <div className="nota-pie">La IA puede equivocarse. Confirme los datos importantes antes de actuar.</div>
        </div>
      </main>

      {confirmar && (
        <div className="fondo-modal" onClick={() => setConfirmar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmar.tipo === 'uno' ? '¿Borrar este chat?' : '¿Borrar todos los chats?'}</h3>
            <p>
              {confirmar.tipo === 'uno' ? `“${confirmar.titulo}” se borrará para siempre. ` : 'Se borrarán todas las conversaciones para siempre. '}
              Lo que la IA ha aprendido de usted no se borra; eso se maneja en “Lo que he aprendido”.
            </p>
            <div className="modal__botones">
              <button className="btn btn-sec" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="btn btn-peligro" onClick={ejecutarBorrado}>Borrar</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div style={{ position: 'fixed', bottom: 'calc(110px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', background: '#0f3a22', border: '1px solid #1c6b3e', color: '#b7f5cf', padding: '12px 20px', borderRadius: 14, zIndex: 60, fontWeight: 600 }}>{toast}</div>}
    </div>
  );
}
