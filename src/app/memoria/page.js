'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fechaCorta } from '@/components/api';

const NOMBRES = { definicion: 'Definición', regla: 'Regla', preferencia: 'Preferencia', persona: 'Persona', dato: 'Dato' };
const NUM = (n) => new Intl.NumberFormat('es-MX').format(n || 0);

export default function Memoria() {
  const [recuerdos, setRecuerdos] = useState(null);
  const [categorias, setCategorias] = useState(Object.keys(NOMBRES));
  const [uso, setUso] = useState(null);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [cat, setCat] = useState('dato');
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  async function cargar() {
    try {
      const d = await api('/api/recuerdos');
      setRecuerdos(d.recuerdos);
      setCategorias(d.categorias);
    } catch (e) {
      setError(e.message);
      setRecuerdos([]);
    }
    api('/api/uso').then(setUso).catch(() => {});
  }
  useEffect(() => {
    cargar();
  }, []);

  async function guardar(e) {
    e.preventDefault();
    if (nuevo.trim().length < 4 || guardando) return;
    setGuardando(true);
    setError('');
    try {
      await api('/api/recuerdos', { method: 'POST', body: JSON.stringify({ categoria: cat, contenido: nuevo }) });
      setNuevo('');
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    const r = aBorrar;
    setABorrar(null);
    try {
      await api(`/api/recuerdos/${r.id}`, { method: 'DELETE' });
      setRecuerdos((rs) => rs.filter((x) => x.id !== r.id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="pagina">
      <div className="pagina__cab">
        <Link href="/" className="icono-btn" aria-label="Volver al chat">←</Link>
        <h1>Lo que he aprendido</h1>
      </div>
      <p className="intro">
        Aquí está todo lo que su asistente recuerda de usted y de su negocio, aunque cierre los chats. Puede borrar lo que ya no sirva o enseñarle algo nuevo.
      </p>

      {error && <div className="aviso-error" role="alert">{error}</div>}

      <div className="caja">
        <h2>Enseñarle algo nuevo</h2>
        <form className="fila-form" onSubmit={guardar}>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Tipo de recuerdo">
            {categorias.map((c) => <option key={c} value={c}>{NOMBRES[c] || c}</option>)}
          </select>
          <textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} maxLength={500} placeholder="Por ejemplo: “Recogido” significa que ya se lo llevó la paquetería." aria-label="Qué debe recordar" />
          <button className="btn" type="submit" disabled={guardando || nuevo.trim().length < 4}>{guardando ? 'Guardando…' : 'Guardar en su memoria'}</button>
        </form>
      </div>

      <div className="caja">
        <h2>Recuerdos guardados {recuerdos ? `(${recuerdos.length})` : ''}</h2>
        {recuerdos === null && <p className="vacio-txt">Cargando…</p>}
        {recuerdos?.length === 0 && <p className="vacio-txt">Todavía no ha aprendido nada. Cuando usted le explique cómo trabaja su negocio, lo anotará aquí.</p>}
        {recuerdos?.map((r) => (
          <div className="recuerdo" key={r.id}>
            <div className="recuerdo__txt">
              <span className="etiqueta">{NOMBRES[r.categoria] || r.categoria}</span>
              <div>{r.contenido}</div>
              <small style={{ color: 'var(--apagado)' }}>{fechaCorta(r.actualizado_en || r.creado_en)}</small>
            </div>
            <button className="btn-mini" onClick={() => setABorrar(r)}>Olvidar</button>
          </div>
        ))}
      </div>

      {uso && !uso.sinMemoria && (
        <div className="caja">
          <h2>Uso de la IA</h2>
          <div className="cifras">
            <div className="cifra"><b>{uso.hoy?.mensajes ?? 0}/{uso.limiteDiario}</b><span>mensajes hoy</span></div>
            <div className="cifra"><b>{NUM(uso.mes?.mensajes)}</b><span>mensajes este mes</span></div>
            <div className="cifra"><b>{NUM((uso.mes?.tokens_in || 0) + (uso.mes?.tokens_out || 0))}</b><span>tokens este mes</span></div>
          </div>
        </div>
      )}

      {aBorrar && (
        <div className="fondo-modal" onClick={() => setABorrar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>¿Olvidar esto?</h3>
            <p>“{aBorrar.contenido}” se borrará de su memoria para siempre.</p>
            <div className="modal__botones">
              <button className="btn btn-sec" onClick={() => setABorrar(null)}>Cancelar</button>
              <button className="btn btn-peligro" onClick={borrar}>Olvidar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
