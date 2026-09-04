import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import '@/styles/globals.css';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

export const metadata: Metadata = {
  title: 'Padel Tournament Manager',
  description: 'Gestione completa tornei di Padel cross-platform',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Padel Manager', statusBarStyle: 'default' }
};

export const viewport: Viewport = {
  themeColor: '#0f766e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <ServiceWorkerRegister />
        <div className="app-shell">
          <header className="topbar">
            <Link href="/" className="brand" aria-label="Homepage Padel Tournament Manager">
              <span className="brand-mark">PT</span>
              <span>Padel Tournament Manager</span>
            </Link>
            <nav className="nav" aria-label="Navigazione principale">
              <Link href="/tournaments">Tornei</Link>
              <Link href="/new-tournament">Nuovo torneo</Link>
              <Link href="/tournaments/demo-tournament">Demo</Link>
            </nav>
          </header>
          {children}
          <footer className="footer">PWA responsive, mobile-first, estendibile con API, PostgreSQL, audit log e test automatici.</footer>
        </div>
      </body>
    </html>
  );
}
