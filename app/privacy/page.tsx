import { PrivacyControls } from "@/components/privacy-controls";
export const metadata = { title: "Privacy & analytics" };
export default function PrivacyPage() {
  return (
    <main id="main-content" className="container privacy-page">
      <h1>Privacy & analytics</h1>
      <p>
        We use lightweight first-party analytics to understand which jobs people
        find useful.
      </p>
      <h2>What we collect</h2>
      <p>
        Page paths (without search queries), job views, clicks to employer
        websites, referring domains, campaign tags, and broad device/browser
        information. Apply clicks measure interest, not completed applications.
      </p>
      <p>
        A random visitor identifier expires after 30 days. A tab session ends
        after 30 minutes of inactivity. These are estimates, not identified
        people: we do not fingerprint your device, collect your name, or store
        raw IP addresses.
      </p>
      <h2>Approximate geography</h2>
      <p>
        If our hosting infrastructure supplies trusted location headers, we
        record country, region and city. These can be inaccurate or unavailable;
        we do not infer missing cities or send IP addresses to a paid
        geolocation service.
      </p>
      <h2>Retention and choice</h2>
      <p>
        Analytics events are deleted after 90 days. Do Not Track and Global
        Privacy Control are respected. You can also disable analytics for this
        browser below. Account forms and the owner panel are not tracked.
      </p>
      <PrivacyControls />
    </main>
  );
}
