import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDownAZ,
  ArrowUpZA,
  ArrowDown01,
  ArrowUp10,
  ArrowUp,
  ArrowDown,
  Filter,
  FilterX,
  Search,
  Check,
  ChevronDown,
  X,
  RotateCcw
} from 'lucide-react';

// =========================================================================
// TYPES & INTERFACES
// =========================================================================
export type ExcelDataType = 'text' | 'number' | 'date';

export interface ExcelColumnDefinition<T> {
  key: string;
  title: string;
  dataType?: ExcelDataType;
  extractor: (item: T) => string | number | null | undefined;
  /**
   * Optional custom extractor for distinct filter values (e.g. if the item has badges or tags)
   */
  filterValueExtractor?: (item: T) => string | string[];
}

export interface ExcelSortConfig {
  columnKey: string | null;
  direction: 'asc' | 'desc' | null;
}

export interface UseExcelTableOptions<T> {
  data: T[];
  columns: Record<string, ExcelColumnDefinition<T>>;
  initialSort?: ExcelSortConfig;
}

export interface UniqueValueItem {
  value: string;
  display: string;
  count: number;
}

// =========================================================================
// CUSTOM HOOK: useExcelTable
// =========================================================================
export function useExcelTable<T>({
  data,
  columns,
  initialSort = { columnKey: null, direction: null }
}: UseExcelTableOptions<T>) {
  const [sortConfig, setSortConfig] = useState<ExcelSortConfig>(initialSort);
  const [activeFilters, setActiveFilters] = useState<Record<string, Set<string>>>({});

  // Set sorting for a column
  const setSort = useCallback((columnKey: string, direction: 'asc' | 'desc' | null) => {
    setSortConfig({ columnKey, direction });
  }, []);

  // Set filter for a column
  const setColumnFilter = useCallback((columnKey: string, allowedValues: Set<string> | null) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      if (!allowedValues || allowedValues.size === 0) {
        delete next[columnKey];
      } else {
        next[columnKey] = allowedValues;
      }
      return next;
    });
  }, []);

  // Clear single column filter
  const clearColumnFilter = useCallback((columnKey: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      delete next[columnKey];
      return next;
    });
  }, []);

  // Clear all filters and sorts
  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setSortConfig({ columnKey: null, direction: null });
  }, []);

  // Check if a specific column is currently filtered
  const isColumnFiltered = useCallback(
    (columnKey: string) => {
      return Boolean(activeFilters[columnKey] && activeFilters[columnKey].size > 0);
    },
    [activeFilters]
  );

  // Total count of filtered columns
  const totalActiveFiltersCount = useMemo(() => {
    return Object.keys(activeFilters).length;
  }, [activeFilters]);

  // Extract unique distinct values for a given column (across current data)
  const getUniqueValues = useCallback(
    (columnKey: string): UniqueValueItem[] => {
      const colDef = columns[columnKey];
      if (!colDef) return [];

      const map = new Map<string, number>();

      data.forEach(item => {
        if (colDef.filterValueExtractor) {
          const raw = colDef.filterValueExtractor(item);
          if (Array.isArray(raw)) {
            raw.forEach(v => {
              const str = (v ?? '').trim();
              if (str) map.set(str, (map.get(str) || 0) + 1);
            });
          } else {
            const str = (raw ?? '').trim();
            if (str) map.set(str, (map.get(str) || 0) + 1);
          }
        } else {
          const raw = colDef.extractor(item);
          const str = raw !== null && raw !== undefined ? String(raw).trim() : '(Kosong)';
          map.set(str, (map.get(str) || 0) + 1);
        }
      });

      const list: UniqueValueItem[] = [];
      map.forEach((count, value) => {
        list.push({ value, display: value, count });
      });

      // Sort unique values alphabetically by default
      list.sort((a, b) => a.display.localeCompare(b.display, 'id', { numeric: true, sensitivity: 'base' }));
      return list;
    },
    [data, columns]
  );

  // Compute processed (filtered + sorted) data
  const processedData = useMemo(() => {
    // 1. Filter
    let filtered = data.filter(item => {
      for (const [colKey, allowedSet] of Object.entries(activeFilters)) {
        if (!allowedSet || allowedSet.size === 0) continue;

        const colDef = columns[colKey];
        if (!colDef) continue;

        if (colDef.filterValueExtractor) {
          const raw = colDef.filterValueExtractor(item);
          if (Array.isArray(raw)) {
            const matches = raw.some(v => allowedSet.has((v ?? '').trim()));
            if (!matches) return false;
          } else {
            const str = (raw ?? '').trim();
            if (!allowedSet.has(str)) return false;
          }
        } else {
          const raw = colDef.extractor(item);
          const str = raw !== null && raw !== undefined ? String(raw).trim() : '(Kosong)';
          if (!allowedSet.has(str)) return false;
        }
      }
      return true;
    });

    // 2. Sort
    if (sortConfig.columnKey && sortConfig.direction) {
      const colDef = columns[sortConfig.columnKey];
      if (colDef) {
        const isAsc = sortConfig.direction === 'asc';
        filtered = [...filtered].sort((a, b) => {
          const valA = colDef.extractor(a);
          const valB = colDef.extractor(b);

          if (valA === valB) return 0;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;

          if (colDef.dataType === 'number') {
            const numA = Number(valA) || 0;
            const numB = Number(valB) || 0;
            return isAsc ? numA - numB : numB - numA;
          }

          const strA = String(valA);
          const strB = String(valB);
          const comp = strA.localeCompare(strB, 'id', { numeric: true, sensitivity: 'base' });
          return isAsc ? comp : -comp;
        });
      }
    }

    return filtered;
  }, [data, columns, activeFilters, sortConfig]);

  return {
    processedData,
    sortConfig,
    setSort,
    activeFilters,
    setColumnFilter,
    clearColumnFilter,
    clearAllFilters,
    getUniqueValues,
    isColumnFiltered,
    totalActiveFiltersCount
  };
}

// =========================================================================
// EXCEL POPOVER COMPONENT (Portal)
// =========================================================================
interface ExcelFilterPopoverProps {
  title: string;
  columnKey: string;
  dataType?: ExcelDataType;
  anchorRect: DOMRect | null;
  isOpen: boolean;
  onClose: () => void;
  sortConfig: ExcelSortConfig;
  onSort: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  uniqueValues: UniqueValueItem[];
  activeFilterValues?: Set<string>;
  onApplyFilter: (values: Set<string> | null) => void;
  onClearFilter: () => void;
}

export function ExcelFilterPopover({
  title,
  columnKey,
  dataType = 'text',
  anchorRect,
  isOpen,
  onClose,
  sortConfig,
  onSort,
  uniqueValues,
  activeFilterValues,
  onApplyFilter,
  onClearFilter
}: ExcelFilterPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initialize selected values when opening
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      if (activeFilterValues && activeFilterValues.size > 0) {
        setSelectedSet(new Set(activeFilterValues));
      } else {
        // All selected by default
        setSelectedSet(new Set(uniqueValues.map(v => v.value)));
      }
    }
  }, [isOpen, activeFilterValues, uniqueValues]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Filter unique values by search query
  const filteredUniqueValues = useMemo(() => {
    if (!searchQuery.trim()) return uniqueValues;
    const q = searchQuery.toLowerCase();
    return uniqueValues.filter(v => v.display.toLowerCase().includes(q));
  }, [uniqueValues, searchQuery]);

  // Select all state
  const isAllSelected = useMemo(() => {
    if (filteredUniqueValues.length === 0) return false;
    return filteredUniqueValues.every(v => selectedSet.has(v.value));
  }, [filteredUniqueValues, selectedSet]);

  const isSomeSelected = useMemo(() => {
    if (filteredUniqueValues.length === 0) return false;
    const count = filteredUniqueValues.filter(v => selectedSet.has(v.value)).length;
    return count > 0 && count < filteredUniqueValues.length;
  }, [filteredUniqueValues, selectedSet]);

  const handleToggleSelectAll = () => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        // Deselect all visible
        filteredUniqueValues.forEach(v => next.delete(v.value));
      } else {
        // Select all visible
        filteredUniqueValues.forEach(v => next.add(v.value));
      }
      return next;
    });
  };

  const handleToggleItem = (val: string) => {
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (next.has(val)) {
        next.delete(val);
      } else {
        next.add(val);
      }
      return next;
    });
  };

  const handleApply = () => {
    // If user selected all unique values, effectively no filter is needed
    if (selectedSet.size === uniqueValues.length) {
      onApplyFilter(null);
    } else {
      onApplyFilter(selectedSet);
    }
    onClose();
  };

  const handleClear = () => {
    onClearFilter();
    onClose();
  };

  if (!isOpen || !anchorRect || typeof document === 'undefined') return null;

  // Calculate popover position
  const popoverWidth = 260;
  let left = anchorRect.left;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }
  if (left < 16) left = 16;

  let top = anchorRect.bottom + 6;
  const popoverHeight = 360;
  if (top + popoverHeight > window.innerHeight - 16 && anchorRect.top > popoverHeight) {
    top = anchorRect.top - popoverHeight - 6;
  }

  const isSortedAsc = sortConfig.columnKey === columnKey && sortConfig.direction === 'asc';
  const isSortedDesc = sortConfig.columnKey === columnKey && sortConfig.direction === 'desc';
  const isFiltered = Boolean(activeFilterValues && activeFilterValues.size > 0);

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[999999] bg-white rounded-2xl shadow-2xl border border-slate-200/90 text-slate-800 p-3 select-none animate-in fade-in zoom-in-95 duration-100 flex flex-col font-sans"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${popoverHeight}px`
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full bg-[#FF6B00] shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 font-mono-code truncate">
            {title}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sort Section */}
      <div className="space-y-1 pb-2 mb-2 border-b border-slate-100 text-xs">
        <button
          type="button"
          onClick={() => {
            onSort(columnKey, isSortedAsc ? null : 'asc');
            onClose();
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer font-medium text-left ${
            isSortedAsc
              ? 'bg-orange-50 text-[#FF6B00] font-bold border border-orange-200 shadow-2xs'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          {dataType === 'number' ? (
            <ArrowDown01 className="w-4 h-4 text-[#FF6B00] shrink-0" />
          ) : (
            <ArrowDownAZ className="w-4 h-4 text-[#FF6B00] shrink-0" />
          )}
          <span>{dataType === 'number' ? 'Sort Terkecil ke Terbesar' : 'Sort A to Z'}</span>
          {isSortedAsc && <Check className="w-3.5 h-3.5 ml-auto text-[#FF6B00]" />}
        </button>

        <button
          type="button"
          onClick={() => {
            onSort(columnKey, isSortedDesc ? null : 'desc');
            onClose();
          }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer font-medium text-left ${
            isSortedDesc
              ? 'bg-orange-50 text-[#FF6B00] font-bold border border-orange-200 shadow-2xs'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
        >
          {dataType === 'number' ? (
            <ArrowUp10 className="w-4 h-4 text-[#FF6B00] shrink-0" />
          ) : (
            <ArrowUpZA className="w-4 h-4 text-[#FF6B00] shrink-0" />
          )}
          <span>{dataType === 'number' ? 'Sort Terbesar ke Terkecil' : 'Sort Z to A'}</span>
          {isSortedDesc && <Check className="w-3.5 h-3.5 ml-auto text-[#FF6B00]" />}
        </button>

        {isFiltered && (
          <button
            type="button"
            onClick={handleClear}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-rose-600 font-medium transition-all cursor-pointer text-left"
          >
            <FilterX className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Hapus Filter dari "{title}"</span>
          </button>
        )}
      </div>

      {/* Filter Checklist Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Search Input Box */}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nilai..."
            className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#FF6B00] focus:border-[#FF6B00]"
          />
        </div>

        {/* Value Items List */}
        <div className="flex-1 overflow-y-auto max-h-36 space-y-0.5 border border-slate-100 rounded-lg p-1.5 bg-slate-50/50">
          {/* Select All Checkbox */}
          <label className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-slate-200/60 cursor-pointer text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={el => {
                if (el) el.indeterminate = isSomeSelected;
              }}
              onChange={handleToggleSelectAll}
              className="w-3.5 h-3.5 rounded border-slate-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer"
            />
            <span className="truncate">(Pilih Semua / Select All)</span>
          </label>

          {filteredUniqueValues.length === 0 ? (
            <div className="p-3 text-center text-[11px] text-slate-400 font-medium">
              Tidak ada nilai yang cocok
            </div>
          ) : (
            filteredUniqueValues.map(item => {
              const isChecked = selectedSet.has(item.value);
              return (
                <label
                  key={item.value}
                  className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-slate-200/60 cursor-pointer text-xs text-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleItem(item.value)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#FF6B00] focus:ring-[#FF6B00] cursor-pointer shrink-0"
                    />
                    <span className="truncate text-[11.5px]">{item.display}</span>
                  </div>
                  <span className="text-[10px] font-mono-code text-slate-400 font-medium shrink-0 bg-white px-1.5 py-0.2 rounded border border-slate-200/80">
                    {item.count}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="flex items-center justify-end gap-1.5 pt-2 mt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg hover:bg-slate-100 text-slate-600 text-xs font-medium transition-colors cursor-pointer"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="px-3.5 py-1 rounded-lg bg-[#FF6B00] hover:bg-[#e56000] text-white text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
        >
          Terapkan
        </button>
      </div>
    </div>,
    document.body
  );
}

// =========================================================================
// EXCEL HEADER CELL COMPONENT
// =========================================================================
export interface ExcelHeaderCellProps {
  title: string;
  columnKey: string;
  dataType?: ExcelDataType;
  sortConfig: ExcelSortConfig;
  onSort: (columnKey: string, direction: 'asc' | 'desc' | null) => void;
  isFiltered: boolean;
  uniqueValues: UniqueValueItem[];
  activeFilterValues?: Set<string>;
  onApplyFilter: (values: Set<string> | null) => void;
  onClearFilter: () => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
  children?: React.ReactNode;
}

export function ExcelHeaderCell({
  title,
  columnKey,
  dataType = 'text',
  sortConfig,
  onSort,
  isFiltered,
  uniqueValues,
  activeFilterValues,
  onApplyFilter,
  onClearFilter,
  align = 'left',
  className = '',
  children
}: ExcelHeaderCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerRef.current) {
      setAnchorRect(triggerRef.current.getBoundingClientRect());
      setIsOpen(prev => !prev);
    }
  };

  const isSortedAsc = sortConfig.columnKey === columnKey && sortConfig.direction === 'asc';
  const isSortedDesc = sortConfig.columnKey === columnKey && sortConfig.direction === 'desc';
  const isSorted = isSortedAsc || isSortedDesc;

  return (
    <th className={`relative select-none ${className}`}>
      <div
        className={`flex items-center gap-1.5 group/cell ${
          align === 'center'
            ? 'justify-center text-center'
            : align === 'right'
            ? 'justify-end text-right'
            : 'justify-between text-left'
        }`}
      >
        <span className="truncate">{children || title}</span>

        {/* Excel Filter & Sort Trigger Button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={handleOpen}
          className={`p-1 rounded-md transition-all cursor-pointer flex items-center justify-center shrink-0 ${
            isFiltered || isSorted
              ? 'bg-orange-100 text-[#FF6B00] ring-1 ring-orange-300 font-bold opacity-100 shadow-2xs'
              : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 opacity-40 group-hover/cell:opacity-100'
          }`}
          title={`Filter & Urutkan kolom ${title}`}
        >
          {isSortedAsc ? (
            <ArrowUp className="w-3 h-3 text-[#FF6B00] stroke-[2.5]" />
          ) : isSortedDesc ? (
            <ArrowDown className="w-3 h-3 text-[#FF6B00] stroke-[2.5]" />
          ) : isFiltered ? (
            <Filter className="w-3 h-3 text-[#FF6B00] stroke-[2.5]" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Floating Excel Popover */}
      <ExcelFilterPopover
        title={title}
        columnKey={columnKey}
        dataType={dataType}
        anchorRect={anchorRect}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sortConfig={sortConfig}
        onSort={onSort}
        uniqueValues={uniqueValues}
        activeFilterValues={activeFilterValues}
        onApplyFilter={onApplyFilter}
        onClearFilter={onClearFilter}
      />
    </th>
  );
}

// =========================================================================
// ACTIVE FILTERS BAR COMPONENT (Optional Bar when filters/sorts are active)
// =========================================================================
export interface ActiveFiltersBarProps {
  totalActiveFiltersCount: number;
  sortConfig: ExcelSortConfig;
  onClearAll: () => void;
  className?: string;
}

export function ActiveFiltersBar({
  totalActiveFiltersCount,
  sortConfig,
  onClearAll,
  className = ''
}: ActiveFiltersBarProps) {
  const hasActiveFilters = totalActiveFiltersCount > 0 || Boolean(sortConfig.columnKey && sortConfig.direction);
  if (!hasActiveFilters) return null;

  return (
    <div
      className={`px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200/80 text-orange-900 text-xs flex items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-100 ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#FF6B00] animate-pulse" />
        <span className="font-semibold text-[11px]">
          Tabel Terfilter: <strong className="text-orange-950 font-bold">{totalActiveFiltersCount} kolom filter aktif</strong>
          {sortConfig.columnKey && (
            <span className="ml-1 text-orange-800">
              • Diurutkan: <strong className="font-mono-code">{sortConfig.columnKey}</strong> ({sortConfig.direction === 'asc' ? 'A-Z' : 'Z-A'})
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={onClearAll}
        className="px-2 py-0.5 rounded-lg bg-white hover:bg-orange-100 text-orange-700 hover:text-orange-950 border border-orange-300 text-[10.5px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-95"
      >
        <RotateCcw className="w-3 h-3 text-orange-600" />
        <span>Reset Semua Filter Excel</span>
      </button>
    </div>
  );
}
