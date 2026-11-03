import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { shareMetadata } from '../share-metadata.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function metadataHtml(template, edition, slug='', page) {
  const origin='https://renungan.ehopindonesia.com';
  const {title,description,pageNumber}=shareMetadata(edition,slug ? page : undefined);
  const image=edition?.image || `${origin}/assets/sampul-november-2026.jpg`;
  const url=origin+(slug?'/'+encodeURIComponent(slug):'/')+(slug && pageNumber ? `?halaman=${pageNumber}&layar=penuh` : '');
  const tags=[['og:type','website'],['og:site_name','Renungan Harian El-Bethel'],['og:locale','id_ID'],['og:title',title],['og:description',description],['og:url',url],['og:image',image],['og:image:secure_url',image],['og:image:alt',title]];
  return template.replace(/<title>[\s\S]*?<\/title>/,`<title>${escape(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${escape(description)}" />`)
    .replace('</head>',`${tags.map(([name,value])=>`<meta property="${name}" content="${escape(value)}" />`).join('\n')}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:image" content="${escape(image)}" />
<link rel="canonical" href="${escape(url)}" />
</head>`);
}

export default async function handler(req,res) {
  const slug=typeof req.query?.slug==='string'?req.query.slug:'';
  const template=await readFile(join(process.cwd(),'index.html'),'utf8');
  if(slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return res.status(404).send('Edisi tidak ditemukan.');
  let edition=null,failed=false;
  try {
    // Only the browser's public configuration is used; never a service-role key.
    const config=await readFile(join(process.cwd(),'config.js'),'utf8');
    const base=config.match(/supabaseUrl\s*:\s*['"]([^'"]+)/)?.[1];
    const key=config.match(/publishableKey\s*:\s*['"]([^'"]+)/)?.[1];
    if(!base||!key||key.startsWith('sb_secret_'))throw new Error('Invalid public configuration');
    const query=new URL(base+'/rest/v1/renungan_editions');
    query.searchParams.set('select','slug,title,theme,cover_path,edition_year,edition_month,page_count');
    query.searchParams.set('is_published','eq.true');
    query.searchParams.set('limit','1');
    if(slug)query.searchParams.set('slug','eq.'+slug);
    else query.searchParams.set('order','edition_year.desc,edition_month.desc');
    const response=await fetch(query,{headers:{apikey:key},signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error('Catalog unavailable');
    edition=(await response.json())[0]||null;
    if(edition?.cover_path)edition.image=base+'/storage/v1/object/public/renungan-publik/'+edition.cover_path.split('/').map(encodeURIComponent).join('/');
  }catch {failed=true;}
  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control',failed?'no-store':'public, max-age=0, s-maxage=60');
  // Missing or draft editions must never expose their metadata to crawlers.
  res.status(slug&&!edition&&!failed?404:200).send(metadataHtml(template,edition,slug,req.query?.halaman));
}
