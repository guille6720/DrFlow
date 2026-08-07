/** Supported locale identifiers — extend when adding translations. */
export type LocaleId = "es-AR";

/** Interpolation params for message templates with `{{key}}` placeholders. */
export type MessageParams = Record<string, string | number>;

/** A static string or a parameterized message factory. */
export type MessageValue = string | ((params: MessageParams) => string);
