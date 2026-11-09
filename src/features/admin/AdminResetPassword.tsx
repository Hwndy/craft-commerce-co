import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { updatePassword } from "./lib/auth";
import { NoIndex } from "./components/NoIndex";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});
type Values = z.infer<typeof schema>;

/**
 * Lands here from the password-reset email's link — supabase-js's client
 * (detectSessionInUrl, the default) already turns that link's token into
 * a real session before this component ever mounts, so updateUser() below
 * just needs a password, not any token handling of its own.
 */
export default function AdminResetPassword() {
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  async function onSubmit(values: Values) {
    setServerError(null);
    try {
      await updatePassword(values.password);
      setDone(true);
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Couldn't set the new password.");
    }
  }

  if (done) return <Navigate to="/admin" replace />;

  return (
    <>
      <NoIndex />
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-2xl font-heading">Set a new password</h1>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {serverError && <p className="text-sm text-destructive">{serverError}</p>}
              <Button type="submit" variant="pill" className="w-full" disabled={form.formState.isSubmitting}>
                Set password
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </>
  );
}
