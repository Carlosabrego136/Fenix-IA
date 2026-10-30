'use client';
import { useState } from 'react';
import Emblema from '@/components/Emblema';
import { api } from '@/components/api';

export default function Login() {
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (!clave || cargando) return;
    setCargando(true);
    setError('');
    try {
      await api('/api/login', { method: 'POST', body: JSON.stringify({ password: clave }) });
      window.location.href = '/';
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  return (
    <div className="centro">
      <form className="tarjeta" onSubmit={entrar}>
        <Emblema tam={84} />
        <h1>Fénix IA</h1>
        <p>Su asistente para administrar el negocio. Escriba su contraseña para entrar.</p>
        <input
          className="campo"
          type={ver ? 'text' : 'password'}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          autoFocus
          aria-label="Contraseña"
        />
        {error && <p className="error-texto" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={cargando || !clave}>{cargando ? 'Entrando…' : 'Entrar'}</button>
        <button type="button" className="enlace-fila" style={{ justifyContent: 'center', marginTop: 8 }} onClick={() => setVer((v) => !v)}>
          {ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        </button>
      </form>
    </div>
  );
}
