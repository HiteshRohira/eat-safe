import { useEffect, useState } from "react";
import api from "@/src/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

function ViolationSheet({
  open,
  onOpenChange,
  inspection,
  side = "right",
  pageSize = 100,
}) {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch violations whenever the sheet opens for a specific inspection
  useEffect(() => {
    let cancelled = false;

    async function fetchViolations() {
      if (!open || !inspection?.id) {
        setViolations([]);
        setLoading(false);
        setError("");
        return;
      }

      try {
        setLoading(true);
        setError("");
        const res = await api.get("/api/violations/", {
          params: { inspection: inspection.id, page_size: pageSize },
        });

        if (cancelled) return;

        const data = Array.isArray(res?.data)
          ? res.data
          : Array.isArray(res?.data?.results)
            ? res.data.results
            : [];
        setViolations(data);
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || "Failed to load violations.");
        setViolations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchViolations();

    return () => {
      cancelled = true;
    };
  }, [open, inspection?.id, pageSize]);

  const formattedDate =
    inspection?.inspection_date &&
    new Date(inspection.inspection_date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Violations</SheetTitle>
          <SheetDescription>
            {formattedDate
              ? `Inspection on ${formattedDate}`
              : inspection?.id
                ? `Inspection #${inspection.id}`
                : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4">
          {loading ? (
            <div className="text-muted-foreground">Loading violations...</div>
          ) : error ? (
            <div className="text-destructive">{error}</div>
          ) : violations.length === 0 ? (
            <div className="text-muted-foreground">
              No violations for this inspection.
            </div>
          ) : (
            <Table className="[&_th]:bg-muted/30 [&_th]:font-semibold">
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="tabular-nums">
                      {v?.code || "-"}
                    </TableCell>
                    <TableCell>
                      {v?.critical_flag ? (
                        v.critical_flag === "Critical" ? (
                          <Badge variant="destructive">Critical</Badge>
                        ) : v.critical_flag === "Not Critical" ? (
                          <Badge variant="secondary">Not Critical</Badge>
                        ) : (
                          <Badge variant="outline">Not Applicable</Badge>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[360px] whitespace-normal"
                      title={v?.description || ""}
                    >
                      {v?.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

export default ViolationSheet;
