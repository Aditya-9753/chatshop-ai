import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal, Search } from "lucide-react";
import { cn } from "./cn";
import Button from "./Button";
import { Checkbox } from "./Switch";
import { EmptyState, ErrorState, Skeleton } from "./Feedback";
import { DropdownMenu, DropdownTrigger, DropdownContent, DropdownItem } from "./Overlay";

const HIDE_BELOW = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

const compare = (a, b) => {
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date || b instanceof Date) return new Date(a) - new Date(b);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

/**
 * Table for every list page.
 *
 * columns: [{ key, header, cell(row), sortValue(row), sortable, align, hideBelow, className }]
 * Search, sort and pagination run on the rows you pass in (client side).
 * Selection: pass `selected` (array of ids) + `onSelectedChange`, and
 * `bulkActions(selectedIds)` renders in the toolbar while rows are selected.
 */
export default function DataTable({
  columns,
  rows = [],
  getRowId = (row) => row._id || row.id,
  loading,
  error,
  onRetry,
  empty,
  searchable,
  searchText,
  searchPlaceholder = "Search…",
  toolbar,
  onRowClick,
  rowActions,
  selected,
  onSelectedChange,
  bulkActions,
  pageSize = 10,
  defaultSort,
  className,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort || null); // { key, dir }
  const [page, setPage] = useState(1);
  const selectable = Array.isArray(selected) && onSelectedChange;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchText) return rows;
    return rows.filter((row) => String(searchText(row) || "").toLowerCase().includes(q));
  }, [rows, query, searchText]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return filtered;
    const value = column.sortValue || ((row) => row[column.key]);
    const out = [...filtered].sort((a, b) => compare(value(a), value(b)));
    return sort.dir === "desc" ? out.reverse() : out;
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [query, rows.length]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const toggleSort = (key) =>
    setSort((current) =>
      current?.key !== key ? { key, dir: "asc" } : current.dir === "asc" ? { key, dir: "desc" } : null
    );

  const visibleIds = visible.map(getRowId);
  const allVisibleSelected = selectable && visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someVisibleSelected = selectable && visibleIds.some((id) => selected.includes(id));

  const toggleAll = () =>
    onSelectedChange(
      allVisibleSelected
        ? selected.filter((id) => !visibleIds.includes(id))
        : [...new Set([...selected, ...visibleIds])]
    );

  const toggleOne = (id) =>
    onSelectedChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const showToolbar = searchable || toolbar || (selectable && selected.length > 0);
  const colSpan = columns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0);

  return (
    <div className={cn("rounded-xl border border-line bg-surface overflow-hidden", className)}>
      {showToolbar && (
        <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center sm:justify-between">
          {selectable && selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-caption font-medium text-fg">{selected.length} selected</span>
              {bulkActions?.(selected)}
              <Button variant="ghost" size="sm" onClick={() => onSelectedChange([])}>
                Clear
              </Button>
            </div>
          ) : (
            searchable && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="h-8 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-fg outline-none focus:border-accent focus:ring-3 focus:ring-accent/15"
                />
              </div>
            )
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60">
              {selectable && (
                <th scope="col" className="w-10 pl-4">
                  <Checkbox
                    checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all on this page"
                  />
                </th>
              )}
              {columns.map((column) => {
                const active = sort?.key === column.key;
                const SortIcon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "px-4 py-2.5 text-left text-xs font-medium text-fg-muted whitespace-nowrap",
                      column.align === "right" && "text-right",
                      HIDE_BELOW[column.hideBelow],
                      column.headerClassName
                    )}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className={cn("inline-flex items-center gap-1 hover:text-fg", active && "text-fg")}
                      >
                        {column.header}
                        <SortIcon className="w-3 h-3" aria-hidden="true" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {rowActions && <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {selectable && <td className="pl-4" />}
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3", HIDE_BELOW[column.hideBelow])}>
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                  {rowActions && <td />}
                </tr>
              ))}

            {!loading && error && (
              <tr>
                <td colSpan={colSpan}>
                  <ErrorState description={error} onRetry={onRetry} />
                </td>
              </tr>
            )}

            {!loading && !error && visible.length === 0 && (
              <tr>
                <td colSpan={colSpan}>
                  {query ? (
                    <EmptyState icon={Search} title="No matches" description={`Nothing matches “${query}”.`} />
                  ) : (
                    <EmptyState {...empty} />
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              visible.map((row) => {
                const id = getRowId(row);
                const isSelected = selectable && selected.includes(id);
                const actions = rowActions?.(row) || [];
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-b border-line last:border-0 transition-colors duration-150",
                      onRowClick && "cursor-pointer hover:bg-surface-2/60",
                      isSelected && "bg-accent-soft/50"
                    )}
                  >
                    {selectable && (
                      <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(id)} aria-label="Select row" />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3 text-fg align-middle",
                          column.align === "right" && "text-right tabular-nums",
                          HIDE_BELOW[column.hideBelow],
                          column.className
                        )}
                      >
                        {column.cell ? column.cell(row) : row[column.key]}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {actions.length > 0 && (
                          <DropdownMenu>
                            <DropdownTrigger asChild>
                              <Button variant="ghost" size="icon-sm" icon={MoreHorizontal} aria-label="Row actions" />
                            </DropdownTrigger>
                            <DropdownContent>
                              {actions.map((action) => (
                                <DropdownItem key={action.label} icon={action.icon} danger={action.danger} onSelect={action.onSelect}>
                                  {action.label}
                                </DropdownItem>
                              ))}
                            </DropdownContent>
                          </DropdownMenu>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && !error && sorted.length > pageSize && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-caption text-fg-muted">
          <span className="tabular-nums">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page" />
            <span className="px-1 tabular-nums">
              {page} / {pageCount}
            </span>
            <Button variant="ghost" size="icon-sm" icon={ChevronRight} disabled={page === pageCount} onClick={() => setPage(page + 1)} aria-label="Next page" />
          </div>
        </div>
      )}
    </div>
  );
}
