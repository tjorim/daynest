import { useContext, useState } from "react";
import * as m from "@/paraglide/messages";
import { AuthContext } from "@/app/providers/AuthProvider";
import { deleteAccount } from "@/lib/api/settings";
import { apiErrorMessage } from "@/lib/api/errorMessages";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      setError(apiErrorMessage(err, m.settings_delete_account_error()));
      setIsDeleting(false);
    }
  };

  return (
    <Card className="tw:mt-4 tw:border-danger">
      <CardHeader className="tw:font-semibold tw:py-2 tw:text-danger">
        {m.settings_delete_account_header()}
      </CardHeader>
      <CardContent className="tw:py-2">
        <p className="tw:text-muted-foreground tw:text-small tw:mb-2">
          {m.settings_delete_account_description()}
        </p>
        {isConfirming ? (
          <Alert variant="danger" className="tw:py-2 tw:text-small tw:mb-2">
            {m.settings_delete_account_confirm({ email: userEmail })}
          </Alert>
        ) : null}
        {isConfirming ? (
          <div className="tw:mb-2">
            <Label className="tw:text-small tw:mb-1" htmlFor="delete-account-email-confirmation">
              {m.settings_delete_account_email_label()}
            </Label>
            <Input
              size="sm"
              type="email"
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
        {error ? (
          <Alert variant="danger" className="tw:py-2 tw:text-small tw:mb-2">
            {error}
          </Alert>
        ) : null}
        {isConfirming ? (
          <div className="tw:flex tw:gap-1">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting || !canDelete}
            >
              {isDeleting ? m.settings_delete_account_deleting() : m.action_confirm()}
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={resetConfirmation}
              disabled={isDeleting}
            >
              {m.action_cancel()}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => {
              setError(null);
              setConfirmationEmail("");
              setIsConfirming(true);
            }}
            disabled={isDeleting || userEmail.length === 0}
          >
            {m.settings_delete_account_button()}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
