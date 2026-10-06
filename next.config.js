/** @type {import('next').NextConfig} */
const noStore = [{ key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' }];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      // Halaman admin & semua API tidak boleh di-cache browser,
      // supaya tombol Back/Forward tidak menampilkan halaman admin lama.
      { source: '/admin/:path*', headers: noStore },
      { source: '/api/:path*', headers: noStore },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};
