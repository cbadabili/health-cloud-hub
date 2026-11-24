/** True when a legal-page config value still needs to be filled in. */
export const isMissing = (value: string | null) => value === null || value.trim() === "";
