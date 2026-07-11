import { useContext, useState } from "react";
import * as m from "@/paraglide/messages";
import { AuthContext } from "@/app/providers/AuthProvider";
import { deleteAccount } from "@/lib/api/settings";

export function AccountDeletionSection() {
  const auth = useContext(AuthContext);
  const userEmail = auth?.user?.email ?? "";
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const canDelete = userEmail.length > 0 && confirmationEmail.trim() === userEmail;

  const resetConfirmation = () => {
    setIsConfirming(false);
    setConfirmationEmail("");
    setError(null);
  };

  const handleDelete = async () => {
    setError(null);

    if (!canDelete) {
      setError(m.settings_delete_account_mismatch());
      return;
    }

    setIsDeleting(true);
    try {
      await deleteAccount();
      auth?.logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : m.settings_delete_account_error());
      setIsDeleting(false);
    }
  };

  return (
    <div className="card mt-3 border-danger">
      <div className="card-header fw-semibold py-2 text-danger">
        {m.settings_delete_account_header()}
      </div>
      <div className="card-body py-2">
        <p className="text-muted small mb-2">{m.settings_delete_account_description()}</p>
        {isConfirming ? (
          <div className="alert alert-danger py-2 small mb-2">
            {m.settings_delete_account_confirm({ email: userEmail })}
          </div>
        ) : null}
        {isConfirming ? (
          <div className="mb-2">
            <label className="form-label small mb-1" htmlFor="delete-account-email-confirmation">
              {m.settings_delete_account_email_label()}
            </label>
            <input
              type="email"
              className="form-control form-control-sm"
              id="delete-account-email-confirmation"
              value={confirmationEmail}
              onChange={(event) => {
                setConfirmationEmail(event.target.value);
                setError(null);
              }}
              placeholder={m.settings_delete_account_email_placeholder({ email: userEmail })}
              autoComplete="off"
              disabled={isDeleting}
            />
          </div>
        ) : null}
        {error ? <div className="alert alert-danger py-2 small mb-2">{error}</div> : null}
        {isConfirming ? (
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={isDeleting || !canDelete}
            >
              {isDeleting ? m.settings_delete_account_deleting() : m.action_confirm()}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={resetConfirmation}
              disabled={isDeleting}
            >
              {m.action_cancel()}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => {
              setError(null);
              setConfirmationEmail("");
              setIsConfirming(true);
            }}
            disabled={isDeleting || userEmail.length === 0}
          >
            {m.settings_delete_account_button()}
          </button>
        )}
      </div>
    </div>
  );
}
