import { GRID_COLUMNS, TABLE_TO_CARD_BREAKPOINT_PX } from "./constants";

// Cells.tsx'teki RunwayCell/CellLabel bileşenlerinin ihtiyaç duyduğu stiller —
// BİLEREK ayrı bir sabit: hem panel (aşağıdaki PAGE_CSS) hem ürün detay
// sayfası (app.product.$variantId.tsx, kendi yerel CSS'i var) RunwayCell'i
// kullanıyor. Ürün detay sayfası önceden bunu hiç import ETMİYORDU — rozet
// şekli/boşlukları kayboluyor, alt satır metni (".invf-sub") block yerine
// varsayılan inline kaldığı için rozetin hemen yanına yapışıyordu (kullanıcı
// geri bildirimi, ekran görüntüsüyle: "≈30DAYS LEFTaround October 22...").
export const RUNWAY_CELL_CSS = `
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
/* Ucretsiz katmanda, siparis miktarinin OLACAGI yerde duran sessiz ipucu.
   Bilerek kucuk ve gri: her satirda tekrarlandigi icin dikkat cekici
   olsaydi listeyi gurultuye bogardi. Amaci satis yapmak degil, o ozelligin
   VAR oldugunu bildirmek — kullanici tam "peki ne kadar siparis vereyim?"
   diye dusundugu anda. */
.invf-qty-locked {
  display: block;
  margin-top: 3px;
  font-size: 11.5px;
  font-weight: 600;
  color: #1F4C8C;
}
`;

// SnoozeControl.tsx'in ihtiyaç duyduğu stiller — RUNWAY_CELL_CSS'teki AYNI
// sebeple ayrı bir sabit: ürün detay sayfası (app.product.$variantId.tsx)
// kendi yerel CSS'inde bunu hiç IMPORT ETMİYORDU. Sonuç: tarayıcının
// varsayılan (küçük, gri, "ucuz" duran) <select> görünümü hiç ezilmeden
// kalıyordu — kullanıcı geri bildirimi: "dikkatle bakarsak görebiliyoruz"
// kadar zor seçilir, StatusPill'e neredeyse yapışık duruyordu.
// Bu turda ayrıca: yazı/dolgu büyütüldü, StatusPill ile arasına daha net
// bir boşluk için kendi başına biraz daha "ağır" bir buton hissi verildi.
export const SNOOZE_CONTROL_CSS = `
.invf-snooze-select {
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding: 11px 38px 11px 14px;
  border: 1.5px solid #C7C7C7;
  border-radius: 9px;
  font: inherit;
  font-size: 14.5px;
  font-weight: 700;
  color: #1A1A1A;
  background-color: #FFFFFF;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23008060' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 15px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.invf-snooze-select:hover { border-color: #008060; }
.invf-snooze-select:focus {
  outline: none;
  border-color: #008060;
  box-shadow: 0 0 0 3px rgba(0, 128, 96, 0.18);
}
.invf-snooze-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.invf-snooze-info span { font-size: 14px; font-weight: 600; color: #4A4A4A; }
/* Bilerek DÜZ METİN DEĞİL, sınırları belli gerçek bir buton — "Snoozed
   until ..." bilgi satırının hemen yanında düz yeşil metin olarak durunca
   tıklanabilir olduğu hiç belli olmuyordu (kullanıcı geri bildirimi:
   herkes "buton" ile "etiket"i ayırt edemeyecek kadar deneyimli olmayabilir). */
.invf-snooze-unsnooze {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  padding: 9px 16px;
  border: 1.5px solid #008060;
  border-radius: 9px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: #0C5132;
  background: #FFFFFF;
  transition: background 120ms ease;
}
.invf-snooze-unsnooze:hover { background: #E3F1DF; }
`;

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
/* Kullanıcı geri bildirimi: "21 ürünün stoğu bitti, 4 ürün 14 gün içinde
   bitiyor" gibi ASIL eylem bilgisini taşıyan satır, kalın başlığın altında
   silik kalıyordu. Punto ve ağırlık artırıldı, rengi koyulaştırıldı —
   başlıkla yarışmadan okunur hale geldi. Sakin (success/info) kutularda
   eski haliyle kalıyor: oradaki metin bilgilendirme, eylem çağrısı değil. */
.invf-alert-desc { font-size: 15px; font-weight: 600; color: #2B2B2B; line-height: 1.45; }
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

/* "Tüm ürünler" + "En çok satanlar" — kullanıcı geri bildirimi: ikisi de
   tam genişlik olunca alt alta gereksiz yer kaplıyordu, üstteki 4'lü
   grid'in genişliğine sığacak şekilde yan yana (2 sütun) daha temiz
   duruyor. Aynı gap değeri (12px) kullanılıyor ki üstteki 4 sütunla
   görsel olarak hizalı görünsün. */
.invf-secondary-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
/* "Stok yeterli" kartı da eklenince üç kart yan yana. Bu kart bilerek
   üstteki 4'lü kategori grid'ine KONMADI: orası "dikkat gerektirenler"
   (bitti / azalıyor / satmıyor / tahmin yok), burası bağlam kartları
   (toplam, rahat olanlar, en çok satanlar). Ayrıca 5. kart eklemek, üstteki
   grid'in "asla 3 sütuna düşmez" düzenini bozardı (bkz. .invf-summary). */
.invf-secondary-row--three { grid-template-columns: repeat(3, 1fr); }
/* Kullanıcı geri bildirimi: mobilde 4 kategori kartı (.invf-summary) 2x2
   olarak yan yana kalırken bu ikili alt alta düşüyordu — tutarsız
   duruyordu. Aynı 2 sütunlu düzen dar ekranda da korunuyor, sadece boşluk
   biraz daralıyor (üstteki .invf-summary ile birebir aynı davranış). */
@media (max-width: 1040px) {
  .invf-secondary-row { gap: 10px; }
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

/* Dar ekranda (<= 560px) ikincil kart satırı tek sütuna iner: yarı genişlikte
   "En çok satanlar" açıklaması 3 satıra sarıp kartları orantısız
   bırakıyordu. */
@media (max-width: 560px) {
  .invf-secondary-row,
  .invf-secondary-row--three { grid-template-columns: 1fr; }
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

/* Ürün detay sayfasında (StatusPill'in yanında, satır içi) kullanılıyor —
   eski hali listedeki dar satır için ayarlanmıştı (11.5px, 4px dolgu),
   burada diğer her şeyin (13.5-15px, 9-10px dolgu) yanında eski/küçük
   kalıyordu (kullanıcı geri bildirimi). Aynı boyut ailesine çekildi. */
${SNOOZE_CONTROL_CSS}

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
  min-height: 40px;
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

/* Akıllı export preset'leri: ana buton + ok, tek bir "pil" gibi bitişik
   duruyor (ok butonunun sol kenarı radius'suz, ana butonun sağ kenarı
   radius'suz) — iki ayrı buton olduğu görsel olarak belli ama tek bir
   bütünmüş gibi okunuyor. */
.invf-export-wrap { position: relative; display: inline-flex; }
.invf-export-wrap .invf-export-btn { border-radius: 9px 0 0 9px; border-right: none; }
.invf-export-caret {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  min-height: 40px;
  border-radius: 0 9px 9px 0;
  border: 1.5px solid #14572E;
  background: #1F7244;
  color: #FFFFFF;
  font-size: 11px;
}
.invf-export-caret:hover { background: #195C38; }
.invf-export-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.14);
  padding: 6px;
  z-index: 20;
}
.invf-export-menu-item {
  all: unset;
  box-sizing: border-box;
  width: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 7px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #1A1A1A;
}
.invf-export-menu-item:hover { background: #F3FBF8; }
.invf-export-menu-count { font-size: 12px; font-weight: 700; color: #6B6B6B; }

/* Satır içi tedarik süresi düzenleme (LeadTimeInlineEdit.tsx) */
.invf-leadtime-inline {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.invf-leadtime-label { font-size: 11.5px; font-weight: 600; color: #7A7A7A; }
/* Kullanıcı geri bildirimi: "title" özniteliği mobilde (dokunmatik) hiç
   çalışmıyor — tıklayınca açılıp kapanan gerçek bir buton+kutu oldu. */
.invf-leadtime-help-wrap { position: relative; display: inline-flex; }
/* Kullanıcı geri bildirimi: yeşil dolgu "bilgi" ile "onaylandı/aktif" gibi
   bir durum karıştırılabiliyordu — herkesin bildiği sade siyah-beyaz "i"
   simgesine (ince kenarlıklı çember + düz "i") çevrildi. Renk artık sadece
   HOVER/açıkken hafifçe koyulaşıyor, dolgu rengi değişmiyor. */
.invf-leadtime-help {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  border: 1.3px solid #8A8A8A;
  background: #FFFFFF;
  color: #4A4A4A;
  font-size: 10.5px;
  font-weight: 700;
  font-style: normal;
  cursor: pointer;
}
/* Görsel ikon küçük kalsın diye boyutu büyütmedik — bunun yerine görünmez
   bir dokunma alanı ekledik (kullanıcı geri bildirimi: mobilde bu ikon
   fazla küçüktü). Tam 44px yapmadık: satırda hemen yanında sayı kutusu
   var (5px boşlukla) — 44px'lik görünmez alan komşu kutunun tıklama
   alanına taşıp yanlış dokunmalara yol açardı. 30px, aradaki boşluğa
   sığan en büyük güvenli değer. */
.invf-leadtime-help::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
}
.invf-leadtime-help:hover, .invf-leadtime-help[aria-expanded="true"] {
  border-color: #1A1A1A;
  color: #1A1A1A;
}
/* Masaüstünde artık fareyle üzerine gelip ~1 saniye beklenince açılıyor
   (bkz. LeadTimeInlineEdit.tsx'teki gecikmeli mouseenter); mobilde
   dokunmatik hover olmadığı için dokunma/tıklama ile açılıp kapanıyor.
   Konum artık sabit genişlik + yüzde ile DEĞİL, JS ile ekrana göre
   hesaplanıp ortalanıyor (bkz. component) — satır dar bir kartın kenarına
   yakınsa balon ekran dışına taşıp kesiliyordu (kullanıcı geri bildirimi:
   "balonun sadece bir kısmı görünüyor"). */
.invf-leadtime-help-popover {
  position: fixed;
  width: 220px;
  max-width: calc(100vw - 24px);
  padding: 10px 12px;
  border-radius: 9px;
  background: #1A1A1A;
  color: #FFFFFF;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  box-shadow: 0 8px 20px rgba(0,0,0,0.25);
  z-index: 30;
}
.invf-leadtime-input {
  box-sizing: border-box;
  width: 46px;
  padding: 3px 5px;
  border: 1px solid #D4D4D4;
  border-radius: 6px;
  font: inherit;
  font-size: 12.5px;
  color: #1A1A1A;
  text-align: center;
}
.invf-leadtime-input:focus { outline: none; border-color: #008060; box-shadow: 0 0 0 2px rgba(0,128,96,0.15); }
.invf-leadtime-suffix { font-size: 11.5px; color: #7A7A7A; }
.invf-leadtime-badge {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #0C5132;
  background: #E3F1DF;
  padding: 2px 6px;
  border-radius: 999px;
}
.invf-leadtime-reset {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 6px 4px;
  min-height: 28px;
  font-size: 11px;
  font-weight: 600;
  color: #6B6B6B;
  text-decoration: underline;
}
.invf-leadtime-reset:hover { color: #1A1A1A; }
.invf-leadtime-input--error { border-color: #D72C0D; box-shadow: 0 0 0 2px rgba(215,44,13,0.12); }
.invf-leadtime-error { font-size: 11px; font-weight: 600; color: #D72C0D; }
.invf-leadtime-saved { font-size: 11px; font-weight: 700; color: #0C5132; }
/* Mevcut @keyframes invf-spin (dosyanın başında, RefreshBar ile paylaşılıyor) yeniden kullanılıyor. */
.invf-leadtime-spinner {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid #D4D4D4;
  border-top-color: #008060;
  animation: invf-spin 0.7s linear infinite;
}
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
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #3A3A3A;
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
/* Kirilamayan uzun tek kelimeler (SKU benzeri basliklar, uzun URL'ler)
   kabi tasirip .invf-list-card'in overflow:hidden'i tarafindan kirpiliyordu. */
.invf-product-title { overflow-wrap: anywhere; }

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
${RUNWAY_CELL_CSS}

/* "Detaylar" linki — Durum sütununda, StatusPill'in hemen altında (bkz.
   ProductRow.tsx). Ayrı bir grid sütununa gerek yok, ürün detay sayfasına
   (app.product.$variantId.tsx) götürüyor. */
.invf-details-btn {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 5px 10px;
  margin-top: 6px;
  border-radius: 999px;
  border: 1px solid #008060;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: #0C5132;
  background: #FFFFFF;
  white-space: nowrap;
}
.invf-details-btn:hover { background: #E3F1DF; }
.invf-snoozed-until-note { display: block; margin-top: 4px; font-size: 11.5px; color: #7A7A7A; }

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
   Dar ekran (<= TABLE_TO_CARD_BREAKPOINT_PX): her satır ayrı bir kart.
   --------------------------------------------------------------------- */
@media (max-width: ${TABLE_TO_CARD_BREAKPOINT_PX}px) {
  .invf-head { display: none; }

  .invf-row {
    /* Kullanıcı geri bildirimi: durum rozeti + "Detaylar" butonu ürün
       satırının SAĞINDA, dar bir sütuna sıkıştırılmış (eski hali) kötü
       duruyordu — ikisi üst üste, köşeye sıkışmış gibi. Artık "durum"
       kendi TAM GENİŞLİK satırında (bkz. .invf-c-status altında), rozet
       solda / "Detaylar" sağda, net bir yatay çubuk. */
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      "product product"
      "status  status"
      "stock   rate"
      "runway  runway";
    column-gap: 10px;
    row-gap: 10px;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid #F1F1F1;
  }
  .invf-c-stock  { grid-area: stock; }
  .invf-c-rate   { grid-area: rate; }
  .invf-wide     { grid-area: runway; }

  .invf-c-status .invf-label { display: none; }
  /* Masaüstünde .invf-details-btn dikey İSTİFLENEN bir kolonda (rozetin
     ALTINDA) olduğu için üstten boşluğa ihtiyaç duyuyordu — burada rozetle
     AYNI yatay satırda, ortalanmış (align-items:center) olduğu için o
     boşluk sadece butonu aşağı kaydırırdı. */
  /* Kullanıcı geri bildirimi (harici inceleme): mobilde "Detaylar" butonu
     işlevsel ama dokunma alanı küçük kalıyordu. Satırın tamamını tıklanabilir
     yapmak satırın içindeki diğer bağımsız etkileşimlerle (ürün linki, tedarik
     süresi girişi) çakışacağından, bunun yerine sadece bu butonun dokunma
     alanını ~44px'e (Apple/Google'ın önerdiği asgari hedef) çıkarıyoruz. */
  .invf-c-status .invf-details-btn { margin-top: 0; padding: 7px 16px; font-size: 13px; min-height: 44px; }
  /* Ertelenmiş not (varsa) tam genişlik alıp kendi satırına düşsün —
     rozet + "Detaylar" ile aynı satırda sıkışmasın. */
  .invf-c-status .invf-snoozed-until-note { flex-basis: 100%; margin-top: 0; }

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
