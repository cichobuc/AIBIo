'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { SchemaExplorer } from './SchemaExplorer';
import type { SchemaSnapshot } from '@/core/types/workspace';

type SnapshotRow = {
  dataSourceId: string;
  snapshotJson: string;
};

type TableProfileRow = {
  dataSourceId: string;
  tableName: string;
  rowCount: number | null;
  isReferenceTable: boolean;
};

type SourceRow = { id: string; name: string };

type Props = {
  sources: SourceRow[];
  snapshots: SnapshotRow[];
  tables: TableProfileRow[];
};

export function ExploreSidebar({ sources, snapshots, tables }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const selectedTable =
    sp.get('source') && sp.get('table')
      ? { sourceId: sp.get('source')!, tableName: sp.get('table')! }
      : undefined;

  const snapshotMap = new Map(snapshots.map((s) => [s.dataSourceId, s]));

  const explorerSources = sources.map((source) => {
    const snapshot = snapshotMap.get(source.id);
    const parsed: SchemaSnapshot = snapshot
      ? (JSON.parse(snapshot.snapshotJson) as SchemaSnapshot)
      : { tables: [], capturedAt: '' };

    const profiles = new Map(
      tables
        .filter((t) => t.dataSourceId === source.id)
        .map((t) => [
          t.tableName,
          { tableName: t.tableName, rowCount: t.rowCount, isReferenceTable: t.isReferenceTable },
        ]),
    );

    return { id: source.id, name: source.name, tables: parsed.tables, profiles };
  });

  const handleSelectTable = (sourceId: string, tableName: string) => {
    router.push(`?source=${encodeURIComponent(sourceId)}&table=${encodeURIComponent(tableName)}`, {
      scroll: false,
    });
  };

  return (
    <SchemaExplorer
      sources={explorerSources}
      onSelectTable={handleSelectTable}
      selectedTable={selectedTable}
    />
  );
}
