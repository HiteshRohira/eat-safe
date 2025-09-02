import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import api from "@/src/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from "@/components/ui/form";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Schemas for fields
const violationSchema = z.object({
  code: z
    .string()
    .max(20, "Max 20 characters")
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
  description: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined)),
  critical_flag: z.enum(["Critical", "Not Critical", "Not Applicable"], {
    required_error: "Select a critical flag",
  }),
});

const AddInspectionSchema = z.object({
  restraunt: z
    .string()
    .min(1, "CAMIS is required")
    .max(10, "CAMIS max length is 10")
    .transform((v) => v.trim()),
  inspection_date: z
    .string()
    .min(1, "Inspection date is required")
    .regex(dateRegex, "Use format YYYY-MM-DD"),
  inspection_type: z
    .string()
    .min(1, "Inspection type is required")
    .max(100, "Max 100 characters")
    .transform((v) => v.trim()),
  action: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : "")),
  score: z
    .preprocess((v) => {
      if (v === "" || v === null || typeof v === "undefined") return undefined;
      const n = Number(v);
      return Number.isNaN(n) ? undefined : n;
    }, z.number().int().min(0, "Score must be >= 0").max(32767, "Too large"))
    .optional(),
  grade: z
    .string()
    .max(2, "Max 2 characters")
    .optional()
    .transform((v) => (v ? v.toUpperCase().trim() : undefined)),
  grade_date: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined))
    .refine((v) => !v || dateRegex.test(v), {
      message: "Use format YYYY-MM-DD",
    }),
  violations_create: z
    .array(violationSchema)
    .optional()
    .default([]),
});

function AddInspectionSheet({
  open,
  onOpenChange,
  presetCamis,
  onCreated,
}) {
  const form = useForm({
    resolver: zodResolver(AddInspectionSchema),
    mode: "onSubmit",
    defaultValues: {
      restraunt: presetCamis || "",
      inspection_date: "",
      inspection_type: "",
      action: "",
      score: "",
      grade: "",
      grade_date: "",
      violations_create: [],
    },
  });

  const {
    fields: violationFields,
    append: appendViolation,
    remove: removeViolation,
    replace: replaceViolations,
  } = useFieldArray({
    control: form.control,
    name: "violations_create",
  });

  useEffect(() => {
    if (!open) return;
    // Reset form each time it opens, seeding CAMIS if provided
    form.reset({
      restraunt: presetCamis || "",
      inspection_date: "",
      inspection_type: "",
      action: "",
      score: "",
      grade: "",
      grade_date: "",
      violations_create: [],
    });
    replaceViolations([]);
  }, [open, presetCamis]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values) => {
    // Filter out empty violations (where all fields are missing)
    const cleaned = {
      ...values,
      violations_create: (values.violations_create || []).filter((v) => {
        return Boolean(v.code || v.description || v.critical_flag);
      }),
    };

    try {
      form.clearErrors();
      form.setValue("score", cleaned.score ?? undefined);
      const res = await api.post("/api/inspections/", cleaned);
      if (typeof onCreated === "function") {
        onCreated(res?.data);
      }
      onOpenChange(false);
    } catch (e) {
      const message =
        e?.response?.data && typeof e.response.data === "object"
          ? JSON.stringify(e.response.data)
          : e?.message || "Failed to create inspection";
      form.setError("root", { type: "server", message });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Inspection</SheetTitle>
          <SheetDescription>
            Create a new inspection record. Fields marked with * are required.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="restraunt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant CAMIS *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 41234567"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="inspection_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inspection Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grade_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="inspection_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inspection Type *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cycle Inspection / Initial Inspection" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="score"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Score</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={32767}
                          placeholder="e.g. 18"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="grade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grade</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. A" maxLength={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter action/notes"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Violations (optional)</div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      appendViolation({
                        code: "",
                        description: "",
                        critical_flag: "Not Applicable",
                      })
                    }
                  >
                    Add violation
                  </Button>
                </div>

                {violationFields.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No violations added.
                  </div>
                ) : null}

                <div className="space-y-4">
                  {violationFields.map((item, index) => (
                    <div
                      key={item.id}
                      className="rounded-md border p-3 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          Violation #{index + 1}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => removeViolation(index)}
                          className="h-8 px-2"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <FormField
                          control={form.control}
                          name={`violations_create.${index}.code`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Code</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g. 10F" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`violations_create.${index}.critical_flag`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Criticality</FormLabel>
                              <FormControl>
                                <Select
                                  onValueChange={field.onChange}
                                  value={field.value}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select criticality" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Critical">Critical</SelectItem>
                                    <SelectItem value="Not Critical">Not Critical</SelectItem>
                                    <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="sm:col-span-3">
                          <FormField
                            control={form.control}
                            name={`violations_create.${index}.description`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                  <Textarea
                                    rows={3}
                                    placeholder="Details"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {form.formState.errors?.root?.message ? (
                <div className="text-destructive text-sm">
                  {form.formState.errors.root.message}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : "Create Inspection"}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

export default AddInspectionSheet;
