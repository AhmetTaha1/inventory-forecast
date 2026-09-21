import type { MetaFunction } from "react-router";

// Herkese açık, embed dışı bir sayfa — Shopify App Store listeleme
// gereksinimi (bkz. shopify.dev/docs/apps/build/compliance) uygulamanın
// gizlilik politikasına genel bir link sağlamasını zorunlu tutuyor.
// Bilerek authenticate.admin KULLANMIYOR: hem reviewer'lar hem de
// uygulamayı kurmamış ziyaretçiler bu sayfayı görebilmeli.
//
// root.tsx zaten <html>/<head>/<body> kabuğunu sağlıyor (bkz. <Outlet />),
// bu yüzden burada sadece içerik döndürülüyor; <title> için react-router'ın
// `meta` route export'u kullanılıyor (React 18'de <title>'ı doğrudan
// component içinde render etmek <head>'e taşınmaz).
//
// ÖNEMLİ: Bu, geliştiricinin kod tabanına bakarak yazdığı taslak bir
// metin — gerçek veri akışlarını (aşağıda) doğru yansıtıyor ama hukuki
// bir belge olarak yayınlanmadan önce bir avukat/mali müşavir gözden
// geçirmeli.
export const meta: MetaFunction = () => [
  { title: "Privacy Policy — Inventory Forecast" },
];

const PRIVACY_PAGE_CSS = `
:root { color-scheme: light; }
.invf-privacy * { box-sizing: border-box; }
.invf-privacy {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
  color: #1A1A1A;
  background: #F6F6F7;
  line-height: 1.6;
  min-height: 100vh;
}
.invf-privacy .wrap { max-width: 720px; margin: 0 auto; padding: 48px 20px 80px; }
.invf-privacy h1 { font-size: 26px; margin-bottom: 4px; }
.invf-privacy .updated { color: #6B6B6B; font-size: 13px; margin-bottom: 32px; }
.invf-privacy h2 { font-size: 18px; margin-top: 36px; margin-bottom: 8px; }
.invf-privacy p, .invf-privacy li { font-size: 15px; color: #303030; }
.invf-privacy ul { padding-left: 20px; }
.invf-privacy a { color: #008060; }
`;

export default function PrivacyPolicy() {
  return (
    <div className="invf-privacy">
      <style>{PRIVACY_PAGE_CSS}</style>
      <div className="wrap">
        <h1>Privacy Policy — Inventory Forecast</h1>
        <p className="updated">Last updated: September 20, 2026</p>

        <p>
          This Privacy Policy explains what data the Inventory Forecast
          Shopify app (&ldquo;the App&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) accesses, why, and how it is
          handled. The App is used inside the Shopify admin by merchants who
          install it.
        </p>

        <h2>1. Information We Access From Your Shopify Store</h2>
        <p>To calculate stockout forecasts, reorder alerts and dead stock reports, the App reads (read-only, never writes or modifies):</p>
        <ul>
          <li>Product and variant titles, status, and featured images</li>
          <li>Inventory levels across your locations</li>
          <li>Order line items and timestamps, used only in aggregate (units sold per day) to calculate sales velocity — we do not access customer names, emails, addresses, or payment information</li>
          <li>Your store&apos;s timezone (to align daily sales totals to your local day)</li>
        </ul>
        <p>
          The App requests only the Shopify API scopes it actually uses:
          {" "}<code>read_products, read_inventory, read_orders, read_all_orders, read_locations</code>.
          It does not request or use any permission to modify your products, orders, or inventory.
        </p>

        <h2>2. Data We Store</h2>
        <ul>
          <li><strong>Access token &amp; shop domain</strong> — required to authenticate API requests on your behalf while the App is installed.</li>
          <li><strong>Cached forecast snapshot</strong> — an aggregated summary (product names, stock counts, computed forecasts) recalculated periodically, stored per shop to avoid re-fetching your entire catalog on every page load.</li>
        </ul>
        <p>We do not store your customers&apos; personal data. No individual customer record ever enters our database.</p>

        <h2>3. Optional Feedback Form</h2>
        <p>
          If you choose to submit feedback through the in-app feedback button, the
          first name, last name, email, and message you provide are sent
          directly from your browser to our form-processing provider,{" "}
          <a href="https://web3forms.com" target="_blank" rel="noreferrer">Web3Forms</a>,
          which delivers it to us by email. This data is not stored in the App&apos;s own database.
          Submitting feedback is entirely optional.
        </p>

        <h2>4. Data Retention &amp; Deletion</h2>
        <p>
          When you uninstall the App, your access token and cached forecast
          data are deleted immediately. In addition, the App implements
          Shopify&apos;s mandatory compliance webhooks
          (<code>customers/data_request</code>, <code>customers/redact</code>,{" "}
          <code>shop/redact</code>) to respond to data requests and ensure
          any remaining data is erased.
        </p>

        <h2>5. Third Parties</h2>
        <p>
          We share data with two service providers, and no one else: Shopify
          (the platform the App runs on) and Web3Forms (only if you submit
          the optional feedback form). We do not sell or rent your data to
          anyone.
        </p>

        <h2>6. Your Rights</h2>
        <p>
          You may request access to, or deletion of, any data we hold about
          your store at any time by uninstalling the App or contacting us
          directly (see below). Requests are handled within 30 days.
        </p>

        <h2>7. Security</h2>
        <p>
          Access tokens are stored securely and are never exposed to the
          browser. All communication with the Shopify API and our servers
          happens over HTTPS.
        </p>

        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this policy from time to time. Material changes will
          be reflected by updating the &ldquo;Last updated&rdquo; date above.
        </p>

        <h2>9. Contact Us</h2>
        <p>
          Questions about this policy or your data can be sent to{" "}
          <a href="mailto:inventoryforecast.support@gmail.com">inventoryforecast.support@gmail.com</a>.
        </p>
      </div>
    </div>
  );
}
