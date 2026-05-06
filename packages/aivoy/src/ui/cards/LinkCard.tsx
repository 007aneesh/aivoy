import { LinkCardSchema } from '../../schemas/card';

export function LinkCard({ data }: { data: unknown }) {
  const parsed = LinkCardSchema.safeParse(data);
  if (!parsed.success) {
    return (
      <pre className="aivoy-card aivoy-card--fallback">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }
  const link = parsed.data;
  return (
    <a
      href={link.href}
      target="_blank"
      rel="noreferrer"
      className="aivoy-card aivoy-card--link"
    >
      {link.imageUrl && (
        <img
          src={link.imageUrl}
          alt={link.title}
          className="aivoy-card__image"
          loading="lazy"
        />
      )}
      <div className="aivoy-card__body">
        <div className="aivoy-card__title">{link.title}</div>
        {link.description && (
          <div className="aivoy-card__subtitle">{link.description}</div>
        )}
      </div>
    </a>
  );
}
