import type { ReactNode } from "react";

// Keep the value separate from translated prose without introducing a React
// provider into the host's provider-free Lingui runtime.
export const LANGUAGE_VALUE_MARKER = "\uE000";

/**
 * Restores an untranslated value at its translated placeholder position.
 * @param message Translated copy containing LANGUAGE_VALUE_MARKER once.
 * @param value Plugin or user content whose language is unknown.
 */
export function isolateLanguageValue(
  message: string,
  value: string,
): ReactNode {
  const markerIndex = message.indexOf(LANGUAGE_VALUE_MARKER);
  if (markerIndex < 0) return message;
  return (
    <>
      {message.slice(0, markerIndex)}
      <span lang="">{value}</span>
      {message.slice(markerIndex + LANGUAGE_VALUE_MARKER.length)}
    </>
  );
}
