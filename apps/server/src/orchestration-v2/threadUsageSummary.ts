import type { ProviderInstanceId, ProviderThreadId } from "@t3tools/contracts";

export interface UsageBucket {
  readonly turnCount: number;
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
}

export interface ThreadUsageSummary {
  readonly totals: UsageBucket | null;
  /** Largest first. Each account lists its models, largest first; `model` is null when unreported. */
  readonly byAccount: ReadonlyArray<
    UsageBucket & {
      readonly providerInstanceId: ProviderInstanceId | null;
      readonly label: string;
      readonly models: ReadonlyArray<UsageBucket & { readonly model: string | null }>;
    }
  >;
}

interface TurnUsageInput {
  readonly providerThreadId: ProviderThreadId;
  readonly model?: string | undefined;
  readonly tokenUsage?:
    | {
        readonly inputTokens?: number | undefined;
        readonly cachedInputTokens?: number | undefined;
        readonly outputTokens?: number | undefined;
      }
    | undefined;
}

type MutableBucket = {
  turnCount: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

const emptyBucket = (): MutableBucket => ({
  turnCount: 0,
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
});

const addTo = (bucket: MutableBucket, usage: NonNullable<TurnUsageInput["tokenUsage"]>) => {
  bucket.turnCount += 1;
  bucket.inputTokens += usage.inputTokens ?? 0;
  bucket.cachedInputTokens += usage.cachedInputTokens ?? 0;
  bucket.outputTokens += usage.outputTokens ?? 0;
};

const largestFirst = <T extends { readonly turnCount: number }>(
  items: ReadonlyArray<T>,
): ReadonlyArray<T> => [...items].toSorted((a, b) => b.turnCount - a.turnCount);

/**
 * Sums each turn that reported usage: overall, and per account (the provider instance of its
 * provider thread), with each account split by model. Turns without usage are skipped.
 */
export function summarizeThreadUsage(input: {
  readonly turns: ReadonlyArray<TurnUsageInput>;
  readonly instanceByThread: ReadonlyMap<ProviderThreadId, ProviderInstanceId>;
  readonly labelFor: (instance: ProviderInstanceId | null) => string;
}): ThreadUsageSummary {
  const totals = emptyBucket();
  const accounts = new Map<
    ProviderInstanceId | null,
    { bucket: MutableBucket; models: Map<string | null, MutableBucket> }
  >();
  for (const turn of input.turns) {
    const usage = turn.tokenUsage;
    if (usage === undefined) continue;
    addTo(totals, usage);
    const instance = input.instanceByThread.get(turn.providerThreadId) ?? null;
    let account = accounts.get(instance);
    if (account === undefined) {
      account = { bucket: emptyBucket(), models: new Map() };
      accounts.set(instance, account);
    }
    addTo(account.bucket, usage);
    const model = turn.model ?? null;
    let modelBucket = account.models.get(model);
    if (modelBucket === undefined) {
      modelBucket = emptyBucket();
      account.models.set(model, modelBucket);
    }
    addTo(modelBucket, usage);
  }
  return {
    totals: totals.turnCount === 0 ? null : totals,
    byAccount: largestFirst(
      [...accounts].map(([providerInstanceId, account]) => ({
        providerInstanceId,
        label: input.labelFor(providerInstanceId),
        ...account.bucket,
        models: largestFirst([...account.models].map(([model, bucket]) => ({ model, ...bucket }))),
      })),
    ),
  };
}
