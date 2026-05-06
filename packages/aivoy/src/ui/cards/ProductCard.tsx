import { ProductCardSchema, ProductCardsSchema } from '../../schemas/card';

export function ProductCards({ data }: { data: unknown }) {
  const parsed = ProductCardsSchema.safeParse(data);
  if (!parsed.success) {
    const single = ProductCardSchema.safeParse(data);
    if (!single.success) {
      return (
        <pre className="aivoy-card aivoy-card--fallback">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    return <ProductCards data={[single.data]} />;
  }
  return (
    <div className="aivoy-cards aivoy-cards--product">
      {parsed.data.map((p) => (
        <a
          key={p.id}
          href={p.href}
          target={p.href ? '_blank' : undefined}
          rel="noreferrer"
          className="aivoy-card aivoy-card--product"
        >
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.title}
              className="aivoy-card__image"
              loading="lazy"
            />
          ) : (
            <div className="aivoy-card__image aivoy-card__image--placeholder" />
          )}
          <div className="aivoy-card__body">
            <div className="aivoy-card__title">{p.title}</div>
            {p.price && (
              <div className="aivoy-card__price">
                {new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: p.price.currency,
                }).format(p.price.amount)}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
