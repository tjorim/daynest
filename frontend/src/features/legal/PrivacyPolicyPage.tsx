import { m } from "@/paraglide/messages";

const LAST_UPDATED = "July 4, 2026";

export function PrivacyPolicyPage() {
  return (
    <section className="mx-auto px-3" style={{ maxWidth: "48rem" }}>
      <h2 className="h4 mb-1">{m.privacy_page_title()}</h2>
      <p className="text-muted mb-4">{m.privacy_page_last_updated({ date: LAST_UPDATED })}</p>

      <p>{m.privacy_page_intro()}</p>
      <p>{m.privacy_page_self_hosting()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_data_collected_title()}</h3>

      <h4 className="h6 mt-3">{m.privacy_page_account_title()}</h4>
      <p>{m.privacy_page_account_body()}</p>

      <h4 className="h6 mt-3">{m.privacy_page_household_data_title()}</h4>
      <p>{m.privacy_page_household_data_body()}</p>

      <h4 className="h6 mt-3">{m.privacy_page_medication_title()}</h4>
      <p>{m.privacy_page_medication_body()}</p>

      <h4 className="h6 mt-3">{m.privacy_page_calendar_title()}</h4>
      <p>{m.privacy_page_calendar_body()}</p>

      <h4 className="h6 mt-3">{m.privacy_page_notifications_title()}</h4>
      <p>{m.privacy_page_notifications_body()}</p>

      <h4 className="h6 mt-3">{m.privacy_page_integrations_title()}</h4>
      <p>{m.privacy_page_integrations_body()}</p>

      <h4 className="h6 mt-3">{m.privacy_page_diagnostics_title()}</h4>
      <p>{m.privacy_page_diagnostics_body()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_data_use_title()}</h3>
      <p>{m.privacy_page_data_use_body()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_sharing_title()}</h3>
      <p>{m.privacy_page_sharing_intro()}</p>
      <ul>
        <li>{m.privacy_page_sharing_hosting()}</li>
        <li>{m.privacy_page_sharing_sentry()}</li>
        <li>{m.privacy_page_sharing_push()}</li>
      </ul>
      <p>{m.privacy_page_sharing_outro()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_retention_title()}</h3>
      <p>{m.privacy_page_retention_body()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_security_title()}</h3>
      <p>{m.privacy_page_security_body()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_children_title()}</h3>
      <p>{m.privacy_page_children_body()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_changes_title()}</h3>
      <p>{m.privacy_page_changes_body()}</p>

      <h3 className="h5 mt-4">{m.privacy_page_contact_title()}</h3>
      <p>
        {m.privacy_page_contact_body()}{" "}
        <a href="mailto:tielemans.jorim@gmail.com">tielemans.jorim@gmail.com</a>
        {m.privacy_page_contact_or()}{" "}
        <a href="https://github.com/tjorim/daynest" target="_blank" rel="noreferrer">
          {m.privacy_page_contact_github_link()}
        </a>
        .
      </p>
    </section>
  );
}
