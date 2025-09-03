import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

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

export const description = "A line chart with dots";

export function LineDots({
  data = [],
  config = {},
  xKey = "label",
  yKey = "score",
  title = "Line Chart - Dots",
  description = "",
  xTickFormatter,
  strokeKey,
}) {
  const fmt = xTickFormatter || ((value) => value);
  const colorKey = strokeKey || yKey;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className={"flex items-end"}>
        <ChartContainer config={config} height={320} className={"px-0 w-full"}>
          <LineChart
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
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Line
              dataKey={yKey}
              type="natural"
              stroke={`var(--color-${colorKey})`}
              strokeWidth={2}
              dot={{
                fill: `var(--color-${colorKey})`,
              }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
