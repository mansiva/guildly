export const metadata = {
  title: 'Privacy Policy — Guildly',
  description: 'Privacy Policy for Guildly',
};

export default function PrivacyPage() {
  const lastUpdated = 'April 11, 2026';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-10">
          <a href="/" className="text-2xl font-bold text-indigo-600 no-underline">⚡ Guildly</a>
          <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <p>
              Guildly ("we", "our", or "us") is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, and safeguard your information
              when you use the Guildly web app at <strong>guildly.app</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Information We Collect</h2>
            <h3 className="font-semibold text-gray-800 mb-2">Information you provide</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Name and email address (via Google Sign-In or email registration)</li>
              <li>Profile photo (if provided via Google account)</li>
              <li>Group names, quest titles, descriptions, and activity logs you create</li>
            </ul>
            <h3 className="font-semibold text-gray-800 mt-4 mb-2">Information collected automatically</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Authentication tokens (managed by Firebase Authentication)</li>
              <li>App usage data stored in Firestore (quest progress, XP, group membership)</li>
              <li>Basic browser/device information for app functionality</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. How We Use Your Information</h2>
            <p className="text-sm mb-2">We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Create and manage your Guildly account</li>
              <li>Enable group collaboration, quest tracking, and activity feeds</li>
              <li>Calculate XP, levels, and award badges</li>
              <li>Display your name and photo to members of groups you belong to</li>
              <li>Improve the app and fix bugs</li>
            </ul>
            <p className="text-sm mt-3">
              We do <strong>not</strong> sell your personal data to third parties.
              We do <strong>not</strong> use your data for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Data Sharing</h2>
            <p className="text-sm mb-2">Your data may be shared in the following limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <strong>Within your groups:</strong> Your display name, photo, and activity
                (quest contributions, XP) are visible to other members of groups you join.
              </li>
              <li>
                <strong>Service providers:</strong> We use Google Firebase (Authentication,
                Firestore) and Vercel (hosting) to operate the app. These providers process
                data on our behalf under their own privacy policies.
              </li>
              <li>
                <strong>Legal requirements:</strong> We may disclose data if required by law
                or to protect the rights and safety of users.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Data Storage & Security</h2>
            <p className="text-sm">
              Your data is stored securely in Google Firebase (Firestore), located in Google
              Cloud infrastructure. We implement security rules to ensure users can only access
              data they are authorised to see. All data is transmitted over HTTPS.
            </p>
            <p className="text-sm mt-3">
              While we take reasonable measures to protect your data, no system is completely
              secure. We recommend using a strong, unique password for your Google account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Data Retention</h2>
            <p className="text-sm">
              We retain your data for as long as your account is active. If you delete your
              account, we will delete your personal data within 30 days, except where retention
              is required by law. Group activity you contributed (quest logs, feed entries)
              may remain visible to other group members in anonymised form.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Your Rights</h2>
            <p className="text-sm mb-2">Depending on your location, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability (receive a copy of your data)</li>
            </ul>
            <p className="text-sm mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:privacy@guildly.app" className="text-indigo-600 underline">
                privacy@guildly.app
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Children's Privacy</h2>
            <p className="text-sm">
              Guildly is not directed at children under the age of 13. We do not knowingly
              collect personal data from children under 13. If you believe a child has provided
              us with personal information, please contact us and we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">8. Third-Party Services</h2>
            <p className="text-sm mb-2">Guildly uses the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>
                <strong>Google Firebase</strong> — Authentication and database.{' '}
                <a href="https://firebase.google.com/support/privacy" className="text-indigo-600 underline" target="_blank" rel="noopener noreferrer">
                  Firebase Privacy Policy
                </a>
              </li>
              <li>
                <strong>Vercel</strong> — Web hosting and deployment.{' '}
                <a href="https://vercel.com/legal/privacy-policy" className="text-indigo-600 underline" target="_blank" rel="noopener noreferrer">
                  Vercel Privacy Policy
                </a>
              </li>
              <li>
                <strong>Google Sign-In</strong> — Authentication via Google OAuth.{' '}
                <a href="https://policies.google.com/privacy" className="text-indigo-600 underline" target="_blank" rel="noopener noreferrer">
                  Google Privacy Policy
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">9. Cookies</h2>
            <p className="text-sm">
              Guildly uses minimal cookies and local storage solely for authentication session
              management (keeping you logged in). We do not use cookies for tracking or
              advertising. You can clear these at any time via your browser settings, though
              this will log you out of the app.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">10. Changes to This Policy</h2>
            <p className="text-sm">
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes by updating the "Last updated" date at the top of this page.
              Continued use of Guildly after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">11. Contact Us</h2>
            <p className="text-sm">
              If you have any questions about this Privacy Policy or how we handle your data,
              please contact us at:{' '}
              <a href="mailto:privacy@guildly.app" className="text-indigo-600 underline">
                privacy@guildly.app
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <a href="/" className="text-indigo-600 text-sm font-medium">← Back to Guildly</a>
        </div>
      </div>
    </div>
  );
}
