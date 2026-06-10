export function JsonPreview({ value }: { value: unknown }) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none text-muted-foreground">
        Request body preview
      </summary>
      <pre className="mt-2 overflow-auto rounded-md bg-muted p-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
