interface VariablePreviewProps {
  rendered: string;
}

export default function VariablePreview({ rendered }: VariablePreviewProps) {
  if (!rendered) return null;

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground mb-1.5">实时预览</div>
      <pre className="text-sm whitespace-pre-wrap font-sans">{rendered}</pre>
    </div>
  );
}
