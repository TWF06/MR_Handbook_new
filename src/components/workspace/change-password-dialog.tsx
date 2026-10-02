import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/queries";

export function ChangePasswordDialog({
  open,
  onOpenChange,
  employeeId,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string | undefined;
  name?: string | undefined;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (next.length < 8) { toast.error("New password must be at least 8 characters."); return; }
    if (next !== confirm) { toast.error("New passwords don't match."); return; }
    if (next === current) { toast.error("New password must differ from the current one."); return; }
    setPending(true);
    const { error } = await supabase.auth.updateUser({ password: next, current_password: current } as never);
    setPending(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("current")
          ? "Current password is incorrect."
          : error.message,
      );
      return;
    }
    if (employeeId && name) await recordAudit(employeeId, name, "Changed password").catch(() => undefined);
    toast.success("Password updated");
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Enter your current password, then choose a new one.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="cp-current">Current password</Label>
            <Input id="cp-current" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">New password</Label>
            <Input id="cp-new" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">Confirm new password</Label>
            <Input id="cp-confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Updating…" : "Update password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
