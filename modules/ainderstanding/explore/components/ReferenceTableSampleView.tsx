function truncate(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

export function ReferenceTableSampleView({
  columns,
  rows,
}: {
  columns: string[];
  rows: Record<string, unknown>[];
}) {
  return (
    <div className="overflow-auto rounded border border-border">
      <table className="w-full text-xs">
        <thead className="bg-secondary sticky top-0">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="border-b border-border px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, ri) => (
            <tr key={ri} className="hover:bg-secondary/40 transition-colors">
              {columns.map((col) => {
                const raw = row[col];
                const display = truncate(raw);
                const isMasked = typeof raw === 'string' && raw.startsWith('[') && raw.endsWith('_MASKED]');
                return (
                  <td
                    key={col}
                    title={typeof raw === 'string' ? raw : undefined}
                    className={`px-3 py-1 whitespace-nowrap ${isMasked ? 'text-muted-foreground/50 italic' : 'text-foreground'}`}
                  >
                    {display}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
