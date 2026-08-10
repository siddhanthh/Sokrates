import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sokrates — Real-Time Intellectual Discussion & Matchmaking',
  description: 'Connect with curious minds for deep 1-on-1 dialogue and group discussions, enhanced by AI argument mapping and post-chat digests.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
