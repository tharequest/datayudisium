import './globals.css';

export const metadata = {
  title: 'Dashboard Yudisium FMIPA UNTAN',
  description: 'Data peserta yudisium Fakultas MIPA Universitas Tanjungpura',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
