// Parabola blurple — matches the accent used on the /discord/guide page.
export const BRAND_COLOR = 0x4c5fe0;
export const DANGER_COLOR = 0xd8383b;
export const SUCCESS_COLOR = 0x2baf6b;

export type EmbedField = { name: string; value: string; inline?: boolean };

export function buildEmbed(opts: {
  title: string;
  description?: string;
  fields?: EmbedField[];
  color?: number;
}) {
  return {
    title: opts.title,
    description: opts.description,
    fields: opts.fields,
    color: opts.color ?? BRAND_COLOR,
  };
}
