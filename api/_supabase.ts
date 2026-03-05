export interface SupabaseEnv {
  url: string
  serviceRoleKey: string
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return null
  }

  return { url, serviceRoleKey }
}

export async function fetchSupabaseRows<T>(params: {
  env: SupabaseEnv
  table: string
  query: URLSearchParams
}): Promise<T[]> {
  const response = await fetch(`${params.env.url}/rest/v1/${params.table}?${params.query.toString()}`, {
    headers: {
      apikey: params.env.serviceRoleKey,
      Authorization: `Bearer ${params.env.serviceRoleKey}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Supabase query failed: ${response.status}`)
  }

  return (await response.json()) as T[]
}
