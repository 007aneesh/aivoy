import type { Message } from '../core/types';
import { CardRenderer } from './cards/CardRenderer';

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
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="aivoy-msg__tools">
            {message.toolCalls.map((tc, i) => (
              <div
                key={`${tc.id}_${i}`}
                className={`aivoy-tool aivoy-tool--${tc.status}`}
                title={tc.error}
              >
                {tc.status === 'running' ? '⟳' : tc.status === 'error' ? '⚠' : '✓'}{' '}
                <code>{tc.name}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
