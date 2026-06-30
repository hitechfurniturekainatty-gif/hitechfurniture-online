import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { BRAND_NAME } from "@/lib/brand";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-page py-14 max-w-3xl mx-auto">
        <h1 className="font-display text-3xl mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-xl mb-2">1. Who We Are</h2>
            <p>
              {BRAND_NAME} ("we", "us", "our") is a furniture retail, wholesale, and interior
              design business based in Edappetty, Kalpetta, Wayanad, Kerala. This policy explains
              how we collect, use, and protect information when you interact with us through our
              website, WhatsApp, Instagram, or Facebook.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">2. Information We Collect</h2>
            <p>When you contact us through any channel, we may collect:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Your name and phone number</li>
              <li>Messages you send us (WhatsApp, Instagram DM, Facebook Messenger, or website enquiry forms)</li>
              <li>Product or service requirements you share with us</li>
              <li>Delivery address, when relevant to an order</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">3. How We Use Your Information</h2>
            <p>We use the information you provide to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Respond to your enquiries, including via automated assistants on WhatsApp and Instagram</li>
              <li>Prepare quotations and process orders</li>
              <li>Coordinate delivery and after-sales service</li>
              <li>Send relevant follow-ups about enquiries you have made</li>
            </ul>
            <p className="mt-2">
              We do not sell or rent your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">4. Messaging Platforms (WhatsApp, Instagram, Facebook)</h2>
            <p>
              We use automated reply systems on WhatsApp and Instagram to provide faster responses
              to common questions (such as working hours, warranty, EMI options, and product
              enquiries). These systems are built using Meta's official Business Messaging APIs.
              Conversation data sent to us through these channels is stored securely and used only
              to assist you and improve our customer service.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">5. Data Storage & Security</h2>
            <p>
              Your information is stored on secure, access-controlled servers. Internal cost and
              pricing data are kept separate from any customer-facing systems and are never shared
              with customers or third parties.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">6. Your Rights</h2>
            <p>
              You may request access to, correction of, or deletion of your personal information
              held by us at any time by contacting us using the details below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl mb-2">7. Contact Us</h2>
            <p>
              For any questions about this Privacy Policy or your data, please contact us at{" "}
              <a href="mailto:hitechfurniturekainatty@gmail.com" className="text-primary hover:underline">
                hitechfurniturekainatty@gmail.com
              </a>{" "}
              or call +91 98951 34482.
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default PrivacyPolicy;
