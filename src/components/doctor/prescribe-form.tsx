"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BlockedPanel } from "@/components/shared/blocked-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCreatePrescription } from "@/lib/queries";
import { signPayload } from "@/lib/signing";
import type { Prescription, ScannedPatient } from "@/lib/types";

const schema = z.object({
  drug: z.string().min(1, "Required"),
  dosage: z.string().min(1, "Required"),
  instructions: z.string().min(1, "Required"),
  diagnosis: z.string().min(1, "Required"),
  // Kept as a string: a number input yields a string anyway, and coercing
  // inside the schema makes the field's type `unknown`.
  max_uses: z
    .string()
    .min(1, "Required")
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "At least one fill"),
  // Empty means "no expiry" — the backend takes null for that.
  expires_at: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function PrescribeForm({
  patient,
  doctorUserId,
  onMinted,
}: {
  patient: ScannedPatient;
  /** The doctor's own user id — part of the signed payload, not the body. */
  doctorUserId: string;
  onMinted: (prescription: Prescription) => void;
}) {
  const mutation = useCreatePrescription();
  const [signingError, setSigningError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      drug: "",
      dosage: "",
      instructions: "",
      diagnosis: "",
      max_uses: "1",
      expires_at: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSigningError(null);

    const drug_details = {
      drug: values.drug,
      dosage: values.dosage,
      instructions: values.instructions,
      diagnosis: values.diagnosis,
    };
    const max_uses = Number(values.max_uses);
    // Date input gives a local calendar day; the contract wants ISO UTC or
    // null. End-of-day avoids a prescription expiring the morning the doctor
    // picked. Computed once: the signature covers this exact string, so
    // deriving it twice risks signing one value and sending another.
    const expires_at = values.expires_at
      ? new Date(`${values.expires_at}T23:59:59Z`).toISOString()
      : null;

    let doctor_signature: string;
    try {
      doctor_signature = await signPayload(doctorUserId, {
        patient_id: patient.id,
        // Not in the request body — the backend reads it from the JWT — but
        // it IS in the signed payload.
        doctor_id: doctorUserId,
        drug_details,
        max_uses,
        expires_at,
      });
    } catch (error) {
      // Fail closed: a prescription that can't be signed must not be written,
      // and must not be sent unsigned for the server to reject.
      setSigningError(
        error instanceof Error
          ? error.message
          : "Couldn't sign this prescription on this device.",
      );
      return;
    }

    mutation.mutate(
      { patient_id: patient.id, drug_details, max_uses, expires_at, doctor_signature },
      { onSuccess: (result) => result && onMinted(result) },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-text-strong">
          New prescription
        </CardTitle>
        <CardDescription>
          This mints a token for {patient.full_name}. The fill count is enforced
          on-chain.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="drug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Drug</FormLabel>
                  <FormControl>
                    <Input placeholder="Amoxicillin 500mg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dosage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dosage</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="1 capsule three times daily"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Input placeholder="Take with food" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis</FormLabel>
                  <FormControl>
                    <Input placeholder="Bacterial throat infection" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="max_uses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fills allowed</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} step={1} {...field} />
                    </FormControl>
                    <FormDescription>
                      Enforced by the ledger, not by us.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expires_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expires</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>Leave blank for no expiry.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {signingError ? (
              <div className="rounded-lg border border-danger/40 bg-danger-surface p-4">
                <p className="font-medium text-danger-text">
                  Couldn&rsquo;t sign this prescription
                </p>
                <p className="text-sm text-foreground">{signingError}</p>
                <p className="pt-1 text-sm text-text-muted">
                  Nothing was written — no token was minted.
                </p>
              </div>
            ) : null}

            {mutation.isError ? (
              <BlockedPanel
                error={mutation.error}
                onRetry={() => mutation.reset()}
                fallbackTitle="Couldn't prescribe"
              />
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending}
            >
              {mutation.isPending
                ? "Writing to Cardano…"
                : "Prescribe & mint token"}
            </Button>

            {mutation.isPending ? (
              <p className="text-center text-sm text-text-muted">
                Submitting a real transaction to preprod. Don&rsquo;t close this
                tab.
              </p>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
