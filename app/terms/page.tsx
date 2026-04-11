export const metadata = {
  title: 'Terms of Service — Guildly',
  description: 'Terms of Service for Guildly',
};

export default function TermsPage() {
  const lastUpdated = 'April 11, 2026';

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-10">
          <a href="/" className="text-2xl font-bold text-indigo-600 no-underline">⚡ Guildly</a>
          <h1 className="text-3xl font-bold text-gray-900 mt-6 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <p className="text-sm">
              By using Guildly ("the app", "the service"), you agree to these Terms of Service.
              Please read them carefully. If you do not agree, do not use Guildly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">1. Using Guildly</h2>
            <p className="text-sm mb-2">You may use Guildly for personal, non-commercial group goal tracking. You agree to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Provide accurate information when creating your account</li>
              <li>Keep your login credentials secure</li>
              <li>Use the app in a way that is respectful to other users</li>
              <li>Not attempt to hack, abuse, or disrupt the service</li>
              <li>Not use the app for any unlawful purpose</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">2. Your Content</h2>
            <p className="text-sm">
              You own the content you create in Guildly (group names, quest descriptions, activity logs).
              By using the app, you grant us a limited licence to store and display that content
              to you and members of your groups, solely to operate the service.
              You are responsible for ensuring your content does not violate any laws or third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">3. Account Termination</h2>
            <p className="text-sm">
              You may delete your account at any time. We reserve the right to suspend or
              terminate accounts that violate these terms, engage in abusive behaviour,
              or misuse the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">4. Disclaimer of Warranties</h2>
            <p className="text-sm">
              Guildly is provided "as is" without warranties of any kind. We do not guarantee
              the app will be available at all times, error-free, or that data will never be lost.
              Use the app at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">5. Limitation of Liability</h2>
            <p className="text-sm">
              To the fullest extent permitted by law, Guildly and its operators shall not be
              liable for any indirect, incidental, or consequential damages arising from your
              use of the service, including data loss or service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">6. Changes to Terms</h2>
            <p className="text-sm">
              We may update these Terms from time to time. We will update the "Last updated"
              date when we do. Continued use of Guildly after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-3">7. Contact</h2>
            <p className="text-sm">
              Questions about these Terms?{' '}
              <a href="mailto:privacy@guildly.app" className="text-indigo-600 underline">
                privacy@guildly.app
              </a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <a href="/privacy" className="text-indigo-600 text-sm font-medium mr-6">Privacy Policy</a>
          <a href="/" className="text-indigo-600 text-sm font-medium">← Back to Guildly</a>
        </div>
      </div>
    </div>
  );
}
