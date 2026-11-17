import { expect, it } from "vitest";
import { channelDurationLabel } from "./ChannelDurationField";

it.each([
  [86400, "1 day", "1天"],
  [604800, "7 days", "7天"],
  [1209600, "2 weeks", "2周"],
  [3600, "1 hour", "1小时"],
  [60, "1 minute", "1分钟"],
  [30, "30 seconds", "30秒钟"],
])(
  "formats %s seconds without changing its lifetime",
  (seconds, english, chinese) => {
    expect(channelDurationLabel(seconds)).toBe(english);
    expect(channelDurationLabel(seconds, "en-US")).toBe(english);
    expect(channelDurationLabel(seconds, "zh-CN")).toBe(chinese);
  },
);
