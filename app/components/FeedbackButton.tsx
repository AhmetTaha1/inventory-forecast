import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getDictionary, type Locale } from "../lib/translations";

// ---------------------------------------------------------------------------
// Web3Forms ayarı
// ---------------------------------------------------------------------------
// https://web3forms.com üzerinden ücretsiz alınan access key. Bu bir sır
// (secret) değil — Web3Forms'un tasarımı gereği tarayıcı tarafında,
// herkesin görebileceği şekilde kullanılması normal (spam koruması sunucu
// tarafında, Web3Forms'un kendi altyapısında yapılıyor). Ücretsiz katman:
// ayda 250 gönderim.
const WEB3FORMS_ACCESS_KEY = "acbd6a73-2595-421a-ba12-c7f08c5b655f";

type Status = "idle" | "sending" | "success" | "error";

// Shopify Admin arayüzü Inter fontunu kullanıyor (Polaris'in kendi tasarım
// sistemi). Bu bileşen artık <s-page> DIŞINDA render edildiği için o
// mirası almıyor — miras almaya güvenmek yerine burada açıkça tanımlıyoruz,
// aksi halde tarayıcı varsayılan sistem fontuna düşüyor (görünüşte belirgin
// bir kalite kaybı). Fallback zinciri Inter yüklenmezse de admin arayüzüyle
// tutarlı bir görünüm sağlasın diye standart sistem fontu sırasını izliyor.
const INVF_FB_FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const FEEDBACK_CSS = `
/* Tetikleyici buton: sol alt köşede sabit/yüzen. "Yukarı çık" butonuyla
   aynı katmanda (z-index 40) ama karşı köşede — çakışmıyor. Sabit
   konumlandığı için bu bileşen <s-page> DIŞINDA, app._index.tsx içinde
   kardeş eleman olarak render edilmeli (aksi halde Polaris'in s-page
   bileşeni transform kullanıyorsa fixed, viewport yerine ona göre
   sabitlenebilir). */
.invf-fb-trigger {
  all: unset;
  box-sizing: border-box;
  position: fixed;
  bottom: 32px;
  left: 44px;
  z-index: 40;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 999px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font-family: ${INVF_FB_FONT_STACK};
  font-size: 13.5px;
  font-weight: 600;
  color: #1A1A1A;
  box-shadow: 0 4px 14px rgba(0,0,0,0.18);
  transition: background 150ms ease, border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease !important;
}
.invf-fb-trigger:hover {
  background: #F7F7F7 !important;
  border-color: #008060 !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 20px rgba(0,0,0,0.22) !important;
}

/* Düz bir sohbet emojisi yerine, uygulamanın geri kalanındaki (özet
   kartları, "yukarı çık" butonu) yeşil vurgu diliyle eşleşen dolgulu bir
   ikon rozeti — jenerik değil, markaya ait bir görünüm hedefleniyor. */
.invf-fb-icon-badge {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: #008060;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 560px) {
  .invf-fb-trigger {
    bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
    left: 16px !important;
    /* Metin dar ekranda son ürün kartının üzerine taşıp okunamaz hale
       geliyordu; mobilde "yukarı çık" butonuyla simetrik, sade bir
       daire ikona dönüşüyor. Erişilebilirlik için aria-label korunuyor,
       sadece görsel etiket gizleniyor. */
    width: 48px !important;
    height: 48px !important;
    padding: 0 !important;
    /* Masaüstünde ikon, beyaz pilin içinde küçük yeşil bir rozetti.
       Mobilde butonun TAMAMI daireye dönüştüğü için rozeti ayrı bir
       daire olarak bırakmak "beyaz halka içinde yeşil nokta" gibi
       çirkin bir görüntü veriyordu — artık butonun kendisi "yukarı çık"
       butonuyla aynı dolgu yeşile boyanıyor, iç rozet şeffaflaşıyor. */
    background: #008060 !important;
    border-color: #008060 !important;
    justify-content: center !important;
  }
  .invf-fb-label { display: none; }
  .invf-fb-icon-badge { background: transparent; width: auto; height: auto; }
}

.invf-fb-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 100;
  /* Panel içindeki tüm elemanlar (başlık, label, input, textarea, buton)
     "font: inherit" / "font: inherit" varyantları kullanıyor; bu yüzden
     Inter'i burada, en üst ortak atada tanımlamak yeterli — tek tek her
     elemana yazmaya gerek yok. */
  font-family: ${INVF_FB_FONT_STACK};
}

.invf-fb-panel {
  width: 100%;
  max-width: 440px;
  max-height: 90vh;
  overflow-y: auto;
  background: #FFFFFF;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}

.invf-fb-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.invf-fb-field label { font-size: 12.5px; font-weight: 700; color: #4A4A4A; }
.invf-fb-field input,
.invf-fb-field textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #D4D4D4;
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  color: #1A1A1A;
  background: #FFFFFF;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}
.invf-fb-field input:focus,
.invf-fb-field textarea:focus {
  border-color: #008060;
  box-shadow: 0 0 0 3px rgba(0, 128, 96, 0.15);
}
.invf-fb-field textarea { resize: vertical; min-height: 90px; font-family: inherit; }

.invf-fb-submit {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: 100%;
  text-align: center;
  padding: 12px;
  border-radius: 9px;
  background: #008060;
  color: #FFFFFF;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  transition: background 150ms ease !important;
}
.invf-fb-submit:hover { background: #026B4F !important; }
.invf-fb-submit[disabled] { opacity: 0.6; cursor: wait; }

.invf-fb-close {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #6B6B6B;
  font-size: 18px;
  transition: background 120ms ease !important;
}
.invf-fb-close:hover { background: #F1F1F1 !important; }

@media (max-width: 480px) {
  .invf-fb-panel { padding: 18px; border-radius: 14px; }
}
`;

type FeedbackButtonProps = {
  locale: Locale;
  // Geniş ekranlarda ürün listesi kartının gerçek kenarına göre ölçülen
  // sol boşluk (bkz. useInventoryView.ts). Verilmezse CSS'teki 44px
  // varsayılanı kullanılır — mobilde zaten !important kuralı bunu eziyor.
  leftOffset?: number;
  // Aktif kaydırma sırasında true — buton soluklaşıp küçülür, altındaki
  // liste satırının metnini tamamen kapatmasın diye (bkz. useInventoryView.ts).
  isScrolling?: boolean;
};

export function FeedbackButton(props: FeedbackButtonProps) {
  const t = getDictionary(props.locale);

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  // Esc ile kapatma.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Modal açıkken arka plandaki sayfanın kaymasını (scroll) engelle.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeAndReset() {
    setOpen(false);
    // Başarılıysa formu temizle; hataysa kullanıcı tekrar denesin diye
    // yazdıklarını koru.
    if (status === "success") {
      setFirstName("");
      setLastName("");
      setEmail("");
      setMessage("");
    }
    setStatus("idle");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: WEB3FORMS_ACCESS_KEY,
          // Bu alan isimleri (Ad/Soyad/E-posta/Mesaj) ve subject bilinçli
          // olarak HER ZAMAN Türkçe — merchant'ın dili ne olursa olsun, bu
          // e-postayı okuyan geliştiricinin kendisi (biz), mağaza sahibi
          // değil. Yani bu, arayüz metni değil, dahili bir e-posta şablonu.
          subject: "Envanter Tahmini - Yeni geri bildirim",
          from_name: `${firstName} ${lastName}`.trim() || "İsimsiz kullanıcı",
          Ad: firstName,
          Soyad: lastName,
          "E-posta": email,
          Mesaj: message,
        }),
      });
      const data = await res.json();
      setStatus(data.success ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <>
      <style>{FEEDBACK_CSS}</style>

      <button
        type="button"
        className="invf-fb-trigger"
        style={{
          left: props.leftOffset,
          opacity: props.isScrolling ? 0.35 : 1,
          transform: props.isScrolling ? "scale(0.85)" : "scale(1)",
          pointerEvents: props.isScrolling ? "none" : "auto",
        }}
        onClick={() => setOpen(true)}
        aria-label={t.feedbackTrigger}
      >
        <span className="invf-fb-icon-badge" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="invf-fb-label">{t.feedbackTrigger}</span>
      </button>

      {open && (
        <div
          className="invf-fb-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAndReset();
          }}
        >
          <div
            className="invf-fb-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t.feedbackDialogAriaLabel}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: "#1A1A1A" }}>
                  {t.feedbackModalTitle}
                </div>
                <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 3 }}>
                  {t.feedbackModalSubtitle}
                </div>
              </div>
              <button
                type="button"
                className="invf-fb-close"
                onClick={closeAndReset}
                aria-label={t.feedbackCloseAriaLabel}
              >
                ✕
              </button>
            </div>

            {status === "success" ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0C5132" }}>
                  {t.feedbackSuccessTitle}
                </div>
                <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 4 }}>
                  {t.feedbackSuccessSubtitle}
                </div>
                <button
                  type="button"
                  className="invf-fb-submit"
                  style={{ marginTop: 18 }}
                  onClick={closeAndReset}
                >
                  {t.feedbackCloseButton}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="invf-fb-field" style={{ flex: 1 }}>
                    <label htmlFor="invf-fb-first">{t.feedbackFieldFirstName}</label>
                    <input
                      id="invf-fb-first"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="invf-fb-field" style={{ flex: 1 }}>
                    <label htmlFor="invf-fb-last">{t.feedbackFieldLastName}</label>
                    <input
                      id="invf-fb-last"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="invf-fb-field">
                  <label htmlFor="invf-fb-email">{t.feedbackFieldEmail}</label>
                  <input
                    id="invf-fb-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="invf-fb-field">
                  <label htmlFor="invf-fb-message">{t.feedbackFieldMessage}</label>
                  <textarea
                    id="invf-fb-message"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t.feedbackMessagePlaceholder}
                  />
                </div>

                {status === "error" && (
                  <div style={{ fontSize: 13, color: "#C4210B", marginBottom: 12 }}>
                    {t.feedbackErrorText}
                  </div>
                )}

                <button type="submit" className="invf-fb-submit" disabled={status === "sending"}>
                  {status === "sending" ? t.feedbackSubmitting : t.feedbackSubmit}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
