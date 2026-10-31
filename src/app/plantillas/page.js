'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, copiarTexto, abrirWhatsapp } from '@/components/api';

export default function Plantillas() {
  const [lista, setLista] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [editando, setEditando] = useState(null); // { id, nombre, descripcion, contenido }
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [aBorrar, setABorrar] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      setError('');
      setLista((await api('/api/plantillas')).plantillas);
    } catch (e) {
      setError(e.message);
      setLista([]);
    }
  }
  useEffect(() => {
    cargar();
  }, []);

  async function copiar(p) {
    const ok = await copiarTexto(p.contenido);
    setAviso(ok ? 'Texto copiado.' : 'No pude copiar; selecciónelo manualmente.');
    setTimeout(() => setAviso(''), 2200);
  }
  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    try {
      if (editando.id) await api(`/api/plantillas/${editando.id}`, { method: 'PUT', body: JSON.stringify({ descripcion: editando.descripcion, contenido: editando.contenido }) });
      else await api('/api/plantillas', { method: 'POST', body: JSON.stringify({ nombre: editando.nombre, descripcion: editando.descripcion, contenido: editando.contenido }) });
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }
  async function borrar() {
    const p = aBorrar;
    setABorrar(null);
    try {
      await api(`/api/plantillas/${p.id}`, { method: 'DELETE' });
      setAbierta(null);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="pagina">
      <div className="pagina__cab">
        <Link href="/" className="icono-btn" aria-label="Volver al chat">←</Link>
        <h1>Plantillas</h1>
      </div>
      <p className="intro">Sus textos de siempre (la dinámica, la cotización, los mensajes de servicio). La IA los usa tal cual y solo cambia los datos del cliente. Aquí puede verlos, copiarlos y corregirlos.</p>
      {error && <div className="aviso-error" role="alert">{error}</div>}
      {aviso && <div className="toast" role="status">{aviso}</div>}

      <div className="caja">
        <button className="btn" onClick={() => setEditando({ nombre: '', descripcion: '', contenido: '' })}>Nueva plantilla</button>
      </div>

      <div className="caja">
        <h2>Guardadas {lista ? `(${lista.length})` : ''}</h2>
        {lista === null && <p className="vacio-txt">Cargando…</p>}
        {lista?.length === 0 && <p className="vacio-txt">Todavía no hay plantillas. Si es la primera vez, pídale a su soporte técnico que cargue la información inicial.</p>}
        {lista?.map((p) => (
          <div className="item" key={p.id} style={{ flexDirection: 'column' }}>
            <div style={{ width: '100%', cursor: 'pointer' }} onClick={() => setAbierta(abierta === p.id ? null : p.id)}>
              <b>{p.nombre.replace(/_/g, ' ')}</b>
              <small style={{ display: 'block', color: 'var(--apagado)' }}>{p.descripcion}</small>
            </div>
            {abierta === p.id && (
              <div style={{ width: '100%' }}>
                <div className="plantilla-texto">{p.contenido}</div>
                <div className="fila-botones">
                  <button className="btn-mini" onClick={() => copiar(p)}>Copiar</button>
                  <button className="btn-mini" onClick={() => abrirWhatsapp(p.contenido)}>WhatsApp</button>
                  <button className="btn-mini" onClick={() => setEditando({ id: p.id, nombre: p.nombre, descripcion: p.descripcion, contenido: p.contenido })}>Editar</button>
                  <button className="btn-mini" onClick={() => setABorrar(p)}>Borrar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {editando && (
        <div className="fondo-modal" onClick={() => setEditando(null)}>
          <form className="modal" style={{ width: 'min(100%, 560px)' }} onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>{editando.id ? 'Editar plantilla' : 'Nueva plantilla'}</h3>
            <div className="fila-form">
              {!editando.id && <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} placeholder="Nombre corto (ej. promo_navidad)" maxLength={60} aria-label="Nombre" />}
              <input value={editando.descripcion} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} placeholder="Para qué sirve" maxLength={200} aria-label="Descripción" />
              <textarea className="plantilla-edit" value={editando.contenido} onChange={(e) => setEditando({ ...editando, contenido: e.target.value })} maxLength={8000} aria-label="Texto" />
              <p style={{ margin: 0, color: 'var(--apagado)', fontSize: '.85rem' }}>No escriba aquí números de tarjeta ni cuentas bancarias.</p>
            </div>
            <div className="modal__botones" style={{ marginTop: 14 }}>
              <button type="button" className="btn btn-sec" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn" type="submit" disabled={guardando || editando.contenido.trim().length < 3 || (!editando.id && !editando.nombre.trim())}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      )}

      {aBorrar && (
        <div className="fondo-modal" onClick={() => setABorrar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>¿Borrar esta plantilla?</h3>
            <p>“{aBorrar.nombre.replace(/_/g, ' ')}” se borrará para siempre.</p>
            <div className="modal__botones">
              <button className="btn btn-sec" onClick={() => setABorrar(null)}>Cancelar</button>
              <button className="btn btn-peligro" onClick={borrar}>Borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
