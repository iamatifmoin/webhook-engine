import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Webhook Engine',
  description: 'Dashboard UI for the webhook automation engine demo.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
