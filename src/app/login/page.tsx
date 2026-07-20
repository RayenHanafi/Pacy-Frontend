"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queries";
import { roleHome } from "@/lib/roles";
import { getSupabaseClient } from "@/lib/supabase";
import type { Me } from "@/lib/types";

/**
 * Email + password only. No signup and no role picker by design: doctors and
 * pharmacies are pre-seeded server-side because they can't self-verify
 * (regulator constraint).
 */
export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { error: authError } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      // Role comes from the backend, never from the JWT we just received.
      // Fetch it before routing so we land on the right view the first time
      // instead of flashing a redirect.
      const me = await queryClient.fetchQuery({
        queryKey: queryKeys.me,
        queryFn: () => api<Me>("/me"),
      });

      if (!me) {
        setError("Signed in, but the backend didn't return a profile.");
        return;
      }

      router.replace(roleHome[me.role]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't sign in. Is the backend running?",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-6 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-2xl text-text-strong">
            Pacy
          </CardTitle>
          <CardDescription>
            One prescription. One token. One time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@pacy.test"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <p className="mt-4 text-xs text-text-muted">
            Accounts are pre-seeded. There&rsquo;s no signup — doctors and pharmacies
            are verified off-platform.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
