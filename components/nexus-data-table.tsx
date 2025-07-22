'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

interface NexusDataTableProps {
  data: any[];
  columns: {
    key: string;
    label: string;
    sortable?: boolean;
    align?: 'left' | 'center' | 'right';
    width?: string;
  }[];
  title?: string;
  maxRows?: number;
}

export function NexusDataTable({
  data,
  columns,
  title,
  maxRows = 10,
}: NexusDataTableProps) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAll, setShowAll] = useState(false);

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal === bVal) return 0;

    const comparison = aVal < bVal ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const displayData = showAll ? sortedData : sortedData.slice(0, maxRows);
  const hasMore = data.length > maxRows;

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-6 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
    >
      {title && (
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {title}
          </h4>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  } ${column.width || ''}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="group inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {column.label}
                      {sortColumn === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {displayData.map((row, rowIndex) => (
              <motion.tr
                key={
                  row.id ||
                  `row-${rowIndex}-${JSON.stringify(row).substring(0, 10)}`
                }
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rowIndex * 0.05 }}
                className="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${
                      column.align === 'center'
                        ? 'text-center'
                        : column.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    }`}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            {showAll ? 'Show less' : `Show all ${data.length} rows`}
          </button>
        </div>
      )}
    </motion.div>
  );
}
