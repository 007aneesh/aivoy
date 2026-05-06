import { z } from 'zod';
import { Concierge, defineTool } from 'aivoy';
import { mockAdapter } from 'aivoy/adapters';

const fakeListings = [
  {
    id: 1,
    title: 'Sunlit Studio in Le Marais',
    subtitle: 'Paris • 1 guest • Wi-Fi',
    imageUrl:
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
    price: { amount: 89, currency: 'EUR', per: 'night' },
    rating: 4.8,
    badges: ['Superhost', 'Free cancel'],
    href: '#',
  },
  {
    id: 2,
    title: 'Cozy Loft near Canal Saint-Martin',
    subtitle: 'Paris • 1 guest • Kitchen',
    imageUrl:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400',
    price: { amount: 72, currency: 'EUR', per: 'night' },
    rating: 4.6,
    href: '#',
  },
];

export default function App() {
  return (
    <main style={{ padding: 32, fontFamily: 'system-ui' }}>
      <h1>aivoy demo</h1>
      <p>Click the chat bubble in the bottom-right to open the concierge.</p>
      <p>
        This demo uses a <code>mockAdapter</code> that scripts a tool call so
        you can see card rendering. Try: <em>"show me stays for 1 in Paris"</em>
        .
      </p>

      <Concierge
        adapter={mockAdapter({
          delayMs: 30,
          // Scripted reply: greet, call searchListings, then summarize once
          // the tool result comes back. Real LLMs decide this from context;
          // the mock has to check `req.toolResults` itself.
          reply: async function* (req) {
            if (req.toolResults && req.toolResults.length > 0) {
              for (const word of 'Here are a couple of options that match. Let me know if you’d like me to narrow it down.'.split(
                /(\s+)/,
              )) {
                yield { type: 'text', delta: word };
              }
              return;
            }

            const last = [...req.messages].reverse().find((m) => m.role === 'user');
            const text = last?.parts.find((p) => p.kind === 'text');
            const userText = (text?.kind === 'text' ? text.text : '').toLowerCase();

            if (userText.includes('stay') || userText.includes('paris')) {
              yield { type: 'text', delta: 'Let me check available stays…' };
              yield {
                type: 'tool_call',
                id: 't_1',
                name: 'searchListings',
                args: { city: 'Paris', guests: 1 },
              };
              return;
            }

            for (const word of `Hi! I'm a demo. Ask me "show me stays for 1 in Paris" to see card rendering.`.split(
              /(\s+)/,
            )) {
              yield { type: 'text', delta: word };
            }
          },
        })}
        assistant={{
          name: 'Aivoy',
          greeting: 'Hi! I’m Aivoy. How can I help you today?',
          suggestedPrompts: [
            'Show me stays for 1 in Paris',
            'Recommend something cozy',
            'What can you do?',
          ],
        }}
        context={{
          user: { name: 'Aneesh', location: 'San Francisco' },
        }}
        tools={[
          defineTool({
            name: 'searchListings',
            description: 'Search travel stays by city and number of guests',
            input: z.object({ city: z.string(), guests: z.number() }),
            renderAs: 'listingCards',
            run: async ({ city }) => {
              await new Promise((r) => setTimeout(r, 400));
              return fakeListings.filter(() => city.length > 0);
            },
          }),
        ]}
        theme={{ accent: '#7c3aed', radius: 'lg', position: 'bottom-right' }}
        persistence={{ strategy: 'local', key: 'aivoy-demo' }}
      />
    </main>
  );
}
