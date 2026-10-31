'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/components/api';

const ESTADOS = { pendiente: ['ambar', 'Pendiente'], comprobante_recibido: ['verde', 'Comprobante recibido'], pagado: ['verde', 'Pagado'] };
const fecha = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '');
const dinero = (n) => (n == null ? 'sin total' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n));

export default function Pagos() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [f, setF] = useState({ cliente: '', total: '', fecha_limite: '' });
  const [guardando, setGuardando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  async function cargar() {
    try {
      setError('');
      setDatos(await api('/api/pagos'));
    } catch (e) {
      setError(e.message);
      setDatos({ pagos: [] });
    }
  }
  useEffect(() => {
    cargar();
  }, []);

  async function agregar(e) {
    e.preventDefault();
    if (!f.cliente.trim() || guardando) return;
    setGuardando(true);
    try {
      await api('/api/pagos', { method: 'POST', body: JSON.stringify({ cliente: f.cliente, total: f.total === '' ? null : Number(f.total), fecha_limite: f.fecha_limite || null }) });
      setF({ cliente: '', total: '', fecha_limite: '' });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }
  async function estado(p, e) {
    try {
      await api(`/api/pagos/${p.id}`, { method: 'PATCH', body: JSON.stringify({ estado: e }) });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }
  async function quitar() {
    const p = aBorrar;
    setABorrar(null);
    try {
      await api(`/api/pagos/${p.id}`, { method: 'DELETE' });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="pagina">
      <div className="pagina__cab">
        <Link href="/" className="icono-btn" aria-label="Volver al chat">←</Link>
        <h1>Pagos de la semana</h1>
      </div>
      <p className="intro">Aquí lleva el control de quién ya mandó su comprobante. La IA no ve Messenger ni verifica depósitos: usted revisa y marca.</p>
      {error && <div className="aviso-error" role="alert">{error}</div>}

      <div className="caja">
        <h2>Anotar un pago esperado</h2>
        <form className="fila-form" onSubmit={agregar}>
          <input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} placeholder="Nombre del cliente" maxLength={120} aria-label="Cliente" />
          <div className="form-linea">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} placeholder="Total (MXN)" aria-label="Total" />
            <input type="date" value={f.fecha_limite} onChange={(e) => setF({ ...f, fecha_limite: e.target.value })} aria-label="Fecha límite" />
          </div>
          <button className="btn" type="submit" disabled={guardando || !f.cliente.trim()}>{guardando ? 'Guardando…' : 'Anotar pago'}</button>
        </form>
      </div>

      <div className="caja">
        <h2>Pagos {datos ? `(${datos.pagos.length})` : ''}</h2>
        {datos === null && <p className="vacio-txt">Cargando…</p>}
        {datos?.pagos.length === 0 && <p className="vacio-txt">Todavía no hay pagos anotados. También puede decirle a la IA: “anota que Karina debe $2,300 para el jueves”.</p>}
        {datos?.pagos.map((p) => {
          const [color, texto] = ESTADOS[p.estado] || [];
          return (
            <div className="item" key={p.id}>
              <div className="item__cuerpo">
                <b>{p.cliente}</b> <span className={'nivel ' + color}>{texto}</span>
                <small>{dinero(p.total)} · semana del {fecha(p.semana_de)}{p.fecha_limite ? ` · límite ${fecha(p.fecha_limite)}` : ''}</small>
                {p.notas && <small>{p.notas}</small>}
              </div>
              <div className="item__acciones">
                {p.estado === 'pendiente' && <button className="btn-mini" onClick={() => estado(p, 'comprobante_recibido')}>Ya mandó comprobante</button>}
                {p.estado !== 'pagado' && <button className="btn-mini" onClick={() => estado(p, 'pagado')}>Pagado</button>}
                {p.estado !== 'pendiente' && <button className="btn-mini" onClick={() => estado(p, 'pendiente')}>Regresar</button>}
                <button className="btn-mini" onClick={() => setABorrar(p)}>Quitar</button>
              </div>
            </div>
          );
        })}
      </div>

      {aBorrar && (
        <div className="fondo-modal" onClick={() => setABorrar(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>¿Quitar este pago?</h3>
            <p>Se borrará el pago de {aBorrar.cliente} de la lista.</p>
            <div className="modal__botones">
              <button className="btn btn-sec" onClick={() => setABorrar(null)}>Cancelar</button>
              <button className="btn btn-peligro" onClick={quitar}>Quitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
