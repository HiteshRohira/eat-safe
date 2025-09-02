import { useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import api from "@/src/api";
import { toast } from "sonner";
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

const INSPECTION_TYPES = [
  "Cycle Inspection / Initial Inspection",
  "Cycle Inspection / Re-inspection",
  "Pre-permit (Operational) / Initial Inspection",
  "Pre-permit (Operational) / Re-inspection",
  "Administrative Miscellaneous / Re-inspection",
  "Complaint / Initial Inspection",
  "Complaint / Re-inspection",
  "Calorie Posting / Initial Inspection",
  "Monitoring / Initial Inspection",
];

const GRADE_OPTIONS = ["A", "B", "C", "P", "Z", "N"];

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
  inspection_type: z.enum(INSPECTION_TYPES, {
    required_error: "Inspection type is required",
  }),
  action: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : "")),
  score: z
    .preprocess(
      (v) => {
        if (v === "" || v === null || typeof v === "undefined")
          return undefined;
        const n = Number(v);
        return Number.isNaN(n) ? undefined : n;
      },
      z.number().int().min(0, "Score must be >= 0").max(200, "Too large"),
    )
    .optional(),
  grade: z
    .preprocess((v) => {
      if (v === "" || v === "__none__" || v == null) return undefined;
      return String(v).toUpperCase().trim();
    }, z.enum(GRADE_OPTIONS))
    .optional(),
  grade_date: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined))
    .refine((v) => !v || dateRegex.test(v), {
      message: "Use format YYYY-MM-DD",
    }),
  violations_create: z.array(violationSchema).optional().default([]),
});

function AddInspectionSheet({ open, onOpenChange, presetCamis, onCreated }) {
  const form = useForm({
    resolver: zodResolver(AddInspectionSchema),
    mode: "onSubmit",
    defaultValues: {
      restraunt: presetCamis || "",
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
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    cleaned.inspection_date = `${yyyy}-${mm}-${dd}`;

    try {
      form.clearErrors();
      form.setValue("score", cleaned.score ?? undefined);
      const res = await api.post("/api/inspections/", cleaned);
      toast.success("Inspection created", {
        description: `Inspection on ${cleaned.inspection_date}${cleaned.restraunt ? ` for ${cleaned.restraunt}` : ""}`,
      });
      if (typeof onCreated === "function") {
        onCreated(res?.data);
      }
      onOpenChange(false);
    } catch (e) {
      const message =
        e?.response?.data && typeof e.response.data === "object"
          ? JSON.stringify(e.response.data)
          : e?.message || "Failed to create inspection";
      toast.error("Failed to create inspection", { description: message });
      form.setError("root", { type: "server", message });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Add Inspection</SheetTitle>
          <SheetDescription>
            Create a new inspection record. Fields marked with * are required.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 overflow-y-auto">
          <Form {...form}>
            <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
              <FormField
                control={form.control}
                name="restraunt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant CAMIS *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 41234567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="inspection_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inspection Type *</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {INSPECTION_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        <Select
                          onValueChange={field.onChange}
                          value={field.value ?? ""}
                        >
                          <SelectTrigger className={"w-full"}>
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {GRADE_OPTIONS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                                    <SelectItem value="Critical">
                                      Critical
                                    </SelectItem>
                                    <SelectItem value="Not Critical">
                                      Not Critical
                                    </SelectItem>
                                    <SelectItem value="Not Applicable">
                                      Not Applicable
                                    </SelectItem>
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
                  {form.formState.isSubmitting
                    ? "Saving..."
                    : "Create Inspection"}
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
