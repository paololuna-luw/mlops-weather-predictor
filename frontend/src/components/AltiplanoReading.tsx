import { DetailsToggle } from "@/components/DetailsToggle";
import { formatPercent } from "@/lib/format";
import { isModelWeights, predictFromWeights } from "@/lib/modelEngine";
import {
  FEATURE_FIELDS,
  FEATURE_NAMES,
  type DailyForecast,
  type ModelRegistryRecord,
  type PredictionRequest,
} from "@/types/mlops";

function likelihood(p: number): string {
  if (p < 0.25) return "Unlikely";
  if (p < 0.5) return "Possible, but below the rain threshold";
  if (p < 0.75) return "Likely";
  return "Very likely";
}

export function AltiplanoReading({
  forecast,
  active,
}: {
  forecast: DailyForecast | null;
  active: ModelRegistryRecord | null;
}) {
  if (!forecast) return null;

  const input = forecast.input_features;
  const complete = FEATURE_NAMES.every((name) => typeof input[name] === "number" && Number.isFinite(input[name]));
  const full = complete ? (input as PredictionRequest) : null;
  const p = Math.min(Math.max(forecast.rain_probability, 0), 1);

  const weights = active?.model_weights;
  const drivers =
    full && weights && isModelWeights(weights)
      ? predictFromWeights(full, weights)
          .impacts.slice()
          .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
          .slice(0, 3)
      : [];

  return (
    <div className="mt-6">
      <section className="ops-card p-6 md:p-8">
        <h3 className="text-xl">What this forecast predicts</h3>
        <p className="mt-3 text-sm leading-6 text-ink/75">
          The chance that Puno records <strong className="font-bold">1.0 mm of rain or more</strong> tomorrow.
          Rain is called when that chance reaches 50%.
        </p>
        <div className="mt-5">
          <div className="relative h-2.5 rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-lake" style={{ width: `${p * 100}%` }} />
            <span className="absolute -top-1 left-1/2 w-0.5 -translate-x-1/2 bg-ink/50" style={{ height: "1.15rem" }} aria-hidden />
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink/55">
            <span>0%</span>
            <span>50% threshold</span>
            <span>100%</span>
          </div>
          <p className="mt-3 text-sm">
            <span className="metric-value text-lg">{formatPercent(p)}</span> · {likelihood(p)}
          </p>
        </div>
        {drivers.length > 0 ? (
          <DetailsToggle label="What pushed the forecast most">
            <ul className="space-y-2 text-sm">
              {drivers.map((item) => {
                const field = FEATURE_FIELDS.find((f) => f.key === item.feature);
                return (
                  <li key={item.feature} className="flex justify-between gap-4 border-b border-ink/5 pb-2">
                    <span>{field?.label ?? item.feature}</span>
                    <span className={item.impact >= 0 ? "text-lake" : "text-totora"}>
                      {item.impact >= 0 ? "toward rain" : "toward dry"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </DetailsToggle>
        ) : null}
      </section>
    </div>
  );
}
