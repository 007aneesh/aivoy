// Public API
export { Concierge, type ConciergeProps } from './ui/Concierge';
export { ConciergeProvider, type ConciergeProviderProps } from './core/ConciergeProvider';
export { useConcierge } from './core/useConcierge';
export { defineTool } from './core/types';
export type {
  AssistantConfig,
  Card,
  CardPart,
  ChatAdapter,
  ChatChunk,
  ChatRequest,
  ConciergeEvent,
  Message,
  MessagePart,
  PersistenceConfig,
  Role,
  TextPart,
  ThemeConfig,
  Tool,
  ToolCallRecord,
  ToolRunContext,
} from './core/types';

// Card schemas (for consumers writing tools that return structured data)
export {
  ListingCardSchema,
  ListingCardsSchema,
  ProductCardSchema,
  ProductCardsSchema,
  LinkCardSchema,
  type ListingCardData,
  type ProductCardData,
  type LinkCardData,
} from './schemas/card';

// Built-in card components — exported so consumers can compose them in custom layouts.
export { ListingCards } from './ui/cards/ListingCard';
export { ProductCards } from './ui/cards/ProductCard';
export { LinkCard } from './ui/cards/LinkCard';
export { CardRenderer } from './ui/cards/CardRenderer';
