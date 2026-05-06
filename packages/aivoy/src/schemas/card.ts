import { z } from 'zod';

/** A travel/booking listing. Used by the built-in `listingCards` renderer. */
export const ListingCardSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  subtitle: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z
    .object({
      amount: z.number(),
      currency: z.string().default('USD'),
      per: z.string().optional(),
    })
    .optional(),
  rating: z.number().optional(),
  href: z.string().optional(),
  badges: z.array(z.string()).optional(),
});

export type ListingCardData = z.infer<typeof ListingCardSchema>;

/** Generic product. Used by `productCards`. */
export const ProductCardSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  imageUrl: z.string().optional(),
  price: z
    .object({
      amount: z.number(),
      currency: z.string().default('USD'),
    })
    .optional(),
  href: z.string().optional(),
});

export type ProductCardData = z.infer<typeof ProductCardSchema>;

/** Arrays of the above — what tools typically return. */
export const ListingCardsSchema = z.array(ListingCardSchema);
export const ProductCardsSchema = z.array(ProductCardSchema);

export const LinkCardSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  href: z.string(),
  imageUrl: z.string().optional(),
});

export type LinkCardData = z.infer<typeof LinkCardSchema>;
