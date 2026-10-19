import { z } from "zod";

export type ProviderModel = {
  id: string;
  label: string;
};

export class ProviderAuthorizationError extends Error {
  readonly code = "PROVIDER_AUTHORIZATION_REJECTED";

  constructor() {
    super("PROVIDER_AUTHORIZATION_REJECTED");
    this.name = "ProviderAuthorizationError";
  }
}

export class ProviderUnavailableError extends Error {
  readonly code = "PROVIDER_UNAVAILABLE";

  constructor() {
    super("PROVIDER_UNAVAILABLE");
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderResponseError extends Error {
  readonly code = "PROVIDER_RESPONSE_INVALID";

  constructor() {
    super("PROVIDER_RESPONSE_INVALID");
    this.name = "ProviderResponseError";
  }
}

const openAIResponseSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) })),
});

const anthropicResponseSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1), display_name: z.string().optional() })),
  has_more: z.boolean().optional(),
  last_id: z.string().nullable().optional(),
});

async function request(
  url: URL,
  headers: Record<string, string>,
  fetcher: typeof fetch,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new ProviderUnavailableError();
  }
  if (response.status === 401 || response.status === 403) {
    throw new ProviderAuthorizationError();
  }
  if (!response.ok) throw new ProviderUnavailableError();
  return response;
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProviderResponseError();
  }
}

export async function listProviderModels(
  provider: "openai" | "anthropic",
  credential: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<ProviderModel[]> {
  if (provider === "openai") {
    const response = await request(
      new URL("https://api.openai.com/v1/models"),
      { authorization: `Bearer ${credential}`, accept: "application/json" },
      fetcher,
    );
    const parsed = openAIResponseSchema.safeParse(await responseJson(response));
    if (!parsed.success) throw new ProviderResponseError();
    return [...new Set(parsed.data.data.map(({ id }) => id))].map((id) => ({ id, label: id }));
  }

  const models: ProviderModel[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < 100; page += 1) {
    const url = new URL("https://api.anthropic.com/v1/models");
    url.searchParams.set("limit", "1000");
    if (cursor) url.searchParams.set("after_id", cursor);

    const response = await request(
      url,
      {
        "x-api-key": credential,
        "anthropic-version": "2023-06-01",
        accept: "application/json",
      },
      fetcher,
    );
    const parsed = anthropicResponseSchema.safeParse(await responseJson(response));
    if (!parsed.success) throw new ProviderResponseError();
    models.push(
      ...parsed.data.data.map(({ id, display_name }) => ({ id, label: display_name || id })),
    );

    if (!parsed.data.has_more) {
      const unique = new Map(models.map((model) => [model.id, model]));
      return [...unique.values()];
    }

    const nextCursor = parsed.data.last_id;
    if (!nextCursor || nextCursor === cursor || seenCursors.has(nextCursor)) {
      throw new ProviderResponseError();
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new ProviderResponseError();
}
