import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  className
}: MetricCardProps) {
  const changeColorClass = {
    positive: "border-success/20 bg-success/10 text-success",
    negative: "border-destructive/20 bg-destructive/10 text-destructive",
    neutral: "border-border/60 bg-muted text-muted-foreground"
  }[changeType];

  return (
    <Card className={cn("metronic-card relative overflow-hidden", className)}>
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-primary to-primary/40" />
      <CardContent className="p-5 pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            {change && (
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", changeColorClass)}>
                {change}
              </span>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl border border-primary/10 bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
