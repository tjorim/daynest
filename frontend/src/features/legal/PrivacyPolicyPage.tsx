import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

const LAST_UPDATED = "2026-07-04";

const sectionTitleClass = "tw:mt-6 tw:text-h5 tw:font-medium";
const subsectionTitleClass = "tw:mt-4 tw:text-h6 tw:font-medium";

export function PrivacyPolicyPage() {
  return (
    <section className="tw:mx-auto tw:max-w-3xl tw:px-4">
      <h2 className="tw:mb-1 tw:text-h4 tw:font-medium">{m.privacy_page_title()}</h2>
      <p className="tw:mb-6 tw:text-muted-foreground">
        {m.privacy_page_last_updated({
          date: new Intl.DateTimeFormat(getLocale(), { dateStyle: "long", timeZone: "UTC" }).format(
            new Date(LAST_UPDATED),
          ),
        })}
      </p>

      <p>{m.privacy_page_intro()}</p>
      <p>{m.privacy_page_self_hosting()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_data_collected_title()}</h3>

      <h4 className={subsectionTitleClass}>{m.privacy_page_account_title()}</h4>
      <p>{m.privacy_page_account_body()}</p>

      <h4 className={subsectionTitleClass}>{m.privacy_page_household_data_title()}</h4>
      <p>{m.privacy_page_household_data_body()}</p>

      <h4 className={subsectionTitleClass}>{m.privacy_page_medication_title()}</h4>
      <p>{m.privacy_page_medication_body()}</p>

      <h4 className={subsectionTitleClass}>{m.privacy_page_calendar_title()}</h4>
      <p>{m.privacy_page_calendar_body()}</p>

      <h4 className={subsectionTitleClass}>{m.privacy_page_notifications_title()}</h4>
      <p>{m.privacy_page_notifications_body()}</p>

      <h4 className={subsectionTitleClass}>{m.privacy_page_integrations_title()}</h4>
      <p>{m.privacy_page_integrations_body()}</p>

      <h4 className={subsectionTitleClass}>{m.privacy_page_diagnostics_title()}</h4>
      <p>{m.privacy_page_diagnostics_body()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_data_use_title()}</h3>
      <p>{m.privacy_page_data_use_body()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_sharing_title()}</h3>
      <p>{m.privacy_page_sharing_intro()}</p>
      <ul>
        <li>{m.privacy_page_sharing_hosting()}</li>
        <li>{m.privacy_page_sharing_sentry()}</li>
        <li>{m.privacy_page_sharing_push()}</li>
      </ul>
      <p>{m.privacy_page_sharing_outro()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_retention_title()}</h3>
      <p>{m.privacy_page_retention_body()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_security_title()}</h3>
      <p>{m.privacy_page_security_body()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_children_title()}</h3>
      <p>{m.privacy_page_children_body()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_changes_title()}</h3>
      <p>{m.privacy_page_changes_body()}</p>

      <h3 className={sectionTitleClass}>{m.privacy_page_contact_title()}</h3>
      <p>
        {m.privacy_page_contact_body()}{" "}
        <a href="mailto:tielemans.jorim@gmail.com">tielemans.jorim@gmail.com</a>.
      </p>
    </section>
  );
}
