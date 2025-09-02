import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";

const ITEMS_PER_PAGE = 10;

function Inspection() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState(null);
  const [violations, setViolations] = useState([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [violationsError, setViolationsError] = useState("");
  const [searchParams] = useSearchParams();
  const camisFilter =
    searchParams.get("restraunt") || searchParams.get("camis") || "";

  // Fetch inspections with server-side pagination + search
  useEffect(() => {
    let isMounted = true;

    const fetchInspections = async () => {
      try {
        setLoading(true);
        setError("");

        const params = {
          page: currentPage,
          page_size: ITEMS_PER_PAGE,
        };
        const q = search.trim();
        if (q) params.q = q;
        if (camisFilter) params.restraunt = camisFilter;

        const res = await api.get("/api/inspections/", { params });
        if (!isMounted) return;

        const data = res?.data;
        if (Array.isArray(data)) {
          // Fallback if server isn't paginating
          setInspections(data);
          setTotalCount(data.length);
        } else {
          const results = Array.isArray(data?.results) ? data.results : [];
          const count = Number.isFinite(data?.count)
            ? data.count
            : results.length;
          setInspections(results);
          setTotalCount(count);
        }
      } catch (err) {
        if (!isMounted) return;
        const msg =
          err?.response?.status === 401
            ? "Unauthorized — please log in to view inspections."
            : err?.message || "Failed to load inspections.";
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInspections();
    return () => {
      isMounted = false;
    };
  }, [search, camisFilter, currentPage]);

  const pageCount = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Reset to page 1 on new search
  useEffect(() => {
    setCurrentPage(1);
  }, [search, camisFilter]);

  // Clamp page when pageCount shrinks
  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const goToPage = (page) => {
    const next = Math.min(Math.max(1, page), pageCount);
    setCurrentPage(next);
  };

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Violations</SheetTitle>
            <SheetDescription>
              {selectedInspection?.inspection_date
                ? `Inspection on ${new Date(selectedInspection.inspection_date).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {violationsLoading ? (
              <div className="text-muted-foreground">Loading violations...</div>
            ) : violationsError ? (
              <div className="text-destructive">{violationsError}</div>
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
                      <TableCell>{v?.critical_flag || "-"}</TableCell>
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
      <div className="flex flex-col gap-2">
        {inspections?.[0]?.restraunt_detail?.name ? (
          <>
            <h2 className="text-xl font-semibold tracking-tight">
              Inspection for {inspections[0].restraunt_detail.name}
            </h2>
            {inspections?.[0]?.inspection_date && (
              <p className="text-muted-foreground">
                Last inspection at{" "}
                {new Date(inspections[0].inspection_date).toLocaleDateString(
                  undefined,
                  { year: "numeric", month: "long", day: "numeric" },
                )}
                . Use search to filter by action or grade
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              Inspections
            </h1>
            <p className="text-muted-foreground">
              {`Browse inspections. Use search to filter by action or grade`}
            </p>
          </>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search inspections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search inspections"
          />
        </div>
        {search && (
          <Button
            variant="ghost"
            onClick={() => setSearch("")}
            className="self-end sm:self-auto"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="rounded-lg border">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Loading inspections...
          </div>
        ) : error ? (
          <div className="p-6 text-destructive">{error}</div>
        ) : inspections.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No inspections found.
          </div>
        ) : (
          <>
            <Table className="[&_th]:bg-muted/30 [&_th]:font-semibold">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Grade Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((r) => {
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => {
                        setSelectedInspection(r);
                        setSheetOpen(true);
                        (async () => {
                          try {
                            setViolationsLoading(true);
                            setViolationsError("");
                            const res = await api.get("/api/violations/", {
                              params: { inspection: r.id },
                            });
                            const data = Array.isArray(res?.data)
                              ? res.data
                              : Array.isArray(res?.data?.results)
                                ? res.data.results
                                : [];
                            setViolations(data);
                          } catch (e) {
                            setViolationsError(
                              e?.message || "Failed to load violations.",
                            );
                          } finally {
                            setViolationsLoading(false);
                          }
                        })();
                      }}
                    >
                      <TableCell className="tabular-nums">
                        {r?.inspection_date || "-"}
                      </TableCell>
                      <TableCell>{r?.inspection_type || "-"}</TableCell>
                      <TableCell
                        className="max-w-[420px] truncate"
                        title={r?.action || ""}
                      >
                        {r?.action || "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {Number.isFinite(r?.score) ? r.score : "-"}
                      </TableCell>
                      <TableCell>{r?.grade || "-"}</TableCell>
                      <TableCell className="tabular-nums">
                        {r?.grade_date || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Separator />

            {/* Pagination */}
            <div className="p-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        goToPage(currentPage - 1);
                      }}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        goToPage(currentPage + 1);
                      }}
                      className={
                        currentPage === pageCount
                          ? "pointer-events-none opacity-50"
                          : ""
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Inspection;
