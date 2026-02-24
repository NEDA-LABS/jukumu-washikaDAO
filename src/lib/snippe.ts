const SNIPPE_BASE_URL = 'https://api.snippe.sh';

function getApiKey(): string {
  const key = process.env.SNIPPE_API_KEY;
  if (!key) throw new Error('SNIPPE_API_KEY environment variable is not set');
  return key;
}

async function snippeRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SNIPPE_BASE_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(`Snippe API network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  const rawText = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    throw new Error(`Snippe API returned non-JSON (${res.status}): ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Snippe API error ${res.status}: ${JSON.stringify(json)}`
    );
  }
  return json as T;
}

export interface SnippeSessionResponse {
  status: number;
  data: {
    id: string;
    reference: string;
    status: string;
    mode: string;
    amount: number;
    currency: string;
    checkout_url: string;
    short_code: string;
    payment_link_url: string;
    expires_at: string;
    created_at: string;
  };
}

export interface CreateSessionParams {
  amount: number;
  currency?: string;
  allowed_methods?: ('mobile_money' | 'qr' | 'card')[];
  customer?: { name?: string; phone?: string; email?: string };
  redirect_url?: string;
  webhook_url?: string;
  description?: string;
  metadata?: Record<string, string>;
  expires_in?: number;
}

export async function createPaymentSession(
  params: CreateSessionParams
): Promise<SnippeSessionResponse> {
  return snippeRequest<SnippeSessionResponse>('POST', '/v1/sessions', {
    currency: 'TZS',
    allowed_methods: ['mobile_money', 'qr'],
    expires_in: 3600,
    ...params,
  });
}

export interface SnippePayoutResponse {
  status: number;
  data: {
    reference: string;
    status: string;
    amount: { value: number; currency: string };
    channel: { type: string; provider: string };
    customer: { phone: string; name: string };
    metadata?: Record<string, string>;
    created_at: string;
  };
}

export interface CreatePayoutParams {
  amount: number;
  currency?: string;
  phone: string;
  name: string;
  provider: string;
  reference?: string;
  description?: string;
  webhook_url?: string;
  metadata?: Record<string, string>;
}

export async function createPayout(
  params: CreatePayoutParams
): Promise<SnippePayoutResponse> {
  return snippeRequest<SnippePayoutResponse>('POST', '/v1/payouts/send', {
    currency: 'TZS',
    channel: {
      type: 'mobile_money',
      provider: params.provider,
    },
    customer: {
      phone: params.phone,
      name: params.name,
    },
    amount: params.amount,
    description: params.description,
    webhook_url: params.webhook_url,
    metadata: params.metadata,
  });
}

export async function getPayoutFee(amount: number): Promise<{ fee: number; total: number }> {
  const res = await snippeRequest<{ data: { fee: { value: number }; total: { value: number } } }>(
    'GET',
    `/v1/payouts/fee?amount=${amount}`
  );
  return {
    fee: res.data.fee.value,
    total: res.data.total.value,
  };
}

export async function getPaymentStatus(reference: string) {
  return snippeRequest<{ data: { reference: string; status: string; amount: { value: number; currency: string } } }>(
    'GET',
    `/v1/payments/${reference}`
  );
}

export async function getPayoutStatus(reference: string) {
  return snippeRequest<{ data: { reference: string; status: string; amount: { value: number; currency: string } } }>(
    'GET',
    `/v1/payouts/${reference}`
  );
}
