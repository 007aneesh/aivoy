import { useState, type FormEvent, type KeyboardEvent } from 'react';

export function Composer({
  placeholder,
  disabled,
  onSend,
  onStop,
  isStreaming,
}: {
  placeholder?: string;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e);
    }
  };

  return (
    <form className="aivoy-composer" onSubmit={submit}>
      <textarea
        className="aivoy-composer__input"
        placeholder={placeholder ?? 'Ask anything…'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        rows={1}
        disabled={disabled}
      />
      {isStreaming ? (
        <button
          type="button"
          className="aivoy-composer__btn aivoy-composer__btn--stop"
          onClick={onStop}
          aria-label="Stop"
        >
          ◼
        </button>
      ) : (
        <button
          type="submit"
          className="aivoy-composer__btn"
          disabled={!value.trim() || disabled}
          aria-label="Send"
        >
          ➤
        </button>
      )}
    </form>
  );
}
