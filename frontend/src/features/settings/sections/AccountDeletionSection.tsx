import { useContext, useState } from "react";
import * as m from "@/paraglide/messages";
import { AuthContext } from "@/app/providers/AuthProvider";
import { deleteAccount } from "@/lib/api/settings";

export function AccountDeletionSection() {
  const auth = useContext(AuthContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
    const confirmed = window.confirm(m.settings_delete_account_confirm());
    if (!confirmed) return;

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
      <div className="card-header fw-semibold py-2 text-danger">{m.settings_delete_account_header()}</div>
      <div className="card-body py-2">
        <p className="text-muted small mb-2">{m.settings_delete_account_description()}</p>
        {error ? <div className="alert alert-danger py-2 small mb-2">{error}</div> : null}
        <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? m.settings_delete_account_deleting() : m.settings_delete_account_button()}
        </button>
      </div>
    </div>
  );
}
