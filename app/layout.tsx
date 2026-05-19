import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Public Cam Dashboard',
  description: 'A world map of publicly-listed webcams and traffic cameras.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
