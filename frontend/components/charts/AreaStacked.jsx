import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export const description = "An area chart with gradient fill";

export function AreaStacked({
  data = [],
  config = {},
  xKey = "label",
  title = "Area Chart",
  description = "",
  areaKeys,
  xTickFormatter,
  stackId = "a",
}) {
  const keys =
    Array.isArray(areaKeys) && areaKeys.length
      ? areaKeys
      : Object.keys(config || {});
  const fmt = xTickFormatter || ((value) => value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={"flex items-end"}>
        <ChartContainer config={config} height={360} className={"px-0"}>
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={fmt}
              padding={{ left: 24, right: 24 }}
              interval="preserveStartEnd"
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              {keys.map((k) => (
                <linearGradient
                  key={k}
                  id={`fill-${k}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={`var(--color-${k})`}
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor={`var(--color-${k})`}
                    stopOpacity={0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            {keys.map((k) => (
              <Area
                key={k}
                dataKey={k}
                type="natural"
                fill={`url(#fill-${k})`}
                fillOpacity={0.4}
                stroke={`var(--color-${k})`}
                stackId={stackId}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
