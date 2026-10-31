'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/components/api';

const NIVEL = {
  decomiso: ['rojo', 'Pasó de 60 días'],
  multa: ['rojo', 'Ya cumplió 14 días'],
  hoy_ultimo_dia: ['rojo', 'HOY es el último día'],
  manana_ultimo_dia: ['ambar', 'Mañana es el último día'],
  atencion: ['ambar', 'Por vencer'],
  ok: ['verde', 'A tiempo'],
  fecha_futura: ['ambar', 'Revisar fecha'],
};
const fecha = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');

export default function Folios() {
  const [tab, setTab] = useState('pendiente');
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [confirmar, setConfirmar] = useState(null);

  async function cargar(t = tab) {
    try {
      setError('');
      setDatos(await api('/api/folios?estado=' + t));
    } catch (e) {
      setError(e.message);
      setDatos({ folios: [], resumen: null });
    }
  }
  useEffect(() => {
    setDatos(null);
    cargar(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function marcar(f, estado) {
    try {
      await api(`/api/folios/${f.id}`, { method: 'PATCH', body: JSON.stringify({ estado }) });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }
  async function quitar() {
    const f = confirmar;
    setConfirmar(null);
    try {
      await api(`/api/folios/${f.id}`, { method: 'DELETE' });
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const r = datos?.resumen;
  const c = r?.conteo || {};
  const vencidos = (c.multa || 0) + (c.decomiso || 0);

  return (
    <div className="pagina">
      <div className="pagina__cab">
        <Link href="/" className="icono-btn" aria-label="Volver al chat">←</Link>
        <h1>Folios PZ Express</h1>
      </div>
      <p className="intro">
        Los folios se registran platicando con la IA (mándele la foto del ticket o la lista). Aquí los ve, marca los que ya recogió y revisa cuáles están por vencer.
      </p>
      {error && <div className="aviso-error" role="alert">{error}</div>}

      {r && (
        <div className="chips">
          <span className="chip">{r.pendientes} pendientes</span>
          {vencidos > 0 && <span className="chip rojo">{vencidos} con 14 días o más</span>}
          {c.hoy_ultimo_dia > 0 && <span className="chip rojo">{c.hoy_ultimo_dia} vencen hoy</span>}
          {c.manana_ultimo_dia > 0 && <span className="chip ambar">{c.manana_ultimo_dia} vencen mañana</span>}
          {c.atencion > 0 && <span className="chip ambar">{c.atencion} a 10–11 días</span>}
          <span className="chip verde">{r.recogidos} recogidos</span>
        </div>
      )}

      <div className="pestanas">
        <button className={'pestana' + (tab === 'pendiente' ? ' activa' : '')} onClick={() => setTab('pendiente')}>Pendientes</button>
        <button className={'pestana' + (tab === 'recogido' ? ' activa' : '')} onClick={() => setTab('recogido')}>Recogidos</button>
      </div>

      <div className="caja">
        {datos === null && <p className="vacio-txt">Cargando…</p>}
        {datos && datos.folios.length === 0 && (
          <p className="vacio-txt">{tab === 'pendiente' ? 'No hay folios pendientes registrados. Mándele a la IA la foto de un ticket o la lista para empezar.' : 'Todavía no hay folios recogidos.'}</p>
        )}
        {datos?.folios.map((f) => {
          const [color, texto] = NIVEL[f.nivel] || [];
          return (
            <div className="item" key={f.id}>
              <div className="item__cuerpo">
                <b>{f.folio}</b>
                {f.estado === 'pendiente' && texto && <span className={'nivel ' + color}>{texto}</span>}
                <small>
                  Recepción {fecha(f.fecha_recepcion)}
                  {f.estado === 'pendiente' ? ` · ${f.dias_transcurridos} día(s) · último día sin multa: ${fecha(f.ultimo_dia_seguro)}` : ` · recogido ${fecha(f.fecha_recogido)}`}
                </small>
                {(f.destinatario || f.remitente) && <small>{[f.remitente, f.destinatario].filter(Boolean).join(' → ')}</small>}
                {f.recolector_numero && <small>Recolector foráneo #{f.recolector_numero}</small>}
                {f.veces_enviado > 1 && <small>Reenviado {f.veces_enviado} veces (duplicado detectado)</small>}
              </div>
              <div className="item__acciones">
                {f.estado === 'pendiente'
                  ? <button className="btn-mini" onClick={() => marcar(f, 'recogido')}>Recogido</button>
                  : <button className="btn-mini" onClick={() => marcar(f, 'pendiente')}>Regresar</button>}
                <button className="btn-mini" onClick={() => setConfirmar(f)}>Quitar</button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmar && (
        <div className="fondo-modal" onClick={() => setConfirmar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>¿Quitar este folio?</h3>
            <p>El folio {confirmar.folio} se borrará de la lista (por ejemplo si se registró por error). Si ya lo recogió, mejor use “Recogido”.</p>
            <div className="modal__botones">
              <button className="btn btn-sec" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button className="btn btn-peligro" onClick={quitar}>Quitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
