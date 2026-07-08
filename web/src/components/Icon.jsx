import {
  LayoutDashboard, Store, Truck, Users, Droplet, Ambulance, ReceiptText,
  MessageSquare, Bell, ShieldCheck, Pill, FileText, HeartPulse, Menu, CircleUser,
  Inbox, TriangleAlert, Siren, Trash2, Wallet, TrendingUp, Package, PackageCheck,
  BadgePlus, CheckCircle2, ChefHat, Ban, Search, Phone, Plus,
} from 'lucide-react';

// Central icon set for the admin & pharmacy web panels — a thin wrapper over
// lucide-react so screens reference semantic names (<Icon name="orders" />)
// instead of remembering component names, and every icon shares one look.
const ICONS = {
  // navigation
  dashboard: LayoutDashboard,
  pharmacies: Store,
  vehicles: Truck,
  users: Users,
  blood: Droplet,
  ambulance: Ambulance,
  orders: ReceiptText,
  support: MessageSquare,
  bell: Bell,
  audit: ShieldCheck,
  medicines: Pill,
  documents: FileText,
  // chrome
  brand: HeartPulse,
  menu: Menu,
  user: CircleUser,
  search: Search,
  phone: Phone,
  trash: Trash2,
  plus: Plus,
  // states
  inbox: Inbox,
  warning: TriangleAlert,
  sos: Siren,
  // pharmacy KPIs / order statuses
  revenue: Wallet,
  trending: TrendingUp,
  package: Package,
  delivered: PackageCheck,
  new: BadgePlus,
  accepted: CheckCircle2,
  preparing: ChefHat,
  rejected: Ban,
};

export default function Icon({ name, size = 18, ...props }) {
  const Cmp = ICONS[name] || Bell;
  return <Cmp size={size} {...props} />;
}
