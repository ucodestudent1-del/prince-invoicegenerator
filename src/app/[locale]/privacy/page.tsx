import { Link } from "@/i18n/navigation";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const metadata = {
  title: "Privacy Policy — Prince",
  description:
    "How Prince collects, uses, and protects your information when you use our construction invoicing platform.",
};

interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

function Section({ id, title, children }: SectionProps) {
  return (
    <section id={id} className="mb-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-4 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-medium text-foreground">{children}</h3>;
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-16">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Privacy Policy
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Effective date: August 4, 2026. Last updated: August 4, 2026.
            </p>

            <Section id="intro" title="Introduction">
              <p>
                Prince (&ldquo;Prince,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
                &ldquo;our&rdquo;) operates the Prince construction invoicing
                platform (the &ldquo;Service&rdquo;). This Privacy Policy explains
                how we collect, use, disclose, and protect your information when
                you use the Service.
              </p>
              <p>
                By accessing or using the Service, you agree to this Privacy
                Policy. If you do not agree, do not use the Service. This policy
                applies to all users &mdash; including owners, administrators,
                members, and viewers &mdash; as well as any individuals whose
                personal data is included in the information you enter into the
                Service on behalf of your organization.
              </p>
            </Section>

            <Section id="info-collected" title="Information We Collect">
              <Sub>Account &amp; profile data</Sub>
              <p>
                To use the Service you create an account via a third-party
                provider (such as Google). We receive your name, email address,
                and profile image from the provider and store your organization
                role. We never store your Google password.
              </p>

              <Sub>Organization &amp; business data</Sub>
              <p>
                As an administrator you enter information into the Service on
                behalf of your business. This may include company details,
                customer records (names, companies, email addresses, phone
                numbers, and postal addresses), project details, invoices,
                estimates, change orders, expenses, subcontractor records, team
                member information, and uploaded jobsite photos. This data is
                stored at your direction and is treated as confidential business
                information.
              </p>

              <Sub>Payment data</Sub>
              <p>
                We process payments through Stripe. We do not store your full
                payment card numbers, bank account details, or Stripe secret
                keys. Stripe collects and processes this information directly.
                See Stripe&rsquo;s{" "}
                <a
                  href="https://stripe.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  Privacy Policy
                </a>
                .
              </p>

              <Sub>Usage &amp; device data</Sub>
              <p>
                We automatically receive information about your interaction with
                the Service, including IP address, browser type, operating
                system, referring/exit pages, and click data. We may use cookies
                and similar tracking technologies (see the Cookies section).
              </p>
              <p>
                Jobsite photos you upload are stored on Cloudflare R2, a
                third-party object storage provider. We store a reference and a
                CDN URL in our database. See Cloudflare&rsquo;s{" "}
                <a
                  href="https://www.cloudflare.com/privacypolicy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </Section>

            <Section id="use" title="How We Use Your Information">
              <Sub>Provide and operate the Service</Sub>
              <p>
                Authenticate you, host your organization data, generate invoices
                and estimates, process payments through Stripe, and store photo
                attachments.
              </p>
              <Sub>Improve and personalize</Sub>
              <p>
                Understand how the Service is used, diagnose problems, and
                improve performance and features. We never sell your data.
              </p>
              <Sub>Communicate</Sub>
              <p>
                Send you service-related notifications (for example, invoice due
                reminders, failed payment notices, or subscription status
                changes) and respond to your support requests.
              </p>
              <Sub>Security &amp; compliance</Sub>
              <p>Detect and prevent fraud, abuse, and unauthorized access.</p>
            </Section>

            <Section id="cookies" title="Cookies &amp; Tracking">
              <p>
                We use cookies and similar technologies to operate the Service
                and keep you signed in as you navigate. These may include
                session cookies managed by NextAuth. You can control cookies
                through your browser settings, though disabling them may limit
                functionality such as authentication.
              </p>
              <p>We do not use cookies for behavioral advertising or third-party ad tracking.</p>
            </Section>

            <Section id="disclosure" title="When &amp; Why We Share">
              <Sub>Service providers</Sub>
              <p>
                We share information with trusted third parties that help us
                operate and improve the Service: Stripe (payments), Google
                (OAuth authentication), and Cloudflare R2 (photo storage). These
                providers are contractually bound to protect your information
                and are authorized to use it only as necessary to provide their
                services.
              </p>
              <Sub>Legal &amp; safety</Sub>
              <p>
                We may disclose your information when required by law, to comply
                with a subpoena or court order, to protect our rights, property,
                or safety, or to prevent fraud or abuse. We will notify you of
                such requests when legally permitted.
              </p>
              <Sub>Business transfers</Sub>
              <p>
                If we are involved in a merger, acquisition, or sale of all or a
                portion of our assets, your information may be transferred. We
                will require the receiving party to honor this Privacy Policy and
                will notify you before the transfer.
              </p>
              <Sub>Aggregated data</Sub>
              <p>
                We may share anonymized, aggregated, or de-identified data that
                does not identify you or your organization.
              </p>
            </Section>

            <Section id="retention" title="Data Retention">
              <p>
                We retain your information for as long as your organization
                account is active or as needed to provide the Service. For
                billing records, we retain information required to comply with
                tax, accounting, and payment-processing obligations. You may
                remove your organization data at any time (see{" "}
                <a href="#rights" className="text-foreground underline">
                  Your Rights
                </a>
                ).
              </p>
            </Section>

            <Section id="rights" title="Your Rights &amp; Choices">
              <Sub>Access &amp; correction</Sub>
              <p>
                You may access and update your profile information at any time
                through the Service. Organization administrators manage
                customer, project, invoice, and team records directly.
              </p>
              <Sub>Data removal</Sub>
              <p>
                You can remove past records for your organization at any time
                from the Data Management section of{" "}
                <Link
                  href="/dashboard/settings"
                  className="text-foreground underline"
                >
                  Settings
                </Link>
                . There you can remove all projects, estimates, change orders,
                expenses, customers, subcontractors, and team members, or
                delete your entire organization. These actions delete your data
                permanently and cannot be undone. Removing customers also
                removes the invoices and estimates that reference them.
              </p>
              <Sub>Account deletion</Sub>
              <p>
                To delete your entire organization and all associated data,
                contact us at the address below. We will delete your
                organization, customer records, and generated invoices and
                estimates within a reasonable time, except where we must retain
                information for legal or accounting purposes.
              </p>
              <Sub>Objections &amp; complaints</Sub>
              <p>
                If you object to our processing of your personal data or have a
                complaint, you may contact us using the details below. You also
                have the right to lodge a complaint with your local data
                protection authority.
              </p>
            </Section>

            <Section id="international" title="International Transfers">
              <p>
                The Service is hosted in the United States. By using the
                Service, you consent to the transfer of your information to and
                processing in the United States and other jurisdictions where we
                or our service providers operate, where data protection laws may
                differ from your jurisdiction.
              </p>
            </Section>

            <Section id="california" title="California Privacy Rights">
              <p>
                California residents have rights under the California Consumer
                Privacy Act (CCPA). We do not sell your personal information.
                You may request that we disclose, delete, or correct your
                California personal information by contacting us (see Contact).
                Where required, we will honor requests to delete personal
                information, subject to certain exceptions.
              </p>
            </Section>

            <Section id="children" title="Children">
              <p>
                The Service is not directed to children under 13, and we do not
                knowingly collect personal information from children. If we
                believe we have collected such information, we will delete it.
              </p>
            </Section>

            <Section id="links" title="Links to Other Sites">
              <p>
                The Service may contain links to other websites and services. We
                are not responsible for the privacy practices of those third
                parties. This Privacy Policy does not apply to information you
                provide directly to those services.
              </p>
            </Section>

            <Section id="security" title="Security">
              <p>
                We take reasonable measures intended to protect your information
                against unauthorized access, alteration, disclosure, or
                destruction. These include encryption in transit, access
                controls, and secure infrastructure. However, no method of
                transmission over the internet or electronic storage is
                completely secure, and we cannot guarantee absolute security.
              </p>
            </Section>

            <Section id="changes" title="Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. When we do,
                we will revise the &ldquo;Effective date&rdquo; at the top and,
                for material changes, post a notice or notify you via the
                Service. We encourage you to review this page periodically.
              </p>
            </Section>

            <Section id="contact" title="Contact Us">
              <p>
                If you have any questions about this Privacy Policy or the
                Service, please contact us at:
              </p>
              <p>
                Prince Invoice Generator
                <br />
                Email: <a href="mailto:privacy@prince-invoice.com" className="text-foreground underline">privacy@prince-invoice.com</a>
                <br />
                Mail: Prince Privacy, c/o General Counsel
              </p>
              <p>
                You may also exercise your data rights through the{" "}
                <Link
                  href="/dashboard/settings"
                  className="text-foreground underline"
                >
                  Data Management
                </Link>{" "}
                section of your organization settings.
              </p>
            </Section>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
