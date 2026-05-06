export function Launcher({
  name,
  avatarUrl,
  onClick,
  position,
}: {
  name: string;
  avatarUrl?: string;
  onClick: () => void;
  position: 'bottom-right' | 'bottom-left';
}) {
  return (
    <button
      type="button"
      className={`aivoy-launcher aivoy-launcher--${position}`}
      onClick={onClick}
      aria-label={`Open ${name}`}
    >
      <span className="aivoy-launcher__halo" aria-hidden />
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="aivoy-launcher__avatar" />
      ) : (
        <span className="aivoy-launcher__sparkle" aria-hidden>
          ✦
        </span>
      )}
      <span className="aivoy-launcher__label">Ask {name}</span>
    </button>
  );
}
