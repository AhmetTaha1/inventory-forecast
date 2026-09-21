import { GRID_COLUMNS } from "./constants";

export const PAGE_CSS = `
@keyframes invf-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ---------------------------- Uyarı kutusu ---------------------------- */
.invf-alert {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px 18px 22px;
  border-radius: 14px;
  border: 2px solid var(--invf-alert-accent);
  border-left: 7px solid var(--invf-alert-accent);
  background: var(--invf-alert-soft);
  box-shadow: 0 2px 10px rgba(0,0,0,0.07);
}
.invf-alert--calm {
  border-width: 1px;
  border-left-width: 5px;
  box-shadow: none;
  padding-top: 14px;
  padding-bottom: 14px;
}
.invf-alert-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--invf-alert-accent);
  color: #FFFFFF;
  font-size: 23px;
  font-weight: 800;
  line-height: 1;
}
.invf-alert--calm .invf-alert-icon { width: 32px; height: 32px; font-size: 18px; }
.invf-alert-body { flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.invf-alert-title {
  font-size: 19px;
  font-weight: 800;
  line-height: 1.25;
  color: var(--invf-alert-text);
}
.invf-alert--calm .invf-alert-title { font-size: 15px; font-weight: 700; }
.invf-alert-desc { font-size: 14px; color: #3D3D3D; line-height: 1.4; }
.invf-alert--calm .invf-alert-desc { font-size: 13px; color: #5C5C5C; }
.invf-alert-btn {
  all: unset;
  box-sizing: border-box;
  flex-shrink: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 13px 22px;
  border-radius: 10px;
  background: var(--invf-alert-accent);
  color: #FFFFFF;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(0,0,0,0.18);
  transition: filter 120ms ease;
}
.invf-alert-btn:hover { filter: brightness(1.08); }

/* --------------------------- Özet kartları --------------------------- */
/* Asla 3 sütuna düşmez: ya 4 ya 2. Aksi halde 4. kart tek başına kalıyor. */
.invf-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 1040px) {
  .invf-summary { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}

/* Basılabilir olduğu belli olsun diye hover'da hafifçe kalkıyor + gölge
   büyüyor + kenarlık kategori rengine dönüyor. Sayısı 0 olan (tıklanamaz)
   kartlarda bu efekt bilerek yok.
   ÖNEMLİ: kartın kendi inline style'ı "all: unset" içeriyor (bkz.
   SummaryCard). Satır içi stil, önem derecesi (!important) olmayan dış
   CSS kurallarını HER ZAMAN ezer — pseudo-class fark etmeksizin. Bu
   yüzden hover'ın gerçekten görünmesi için bu kurallara !important şart.
   Aynı sebeple: bu sınıf hem kategori kartları hem "Tüm ürünler" kartı
   (invf-allcard) tarafından paylaşılıyor, tutarlı hover/focus için. */
.invf-summary-card {
  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease !important;
}
.invf-summary-card:hover:not(.invf-summary-card--empty) {
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important;
  border-color: var(--invf-card-accent) !important;
}
.invf-summary-card:focus-visible:not(.invf-summary-card--empty) {
  outline: 2px solid var(--invf-card-accent) !important;
  outline-offset: 2px !important;
}
.invf-summary-card--empty { cursor: default; }

/* "Tüm ürünler" kartı: diğerleriyle aynı görsel dil (kart + üst şerit),
   ama kare değil geniş/yatay. Dar ekranda dikeyleşir — bu yalnızca
   media query ile mümkün, bu yüzden layout'un flex-direction'ı burada
   !important ile eziliyor (inline "all: unset" nedeniyle aksi halde
   üzerine yazılamaz, bkz. yukarıdaki açıklama). */
@media (max-width: 560px) {
  .invf-allcard {
    flex-direction: column !important;
    align-items: flex-start !important;
    gap: 6px !important;
  }
}

.invf-hint { font-size: 12.5px; color: #6B6B6B; margin-top: -4px; }

/* ------------------------- Ertele (snooze) ------------------------- */
/* Diğer araç çubuğu butonlarıyla (Excel indir / Temizle) aynı boyut ve
   tıklanabilirlik dilinde — önceden düz, alt çizgisiz metindi ve "tıklanabilir
   bir şey" olduğu hiç belli olmuyordu (kullanıcı geri bildirimi). */
.invf-snoozed-link {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 15px;
  border-radius: 9px;
  border: 1px solid #E8A317;
  background: #FFF8E8;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #7A5100;
  white-space: nowrap;
}
.invf-snoozed-link:hover { background: #FFEFC7; }

.invf-snooze-select {
  margin-top: 6px;
  box-sizing: border-box;
  max-width: 120px;
  padding: 4px 6px;
  border: 1px solid #D4D4D4;
  border-radius: 6px;
  font: inherit;
  font-size: 11.5px;
  color: #5C5C5C;
  background: #FFFFFF;
}
.invf-snooze-info {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.invf-snooze-info span { font-size: 11.5px; color: #6B6B6B; }
/* Bilerek DÜZ METİN DEĞİL, sınırları belli gerçek bir buton — "Snoozed
   until ..." bilgi satırının hemen yanında düz yeşil metin olarak durunca
   tıklanabilir olduğu hiç belli olmuyordu (kullanıcı geri bildirimi:
   herkes "buton" ile "etiket"i ayırt edemeyecek kadar deneyimli olmayabilir). */
.invf-snooze-unsnooze {
  all: unset;
  box-sizing: border-box;
  align-self: flex-start;
  cursor: pointer;
  padding: 5px 10px;
  border: 1px solid #008060;
  border-radius: 7px;
  font: inherit;
  font-size: 11.5px;
  font-weight: 700;
  color: #0C5132;
  background: #FFFFFF;
}
.invf-snooze-unsnooze:hover { background: #E3F1DF; }

.invf-foot {
  padding: 12px 20px 16px;
  border-top: 1px solid #F1F1F1;
  font-size: 12px;
  color: #7A7A7A;
  line-height: 1.45;
}

/* ---------------------------- Liste kartı ---------------------------- */
.invf-list-card {
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 14px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  overflow: hidden;
  scroll-margin-top: 16px;
}
.invf-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 14px;
}
/* Başlık satırı: solda başlık/özet (süzgeç adı zaten burada yazıyor),
   sağda eylem butonları (Excel indir / temizle). */
.invf-toolbar-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.invf-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.invf-clear-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 15px;
  border-radius: 9px;
  border: 1px solid #008060;
  background: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #0C5132;
  white-space: nowrap;
}
.invf-clear-btn:hover { background: #E3F1DF; }
.invf-settings-link:hover { background: #F7F7F7 !important; border-color: #008060 !important; }
/* Excel indir butonu: dolu, Excel'in koyu yeşiline yakın renk. İkon
   kaldırıldı (küçük boyutta tanınmıyordu); metin kısa tutuldu çünkü
   hangi ürünleri indirdiği zaten hemen üstteki "Süzgeç: ..." satırında
   yazıyor — tekrar etmeye gerek yok, tam açıklama title tooltip'inde. */
.invf-export-btn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  padding: 9px 16px;
  border-radius: 9px;
  border: 1.5px solid #14572E;
  background: #1F7244;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #FFFFFF;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}
.invf-export-btn:hover { background: #195C38; }
.invf-search { position: relative; }
.invf-search input {
  box-sizing: border-box;
  width: 100%;
  padding: 11px 14px 11px 40px;
  border: 1px solid #D4D4D4;
  border-radius: 10px;
  font: inherit;
  font-size: 14px;
  color: #1A1A1A;
  background: #FFFFFF;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.invf-search input::placeholder { color: #7A7A7A; }
.invf-search input:focus {
  border-color: #008060;
  box-shadow: 0 0 0 3px rgba(0, 128, 96, 0.15);
}
.invf-search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 15px;
  pointer-events: none;
}

/* ------------------------------ Satırlar ------------------------------ */
.invf-head, .invf-row {
  display: grid;
  grid-template-columns: ${GRID_COLUMNS};
  column-gap: 28px;
  align-items: center;
  padding: 16px 20px;
}
.invf-head {
  background: #FAFAFA;
  border-top: 1px solid #EBEBEB;
  border-bottom: 1px solid #EBEBEB;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #4A4A4A;
  padding-top: 11px;
  padding-bottom: 11px;
}
.invf-row {
  border-bottom: 1px solid #F1F1F1;
  transition: background 120ms ease;
}
.invf-row:last-child { border-bottom: none; }
.invf-row:hover { background: #FBFCFC; }
.invf-label { display: none; }

/* Ürün adı artık gerçek Shopify ürün sayfasına link — mağaza sahibi ürünü
   ismine güvenmeden (fotoğrafına bakarak) tanıyabilsin, tıklayınca da
   doğrudan o ürünün admin sayfasına gitsin diye eklendi. Hover'da başlık
   altı çizili oluyor ki tıklanabilir olduğu belli olsun. */
.invf-product { cursor: pointer; }
.invf-product:hover .invf-product-title { text-decoration: underline; }
.invf-product:focus-visible { outline: 2px solid #008060; outline-offset: 2px; border-radius: 6px; }

.invf-num {
  font-size: 16px;
  font-weight: 700;
  color: #1A1A1A;
  line-height: 1.2;
}
.invf-num small { font-size: 12px; font-weight: 600; color: #6B6B6B; margin-left: 3px; }
.invf-muted { font-size: 13px; color: #6B6B6B; }

.invf-days-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 5px 11px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.1;
}
.invf-days-chip small { font-size: 11.5px; font-weight: 700; }

.invf-sub {
  display: block;
  margin-top: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #5C5C5C;
}
.invf-note {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  color: #7A7A7A;
}

.invf-pagebtn {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 8px 14px;
  border-radius: 10px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
}
.invf-pagebtn:hover { background: #F7F7F7; }
.invf-pagebtn[disabled] { opacity: 0.4; cursor: default; }

.invf-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 40px 20px;
  border-top: 1px solid #EBEBEB;
  text-align: center;
}

/* --------------------------- Yukarı çık butonu --------------------------- */
.invf-scrolltop-btn {
  transition: transform 150ms ease, box-shadow 150ms ease, background 150ms ease, opacity 150ms ease !important;
}
.invf-scrolltop-btn:hover {
  transform: translateY(-3px) scale(1.06) !important;
  box-shadow: 0 10px 22px rgba(0,0,0,0.28) !important;
  background: #026B4F !important;
}

/* ---------------------------------------------------------------------
   Dar ekran (<= 900px): her satır ayrı bir kart.
   --------------------------------------------------------------------- */
@media (max-width: 900px) {
  .invf-head { display: none; }

  .invf-row {
    /* Durum rozeti artık ürün satırının SAĞINDA, ayrı bir satır değil —
       önceki tasarımda her kart 4 ayrı dikey blok (ürün / durum / stok+
       hız / bitiş) olduğu için gereksiz uzundu, ürünler arası kaydırma
       çok fazlaydı. "status" alanı artık "product" ile aynı grid satırında,
       sağda dar bir sütunda duruyor — kartın toplam yüksekliği belirgin
       şekilde azalıyor. */
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "product status"
      "stock   rate"
      "runway  runway";
    column-gap: 10px;
    row-gap: 8px;
    align-items: stretch;
    padding: 12px;
    margin: 0 14px 8px;
    border: 1px solid #ECECEC;
    border-radius: 12px;
    background: #FFFFFF;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .invf-row:last-child { margin-bottom: 14px; }
  .invf-row:hover { background: #FFFFFF; }

  .invf-product { grid-area: product; min-width: 0; }
  .invf-c-status {
    grid-area: status;
    align-self: start;
    justify-self: end;
  }
  .invf-c-stock  { grid-area: stock; }
  .invf-c-rate   { grid-area: rate; }
  .invf-wide     { grid-area: runway; }

  .invf-c-status .invf-label { display: none; }

  .invf-c-stock, .invf-c-rate {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    background: #FAFBFB;
    border: 1px solid #F0F0F0;
    border-radius: 9px;
    padding: 7px 10px;
  }

  .invf-wide { padding-top: 2px; border-top: 1px dashed #EDEDED; }

  .invf-label {
    display: block;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #757575;
  }

  .invf-toolbar { padding: 14px; }
  .invf-foot { padding: 12px 14px 14px; }

  .invf-alert { flex-wrap: wrap; gap: 12px; padding: 16px 16px 16px 18px; }
  .invf-alert-title { font-size: 17px; }
  .invf-alert-btn { flex: 1 1 100%; justify-content: center; }
}

@media (max-width: 560px) {
  .invf-summary { gap: 8px; }
  .invf-row { margin: 0 10px 8px; padding: 11px; }
  .invf-row:last-child { margin-bottom: 12px; }
  .invf-toolbar { padding: 12px; }
  .invf-refresh-btn { width: 100%; justify-content: center; }
  .invf-toolbar-actions { flex-direction: column; width: 100%; }
  .invf-clear-btn, .invf-export-btn { flex: 1 1 100%; justify-content: center; }
  .invf-scrolltop-btn {
    bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
    right: 16px !important;
  }
}

/* ------------------------------ Alt boşluk ------------------------------ */
/* Sayfanın en altı için: sol altta geri bildirim, sağ altta (kaydırınca)
   yukarı çık butonu sabit duruyor. Bu boşluk olmadan, sayfa sonuna kadar
   kaydırıldığında son ürün kartı bu butonların altında kalıp
   okunamıyordu. Mobilde butonlar ekrana daha yakın durduğu için pay
   biraz daha artırılıyor. */
.invf-page-content {
  padding-bottom: 88px;
}
@media (max-width: 560px) {
  .invf-page-content { padding-bottom: 104px; }
}
`;
