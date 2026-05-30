import { getPodStatus, getPodRestarts } from "./utils";

export function parseListParams(request) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const sortBy = searchParams.get("sortBy") || "";
  const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const status = (searchParams.get("status") || "").trim().toLowerCase();
  const node = (searchParams.get("node") || "").trim().toLowerCase();

  return { page, limit, search, sortBy, sortOrder, status, node };
}

function searchItems(items, search) {
  if (!search) return items;

  return items.filter((item) => {
    const fields = [
      item?.metadata?.name,
      item?.metadata?.namespace,
      item?.status?.phase,
      item?.spec?.nodeName,
      item?.spec?.type,
      item?.type,
    ];

    const labels = Object.values(item?.metadata?.labels ?? {});
    const annotations = Object.values(item?.metadata?.annotations ?? {}).filter(
      (v) => typeof v === "string" && v.length < 200,
    );

    const conditions = (item?.status?.conditions ?? []).flatMap((c) => [c?.type, c?.reason, c?.message]);

    const all = [...fields, ...labels, ...annotations, ...conditions]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    return all.some((v) => v.includes(search));
  });
}

function filterItems(items, { status, node }) {
  let result = items;

  if (status) {
    result = result.filter((item) => {
      const phase = (item?.status?.phase ?? "").toLowerCase();
      const derived = getPodStatus(item).toLowerCase();
      return phase.includes(status) || derived.includes(status);
    });
  }

  if (node) {
    result = result.filter((item) =>
      (item?.spec?.nodeName ?? "").toLowerCase().includes(node),
    );
  }

  return result;
}

function getFieldValue(item, sortBy) {
  switch (sortBy) {
    case "name":
      return (item?.metadata?.name ?? "").toLowerCase();
    case "namespace":
      return (item?.metadata?.namespace ?? "").toLowerCase();
    case "createdAt":
    case "age":
      return new Date(item?.metadata?.creationTimestamp ?? 0).getTime();
    case "status":
      return (item?.status?.phase ?? getPodStatus(item) ?? "").toLowerCase();
    case "restarts":
      return getPodRestarts(item);
    case "node":
      return (item?.spec?.nodeName ?? "").toLowerCase();
    default:
      return null;
  }
}

function sortItems(items, sortBy, sortOrder) {
  if (!sortBy) return items;

  const multiplier = sortOrder === "desc" ? -1 : 1;

  return [...items].sort((a, b) => {
    const va = getFieldValue(a, sortBy);
    const vb = getFieldValue(b, sortBy);

    if (va === null || vb === null) return 0;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * multiplier;
    if (va < vb) return -1 * multiplier;
    if (va > vb) return 1 * multiplier;
    return 0;
  });
}

function paginateItems(items, page, limit) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const clampedPage = Math.min(page, totalPages);
  const offset = (clampedPage - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return {
    data,
    pagination: {
      page: clampedPage,
      limit,
      totalItems,
      totalPages,
      hasNextPage: clampedPage < totalPages,
      hasPreviousPage: clampedPage > 1,
      nextPage: clampedPage < totalPages ? clampedPage + 1 : null,
      previousPage: clampedPage > 1 ? clampedPage - 1 : null,
    },
  };
}

export function applyListPipeline(items, params) {
  const { page, limit, search, sortBy, sortOrder, status, node } = params;

  let result = searchItems(items, search);
  result = filterItems(result, { status, node });
  result = sortItems(result, sortBy, sortOrder);
  return paginateItems(result, page, limit);
}
