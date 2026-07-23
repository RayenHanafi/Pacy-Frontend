"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
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
import { useChainPrescribe } from "@/lib/chain-queries";
import type { Prescription, ScannedPatient } from "@/lib/types";

/** Backend limit: at least one medicine, at most 20 on one prescription. */
const MAX_MEDICINES = 20;

const medicineSchema = z.object({
  drug: z.string().min(1, "Required"),
  dosage: z.string().min(1, "Required"),
  instructions: z.string().min(1, "Required"),
});

const schema = z.object({
  // One prescription, one token, one expiry — but several medicines.
  medicines: z.array(medicineSchema).min(1).max(MAX_MEDICINES),
  // Prescription-level and optional; blank is sent as absent, not "".
  diagnosis: z.string(),
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

const EMPTY_MEDICINE = { drug: "", dosage: "", instructions: "" };

export function PrescribeForm({
  patient,
  doctorUserId,
  onMinted,
}: {
  patient: ScannedPatient;
  /** The doctor's user id — whose wallet signs the mint. */
  doctorUserId: string;
  onMinted: (prescription: Prescription) => void;
}) {
  // Path A: prepare → sign with the doctor's key → commit, all inside the
  // mutation. Signing failures throw and surface through the same panel.
  const mutation = useChainPrescribe(doctorUserId);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      medicines: [{ ...EMPTY_MEDICINE }],
      diagnosis: "",
      max_uses: "1",
      expires_at: "",
    },
  });

  const medicines = useFieldArray({ control: form.control, name: "medicines" });

  function onSubmit(values: FormValues) {
    const diagnosis = values.diagnosis.trim();
    const drug_details = {
      medicines: values.medicines,
      // Optional and prescription-level: omit rather than send an empty string.
      ...(diagnosis ? { diagnosis } : {}),
    };
    const max_uses = Number(values.max_uses);
    // Date input gives a local calendar day; the contract wants ISO UTC or
    // null. End-of-day avoids a prescription expiring the morning the doctor
    // picked.
    const expires_at = values.expires_at
      ? new Date(`${values.expires_at}T23:59:59Z`).toISOString()
      : null;

    mutation.mutate(
      { patient_id: patient.id, drug_details, max_uses, expires_at },
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
          This mints a token for {patient.full_name}, signed with your key —
          nobody can issue it in your name.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* One prescription can carry several medicines. The fills and
                expiry below apply to all of them together. */}
            <div className="space-y-4">
              {medicines.fields.map((row, index) => (
                <div
                  key={row.id}
                  className="space-y-4 rounded-lg border border-border-subtle p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-text-strong">
                      Medicine {index + 1}
                    </p>
                    {medicines.fields.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => medicines.remove(index)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>

                  <FormField
                    control={form.control}
                    name={`medicines.${index}.drug`}
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
                    name={`medicines.${index}.dosage`}
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
                    name={`medicines.${index}.instructions`}
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
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={medicines.fields.length >= MAX_MEDICINES}
                onClick={() => medicines.append({ ...EMPTY_MEDICINE })}
              >
                {medicines.fields.length >= MAX_MEDICINES
                  ? `Limit is ${MAX_MEDICINES} medicines`
                  : "Add another medicine"}
              </Button>
            </div>

            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis</FormLabel>
                  <FormControl>
                    <Input placeholder="Bacterial throat infection" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional, and covers the whole prescription. Not shown to
                    the dispensing pharmacy.
                  </FormDescription>
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
                      For the whole prescription. Enforced by the ledger, not
                      by us.
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
