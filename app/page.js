import Dashboard from '@/components/Dashboard';
import { getSettings } from '@/lib/settings';
import { loadRows } from '@/lib/sheet';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const s = await getSettings();
  return { title: `Dashboard Yudisium FMIPA UNTAN, Periode ${s.periode} TA ${s.tahunAjar}` };
}

export default async function Page() {
  const s = await getSettings();
  let rows = [];
  let error = null;
  if (!s.sheetUrl) {
    error = 'Link spreadsheet belum diatur. Admin dapat mengaturnya di /admin.';
  } else {
    try {
      rows = await loadRows(s.sheetUrl);
    } catch (e) {
      error = e.message;
    }
  }
  return (
    <Dashboard
      initial={{ periode: s.periode, tahunAjar: s.tahunAjar, rows, error, fetchedAt: new Date().toISOString() }}
    />
  );
}
