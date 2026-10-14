"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { trackingDisabled } from "@/lib/analytics-client";

import type { PublicIntegration } from "@/lib/public-integrations";
import { loadPublicIntegrations } from "@/lib/public-integrations-client";

export function PublicIntegrations() {
  const path = usePathname();
  const [items, setItems] = useState<PublicIntegration[]>([]);
  useEffect(() => {
    if (path.startsWith("/admin") || path.startsWith("/login") || path.startsWith("/register") || trackingDisabled()) return;
    let active = true;
    // Navigation cancels this subscription, not the shared in-flight request.
    void loadPublicIntegrations()
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => {});
    return () => { active = false; };
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
