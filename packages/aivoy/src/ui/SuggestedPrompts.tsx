export function SuggestedPrompts({
  prompts,
  onPick,
}: {
  prompts: string[];
  onPick: (prompt: string) => void;
}) {
  if (!prompts.length) return null;
  return (
    <div className="aivoy-prompts">
      {prompts.map((p) => (
        <button
          key={p}
          type="button"
          className="aivoy-prompt"
          onClick={() => onPick(p)}
        >
          <span className="aivoy-prompt__icon" aria-hidden>✦</span>
          <span>{p}</span>
        </button>
      ))}
    </div>
  );
}
