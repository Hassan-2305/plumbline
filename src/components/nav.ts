import {
  Activity,
  BarChart3,
  BookOpen,
  CircleCheck,
  FileText,
  Home,
  Image as ImageIcon,
  MessageSquareDot,
  PenLine,
  Plug,
  Quote,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_GROUPS: { label?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/content/new", label: "Create", icon: PenLine },
      { href: "/content", label: "Content", icon: FileText },
      { href: "/reviews", label: "Reviews", icon: MessageSquareDot },
      { href: "/approvals", label: "Approvals", icon: CircleCheck },
    ],
  },
  {
    label: "Brand",
    items: [
      { href: "/guidelines", label: "Guidelines", icon: BookOpen },
      { href: "/assets", label: "Brand Assets", icon: ImageIcon },
      { href: "/facts", label: "Approved Facts", icon: Quote },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/insights", label: "Insights", icon: BarChart3 },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/team", label: "Team & permissions", icon: Users },
      { href: "/integrations", label: "Integrations", icon: Plug },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
