import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

// Base API URL. Set VITE_API_URL (e.g. http://localhost:8008) to call the
// backend directly while both are running; otherwise fall back to Vite's
// `/api` dev-server proxy.
export const API_URL = import.meta.env.VITE_API_URL ?? '/api'

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: API_URL, credentials: 'include' }),
  // refetchOnFocus disabled: a surprise refetch of page detail would clobber
  // in-progress canvas edits with the last-saved snapshot.
  refetchOnFocus: false,
  refetchOnReconnect: false,
  tagTypes: ['User', 'Page'],
  endpoints: (builder) => ({
    getHealth: builder.query<{ status: string; version: string }, void>({
      query: () => '/health',
    }),
  }),
})

export const { useGetHealthQuery } = api
