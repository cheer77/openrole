"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { trackingDisabled } from "@/lib/analytics-client";

type Integration = { provider: string; identifier: string };
const patterns: Record<string, RegExp> = {
  ga4: /^G-[A-Z0-9]{4,20}$/,
  gtm: /^GTM-[A-Z0-9]{4,20}$/,
  meta: /^\d{8,20}$/,
  clarity: /^[a-z0-9]{5,32}$/i,
};
export function PublicIntegrations() {
  const path = usePathname();
  const [items, setItems] = useState<Integration[]>([]);
  useEffect(() => {
    if (path.startsWith("/admin") || path.startsWith("/login") || path.startsWith("/register") || trackingDisabled()) return;
    const controller = new AbortController();
    void fetch("/api/integrations", { signal: controller.signal, cache: "no-store" })
      .then((response) => response.ok ? response.json() : [])
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) return;
        setItems(rows.filter((row): row is Integration =>
          !!row && typeof row === "object" &&
          typeof row.provider === "string" && typeof row.identifier === "string" &&
          !!patterns[row.provider]?.test(row.identifier)));
      }).catch(() => {});
    return () => controller.abort();
  }, [path]);
  if (path.startsWith("/admin") || path.startsWith("/login") || path.startsWith("/register") || trackingDisabled()) return null;
  const byProvider = Object.fromEntries(items.map((item) => [item.provider, item.identifier]));
  const ga4 = byProvider.gtm ? undefined : byProvider.ga4;
  return <>
    {byProvider.gtm && <><Script id="vmiyou-gtm-init" strategy="afterInteractive">{"(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer'," + JSON.stringify(byProvider.gtm) + ");"}</Script></>}
    {ga4 && <><Script src={"https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga4)} strategy="afterInteractive" /><Script id="vmiyou-ga4-init" strategy="afterInteractive">{"window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config'," + JSON.stringify(ga4) + ");"}</Script></>}
    {byProvider.meta && <Script id="vmiyou-meta-init" strategy="afterInteractive">{"!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init'," + JSON.stringify(byProvider.meta) + ");fbq('track','PageView');"}</Script>}
    {byProvider.clarity && <Script id="vmiyou-clarity-init" strategy="afterInteractive">{"(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src='https://www.clarity.ms/tag/'+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,'clarity','script'," + JSON.stringify(byProvider.clarity) + ");"}</Script>}
  </>;
}
