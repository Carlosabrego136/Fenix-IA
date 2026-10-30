'use client';
// Mini formato seguro (sin HTML crudo): párrafos, listas, **negritas**, `código` y bloques ``` para
// mensajes listos para copiar o mandar por WhatsApp.
import { Fragment } from 'react';

function inline(texto, clave) {
  const partes = texto.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return partes.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={clave + i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return <code key={clave + i}>{p.slice(1, -1)}</code>;
    return <Fragment key={clave + i}>{p}</Fragment>;
  });
}

export function analizar(texto) {
  const lineas = String(texto).replace(/\r/g, '').split('\n');
  const bloques = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (/^```/.test(l)) {
      const buf = [];
      i++;
      while (i < lineas.length && !/^```/.test(lineas[i])) buf.push(lineas[i++]);
      i++;
      bloques.push({ tipo: 'codigo', texto: buf.join('\n').trim() });
    } else if (/^\s*[-*•]\s+/.test(l)) {
      const items = [];
      while (i < lineas.length && /^\s*[-*•]\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*[-*•]\s+/, ''));
      bloques.push({ tipo: 'ul', items });
    } else if (/^\s*\d+[.)]\s+/.test(l)) {
      const items = [];
      while (i < lineas.length && /^\s*\d+[.)]\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*\d+[.)]\s+/, ''));
      bloques.push({ tipo: 'ol', items });
    } else if (!l.trim()) {
      i++;
    } else {
      const buf = [];
      while (i < lineas.length && lineas[i].trim() && !/^```/.test(lineas[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lineas[i])) buf.push(lineas[i++]);
      bloques.push({ tipo: 'p', texto: buf.join('\n').replace(/^#+\s*/gm, '') });
    }
  }
  return bloques;
}

export default function Markdown({ texto, alMensaje }) {
  return (
    <>
      {analizar(texto).map((b, n) => {
        if (b.tipo === 'p')
          return (
            <p key={n}>
              {b.texto.split('\n').map((ln, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  {inline(ln, `${n}-${j}-`)}
                </Fragment>
              ))}
            </p>
          );
        if (b.tipo === 'ul') return <ul key={n}>{b.items.map((t, j) => <li key={j}>{inline(t, `${n}-${j}-`)}</li>)}</ul>;
        if (b.tipo === 'ol') return <ol key={n}>{b.items.map((t, j) => <li key={j}>{inline(t, `${n}-${j}-`)}</li>)}</ol>;
        return (
          <div className="mensaje-listo" key={n}>
            <div className="mensaje-listo__titulo">Mensaje listo para enviar</div>
            <div className="mensaje-listo__texto">{b.texto}</div>
            {alMensaje && (
              <div className="acciones">
                <button type="button" className="btn-mini" onClick={() => alMensaje.copiar(b.texto)}>Copiar</button>
                <button type="button" className="btn-mini btn-wa" onClick={() => alMensaje.whatsapp(b.texto)}>WhatsApp</button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
