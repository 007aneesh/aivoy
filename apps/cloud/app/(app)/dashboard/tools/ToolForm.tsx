'use client';

import { useState, useTransition } from 'react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui';
import { createTool, updateTool } from './actions';

const BUILT_IN_RENDER_AS = ['listingCards', 'productCards', 'link'] as const;
type BuiltInRenderAs = (typeof BUILT_IN_RENDER_AS)[number];

interface Template {
  label: string;
  name: string;
  description: string;
  renderAs: BuiltInRenderAs | '' | 'custom';
  customRenderAs?: string;
  inputSchema: string;
}

const TEMPLATES: Record<string, Template> = {
  blank: {
    label: 'Blank — start from scratch',
    name: '',
    description: '',
    renderAs: '',
    inputSchema: `{
  "type": "object",
  "properties": {},
  "required": []
}`,
  },
  searchProducts: {
    label: 'Search products',
    name: 'searchProducts',
    description:
      'Search the product catalogue by keyword, category, or price. Use whenever the user asks to find or compare products.',
    renderAs: 'productCards',
    inputSchema: `{
  "type": "object",
  "properties": {
    "query":    { "type": "string",  "description": "Free-text search term" },
    "category": { "type": "string",  "description": "Optional category filter" },
    "maxPrice": { "type": "number",  "description": "Maximum price" },
    "limit":    { "type": "integer", "minimum": 1, "maximum": 12, "default": 6 }
  }
}`,
  },
  searchListings: {
    label: 'Search listings (rentals / properties)',
    name: 'searchListings',
    description:
      'Search short-term rental listings by city, dates, guests, and price. Use when the user wants to discover stays.',
    renderAs: 'listingCards',
    inputSchema: `{
  "type": "object",
  "properties": {
    "city":     { "type": "string" },
    "checkIn":  { "type": "string", "description": "YYYY-MM-DD" },
    "checkOut": { "type": "string", "description": "YYYY-MM-DD" },
    "guests":   { "type": "integer", "minimum": 1 },
    "maxPrice": { "type": "number" },
    "limit":    { "type": "integer", "minimum": 1, "maximum": 12, "default": 6 }
  }
}`,
  },
  getDetails: {
    label: 'Get item details',
    name: 'getItemDetails',
    description:
      'Fetch the full details of a single item by id. Use for follow-up questions about something the user has already seen.',
    renderAs: 'link',
    inputSchema: `{
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "Item identifier" }
  },
  "required": ["id"]
}`,
  },
  getStatus: {
    label: 'Status check (orders, bookings, tickets)',
    name: 'getOrderStatus',
    description:
      'Look up the current status of an order or booking by its id. Returns plain text the LLM summarizes.',
    renderAs: '',
    inputSchema: `{
  "type": "object",
  "properties": {
    "orderId": { "type": "string" }
  },
  "required": ["orderId"]
}`,
  },
  recommend: {
    label: 'Recommend (personalized picks)',
    name: 'recommendItems',
    description:
      'Recommend items based on past history or stated preferences. Returns a curated list as cards.',
    renderAs: 'productCards',
    inputSchema: `{
  "type": "object",
  "properties": {
    "limit":      { "type": "integer", "minimum": 1, "maximum": 12, "default": 6 },
    "noveltyMix": { "type": "number",  "minimum": 0, "maximum": 1, "default": 0.6 }
  }
}`,
  },
};

const RENDER_AS_OPTIONS: { value: '' | BuiltInRenderAs | 'custom'; label: string; hint: string }[] = [
  { value: '',             label: 'Plain text (no card)',     hint: 'LLM reads the JSON and writes its own response.' },
  { value: 'listingCards', label: 'Listing cards (built-in)', hint: 'Travel / rentals — image, title, price/night, rating, badges.' },
  { value: 'productCards', label: 'Product cards (built-in)', hint: 'E-commerce — image, title, price, link.' },
  { value: 'link',         label: 'Link card (built-in)',     hint: 'Single card that opens a URL.' },
  { value: 'custom',       label: 'Custom — register on the embed', hint: 'You ship the renderer via window.aivoyCards or the React cards prop.' },
];

function deriveRenderAsState(value: string | null | undefined): { mode: '' | BuiltInRenderAs | 'custom'; custom: string } {
  if (!value) return { mode: '', custom: '' };
  if ((BUILT_IN_RENDER_AS as readonly string[]).includes(value)) {
    return { mode: value as BuiltInRenderAs, custom: '' };
  }
  return { mode: 'custom', custom: value };
}

export function ToolForm({
  initial,
  onDone,
}: {
  initial?: {
    id: string;
    name: string;
    description: string;
    webhookUrl: string;
    inputSchema: Record<string, unknown>;
    renderAs: string | null;
    enabled: boolean;
  };
  onDone?: () => void;
}) {
  const isEdit = !!initial;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Template controls only show when creating a new tool — editing keeps the
  // saved values; the user shouldn't accidentally overwrite by re-selecting.
  const [templateKey, setTemplateKey] = useState<string>(isEdit ? '' : 'blank');
  const tpl = TEMPLATES[templateKey];

  const initialRenderAs = isEdit
    ? deriveRenderAsState(initial.renderAs)
    : { mode: tpl?.renderAs ?? '', custom: tpl?.customRenderAs ?? '' };

  const [renderMode, setRenderMode] = useState<'' | BuiltInRenderAs | 'custom'>(initialRenderAs.mode);
  const [customRender, setCustomRender] = useState(initialRenderAs.custom);

  const [name, setName] = useState(initial?.name ?? tpl?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? tpl?.description ?? '');
  const [inputSchema, setInputSchema] = useState(
    initial ? JSON.stringify(initial.inputSchema, null, 2) : tpl?.inputSchema ?? '',
  );

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const next = TEMPLATES[key];
    if (!next) return;
    setName(next.name);
    setDescription(next.description);
    setInputSchema(next.inputSchema);
    setRenderMode(next.renderAs);
    setCustomRender(next.customRenderAs ?? '');
  }

  const effectiveRenderAs = renderMode === 'custom' ? customRender.trim() : renderMode;
  const renderHint = RENDER_AS_OPTIONS.find((o) => o.value === renderMode)?.hint ?? '';

  return (
    <form
      style={{ padding: 16 }}
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          fd.set('renderAs', effectiveRenderAs);
          try {
            if (isEdit) {
              fd.set('id', initial.id);
              await updateTool(fd);
            } else {
              await createTool(fd);
            }
            onDone?.();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to save');
          }
        })
      }
    >
      {!isEdit && (
        <Field
          label="Start from template"
          hint="Pre-fills the form for common shapes. You can customize anything after."
        >
          <Select value={templateKey} onChange={(e) => applyTemplate(e.target.value)}>
            {Object.entries(TEMPLATES).map(([key, t]) => (
              <option key={key} value={key}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field
          label="Name"
          hint="What the LLM calls. camelCase — letters, digits, underscores."
        >
          <Input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="searchProducts"
            pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
          />
        </Field>
        <Field label="Render as" hint={renderHint}>
          <Select
            value={renderMode}
            onChange={(e) => setRenderMode(e.target.value as typeof renderMode)}
          >
            {RENDER_AS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {renderMode === 'custom' && (
            <Input
              value={customRender}
              onChange={(e) => setCustomRender(e.target.value)}
              placeholder="eventCard"
              pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
              required
              style={{ marginTop: 6 }}
            />
          )}
        </Field>
      </div>

      <Field label="Description" hint="Shown to the LLM. Be specific about when to call it.">
        <Textarea
          name="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Search travel stays by city and number of guests"
        />
      </Field>

      <Field label="Webhook URL" hint="aivoy POSTs here when the LLM calls this tool.">
        <Input
          name="webhookUrl"
          type="url"
          required
          defaultValue={initial?.webhookUrl ?? ''}
          placeholder="https://your-app.com/api/aivoy/searchProducts"
        />
      </Field>

      <Field label="Input schema (JSON Schema)" hint="What arguments the LLM should pass.">
        <Textarea
          name="inputSchema"
          required
          rows={10}
          value={inputSchema}
          onChange={(e) => setInputSchema(e.target.value)}
          style={{ fontFamily: 'var(--font-mono)' }}
        />
      </Field>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial?.enabled ?? true}
        />
        <span>Enabled — exposed to the LLM</span>
      </label>

      {error && <p style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add tool'}
        </Button>
        {isEdit && onDone && (
          <Button type="button" variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
