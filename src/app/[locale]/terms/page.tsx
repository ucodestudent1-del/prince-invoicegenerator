import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const metadata = {
  title: "Terms of Service — Prince Invoice Generator",
  description: "Terms of service for Prince Invoice Generator.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-16 max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: August 2026</p>

          <div className="mt-8 space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Prince Invoice Generator (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. Description of Service</h2>
              <p>
                Prince Invoice Generator provides online invoicing, estimating, and related tools for construction contractors. Features and pricing are subject to change.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Accounts and Security</h2>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account. Notify us immediately of unauthorized access.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Acceptable Use</h2>
              <p>
                You agree not to misuse the Service or help anyone else do so. Prohibited activities include violating laws, infringing intellectual property, distributing malware, or interfering with the Service.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Subscription and Payments</h2>
              <p>
                Paid plans are billed in advance on a monthly basis. Fees are non-refundable except as required by law. We may change pricing with reasonable notice.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Cancellation and Termination</h2>
              <p>
                You may cancel your subscription at any time via the Stripe billing portal. Upon cancellation, access continues until the end of the billing period. We may suspend or terminate accounts that violate these terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Data and Privacy</h2>
              <p>
                Your use of the Service is also governed by our Privacy Policy. We implement reasonable security measures but cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">8. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Prince Invoice Generator shall not be liable for indirect, incidental, special, or consequential damages. Our total liability shall not exceed the amount you paid in the twelve months before the claim.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">9. Changes to Terms</h2>
              <p>
                We may update these terms occasionally. Continued use of the Service after changes constitutes acceptance of the updated terms.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">10. Contact</h2>
              <p>
                Questions about these terms?{" "}
                <Link href="/support" className="text-primary hover:underline">
                  Contact support
                </Link>{" "}
                or email privacy@prince-invoice.com.
              </p>
            </section>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
