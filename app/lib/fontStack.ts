// app/lib/fontStack.ts
//
// Shopify Admin arayüzü Inter fontunu kullanıyor (Polaris'in kendi tasarım
// sistemi). <s-page> İÇİNDEKİ her şey bunu otomatik miras alıyor, ama
// <s-page> DIŞINDA (fixed/overlay) render edilen bileşenler (FeedbackButton,
// WelcomeTour gibi) bu mirası ALMIYOR — miras almaya güvenmek yerine burada
// açıkça tanımlanmalı, aksi halde tarayıcı varsayılan sistem fontuna düşüyor
// (görünüşte belirgin bir kalite kaybı, iki kez fark edilip düzeltildi).
// Fallback zinciri Inter yüklenmezse de admin arayüzüyle tutarlı bir
// görünüm sağlasın diye standart sistem fontu sırasını izliyor.
export const INVF_FONT_STACK =
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
