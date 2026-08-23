import { api } from './api'

export interface PageSummary {
  id: string
  name: string
  created_at: string | null
  updated_at: string | null
}

export interface PageDetail extends PageSummary {
  snapshot: Record<string, unknown> | null
}

export const pagesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPages: builder.query<{ pages: PageSummary[] }, void>({
      query: () => '/pages',
      providesTags: [{ type: 'Page', id: 'LIST' }],
    }),
    createPage: builder.mutation<{ page: PageDetail }, { name?: string }>({
      query: (body) => ({ url: '/pages', method: 'POST', body }),
      invalidatesTags: [{ type: 'Page', id: 'LIST' }],
    }),
    getPage: builder.query<{ page: PageDetail }, string>({
      query: (id) => `/pages/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Page', id }],
    }),
    // Only invalidates the LIST tag — refetching page detail mid-edit would
    // clobber unsaved canvas work.
    saveSnapshot: builder.mutation<
      { saved_at: string },
      { id: string; snapshot: Record<string, unknown> }
    >({
      query: ({ id, snapshot }) => ({
        url: `/pages/${id}/snapshot`,
        method: 'PUT',
        body: { snapshot },
      }),
      invalidatesTags: [{ type: 'Page', id: 'LIST' }],
    }),
    renamePage: builder.mutation<{ ok: boolean }, { id: string; name: string }>({
      query: ({ id, name }) => ({ url: `/pages/${id}`, method: 'PATCH', body: { name } }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Page', id },
        { type: 'Page', id: 'LIST' },
      ],
    }),
    deletePage: builder.mutation<void, string>({
      query: (id) => ({ url: `/pages/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Page', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetPagesQuery,
  useCreatePageMutation,
  useGetPageQuery,
  useSaveSnapshotMutation,
  useRenamePageMutation,
  useDeletePageMutation,
} = pagesApi
