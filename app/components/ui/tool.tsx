export function ToolInvocations({
  toolInvocations,
  onImageClick,
}: {
  toolInvocations: ToolInvocation[];
  onImageClick?: (imageSrc: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-2">
      {toolInvocations
        .filter(tool => tool.toolName !== "pause_execution") // Skip pause_execution tools
        .map((tool, index) => {
          // ... rest of the component
        })}
    </div>
  );
}
