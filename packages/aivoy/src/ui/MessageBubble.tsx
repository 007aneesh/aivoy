import type { Message, ToolCallRecord } from '../core/types';
import { CardRenderer } from './cards/CardRenderer';

const TOOL_LABEL_OVERRIDES: Record<string, { running: string; error: string }> = {
  getUserLocation: { running: 'Locating you', error: "Couldn't get your location" },
  searchListings: { running: 'Searching stays', error: "Couldn't search stays" },
  getListingDetails: { running: 'Loading details', error: "Couldn't load details" },
  recommendBasedOnHistory: { running: 'Finding picks', error: "Couldn't fetch picks" },
  getDestinationGuide: { running: 'Drafting guide', error: "Couldn't fetch guide" },
};

function humanizeToolName(name: string, status: ToolCallRecord['status']): string {
  const override = TOOL_LABEL_OVERRIDES[name];
  if (override) return status === 'error' ? override.error : `${override.running}…`;
  // camelCase / snake_case → "Word word" so the slug still reads as English.
  const pretty = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
  return status === 'error' ? `${pretty} failed` : `${pretty}…`;
}

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div
      className={`aivoy-msg ${isUser ? 'aivoy-msg--user' : 'aivoy-msg--assistant'}`}
    >
      <div className="aivoy-msg__inner">
        {message.parts.map((part, i) => {
          if (part.kind === 'text') {
            return (
              <div key={i} className="aivoy-msg__text">
                {part.text}
                {message.pending && i === message.parts.length - 1 && (
                  <span className="aivoy-msg__caret" aria-hidden>▍</span>
                )}
              </div>
            );
          }
          if (part.kind === 'error') {
            return (
              <div key={i} className="aivoy-msg__error" role="status">
                <span className="aivoy-msg__error-icon" aria-hidden>⚠</span>
                <span className="aivoy-msg__error-text">{part.error}</span>
              </div>
            );
          }
          return (
            <div key={i} className="aivoy-msg__card">
              <CardRenderer card={part.card} />
            </div>
          );
        })}
        {message.pending && message.parts.length === 0 && (
          <div className="aivoy-msg__typing" aria-label="Thinking">
            <span /><span /><span />
          </div>
        )}
        {(() => {
          // Only surface tool chips while RUNNING (gives the user something
          // to look at during the wait) or on ERROR (so failures aren't
          // silent). Done-state chips are dropped — the card/text below is
          // already the visible result, and a row of slug labels is noise.
          const visible = (message.toolCalls ?? []).filter(
            (tc) => tc.status === 'running' || tc.status === 'error',
          );
          if (visible.length === 0) return null;
          return (
            <div className="aivoy-msg__tools">
              {visible.map((tc, i) => (
                <div
                  key={`${tc.id}_${i}`}
                  className={`aivoy-tool aivoy-tool--${tc.status}`}
                  title={tc.error}
                >
                  {tc.status === 'running' ? (
                    <span className="aivoy-tool__spinner" aria-hidden />
                  ) : (
                    <span aria-hidden>⚠</span>
                  )}
                  <span>{humanizeToolName(tc.name, tc.status)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
