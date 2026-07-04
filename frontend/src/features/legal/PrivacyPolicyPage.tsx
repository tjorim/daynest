const LAST_UPDATED = "July 4, 2026";

export function PrivacyPolicyPage() {
  return (
    <section className="mx-auto" style={{ maxWidth: "48rem" }}>
      <h2 className="h4 mb-1">Privacy Policy</h2>
      <p className="text-muted mb-4">Last updated: {LAST_UPDATED}</p>

      <p>
        Daynest (&ldquo;Daynest&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a personal/household
        planning app for daily routines, chores, medication reminders, meal planning, and
        shopping lists. This policy explains what data the official Daynest service at{" "}
        <code>daynest.tjor.im</code>, and the Daynest web and Android apps that connect to it,
        collect and how that data is used.
      </p>
      <p>
        Daynest is open source and can be self-hosted by anyone. If you are using a
        self-hosted instance operated by someone other than us, that operator is
        responsible for your data and this policy does not apply to their instance.
      </p>

      <h3 className="h5 mt-4">Data we collect</h3>

      <h4 className="h6 mt-3">Account &amp; authentication</h4>
      <p>
        When you sign up or sign in (including via single sign-on/OIDC), we store your
        email address, display name, a securely hashed password (if you use one), your
        timezone, and notification/quiet-hours preferences. If you are part of a
        household, we store which household(s) you belong to.
      </p>

      <h4 className="h6 mt-3">Household &amp; planning data</h4>
      <p>
        Routines, chores, tasks, meal plans, shopping lists, and templates that you or
        members of your household create are stored so the app can show and schedule
        them for you.
      </p>

      <h4 className="h6 mt-3">Medication data (optional)</h4>
      <p>
        If you use the medication feature, we store the medication names, dosage
        instructions, and schedules you enter. This is health-adjacent information that
        you choose to provide; it is only stored if you use this optional feature and is
        never used for anything other than showing and reminding you of your own
        medication schedule.
      </p>

      <h4 className="h6 mt-3">Calendar integration</h4>
      <p>
        You can subscribe an external calendar app to a private, per-account calendar
        feed URL containing your Daynest schedule. The Android app can also read and
        write your device&rsquo;s calendar (with your permission) to keep local calendar
        events in sync with Daynest.
      </p>

      <h4 className="h6 mt-3">Push notifications</h4>
      <p>
        If you enable notifications, we store the push subscription your browser or
        device gives us (an endpoint URL and encryption keys) so we can deliver chore and
        medication reminders. Depending on platform, this is delivered via Web Push,
        Firebase Cloud Messaging (Android), or UnifiedPush.
      </p>

      <h4 className="h6 mt-3">Third-party integrations</h4>
      <p>
        If you connect Daynest to an external tool (for example Home Assistant or an
        MCP-compatible assistant), we store the access credentials needed to allow that
        connection, scoped to your account.
      </p>

      <h4 className="h6 mt-3">Diagnostics &amp; logs</h4>
      <p>
        Our server logs basic request metadata (user ID, route, response status,
        latency) to operate and troubleshoot the service. If error monitoring is
        enabled, crash reports are sent to Sentry with default personal-data collection
        turned off.
      </p>

      <h3 className="h5 mt-4">How we use this data</h3>
      <p>
        We use the data above solely to provide and improve Daynest&rsquo;s core
        functionality: showing your tasks and schedule, sending reminders you&rsquo;ve
        opted into, syncing your calendar, and keeping the service reliable and secure.
        We do not sell your data, and we do not use it for advertising.
      </p>

      <h3 className="h5 mt-4">Sharing with third parties</h3>
      <p>We share data only with the infrastructure providers needed to run the service:</p>
      <ul>
        <li>Our hosting provider, which runs the server and database.</li>
        <li>
          Sentry, for optional error/crash monitoring (configured without default
          personal data collection).
        </li>
        <li>
          Firebase Cloud Messaging (Google) or a UnifiedPush distributor of your choice,
          to deliver push notifications on Android.
        </li>
      </ul>
      <p>We do not otherwise share, rent, or sell your data to third parties.</p>

      <h3 className="h5 mt-4">Data retention &amp; deletion</h3>
      <p>
        We keep your data for as long as your account is active. If you delete your
        account (or ask us to), your account and all associated data &mdash; household
        membership, planning data, medication data, calendar tokens, push subscriptions,
        and integration credentials &mdash; are deleted. To request deletion, contact us
        using the details below.
      </p>

      <h3 className="h5 mt-4">Security</h3>
      <p>
        Data is transmitted over encrypted HTTPS connections, the Android app pins the
        server&rsquo;s TLS certificate, and passwords are stored using secure one-way
        hashing. Access to your data requires authentication.
      </p>

      <h3 className="h5 mt-4">Children&rsquo;s privacy</h3>
      <p>
        Daynest is intended for use by adults managing their own household. It is not
        directed at children, and we do not knowingly collect data from children.
      </p>

      <h3 className="h5 mt-4">Changes to this policy</h3>
      <p>
        We may update this policy as the app evolves. Material changes will be reflected
        by updating the &ldquo;Last updated&rdquo; date above.
      </p>

      <h3 className="h5 mt-4">Contact</h3>
      <p>
        Questions, data access, or deletion requests can be sent to{" "}
        <a href="mailto:tielemans.jorim@gmail.com">tielemans.jorim@gmail.com</a>, or filed
        as an issue on the{" "}
        <a href="https://github.com/tjorim/daynest" target="_blank" rel="noreferrer">
          Daynest GitHub repository
        </a>
        .
      </p>
    </section>
  );
}
