import './globals.css';

export const metadata = {
  title: 'Overseas Remittance Mock',
  description: 'Minimal mock for overseas remittance workflow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
