"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/src/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AreaStacked } from "@/components/charts/AreaStacked";
import { LineDots } from "@/components/charts/LineDots";

function formatShortDateLabel(iso) {
  // Expecting "YYYY-MM-DD"
  const d = iso ? new Date(iso) : null;
  if (!d || isNaN(d.getTime())) return iso || "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}`;
}

function byAscDate(a, b) {
  // Sort by inspection_date ascending
  const da = new Date(a.inspection_date || a.date || "");
  const db = new Date(b.inspection_date || b.date || "");
  return da - db;
}

export default function InspectionVisualisation({
  camis,
  limit = 50,
  className = "",
}) {
  const [violationsData, setViolationsData] = useState([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [violationsError, setViolationsError] = useState("");

  const [scoreData, setScoreData] = useState([]);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState("");

  // Fetch data on mount and when CAMIS changes
  useEffect(() => {
    let cancelled = false;

    async function fetchViolations() {
      if (!camis) {
        setViolationsData([]);
        setViolationsError("");
        setViolationsLoading(false);
        return;
      }
      try {
        setViolationsLoading(true);
        setViolationsError("");
        const res = await api.get("/api/charts/violations-timeline/", {
          params: { restraunt: camis, limit },
        });
        if (cancelled) return;
        const arr = Array.isArray(res?.data) ? res.data : [];
        setViolationsData(arr);
      } catch (e) {
        if (cancelled) return;
        setViolationsError(e?.message || "Failed to load violations timeline.");
        setViolationsData([]);
      } finally {
        if (!cancelled) setViolationsLoading(false);
      }
    }

    async function fetchScore() {
      if (!camis) {
        setScoreData([]);
        setScoreError("");
        setScoreLoading(false);
        return;
      }
      try {
        setScoreLoading(true);
        setScoreError("");
        const res = await api.get("/api/charts/score-timeline/", {
          params: { restraunt: camis, limit },
        });
        if (cancelled) return;
        const arr = Array.isArray(res?.data) ? res.data : [];
        setScoreData(arr);
      } catch (e) {
        if (cancelled) return;
        setScoreError(e?.message || "Failed to load score timeline.");
        setScoreData([]);
      } finally {
        if (!cancelled) setScoreLoading(false);
      }
    }

    fetchViolations();
    fetchScore();

    return () => {
      cancelled = true;
    };
  }, [camis, limit]);

  const areaChartData = useMemo(() => {
    // Transform to recharts-friendly rows, sorted by date ascending
    const sorted = [...violationsData].sort(byAscDate);
    return sorted.map((row) => ({
      date: row.inspection_date,
      label: formatShortDateLabel(row.inspection_date),
      critical: row.violations_critical || 0,
      notCritical: row.violations_not_critical || 0,
      notApplicable: row.violations_not_applicable || 0,
      total: row.violations_total || 0,
      grade: row.grade || null,
      score: typeof row.score === "number" ? row.score : null,
    }));
  }, [violationsData]);

  const lineChartData = useMemo(() => {
    const sorted = [...scoreData].sort(byAscDate);
    return sorted.map((row) => ({
      date: row.inspection_date,
      label: formatShortDateLabel(row.inspection_date),
      score: typeof row.score === "number" ? row.score : null,
      grade: row.grade || null,
    }));
  }, [scoreData]);

  // Chart color configs
  const violationsChartConfig = {
    critical: {
      label: "Critical",
      color: "var(--chart-1)",
    },
    notCritical: {
      label: "Not Critical",
      color: "var(--chart-2)",
    },
  };

  const scoreChartConfig = {
    score: {
      label: "Score",
      color: "var(--chart-4)",
    },
  };

  if (!camis) {
    return (
      <div className={className}>
        <Card>
          <CardHeader>
            <CardTitle>Inspections overview</CardTitle>
            <CardDescription>
              Filter by CAMIS to view trends for a specific restaurant.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className={`grid gap-6 md:grid-cols-2 ${className}`}>
      {violationsLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Violations over time</CardTitle>
            <CardDescription>
              Stacked by criticality; shows counts per inspection date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm">
              Loading chart...
            </div>
          </CardContent>
        </Card>
      ) : violationsError ? (
        <Card>
          <CardHeader>
            <CardTitle>Violations over time</CardTitle>
            <CardDescription>
              Stacked by criticality; shows counts per inspection date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-sm">{violationsError}</div>
          </CardContent>
        </Card>
      ) : areaChartData.length < 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Violations over time</CardTitle>
            <CardDescription>
              Stacked by criticality; shows counts per inspection date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm flex h-48 items-center justify-center">
              Not enough data to visualize
            </div>
          </CardContent>
        </Card>
      ) : (
        <AreaStacked
          data={areaChartData}
          config={violationsChartConfig}
          xKey="label"
          areaKeys={["notCritical", "critical"]}
          title="Violations over time"
          description="Stacked by criticality; shows counts per inspection date."
        />
      )}

      {scoreLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Score trend</CardTitle>
            <CardDescription>Lower is better.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm">
              Loading chart...
            </div>
          </CardContent>
        </Card>
      ) : scoreError ? (
        <Card>
          <CardHeader>
            <CardTitle>Score trend</CardTitle>
            <CardDescription>Lower is better.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-destructive text-sm">{scoreError}</div>
          </CardContent>
        </Card>
      ) : lineChartData.length < 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Score trend</CardTitle>
            <CardDescription>Lower is better.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-muted-foreground text-sm flex h-48 items-center justify-center">
              Not enough data to visualize
            </div>
          </CardContent>
        </Card>
      ) : (
        <LineDots
          data={lineChartData}
          config={scoreChartConfig}
          xKey="label"
          yKey="score"
          strokeKey="score"
          title="Score trend"
          description="Lower is better."
        />
      )}
    </div>
  );
}
