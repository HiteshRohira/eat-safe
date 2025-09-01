import { useEffect, useMemo, useState } from "react";
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
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination";

const ITEMS_PER_PAGE = 10;

function Home() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch all restaurants once, client-side filter + paginate
  useEffect(() => {
    let isMounted = true;
    const fetchRestaurants = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/api/restraunts/");
        if (!isMounted) return;
        setRestaurants(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!isMounted) return;
        const msg =
          err?.response?.status === 401
            ? "Unauthorized — please log in to view restaurants."
            : err?.message || "Failed to load restaurants.";
        setError(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchRestaurants();
    return () => {
      isMounted = false;
    };
  }, []);

  // Derived: filtered by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return restaurants;
    return restaurants.filter((r) => {
      return [
        r?.name,
        r?.cuisine,
        r?.boro,
        r?.zipcode,
        r?.camis,
        r?.phone,
        r?.street,
        r?.building,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [restaurants, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  // Reset to page 1 on new search
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Clamp page when filtered list shrinks
  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const goToPage = (page) => {
    const next = Math.min(Math.max(1, page), pageCount);
    setCurrentPage(next);
  };

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Restaurants</h1>
        <p className="text-muted-foreground">
          Browse NYC restaurants. Use search to filter by name, cuisine, boro, CAMIS, zip, etc.
        </p>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search restaurants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search restaurants"
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
            Loading restaurants...
          </div>
        ) : error ? (
          <div className="p-6 text-destructive">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            No restaurants found.
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
                {currentItems.map((r) => (
                  <TableRow key={r.camis}>
                    <TableCell className="font-medium">{r?.name || "-"}</TableCell>
                    <TableCell>{r?.boro || "-"}</TableCell>
                    <TableCell>{r?.cuisine || "-"}</TableCell>
                    <TableCell>{r?.zipcode || "-"}</TableCell>
                    <TableCell className="tabular-nums">{r?.camis || "-"}</TableCell>
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
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: pageCount }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        isActive={page === currentPage}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(page);
                        }}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        goToPage(currentPage + 1);
                      }}
                      className={currentPage === pageCount ? "pointer-events-none opacity-50" : ""}
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

export default Home;
