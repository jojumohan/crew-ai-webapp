import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Chat', description: 'Real-time messaging' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-wa-dark text-wa-text h-screen overflow-hidden antialiased">{children}</body>
    </html>
  );
}
