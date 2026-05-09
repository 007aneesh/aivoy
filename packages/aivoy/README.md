# aivoy

A drop-in AI concierge widget for React apps. Streaming responses, tool calls, custom cards, session-scoped chat history.

```bash
npm install aivoy
```

Pairs with the [aivoy cloud](https://github.com/aneeshwiz/aivoy) for a managed multi-LLM gateway, or works against any server that streams ND-JSON.

## Quick start

```tsx
import { Concierge } from 'aivoy';
import { proxyAdapter } from 'aivoy/adapters';
import 'aivoy/styles.css';

export function App() {
  return (
    <Concierge
      adapter={proxyAdapter({
        url: 'https://your-aivoy-host/embed/v1/chat',
        headers: () => ({ Authorization: `Bearer pk_...` }),
      })}
      assistant={{
        name: 'Concierge',
        greeting: 'Hi! How can I help?',
        suggestedPrompts: ['Show me popular options', 'What can you do?'],
      }}
      theme={{ accent: '#7c3aed', position: 'bottom-right' }}
    />
  );
}
```

That's the floating launcher + chat panel. The widget streams tokens, calls tools server-side, and renders structured results as cards.

## Two ways to embed

**React app** — install the package, mount `<Concierge>` directly. Full control, typed props, custom card components.

**Any HTML page** — drop a single script tag, no framework needed:

```html
<script
  src="https://your-aivoy-host/embed/loader.js"
  data-token="pk_..."
  async
></script>
```

Use the script tag for marketing sites, Webflow, Shopify themes, plain HTML. Use the npm package when you're already in a React app or need custom card rendering.

## Adapters

| Adapter | Use it for | Browser-safe |
|---|---|---|
| `proxyAdapter({ url })` | Production. Your server proxies to the LLM. | Yes |
| `openaiAdapter({ apiKey })` | Local dev / demos | No (leaks key) |
| `anthropicAdapter({ apiKey })` | Local dev / demos | No (leaks key) |
| `geminiAdapter({ apiKey })` | Local dev / demos | No (leaks key) |
| `mockAdapter()` | Tests, offline | Yes |

`proxyAdapter` POSTs `{ messages }` to your server and expects `application/x-ndjson` back — one chunk per line:

```
{"type":"text","delta":"Hello"}
{"type":"tool_status","id":"t_1","name":"searchListings","status":"running"}
{"type":"card","cardType":"listingCards","data":[…]}
{"type":"text","delta":" — here are five options."}
{"type":"done"}
```

## Tools

Tools are how the assistant pulls live data. The widget itself doesn't define them — your server does. With the [aivoy cloud](https://github.com/aneeshwiz/aivoy) you register tools in a dashboard; with your own server, you implement the chat endpoint to dispatch them.

Each tool call surfaces in the widget as a status chip while running, and the result either renders as a card (when the server sets `renderAs`) or feeds back to the LLM as raw JSON for narration.

## Custom cards

Match your brand by shipping your own card components. Each receives the raw tool result via `data`:

```tsx
<Concierge
  cards={{
    flightCard: ({ data }) => <FlightCard {...(data as Flight)} />,
    eventCard: ({ data }) => <EventCard {...(data as Event)} />,
  }}
  ...
/>
```

The key (`flightCard`) must match the `renderAs` the server returns.

For the script-tag embed, set `window.aivoyCards` before the loader script:

```html
<script>
  window.aivoyCards = {
    flightCard: (data) => `<div class="my-flight">…</div>`,
  };
</script>
```

Strings and `HTMLElement` returns both work — non-React sites get full custom UI without adopting React.

## Persistence

```tsx
// Default — survives reloads in the same tab, wiped when the tab closes.
persistence={{ strategy: 'session', key: 'aivoy:my-app' }}

// Persists across browser restarts.
persistence={{ strategy: 'local', key: 'aivoy:my-app' }}

// Disable.
persistence={{ strategy: 'none' }}

// Bring your own backend.
persistence={{ strategy: 'remote', load, save }}
```

## Theming

The `theme` prop covers common knobs:

| Key | Values |
|---|---|
| `accent` | hex (`#7c3aed`) — buttons, chips, launcher |
| `mode` | `light` / `dark` / `auto` |
| `position` | `bottom-right` / `bottom-left` |
| `radius` | `sm` / `md` / `lg` / `xl` |

For deeper control, override CSS variables anywhere downstream of `.aivoy-root`:

```css
.aivoy-root {
  --aivoy-accent: #ff6a3d;
  --aivoy-radius: 20px;
  --aivoy-font: 'Inter', system-ui, sans-serif;
}
```

## Headless

Skip the built-in UI entirely:

```tsx
import { ConciergeProvider, useConcierge } from 'aivoy';

<ConciergeProvider adapter={...} assistant={{ name: 'Concierge' }}>
  <YourCustomUI />
</ConciergeProvider>;

function YourCustomUI() {
  const { messages, send, isStreaming, open, setOpen } = useConcierge();
  // render anything
}
```

## API surface

| Export | From | What it is |
|---|---|---|
| `Concierge` | `aivoy` | Main floating launcher + chat panel |
| `ConciergeProvider`, `useConcierge` | `aivoy` | Headless |
| `MessageBubble`, `Composer`, `CardRenderer` | `aivoy` | Sub-components for custom layouts |
| `proxyAdapter`, `openaiAdapter`, `anthropicAdapter`, `geminiAdapter`, `mockAdapter` | `aivoy/adapters` | Chat backends |
| `'aivoy/styles.css'` | side-effect import | Default styles |

Full TypeScript types ship with the package.

## Browser support

Modern evergreen browsers. Uses `fetch` streams (`ReadableStream` + `TextDecoder`) which are supported everywhere except IE11 and Safari < 14.1.

## License

MIT.
