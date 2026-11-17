import { msg } from "@lingui/core/macro";
import { i18n } from "../../features/localization/service";
import type { ToolItem } from "../../features/agents/activity-transcript";
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
function parsed(value: string) {
  try {
    return object(JSON.parse(value));
  } catch {
    return;
  }
}
function basename(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    /[/\\]$/.test(value) ||
    /[\r\n]/.test(value)
  )
    return;
  const name = value.split(/[/\\]/).at(-1);
  return name && name !== "." && name !== ".." ? name : undefined;
}

/** Display only. Never feeds send association, status, permissions or execution. */
export function activityPresentation(entry: ToolItem) {
  const input = parsed(entry.input);
  const name = entry.title;
  let title = entry.title,
    target: string | undefined;
  if (name === "buzz-dev-mcp__shell") {
    title = i18n._(msg`Run command`);
    const line =
      typeof input?.command === "string"
        ? input.command
            .split(/\r?\n/)
            .find((part) => part.trim())
            ?.replace(/\p{Cc}/gu, " ")
            .trim()
        : undefined;
    target = line
      ? `${line.slice(0, 90)}${line.length > 90 ? "…" : ""}`
      : undefined;
  } else if (
    name === "buzz-dev-mcp__read_file" ||
    name === "buzz-dev-mcp__str_replace" ||
    name === "buzz-dev-mcp__view_image"
  ) {
    target = basename(input?.path);
    title = target
      ? name.endsWith("read_file")
        ? i18n._(msg`Read file`)
        : name.endsWith("str_replace")
          ? i18n._(msg`Edit file`)
          : i18n._(msg`View image`)
      : entry.title;
  }
  // Only unwrap the observed shell wrapper. Missing/malformed fields retain the
  // exact output text; raw source is accessible for every presentation below.
  const result =
    name === "buzz-dev-mcp__shell" ? parsed(entry.output) : undefined;
  const shellOutput =
    result &&
    typeof result.stdout === "string" &&
    typeof result.stderr === "string" &&
    Number.isInteger(result.exit_code) &&
    typeof result.timed_out === "boolean" &&
    typeof result.stdout_truncated === "boolean" &&
    typeof result.stderr_truncated === "boolean"
      ? {
          stdout: result.stdout,
          stderr: result.stderr,
          failed: result.exit_code !== 0 || result.timed_out,
          note: [
            result.exit_code !== 0
              ? i18n._(msg`Exit code ${String(result.exit_code)}`)
              : "",
            result.timed_out ? i18n._(msg`Command timed out`) : "",
            result.stdout_truncated || result.stderr_truncated
              ? i18n._(msg`Output was truncated by the tool`)
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        }
      : undefined;
  const command =
    name === "buzz-dev-mcp__shell" && typeof input?.command === "string"
      ? input.command
      : undefined;
  return { title, target, shellOutput, command };
}
