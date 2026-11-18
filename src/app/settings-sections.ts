import type { I18n, MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { i18n as defaultI18n } from "../features/localization/service";
// One Settings section policy for the standalone and shell presentations and
// route classification. Visibility and authorization stay with settingsCards.
import { isTauri } from "@tauri-apps/api/core";
import { developerMode } from "../features/developer/mode";
import {
  BellIcon,
  BrainIcon,
  ShieldIcon,
  ChatCircleIcon,
  DownloadIcon,
  KeyboardIcon,
  PaletteIcon,
  RobotIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
  GearIcon,
  GlobeIcon,
  LockIcon,
} from "../shared/design-system/icons/index";
import type { SettingsCard } from "../features/settings/service";
import type { Contribution } from "../plugins/contributions";

type Community = {
  name: string;
  localName?: string | undefined;
  publishedName?: string | undefined;
};
export type SettingsSection = {
  id: string;
  label: string;
  lang?: string;
  /** Contributed groups leave the icon to each presentation. */
  icon?: typeof UserIcon;
};
export type SettingsGroup = {
  id: string;
  label: string;
  lang?: string;
  sections: readonly SettingsSection[];
};

export { developerMode };

type BuiltInSection = Omit<SettingsSection, "label"> & {
  label: MessageDescriptor;
};

const profile: BuiltInSection = {
  id: "profile",
  label: msg`Profile`,
  icon: UserIcon,
};
const app: readonly BuiltInSection[] = [
  { id: "appearance", label: msg`Appearance`, icon: PaletteIcon },
  { id: "language", label: msg`Language`, icon: GlobeIcon },
  { id: "notifications", label: msg`Notifications`, icon: BellIcon },
  { id: "shortcuts", label: msg`Shortcuts`, icon: KeyboardIcon },
  { id: "agents", label: msg`Agent setup`, icon: RobotIcon },
  { id: "decisions", label: msg`Decisions API`, icon: BrainIcon },
  { id: "updates", label: msg`Software updates`, icon: DownloadIcon },
];
const plugins: BuiltInSection = {
  id: "plugins",
  label: msg`Manage plugins`,
  icon: SquaresFourIcon,
};
const developer: BuiltInSection = {
  id: "developer",
  label: msg`Developer`,
  icon: WrenchIcon,
};
const departure: BuiltInSection = {
  id: "leave-community",
  label: msg`Leave or remove`,
  icon: SignOutIcon,
};
const identity: BuiltInSection = {
  id: "identity",
  label: msg`Identity`,
  icon: ShieldIcon,
};
const security: BuiltInSection = {
  id: "security",
  label: msg`Security`,
  icon: LockIcon,
};
const local: BuiltInSection = {
  id: "local-settings",
  label: msg`Local settings`,
  icon: GearIcon,
};
// Keep frequent destinations first, regardless of plugin activation order.
// Other community contributions stay together before pairing.
const communityOrder: Readonly<Record<string, number>> = {
  "buzz.emoji/custom-emoji": 1,
  "buzz.pairing/mobile": 4,
};
const builtIn = new Set(
  [
    profile,
    identity,
    security,
    local,
    departure,
    plugins,
    ...app,
    ...(developerMode ? [developer] : []),
  ].map(({ id }) => id),
);

/** Host-owned sections; any other section is a plugin card contribution key. */
export const isBuiltInSettingsSection = (id: string) => builtIn.has(id);

export function settingsSections(
  cards: readonly Contribution<SettingsCard>[],
  community: Community | undefined,
  i18n: Pick<I18n, "_" | "locale"> = defaultI18n,
) {
  const label = (item: BuiltInSection): SettingsSection => ({
    ...item,
    label: i18n._(item.label),
    lang: i18n.locale,
  });
  const section = (
    card: Contribution<SettingsCard>,
    icon?: typeof UserIcon,
  ): SettingsSection => {
    const resolvedIcon = card.icon ?? icon;
    return {
      id: card.key,
      // 插件卡片标题在渲染期翻译，语言切换即时生效。
      label:
        typeof card.title === "string" ? card.title : i18n._(card.title),
      ...(typeof card.title !== "string" ? { lang: i18n.locale } : {}),
      ...(resolvedIcon ? { icon: resolvedIcon } : {}),
    };
  };
  const administration = community
    ? cards
        .filter((card) => card.section === "administration")
        .map((card) => section(card, UsersIcon))
    : [];
  const groups: SettingsGroup[] = [
    ...(community
      ? [
          {
            id: "community",
            label: i18n._(msg`Community`),
            lang: i18n.locale,
            sections: [
              label(profile),
              label(local),
              ...[
                ...cards
                  .filter((card) => !card.group && !card.section)
                  .map((card) => section(card, ChatCircleIcon)),
              ].sort(
                (a, b) =>
                  (communityOrder[a.id] ?? 2) - (communityOrder[b.id] ?? 2),
              ),
              label(departure),
            ],
          },
        ]
      : [
          // Personal space keeps the local default profile with the community
          // cards that supply their own address, such as Pair mobile.
          {
            id: "personal",
            label: i18n._(msg`Personal space`),
            lang: i18n.locale,
            sections: [
              label(profile),
              ...cards
                .filter((card) => card.personal && !card.group && !card.section)
                .map((card) => section(card, ChatCircleIcon)),
            ],
          },
        ]),
    ...(administration.length > 0
      ? [
          {
            id: "administration",
            label: i18n._(msg`Community admin`),
            lang: i18n.locale,
            sections: administration,
          },
        ]
      : []),
    {
      id: "app",
      label: "Buzz",
      sections: [
        label(identity),
        // Paired command-line tools exist only in the desktop app.
        ...(isTauri() ? [label(security)] : []),
        ...app.filter((item) => item.id !== "updates").map(label),
        ...cards
          .filter((card) => card.group === "App")
          .map((card) => section(card)),
        ...app.filter((item) => item.id === "updates").map(label),
        ...(developerMode ? [label(developer)] : []),
      ],
    },
    {
      id: "plugins",
      label: i18n._(msg`Plugins`),
      lang: i18n.locale,
      sections: [
        label(plugins),
        ...cards
          .filter((card) => card.group === "Plugins")
          .map((card) => section(card))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    },
    ...[
      ...new Set(
        cards.flatMap((card) =>
          card.group && card.group !== "App" && card.group !== "Plugins"
            ? [card.group]
            : [],
        ),
      ),
    ].map((label) => ({
      id: `group:${label}`,
      label,
      sections: cards
        .filter((card) => card.group === label)
        .map((card) => section(card)),
    })),
  ];
  return {
    groups,
    sections: groups.flatMap((group) => group.sections),
    defaultSection: community ? "profile" : "appearance",
  };
}
