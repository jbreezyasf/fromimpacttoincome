export type Episode = {
  id?: string; slug: string; title: string; description: string; guest_name: string; guest_bio: string;
  guest_links: {label:string;url:string}[]; youtube_url: string | null; media_url: string | null;
  media_kind: 'audio'|'video'|null; transcript: string; article: string; meta_description: string;
  status: 'draft'|'published'; published_at: string | null;
};
export function youtubeId(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)) return u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
  } catch { /* invalid URL */ }
  return null;
}
export function validWebUrl(value: string) {
  try { const u = new URL(value); return ['https:','http:'].includes(u.protocol); } catch { return false; }
}
export function setPageMeta(title: string, description: string) {
  document.title = title;
  let el = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!el) { el = document.createElement('meta'); el.name='description'; document.head.append(el); }
  el.content = description;
}
