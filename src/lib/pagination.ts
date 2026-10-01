export function paginationParams(search: { page?: string; pageSize?: string }) {
  const requestedSize = Number(search.pageSize);
  const pageSize = [10, 25, 50, 100].includes(requestedSize) ? requestedSize : 25;
  const page = Math.max(1, Math.floor(Number(search.page) || 1));
  return { page, pageSize, offset: (page - 1) * pageSize };
}
