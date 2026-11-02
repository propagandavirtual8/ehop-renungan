import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=es2022';
import * as pdfjs from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
// tus-js-client is loaded from its prebuilt BROWSER bundle in index.html.
// The previous esm.sh entry could resolve to the Node build and reject browser File objects.

pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const CONFIG = window.RENUNGAN_CONFIG || {};
const BUCKET = 'renungan-publik';
const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
let db;
let flipInstance = null;
let readerTask = null;
let routeSerial = 0;
let activeAdminRows = [];
let editingId = null;
let activeReaderPdf = null;
let activeReaderPage = 0;

function safe(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function labelDate(row) { return `${MONTHS[row.edition_month - 1]} ${row.edition_year}`; }
function slugFor(year, month) { return `${MONTHS[Number(month) - 1].toLowerCase()}-${year}`; }
function publicUrl(path) { return path ? db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : ''; }
function hasConfig() { return CONFIG.supabaseUrl?.startsWith('https://') && !CONFIG.supabaseUrl.includes('GANTI-') && CONFIG.publishableKey && !CONFIG.publishableKey.includes('GANTI-'); }
function showError(message) { app.innerHTML = `<div class="container section"><div class="error-box">${safe(message)}</div><p><a class="plain-link" href="/" data-nav="/">← Kembali ke beranda</a></p></div>`; }
function setMessage(s, isError=false) { const el=document.getElementById('admin-message'); if(el){el.className=isError?'error-box':'notice'; el.textContent=s; el.classList.remove('hidden');} }
function cancelReader() {
  if (readerTask) { try { readerTask.destroy(); } catch(e) { /* Document already disposed */ } readerTask=null; }
  if (flipInstance) { try { flipInstance.destroy(); } catch(e) { /* Already disposed */ } flipInstance=null; }
  activeReaderPdf=null;
  overlay.classList.add('hidden'); document.getElementById('overlay-body').innerHTML='';
}
function go(path) { history.pushState({}, '', path); renderRoute(); if (location.hash === '#arsip') setTimeout(() => document.getElementById('arsip')?.scrollIntoView(), 50); else scrollTo(0,0); }
document.addEventListener('click', e => {
  const link = e.target.closest('a[data-nav]');
  if (!link || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault(); go(link.getAttribute('data-nav'));
});
window.addEventListener('popstate', renderRoute);
document.getElementById('overlay-close').onclick = closeOverlay;
function closeOverlay() { overlay.classList.add('hidden'); document.getElementById('overlay-body').innerHTML=''; }
overlay.onclick = e => { if(e.target === overlay) closeOverlay(); };
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeOverlay(); });

async function renderRoute() {
  const serial=++routeSerial;
  cancelReader();
  if (!hasConfig()) {
    app.innerHTML=`<div class="container section"><div class="notice"><strong>Konfigurasi Supabase belum diisi.</strong><p>Buka file <code>config.js</code>, isi URL proyek Supabase dan publishable/anon key. Jangan gunakan service_role atau secret key.</p></div></div>`;
    return;
  }
  try {
    if(!db) db=createClient(CONFIG.supabaseUrl, CONFIG.publishableKey);
    const path=decodeURIComponent(location.pathname).replace(/\/+$/,'') || '/';
    if(path === '/admin') await renderAdmin(serial);
    else if(path === '/') await renderHome(serial);
    else await renderReader(serial, path.slice(1));
  } catch(e) { if(serial===routeSerial) showError(e?.message || 'Terjadi kesalahan.'); }
}
function cover(row) {
  return row.cover_path
    ? `<img src="${safe(publicUrl(row.cover_path))}" alt="Sampul ${safe(labelDate(row))}" loading="lazy" />`
    : `<div class="fallback-cover"><span>RENUNGAN HARIAN</span><strong>${safe(row.theme || 'Setia dalam Firman')}</strong><span>EL-BETHEL · ${safe(labelDate(row))}</span></div>`;
}
async function renderHome(serial) {
  app.innerHTML = '<div class="loading-shell">Memuat katalog renungan...</div>';
  const {data: rows, error}=await db.from('renungan_editions').select('*').eq('is_published',true).order('edition_year',{ascending:false}).order('edition_month',{ascending:false});
  if(serial!==routeSerial) return;
  if(error) throw error;
  const latest=rows?.[0];
  app.innerHTML=`
    <section class="hero"><div class="hero-inner">
      <div><span class="eyebrow">Bertumbuh dalam firman setiap hari</span><h1>Renungan Harian<br/>El-Bethel</h1><p>Perjalanan iman yang dibangun melalui firman Tuhan. Baca edisi terbaru, renungkan setiap hari, dan bagikan pengharapan kepada sesama.</p>
        <div class="hero-actions">${latest ? `<a class="btn btn-cream" href="/${safe(latest.slug)}" data-nav="/${safe(latest.slug)}">Baca edisi terbaru ↗</a>` : '<a href="#arsip" class="btn btn-cream">Jelajahi Renungan</a>'}<a class="btn btn-soft" href="#arsip">Lihat semua edisi ↓</a></div>
      </div>
      <div class="book-art" aria-hidden="true"><div class="hero-cover">${latest?.cover_path ? `<img src="${safe(publicUrl(latest.cover_path))}" alt=""/>` : `<small>Renungan Harian El-Bethel</small><b>${safe(latest?.theme || 'SETIA DI SETIAP MASA')}</b><small>${safe(latest ? labelDate(latest):'Bacaan Setiap Hari')}</small>`}</div></div>
    </div></section>
    <section id="arsip" class="container section"><div class="section-top"><div><span class="eyebrow">Perpustakaan digital</span><h2 class="section-title">Edisi Renungan</h2></div><p class="section-desc">Pilih bulan untuk mulai membaca</p></div>
    ${rows?.length ? `<div class="edition-grid">${rows.map(row=>`<article class="edition-card"><div class="cover-wrap">${cover(row)}</div><div class="card-info"><span class="pill">${safe(labelDate(row))}</span><h3>${safe(row.title)}</h3><p>${safe(row.theme || 'Renungan Harian El-Bethel')}</p><a class="btn" href="/${safe(row.slug)}" data-nav="/${safe(row.slug)}">Buka Flipbook →</a></div></article>`).join('')}</div>` : `<div class="empty">Belum ada edisi yang diterbitkan. Masuk ke <a href="/admin" data-nav="/admin"><u>halaman admin</u></a> untuk menambahkan edisi pertama.</div>`}
    </section>`;
  if(location.hash === '#arsip') document.getElementById('arsip')?.scrollIntoView();
}

async function renderReader(serial, slug) {
  app.innerHTML='<div class="loading-shell">Memuat flipbook...</div>';
  const {data:row,error}=await db.from('renungan_editions').select('*').eq('slug',slug).eq('is_published',true).maybeSingle();
  if(serial!==routeSerial) return;
  if(error) throw error;
  if(!row){showError('Edisi renungan tidak ditemukan atau belum diterbitkan.');return;}
  const url=publicUrl(row.pdf_path);
  app.innerHTML=`<section class="container">
    <div class="reader-header"><a class="crumb" href="/" data-nav="/">← Kembali ke perpustakaan</a><h1>${safe(row.title)}</h1><p>${safe(labelDate(row))} · ${safe(row.theme)}</p></div>
    <div class="reader-toolbar"><div class="toolgroup"><button id="prev" class="btn btn-soft btn-sm">← Sebelumnya</button><button id="next" class="btn btn-soft btn-sm">Berikutnya →</button></div><div class="toolgroup"><span class="page-count">Halaman</span><input class="page-jump" id="page-jump" type="number" min="1" value="1" aria-label="Nomor halaman" /><span id="page-total" class="page-count">/ ...</span><button id="jump" class="btn btn-sm">Pergi</button></div><div class="toolgroup"><button id="zoom" class="btn btn-soft btn-sm">Perbesar</button><button id="share" class="btn btn-soft btn-sm">Bagikan</button><a class="btn btn-soft btn-sm" href="${safe(url)}" target="_blank" rel="noopener noreferrer">PDF asli ↗</a></div></div>
    <div id="reader-stage" class="reader-stage"><div class="book-host"><div id="book"></div></div><div id="reader-loading" class="spinner" style="position:absolute"></div></div>
    <div class="status-line" id="reader-status">Menyiapkan halaman buku...</div></section>`;

  let task;
  try { task=pdfjs.getDocument({url}); readerTask=task; activeReaderPdf=await task.promise; }
  catch(err) { if(serial!==routeSerial)return; document.getElementById('reader-status').textContent='PDF gagal dimuat. Periksa URL publik dan izin file pada Supabase Storage.'; throw err; }
  if(serial!==routeSerial)return;
  const pdf=activeReaderPdf;
  const first=await pdf.getPage(1);
  if(serial!==routeSerial)return;
  const viewport=first.getViewport({scale:1});
  const width=390, height=Math.round(width*viewport.height/viewport.width);
  const book=document.getElementById('book');
  book.innerHTML=Array.from({length:pdf.numPages},(_,i)=>`<div class="book-page" data-index="${i}" ${i===0||i===pdf.numPages-1?'data-density="hard"':''}><img alt="Halaman ${i+1}"/><span class="page-placeholder">Halaman ${i+1}</span></div>`).join('');
  const flipCtor=window.St?.PageFlip;
  if(!flipCtor) throw new Error('Library animasi flipbook tidak termuat. Periksa koneksi internet atau CDN.');
  const starting=Math.min(pdf.numPages-1,Math.max(0,parseInt(new URLSearchParams(location.search).get('halaman') || '1',10)-1 || 0));
  const flip=new flipCtor(book, {
    width,height,size:'stretch',minWidth:210,maxWidth:width,minHeight:Math.round(height*210/width),maxHeight:height,
    showCover:true,startPage:starting,usePortrait:true,drawShadow:true,maxShadowOpacity:.35,flippingTime:650,mobileScrollSupport:false
  });
  flip.loadFromHTML(book.querySelectorAll('.book-page'));
  flipInstance=flip;
  const cache=new Map(), pending=new Map();
  let current=starting;
  const status=document.getElementById('reader-status');
  document.getElementById('page-total').textContent=`/ ${pdf.numPages}`;
  document.getElementById('reader-loading')?.remove();
  status.textContent='Klik atau geser halaman untuk membalik buku.';
  function fillImages(index, src) {
    book.querySelectorAll(`.book-page[data-index="${index}"] img`).forEach(img=>{if(img.getAttribute('src')!==src)img.setAttribute('src',src);});
  }
  async function loadPage(index) {
    if(index<0 || index>=pdf.numPages || serial!==routeSerial) return;
    if(cache.has(index)){ fillImages(index,cache.get(index));return; }
    if(pending.has(index)) return pending.get(index);
    const promise=(async()=>{
      const page=await pdf.getPage(index+1);
      const orig=page.getViewport({scale:1});
      const vp=page.getViewport({scale:900/orig.width});
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);
      await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport:vp}).promise;
      if(serial!==routeSerial)return;
      const image=canvas.toDataURL('image/jpeg',.91);
      cache.set(index,image); fillImages(index,image);
      page.cleanup();
    })().catch(err=>{console.warn('Tidak dapat memuat halaman',index+1,err);}).finally(()=>pending.delete(index));
    pending.set(index,promise);return promise;
  }
  async function preloadAround(index){
    const desired=new Set();
    for(let i=index-3;i<=index+4;i++)if(i>=0&&i<pdf.numPages)desired.add(i);
    await Promise.all([...desired].map(loadPage));
    if(serial!==routeSerial)return;
    for(const old of cache.keys()) if(!desired.has(old)) {
      cache.delete(old);
      book.querySelectorAll(`.book-page[data-index="${old}"] img`).forEach(img=>img.removeAttribute('src'));
    }
  }
  function setCurrent(index){
    current=index;activeReaderPage=index;
    const jump=document.getElementById('page-jump');if(jump)jump.value=index+1;
    const u=new URL(location.href);u.searchParams.set('halaman',String(index+1));history.replaceState({},'',u);
    void preloadAround(index);
  }
  flip.on('flip',event=>setCurrent(event.data));
  flip.on('changeOrientation',()=>void preloadAround(current));
  document.getElementById('prev').onclick=()=>flip.flipPrev();
  document.getElementById('next').onclick=()=>flip.flipNext();
  document.getElementById('jump').onclick=()=>{
    const n=Number(document.getElementById('page-jump').value);
    if(Number.isInteger(n) && n>=1 && n<=pdf.numPages) {flip.turnToPage(n-1);setCurrent(n-1);}
  };
  document.getElementById('page-jump').onkeydown=e=>{if(e.key==='Enter')document.getElementById('jump').click();};
  document.getElementById('share').onclick=async()=>{
    const link=location.href;
    try { if(navigator.share) await navigator.share({title:row.title,url:link}); else {await navigator.clipboard.writeText(link);status.textContent='Tautan halaman berhasil disalin.';} }
    catch(e){if(e.name!=='AbortError') status.textContent='Silakan salin alamat dari browser untuk membagikannya.';}
  };
  document.getElementById('zoom').onclick=async()=>{
    overlay.classList.remove('hidden');document.getElementById('overlay-body').innerHTML='<div class="spinner" style="margin:10vh auto"></div>';
    const page=await pdf.getPage(activeReaderPage+1);
    const original=page.getViewport({scale:1});const vp=page.getViewport({scale:1400/original.width});
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    if(!overlay.classList.contains('hidden')) document.getElementById('overlay-body').innerHTML=`<img alt="Halaman ${activeReaderPage+1}" src="${canvas.toDataURL('image/jpeg',.94)}"/>`;
    page.cleanup();
  };
  await preloadAround(starting);
}

async function renderAdmin(serial) {
  app.innerHTML='<div class="loading-shell">Memeriksa sesi administrator...</div>';
  const {data:{session},error}=await db.auth.getSession();
  if(serial!==routeSerial)return;
  if(error)throw error;
  if(!session?.user){renderLogin();return;}
  const {data:membership,error:authError}=await db.from('renungan_admins').select('user_id').eq('user_id',session.user.id).maybeSingle();
  if(serial!==routeSerial)return;
  if(authError)throw authError;
  if(!membership){
    app.innerHTML=`<div class="container section"><div class="error-box"><strong>Akun tidak memiliki hak admin.</strong><p>Tambahkan UUID akun ini ke tabel <code>public.renungan_admins</code> melalui Supabase SQL Editor (petunjuk di README).</p><p>UUID: <code>${safe(session.user.id)}</code></p></div><p><button class="btn btn-soft" id="logout">Keluar</button></p></div>`;
    document.getElementById('logout').onclick=async()=>{await db.auth.signOut();renderRoute();};return;
  }
  await renderAdminConsole(serial, session.user.email);
}
function renderLogin(){
  app.innerHTML=`<div class="container"><div class="panel login-panel"><span class="eyebrow">Akses redaksi</span><h2>Login Administrator</h2><p>Masuk menggunakan akun yang telah didaftarkan di Supabase Authentication dan diberi izin admin.</p>
    <form id="login-form"><div class="field"><label for="email">Email admin</label><input id="email" type="email" autocomplete="username" required /></div><div class="field"><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" required /></div><button class="btn" type="submit">Masuk</button></form><div id="login-feedback" style="margin-top:15px" aria-live="polite"></div></div></div>`;
  document.getElementById('login-form').onsubmit=async e=>{
    e.preventDefault();const form=e.currentTarget,button=form.querySelector('button');button.disabled=true;button.textContent='Memeriksa akun...';
    const {error}=await db.auth.signInWithPassword({email:document.getElementById('email').value,password:document.getElementById('password').value});
    if(error){document.getElementById('login-feedback').innerHTML=`<div class="error-box">${safe(error.message)}</div>`;button.disabled=false;button.textContent='Masuk';}
    else renderRoute();
  };
}
async function renderAdminConsole(serial,email) {
  const {data:rows,error}=await db.from('renungan_editions').select('*').order('edition_year',{ascending:false}).order('edition_month',{ascending:false});
  if(serial!==routeSerial)return;
  if(error)throw error;
  activeAdminRows=rows || [];editingId=null;
  app.innerHTML=`<div class="container admin-layout"><div class="admin-heading"><div><span class="eyebrow">Ruang redaksi</span><h1 class="section-title">Kelola Renungan</h1><p class="muted" style="font-size:13px">Login sebagai ${safe(email)}</p></div><button class="btn btn-soft btn-sm" id="logout">Keluar</button></div>
  <div class="admin-grid"><section class="panel"><h2 id="form-title">Tambah edisi</h2><form id="edition-form">
    <div class="fields-two"><div class="field"><label for="month">Bulan</label><select id="month" required>${MONTHS.map((m,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><label for="year">Tahun</label><input id="year" type="number" min="2020" max="2200" value="${new Date().getFullYear()}" required/></div></div>
    <div class="field"><label for="title">Judul publikasi</label><input id="title" maxlength="160" value="Renungan Harian El-Bethel" required /></div>
    <div class="field"><label for="theme">Tema edisi</label><input id="theme" maxlength="160" placeholder="Contoh: Setia di Setiap Masa"/></div>
    <div class="field"><label for="pdf-file">Upload PDF baru (opsional jika sudah ada di Storage)</label><input id="pdf-file" type="file" accept="application/pdf,.pdf"/><span class="help">File di atas 6 MB diunggah secara bertahap agar lebih andal.</span></div>
    <div class="field"><label for="pdf-path">Atau gunakan path PDF yang SUDAH ada di Storage</label><input id="pdf-path" placeholder="2026/11/nama-file.pdf"/><span class="help">Isi path di dalam bucket, bukan URL lengkap. Tidak perlu upload ulang.</span></div>
    <div class="field"><label for="cover-file">Sampul JPG/PNG/WEBP (opsional)</label><input id="cover-file" type="file" accept="image/jpeg,image/png,image/webp"/><span class="help">Jika upload PDF baru tanpa sampul, sampul otomatis diambil dari halaman pertama PDF.</span></div>
    <div class="checkline"><input id="publish" type="checkbox" checked/><label for="publish">Publikasikan edisi (langsung muncul di beranda)</label></div>
    <div class="button-row"><button id="save" class="btn" type="submit">Simpan edisi</button><button id="reset" class="btn btn-soft" type="button">Batal / Kosongkan</button></div>
  </form><div class="hidden" id="admin-message" style="margin-top:17px" aria-live="polite"></div></section>
  <section class="panel"><h2>Daftar edisi</h2><div class="admin-list" id="admin-list">${renderAdminItems(activeAdminRows)}</div></section></div></div>`;
  document.getElementById('logout').onclick=async()=>{await db.auth.signOut();renderRoute();};
  document.getElementById('edition-form').onsubmit=saveEdition;
  document.getElementById('reset').onclick=clearAdminForm;
  document.getElementById('admin-list').onclick=async e=>{
    const btn=e.target.closest('button[data-action]');if(!btn)return;
    const row=activeAdminRows.find(r=>r.id===btn.dataset.id);if(!row)return;
    if(btn.dataset.action==='edit')editEdition(row);
    if(btn.dataset.action==='delete')await deleteEdition(row);
  };
}
function renderAdminItems(rows){
  return rows.length ? rows.map(r=>`<div class="admin-item"><div class="admin-thumb">${r.cover_path?`<img src="${safe(publicUrl(r.cover_path))}" alt="" />`:'Sampul'}</div><div class="admin-item-info"><strong>${safe(r.title)}</strong><span>${safe(labelDate(r))} · ${r.is_published?'Terbit':'Draft'}</span></div><div class="admin-actions"><button type="button" data-action="edit" data-id="${r.id}">Edit</button><button type="button" data-action="delete" data-id="${r.id}">Hapus</button></div></div>`).join('')
    :'<p class="muted" style="font-size:13px">Belum ada edisi. Gunakan form di sebelah kiri.</p>';
}
function clearAdminForm(){
  editingId=null;document.getElementById('edition-form').reset();
  document.getElementById('month').value=new Date().getMonth()+1;
  document.getElementById('year').value=new Date().getFullYear();
  document.getElementById('title').value='Renungan Harian El-Bethel';
  document.getElementById('publish').checked=true;
  document.getElementById('form-title').textContent='Tambah edisi';
  document.getElementById('save').textContent='Simpan edisi';
  document.getElementById('admin-message').classList.add('hidden');
}
function editEdition(row){
  editingId=row.id;
  document.getElementById('month').value=row.edition_month;
  document.getElementById('year').value=row.edition_year;
  document.getElementById('title').value=row.title;
  document.getElementById('theme').value=row.theme || '';
  document.getElementById('pdf-path').value=row.pdf_path;
  document.getElementById('pdf-file').value='';
  document.getElementById('cover-file').value='';
  document.getElementById('publish').checked=row.is_published;
  document.getElementById('form-title').textContent='Edit edisi '+labelDate(row);
  document.getElementById('save').textContent='Simpan perubahan';
  document.getElementById('admin-message').classList.add('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
async function pdfCoverBlob(fileOrUrl){
  const source=typeof fileOrUrl==='string'?{url:fileOrUrl}:{data:await fileOrUrl.arrayBuffer()};
  const task=pdfjs.getDocument(source);const pdf=await task.promise;
  try {
    const first=await pdf.getPage(1);const base=first.getViewport({scale:1});
    const vp=first.getViewport({scale:640/base.width});
    const canvas=document.createElement('canvas');canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);
    await first.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
    return {blob,count:pdf.numPages};
  } finally { await pdf.destroy(); }
}
async function uploadAsset(path, file, contentType){
  // Supabase recommends resumable TUS transfers for files above 6 MB.
  if(file.size > 6*1024*1024){
    const tus = window.tus;
    if(!tus?.Upload) throw new Error('Library upload browser gagal dimuat. Periksa koneksi internet lalu muat ulang halaman.');
    const {data:{session},error:authError}=await db.auth.getSession();
    if(authError || !session?.access_token)throw new Error('Sesi admin berakhir. Login ulang.');
    const ref=new URL(CONFIG.supabaseUrl).hostname.split('.')[0];
    await new Promise((resolve,reject)=>{
      const uploader=new tus.Upload(file,{
        endpoint:`https://${ref}.storage.supabase.co/storage/v1/upload/resumable`,
        retryDelays:[0,3000,5000,10000,20000],
        headers:{authorization:`Bearer ${session.access_token}`,'x-upsert':'false'},
        uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,
        metadata:{bucketName:BUCKET,objectName:path,contentType,cacheControl:'3600'},
        chunkSize:6*1024*1024,
        onProgress:(uploaded,total)=>setMessage(`Mengunggah PDF... ${Math.round(uploaded/total*100)}%`),
        onError:reject,onSuccess:resolve,
      });
      uploader.findPreviousUploads().then(previous=>{
        if(previous.length)uploader.resumeFromPreviousUpload(previous[0]);
        uploader.start();
      }).catch(reject);
    });
    return path;
  }
  const {error}=await db.storage.from(BUCKET).upload(path,file,{contentType,upsert:false,cacheControl:'3600'});
  if(error)throw error;return path;
}
async function saveEdition(e){
  e.preventDefault();const save=document.getElementById('save'),month=Number(document.getElementById('month').value),year=Number(document.getElementById('year').value);
  const pdfFile=document.getElementById('pdf-file').files[0],coverFile=document.getElementById('cover-file').files[0];
  const old=editingId?activeAdminRows.find(r=>r.id===editingId):null;
  let pdfPath=document.getElementById('pdf-path').value.trim(),coverPath=old?.cover_path||null,pageCount=old?.page_count||null;
  const newPaths=[];save.disabled=true;save.textContent='Menyimpan...';
  try {
    if(!Number.isInteger(year)||year<2020||year>2200||month<1||month>12)throw new Error('Bulan atau tahun tidak valid.');
    if(pdfFile && pdfFile.type!=='application/pdf' && !pdfFile.name.toLowerCase().endsWith('.pdf'))throw new Error('File harus PDF.');
    if(!pdfFile && !pdfPath)throw new Error('Pilih file PDF atau isi path PDF yang sudah ada di Storage.');
    if(pdfFile && pdfPath && !old) throw new Error('Dua sumber PDF terisi. Untuk file yang sudah ada di Storage, kosongkan kolom Upload PDF baru. Untuk PDF baru, kosongkan kolom path Storage.');
    if(coverFile && !['image/jpeg','image/png','image/webp'].includes(coverFile.type))throw new Error('Sampul harus JPG, PNG, atau WEBP.');
    const folder=`${year}/${String(month).padStart(2,'0')}`;
    let automaticCover=null;
    if(pdfFile){
      setMessage('Membaca PDF dan menyiapkan sampul...');
      const c=await pdfCoverBlob(pdfFile);automaticCover=c.blob;pageCount=c.count;
      pdfPath=`${folder}/${crypto.randomUUID()}.pdf`;
      setMessage('Mengunggah PDF...');await uploadAsset(pdfPath,pdfFile,'application/pdf');newPaths.push(pdfPath);
    }
    if(coverFile||automaticCover){
      const ext=coverFile?.type==='image/png'?'png':coverFile?.type==='image/webp'?'webp':'jpg';
      const file=coverFile||automaticCover;
      coverPath=`${folder}/cover-${crypto.randomUUID()}.${ext}`;
      setMessage('Mengunggah sampul...');await uploadAsset(coverPath,file,coverFile?.type||'image/jpeg');newPaths.push(coverPath);
    }
    // Verify that a pre-existing Storage path really points to a readable PDF.
    if(!pdfFile){
      setMessage('Memeriksa PDF yang sudah ada di Storage...');
      let c;
      try { c=await pdfCoverBlob(publicUrl(pdfPath)); }
      catch(err){ throw new Error('PDF pada path Storage tidak dapat dibaca. Periksa nama path dan Public URL.'); }
      pageCount=c.count;
      if(!coverFile && !coverPath){
        coverPath=`${folder}/cover-${crypto.randomUUID()}.jpg`;
        await uploadAsset(coverPath,c.blob,'image/jpeg');newPaths.push(coverPath);
      }
    }
    const payload={slug:slugFor(year,month),title:document.getElementById('title').value.trim(),theme:document.getElementById('theme').value.trim(),edition_year:year,edition_month:month,pdf_path:pdfPath,cover_path:coverPath,page_count:pageCount,is_published:document.getElementById('publish').checked};
    if(payload.title.length<2)throw new Error('Judul harus diisi.');
    if(payload.is_published && !old?.published_at) payload.published_at=new Date().toISOString();
    if(!payload.is_published) payload.published_at=null;
    setMessage('Menyimpan informasi edisi...');
    const request=old?db.from('renungan_editions').update(payload).eq('id',old.id):db.from('renungan_editions').insert(payload);
    const {error}=await request;
    if(error)throw error;
    const serial=routeSerial;await renderAdminConsole(serial,(await db.auth.getUser()).data.user?.email||'admin');
    setMessage('Edisi berhasil disimpan. '+(payload.is_published?'Sudah tampil di beranda.':'Masih berstatus Draft.'));
  }catch(err){
    // Roll back newly uploaded assets when metadata save fails. Existing assets remain unchanged.
    if(newPaths.length)await db.storage.from(BUCKET).remove(newPaths).catch(()=>{});
    setMessage(err?.message||'Gagal menyimpan edisi.',true);
    save.disabled=false;save.textContent=old?'Simpan perubahan':'Simpan edisi';
  }
}
async function deleteEdition(row){
  if(!confirm(`Hapus edisi ${labelDate(row)} dari katalog? Tautan edisi tidak akan berfungsi lagi.`))return;
  const {error}=await db.from('renungan_editions').delete().eq('id',row.id);
  if(error){setMessage(error.message,true);return;}
  await renderAdminConsole(routeSerial,(await db.auth.getUser()).data.user?.email||'admin');
  setMessage('Edisi dihapus dari katalog. Berkas PDF lama tetap berada di Storage agar bisa dipulihkan jika perlu.');
}

renderRoute();
