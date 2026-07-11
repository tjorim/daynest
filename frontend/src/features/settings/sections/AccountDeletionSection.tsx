import { useContext, useState } from "react";
import * as m from "@/paraglide/messages";
import { AuthContext } from "@/app/providers/AuthProvider";
import { deleteAccount } from "@/lib/api/settings";

export function AccountDeletionSection() {
  const auth = useContext(AuthContext);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setError(null);
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
            {m.settings_delete_account_confirm()}
          </div>
        ) : null}
        {error ? <div className="alert alert-danger py-2 small mb-2">{error}</div> : null}
        {isConfirming ? (
          <div className="d-flex gap-1">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? m.settings_delete_account_deleting() : m.action_confirm()}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => {
                setIsConfirming(false);
                setError(null);
              }}
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
              setIsConfirming(true);
            }}
            disabled={isDeleting}
          >
            {m.settings_delete_account_button()}
          </button>
        )}
      </div>
    </div>
  );
}
