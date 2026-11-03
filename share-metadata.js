// Shared by the reader and server so native sharing and link previews agree.
export function shareMetadata(edition, page) {
  const fallbackTitle = edition ? `${edition.title}${edition.theme ? ' — ' + edition.theme : ''}` : 'Renungan Harian El-Bethel';
  const year = Number(edition?.edition_year);
  const month = Number(edition?.edition_month);
  const validEdition = Number.isInteger(year) && year >= 1000 && year <= 9999 && Number.isInteger(month) && month >= 1 && month <= 12;
  const validPage = (typeof page === 'string' || typeof page === 'number') && /^[1-9]\d*$/.test(String(page)) && Number.isSafeInteger(Number(page)) && (!edition?.page_count || Number(page) <= Number(edition.page_count));
  const pageNumber = validPage ? Number(page) : null;
  if (!validEdition) return { title: fallbackTitle, description: 'Baca Renungan Harian El-Bethel dan temukan edisi renungan setiap bulan.', pageNumber };
  const date = new Date(Date.UTC(year, month - 1, 1));
  const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long', timeZone: 'UTC' }).format(date);
  const description = `Renungan El-Bethel Bulan ${monthName} ${year}${edition.theme ? ' - ' + edition.theme : ''}`;
  const day = pageNumber === null ? 0 : pageNumber - 2;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return { title: fallbackTitle, description, pageNumber };
  date.setUTCDate(day);
  const weekday = new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'UTC' }).format(date);
  return { title: `Renungan ${weekday}, ${day} ${monthName} ${year}`, description, pageNumber };
}
