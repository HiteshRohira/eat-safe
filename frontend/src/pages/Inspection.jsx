import { useEffect, useState } from "react";
import api from "../api";
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
  }, [search, currentPage]);

  const pageCount = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  // Reset to page 1 on new search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Inspections</h1>
        <p className="text-muted-foreground">
          Browse the inspections done for the restraunt and view its violations
        </p>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Boro</TableHead>
                  <TableHead>Cuisine</TableHead>
                  <TableHead>ZIP</TableHead>
                  <TableHead>CAMIS</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.map((r) => (
                  <TableRow key={r.camis}>
                    <TableCell className="font-medium">
                      {r?.name || "-"}
                    </TableCell>
                    <TableCell>{r?.boro || "-"}</TableCell>
                    <TableCell>{r?.cuisine || "-"}</TableCell>
                    <TableCell>{r?.zipcode || "-"}</TableCell>
                    <TableCell className="tabular-nums">
                      {r?.camis || "-"}
                    </TableCell>
                    <TableCell>{r?.phone || "-"}</TableCell>
                    <TableCell>
                      {r?.building || r?.street
                        ? `${r?.building ?? ""} ${r?.street ?? ""}`.trim()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
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
