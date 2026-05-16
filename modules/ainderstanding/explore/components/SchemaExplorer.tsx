'use client';

import { useState } from 'react';
import { Badge } from '@/core/ui/badge';
import { Input } from '@/core/ui/input';
import { ScrollArea } from '@/core/ui/scroll-area';

type Column = {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
};

type Table = {
  name: string;
  schema?: string;
  columns: Column[];
};

type TableProfile = {
  tableName: string;
  rowCount: number | null;
  isReferenceTable: boolean;
};

type Source = {
  id: string;
  name: string;
  tables: Table[];
  profiles: Map<string, TableProfile>;
};

type Props = {
  sources: Source[];
  onSelectTable: (sourceId: string, tableName: string) => void;
  selectedTable?: { sourceId: string; tableName: string };
};

export function SchemaExplorer({ sources, onSelectTable, selectedTable }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set(sources.map((s) => s.id)));

  const toggleSource = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const q = search.toLowerCase();

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <Input
          placeholder="Search tables…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <ScrollArea className="flex-1">
        {sources.length === 0 && (
          <div className="p-4 text-xs text-muted-foreground text-center">
            Schema not loaded yet — Run schema discovery
          </div>
        )}
        {sources.map((source) => {
          const filtered = source.tables.filter(
            (t) => !q || t.name.toLowerCase().includes(q),
          );
          return (
            <div key={source.id}>
              <button
                className="w-full flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/50 text-left"
                onClick={() => toggleSource(source.id)}
              >
                <span className="text-muted-foreground">{expanded.has(source.id) ? '▾' : '▸'}</span>
                {source.name}
              </button>
              {expanded.has(source.id) &&
                filtered.map((table) => {
                  const profile = source.profiles.get(table.name);
                  const isSelected =
                    selectedTable?.sourceId === source.id &&
                    selectedTable.tableName === table.name;
                  return (
                    <button
                      key={table.name}
                      onClick={() => onSelectTable(source.id, table.name)}
                      className={`w-full flex items-center gap-2 pl-7 pr-3 py-1 text-xs hover:bg-accent/50 text-left ${
                        isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground'
                      }`}
                    >
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap flex-1">{table.name}</span>
                      {profile?.isReferenceTable && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">ref</Badge>
                      )}
                      {profile?.rowCount != null && (
                        <span className="text-muted-foreground text-[10px] shrink-0">
                          {profile.rowCount.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          );
        })}
      </ScrollArea>
    </div>
  );
}
