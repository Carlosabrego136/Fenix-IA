'use client';
import { useEffect } from 'react';

export default function RegistroSW() {
  useEffect(() => {
    const seguro = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if ('serviceWorker' in navigator && seguro) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
