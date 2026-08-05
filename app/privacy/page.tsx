import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Privacy Policy — OwnYourMusic",
  description: "How OwnYourMusic collects, uses, and protects your data.",
};

const SECTIONS = [
  {
    heading: "1. Who is responsible for your data",
    body: (
      <p>
        OwnYourMusic is operated by Own Your Music, based in Limoges, France. For the purposes
        of GDPR, we are the data controller for the information described below.
      </p>
    ),
  },
  {
    heading: "2. What we collect",
    body: (
      <ul>
        <li>
          <strong>Account information</strong>: email address, authentication data (via Supabase
          Auth).
        </li>
        <li>
          <strong>Catalog data you provide</strong>: album/track titles, ISRCs, UPCs, credits,
          release dates, and other metadata you confirm during import.
        </li>
        <li>
          <strong>Files you upload for extraction</strong>: screenshots, PDFs, CSVs, or pasted
          text used during the Universal Import step.
        </li>
        <li>
          <strong>Artwork images</strong>: stored to display in your catalog and confirm screens.
        </li>
        <li>
          <strong>We do not store your master audio files.</strong> Audio verification happens
          locally on your device; audio file bytes are never uploaded to or retained on our
          servers.
        </li>
      </ul>
    ),
  },
  {
    heading: "3. How we use it",
    body: (
      <ul>
        <li>To provide the core Service: extracting, validating, and organizing your catalog data.</li>
        <li>To generate export packs, migration reports, and Confidence Scores.</li>
        <li>To operate your account (authentication, billing).</li>
      </ul>
    ),
  },
  {
    heading: "4. Third parties who process your data on our behalf",
    body: (
      <>
        <ul>
          <li>
            <strong>Anthropic</strong> (AI provider) — processes uploaded screenshots/documents
            during the import step only, to extract structured catalog data. Not used for any
            other ongoing processing of your catalog.
          </li>
          <li>
            <strong>Supabase</strong> — hosts our database and handles authentication.
          </li>
          <li>
            <strong>Cloudflare (R2)</strong> — stores artwork images only.
          </li>
          {/*
            TODO(billing): Add the payment processor here once billing is implemented.
            This bullet is a placeholder so the "third parties" list stays accurate —
            do not ship a billing feature without updating this section (and the
            "How we use it" section above, which already references billing).
          */}
          <li className="text-ink/50">
            [Payment processor — to be added once billing is implemented]
          </li>
        </ul>
        <p>
          Our primary application infrastructure is hosted in the European Economic Area (EEA)
          wherever possible. Some supporting services and content delivery networks may process
          or temporarily cache data in other countries to provide reliable worldwide access.
        </p>
      </>
    ),
  },
  {
    heading: "5. Legal basis for processing",
    body: (
      <p>
        We process your data to perform our contract with you (providing the Service you&rsquo;ve
        signed up for), and in some cases based on your consent, such as if you opt in to product
        updates.
      </p>
    ),
  },
  {
    heading: "6. Data retention",
    body: (
      <p>
        We retain your catalog data for as long as your account is active. You may request
        deletion of your account and associated data at any time by contacting us (see below).
      </p>
    ),
  },
  {
    heading: "7. Your rights (GDPR)",
    body: (
      <>
        <p>
          If you&rsquo;re in the EU/EEA (or covered by similar regional laws), you have the right
          to:
        </p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data (&ldquo;right to be forgotten&rdquo;).</li>
          <li>Request a portable export of your data.</li>
          <li>Object to certain processing.</li>
          <li>Lodge a complaint with your local data protection authority.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:wearegamechangers@outlook.com" className="text-ink underline hover:text-brass">
            wearegamechangers@outlook.com
          </a>
          .
        </p>
      </>
    ),
  },
  {
    heading: "8. International data transfers",
    body: (
      <p>
        Where personal data is transferred outside the UK or EEA, we rely on appropriate
        safeguards, such as Standard Contractual Clauses (SCCs), or other lawful transfer
        mechanisms required by applicable data protection laws.
      </p>
    ),
  },
  {
    heading: "9. Cookies",
    body: (
      <p>
        We use a single functional cookie — the Supabase authentication session cookie — to keep
        you signed in. We do not use tracking, advertising, or analytics cookies.
      </p>
    ),
  },
  {
    heading: "10. Changes to this policy",
    body: (
      <p>
        We may update this policy from time to time. Material changes will be noted with an
        updated &ldquo;Last updated&rdquo; date.
      </p>
    ),
  },
  {
    heading: "11. Contact",
    body: (
      <p>
        Privacy questions or rights requests:{" "}
        <a href="mailto:wearegamechangers@outlook.com" className="text-ink underline hover:text-brass">
          wearegamechangers@outlook.com
        </a>
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-10 pb-20">
      <div className="mx-auto max-w-3xl">
        <PageHeader eyebrow="Last updated: August 2026" title="Privacy Policy" />

        <Card className="p-6 sm:p-10">
          <div className="space-y-8 text-base font-normal leading-relaxed text-ink/75 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_li]:leading-relaxed [&_p+p]:mt-3 [&_p+ul]:mt-3 [&_ul+p]:mt-3">
            {SECTIONS.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-lg font-semibold text-ink mb-2">
                  {section.heading}
                </h2>
                {section.body}
              </section>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
