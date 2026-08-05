import type { Metadata } from "next";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Contact — OwnYourMusic",
  description: "Get in touch with the OwnYourMusic team.",
};

const SUPPORT_EMAIL = "wearegamechangers@outlook.com";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-10 pb-20">
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Get in touch" />

        <Card className="p-6 sm:p-10">
          <div className="space-y-4 text-base font-normal leading-relaxed text-ink/75">
            <p>
              Questions about your account, a bug you&rsquo;ve run into, or anything else —
              we&rsquo;re happy to help.
            </p>

            <p>
              <span className="font-semibold text-ink">Email: </span>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-ink underline hover:text-brass"
              >
                {SUPPORT_EMAIL}
              </a>
            </p>

            <p>We typically respond within 1–2 business days.</p>

            <p>
              For privacy-related requests (accessing or deleting your data), please use the
              same address and mention &ldquo;Privacy Request&rdquo; in your subject line.
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
