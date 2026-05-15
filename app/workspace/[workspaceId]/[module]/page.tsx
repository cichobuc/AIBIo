const MODULE_LABELS: Record<string, string> = {
  connect: 'Connect',
  explore: 'Explore',
  govern: 'Govern',
  model: 'Model',
  document: 'Document',
  test: 'Test',
  translate: 'Translate',
  export: 'Export',
};

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const label = MODULE_LABELS[module] ?? module;
  return (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      <div className="text-center">
        <p className="text-section font-medium text-foreground">{label}</p>

        <p className="text-body mt-1">Coming soon</p>
      </div>
    </div>
  );
}
