"use client";

import Script from "next/script";

export function Analytics() {
  const plausibleDomain = process["env"]["NEXT_PUBLIC_PLAUSIBLE_DOMAIN"];
  const ga4Id = process["env"]["NEXT_PUBLIC_GA4_ID"];

  if (!plausibleDomain && !ga4Id) return null;

  return (
    <>
      {plausibleDomain && (
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
        />
      )}
      {ga4Id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}
    </>
  );
}
