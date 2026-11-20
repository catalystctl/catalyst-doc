import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        audience: z.array(z.string()).optional(),
        features: z.array(z.string()).optional(),
        sources: z.array(z.string()).optional(),
        last_verified: z.string().optional(),
      }),
    }),
  }),
};
