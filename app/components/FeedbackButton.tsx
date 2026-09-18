import type { CSSProperties, FormEvent } from "react";
import { useEffect, useState } from "react";

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

const FEEDBACK_CSS = `
.invf-fb-trigger {
  all: unset;
  box-sizing: border-box;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 11px 20px;
  border-radius: 10px;
  border: 1px solid #D4D4D4;
  background: #FFFFFF;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: #1A1A1A;
  transition: background 150ms ease, border-color 150ms ease, transform 150ms ease !important;
}
.invf-fb-trigger:hover {
  background: #F7F7F7 !important;
  border-color: #008060 !important;
  transform: translateY(-1px) !important;
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

export function FeedbackButton() {
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

  const overlayStyle: CSSProperties = { all: "unset" };

  return (
    <>
      <style>{FEEDBACK_CSS}</style>

      <button type="button" className="invf-fb-trigger" onClick={() => setOpen(true)}>
        <span aria-hidden="true">💬</span>
        Görüş, öneri ya da sorun bildir
      </button>

      {open && (
        <div
          className="invf-fb-overlay"
          style={overlayStyle}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAndReset();
          }}
        >
          <div
            className="invf-fb-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Geri bildirim formu"
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
                  Görüş, öneri ya da sorun bildir
                </div>
                <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 3 }}>
                  Uygulamayı geliştirmemize yardımcı olur, teşekkürler.
                </div>
              </div>
              <button
                type="button"
                className="invf-fb-close"
                onClick={closeAndReset}
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            {status === "success" ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0C5132" }}>
                  Mesajınız iletildi
                </div>
                <div style={{ fontSize: 13, color: "#6B6B6B", marginTop: 4 }}>
                  En kısa sürede döneceğiz.
                </div>
                <button
                  type="button"
                  className="invf-fb-submit"
                  style={{ marginTop: 18 }}
                  onClick={closeAndReset}
                >
                  Kapat
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="invf-fb-field" style={{ flex: 1 }}>
                    <label htmlFor="invf-fb-first">Ad</label>
                    <input
                      id="invf-fb-first"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="invf-fb-field" style={{ flex: 1 }}>
                    <label htmlFor="invf-fb-last">Soyad</label>
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
                  <label htmlFor="invf-fb-email">E-posta</label>
                  <input
                    id="invf-fb-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="invf-fb-field">
                  <label htmlFor="invf-fb-message">Mesajınız</label>
                  <textarea
                    id="invf-fb-message"
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ne düşünüyorsunuz, neyi eksik buldunuz?"
                  />
                </div>

                {status === "error" && (
                  <div style={{ fontSize: 13, color: "#C4210B", marginBottom: 12 }}>
                    Gönderilemedi, lütfen tekrar deneyin.
                  </div>
                )}

                <button type="submit" className="invf-fb-submit" disabled={status === "sending"}>
                  {status === "sending" ? "Gönderiliyor…" : "Gönder"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
