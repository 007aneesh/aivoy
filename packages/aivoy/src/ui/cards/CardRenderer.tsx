import type { Card } from '../../core/types';
import { useConciergeContext } from '../../core/ConciergeProvider';
import { ListingCards } from './ListingCard';
import { ProductCards } from './ProductCard';
import { LinkCard } from './LinkCard';

const builtins: Record<string, React.ComponentType<{ data: unknown }>> = {
  listingCards: ListingCards,
  productCards: ProductCards,
  link: LinkCard,
};

export function CardRenderer({ card }: { card: Card }) {
  const { cardComponents } = useConciergeContext();
  const Component = cardComponents[card.type] ?? builtins[card.type];

  if (!Component) {
    return (
      <pre className="aivoy-card aivoy-card--fallback">
        {JSON.stringify(card.data, null, 2)}
      </pre>
    );
  }
  return <Component data={card.data} />;
}
