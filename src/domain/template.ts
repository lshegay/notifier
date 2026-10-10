export type Template = {
  id: string;
  name: string;
  content: string;
  provider_id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTemplateDTO = {
  name: string;
  content: string;
  provider_id: string;
};

export type UpdateTemplateDTO = {
  name?: string;
  content?: string;
  provider_id?: string;
};

/**
 * Renders template content by replacing `{{variable}}` placeholders with values from args.
 */
export function renderTemplate(content: string, args: Record<string, unknown>): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, varName) => {
    if (varName in args) {
      const val = args[varName];
      return val !== null && val !== undefined ? String(val) : '';
    }
    return match;
  });
}
