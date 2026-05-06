import { ListingCardSchema, ListingCardsSchema } from '../../schemas/card';

export function ListingCards({ data }: { data: unknown }) {
  const parsed = ListingCardsSchema.safeParse(data);
  if (!parsed.success) {
    const single = ListingCardSchema.safeParse(data);
    if (!single.success) return <FallbackCard data={data} />;
    return <ListingCards data={[single.data]} />;
  }
  return (
    <div className="aivoy-cards aivoy-cards--listing">
      {parsed.data.map((listing) => (
        <a
          key={listing.id}
          href={listing.href}
          target={listing.href ? '_blank' : undefined}
          rel="noreferrer"
          className="aivoy-card aivoy-card--listing"
        >
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="aivoy-card__image"
              loading="lazy"
            />
          ) : (
            <div className="aivoy-card__image aivoy-card__image--placeholder" />
          )}
          <div className="aivoy-card__body">
            <div className="aivoy-card__title">{listing.title}</div>
            {listing.subtitle && (
              <div className="aivoy-card__subtitle">{listing.subtitle}</div>
            )}
            <div className="aivoy-card__meta">
              {listing.price && (
                <span className="aivoy-card__price">
                  {formatMoney(listing.price.amount, listing.price.currency)}
                  {listing.price.per ? ` / ${listing.price.per}` : ''}
                </span>
              )}
              {typeof listing.rating === 'number' && (
                <span className="aivoy-card__rating">★ {listing.rating.toFixed(1)}</span>
              )}
            </div>
            {listing.badges && listing.badges.length > 0 && (
              <div className="aivoy-card__badges">
                {listing.badges.map((b) => (
                  <span key={b} className="aivoy-card__badge">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}

function FallbackCard({ data }: { data: unknown }) {
  return (
    <pre className="aivoy-card aivoy-card--fallback">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
