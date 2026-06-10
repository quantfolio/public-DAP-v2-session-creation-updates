import { useState } from "react";
import { RunButton } from "@/components/ui/run-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JsonPreview } from "@/components/JsonPreview";
import { SourceInfo } from "@/components/SourceInfo";
import type { ApiResult } from "@/lib/api";

type Category = "assets" | "debt" | "liquidity";
const CATEGORIES: Category[] = ["assets", "debt", "liquidity"];

interface Field {
  id: string;
  label: string;
}
type Catalog = Record<Category, Field[]>;
type Values = Record<Category, Record<string, string>>;

const emptyValues = (): Values => ({ assets: {}, debt: {}, liquidity: {} });

export function FinancialSituation({
  run,
}: {
  run: (method: string, path: string, body?: unknown) => Promise<ApiResult>;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [values, setValues] = useState<Values>(emptyValues());

  async function load() {
    const config: { person: Catalog } = await fetch("/api/config/financial-situation").then((r) => r.json());
    setCatalog(config.person);

    const r = await run("GET", "/api/financial-situation");
    const current = (r.body as { data?: { financial_situation?: Record<string, unknown> } } | null)
      ?.data?.financial_situation;
    const next = emptyValues();
    for (const cat of CATEGORIES) {
      const arr = current?.[cat];
      if (Array.isArray(arr)) {
        for (const item of arr as { id: string; value: number }[]) {
          if (item && item.id != null && item.value != null) next[cat][item.id] = String(item.value);
        }
      }
    }
    setValues(next);
  }

  function buildBody() {
    const person: Record<string, { id: string; value: number }[]> = {};
    for (const cat of CATEGORIES) {
      const items = Object.entries(values[cat])
        .filter(([, v]) => v !== "")
        .map(([id, v]) => ({ id, value: Number(v) }));
      if (items.length > 0) person[cat] = items;
    }
    return { person_financial_situation: person };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial situation</CardTitle>
        <CardDescription>GET / PATCH /financial-situation · person fields from settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SourceInfo
          items={[
            {
              label: "Endpoint",
              value: "GET·PATCH /v2/advice_session/{session_id}/financial_situation",
            },
            {
              label: "Fields",
              value: "settings → roboAdviceForm.financialSituation.{assets,debt,liquidity}.person",
            },
          ]}
        />
        <RunButton variant="secondary" onRun={load}>
          Load fields
        </RunButton>

        {catalog &&
          CATEGORIES.map((cat) => (
            <div key={cat} className="space-y-2">
              <p className="text-sm font-semibold capitalize">{cat}</p>
              {catalog[cat].length === 0 && (
                <p className="text-xs text-muted-foreground">No fields configured.</p>
              )}
              {catalog[cat].map((f) => (
                <div key={f.id} className="grid grid-cols-[1fr_140px] items-center gap-2">
                  <Label className="font-normal">{f.label || f.id}</Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={values[cat][f.id] ?? ""}
                    onChange={(e) =>
                      setValues((p) => ({ ...p, [cat]: { ...p[cat], [f.id]: e.target.value } }))
                    }
                  />
                </div>
              ))}
            </div>
          ))}

        {catalog && (
          <>
            <JsonPreview value={buildBody()} />
            <RunButton onRun={() => run("PATCH", "/api/financial-situation", buildBody())}>
              Patch
            </RunButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}
