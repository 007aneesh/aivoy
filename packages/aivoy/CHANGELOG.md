# Changelog

All notable changes to the `aivoy` widget package.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2]

### Fixed
- `repository`, `homepage`, and `bugs` URLs corrected to `github.com/007aneesh/aivoy`. No code changes — metadata only.

### Added
- `cards` prop on `<Concierge>` accepts a map of `cardType → React.ComponentType<{ data }>` for custom card rendering.
- `window.aivoyCards` global on the standalone bundle — non-React sites can register vanilla functions returning HTML strings or `HTMLElement`. Wrapped automatically as React components.
- `'session'` persistence strategy — chat survives reloads in the same tab, wiped when the tab closes. Now the default for the standalone embed.

### Changed
- Default fallback assistant name changed from `Assistant` to `Aivoy`.
- Tool result chips on the chat panel now only render on error. Successful tool calls surface only the rendered card (or feed back to the LLM silently if `renderAs` is unset).

### Fixed
- Listing card image URL handling — accepts both string URLs and `{ url, ... }` objects from the server, prevents schema-validation fallback to a JSON `<pre>` dump.

## [0.1.0] — initial

- `<Concierge>` floating launcher + chat panel.
- `proxyAdapter`, `openaiAdapter`, `anthropicAdapter`, `geminiAdapter`, `mockAdapter`.
- Built-in cards: `listingCards`, `productCards`, `link`.
- Persistence: `none` / `local` / `remote`.
- Headless mode via `ConciergeProvider` + `useConcierge`.
