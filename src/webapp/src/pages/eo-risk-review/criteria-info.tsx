import { Flag } from "lucide-react";
import { Badge } from "@/shadcn/components/badge";

interface CriteriaInfoProps {
  itemsUnderReview: number;
}

export function CriteriaInfo({ itemsUnderReview }: CriteriaInfoProps) {
  return (
    <div className="shrink-0 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            <h2 className="text-lg font-semibold tracking-tight">
              Risk Review
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Items below meet at least one of the following risk criteria and
            require buyer review. Values are computed in real time from current
            inventory and sales data.
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>
              <span className="font-medium text-foreground">
                30+ days on Hand (Aged Inventory)
              </span>{" "}
              — Items sitting in inventory beyond the aging threshold
            </li>
            <li>
              <span className="font-medium text-foreground">Excess</span> —
              On-hand quantity exceeds projected demand based on average daily
              usage
            </li>
            <li>
              <span className="font-medium text-foreground">Dead</span> — Items
              with on-hand inventory but zero sales activity in the lookback
              period
            </li>
            <li>
              <span className="font-medium text-foreground">
                QTY not to sell by expiration
              </span>{" "}
              — Quantity that cannot be sold before the expiration date at
              current sales velocity
            </li>
          </ul>
        </div>
        <Badge variant="default" className="shrink-0 text-sm px-3 py-1">
          {itemsUnderReview.toLocaleString()} Items Under Review
        </Badge>
      </div>
    </div>
  );
}
