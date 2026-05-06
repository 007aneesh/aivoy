# aivoy

Drop-in AI concierge chatbot for React apps. Floating launcher + chat panel, **streaming** responses, **tool calling** for live data, **rich cards** for structured results, **conversation persistence**.

Pluggable LLM backends: OpenAI, Anthropic, Gemini, or your own server.

```bash
npm i aivoy
```

## Quick start

```tsx
import { Concierge, defineTool } from 'aivoy';
import { proxyAdapter } from 'aivoy/adapters';
import 'aivoy/styles.css';
import { z } from 'zod';

export function App() {
  return (
    <Concierge
      adapter={proxyAdapter({ url: '/api/chat' })}
      assistant={{
        name: 'Aivoy',
        suggestedPrompts: [
          'Show me nearby stays for 1',
          'Recommend based on my last trip',
        ],
      }}
      context={{
        user: { name: 'Aneesh' },
        history: { lastBookings: [] },
      }}
      tools={[
        defineTool({
          name: 'searchListings',
          description: 'Search stays by city and number of guests',
          input: z.object({ city: z.string(), guests: z.number() }),
          renderAs: 'listingCards',
          run: async (args) => fetch('/api/listings?' + new URLSearchParams(args as any)).then(r => r.json()),
        }),
      ]}
      theme={{ accent: '#7c3aed', position: 'bottom-right' }}
    />
  );
}
```

## Adapters

| Adapter | Use it for | Browser-safe? |
|---|---|---|
| `proxyAdapter({ url })` | **Production.** POSTs to your server, which calls the LLM. | ✅ |
| `openaiAdapter({ apiKey })` | Local dev / demos | ⚠️ leaks key |
| `anthropicAdapter({ apiKey })` | Local dev / demos | ⚠️ leaks key |
| `geminiAdapter({ apiKey })` | Local dev / demos | ⚠️ leaks key |
| `mockAdapter()` | Tests + offline demos | ✅ |

> **Production:** always use `proxyAdapter` and call the provider server-side. The provider adapters take an `apiKey` for prototyping only.

### Proxy server contract

`POST <url>` receives JSON `{ system, messages, tools, toolResults? }` and must reply with `application/x-ndjson` — one `ChatChunk` per line:

```
{"type":"text","delta":"Hello"}
{"type":"tool_call","id":"t_1","name":"searchListings","args":{"city":"Paris"}}
{"type":"done"}
```

## Tools

Tools are how the assistant gets live data. Use `defineTool({ name, description, input, run, renderAs? })`:

- `input` is a Zod schema — used as the tool's JSON Schema *and* runtime arg validator.
- `run(args, ctx)` returns the result. `ctx.context` is your static `<Concierge context={...} />`. `ctx.signal` aborts if the user cancels.
- `renderAs` (optional) — if set, the tool's result becomes a card of this type instead of being summarized as text. Built-ins: `listingCards`, `productCards`, `link`. Register your own via `<Concierge cards={{ myType: MyCard }} />`.

## Headless usage

```tsx
import { ConciergeProvider, useConcierge } from 'aivoy';

<ConciergeProvider {...props}>
  <YourCustomUI />
</ConciergeProvider>;

function YourCustomUI() {
  const { messages, send, isStreaming, open, setOpen } = useConcierge();
  // build whatever UI you want
}
```

## Persistence

```tsx
persistence={{ strategy: 'local', key: 'my-app:thread' }}     // localStorage (default)
persistence={{ strategy: 'remote', load, save }}              // your backend
persistence={{ strategy: 'none' }}                            // disable
```

## Theming

CSS variables — override anywhere downstream of `.aivoy-root`:

```css
.aivoy-root { --aivoy-accent: #ff6a3d; --aivoy-radius: 20px; }
```

Or use the `theme` prop for the common knobs: `accent`, `radius` (`sm|md|lg|xl`), `position` (`bottom-right|bottom-left`), `mode` (`light|dark|auto`).

## Demo

```bash
npm run build
cd examples/vanilla
npm install
npm run dev
```

## License

MIT
