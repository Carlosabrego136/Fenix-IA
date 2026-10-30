import './globals.css';
import RegistroSW from '@/components/RegistroSW';
import { SCRIPT_TEMA } from '@/components/tema';

export const metadata = {
  title: 'Fénix IA',
  description: 'Su asistente de inteligencia artificial para administrar el negocio de envíos.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Fénix IA',
  appleWebApp: { capable: true, title: 'Fénix IA', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-MX" data-tema="claro" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        {children}
        <RegistroSW />
      </body>
    </html>
  );
}
