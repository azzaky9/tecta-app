import type { ReactNode } from "react";
import { LayoutGridIcon, SendIcon } from "lucide-react";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		items: [
			{
				title: "Overview",
				path: "/dashboard",
				icon: <LayoutGridIcon />,
			},
		],
	},
	{
		label: "Payroll",
		items: [
			{
				title: "Disbursements",
				path: "/dashboard/disbursements",
				icon: <SendIcon />,
			},
			// "Claim Salary" (/dashboard/claim) tab hidden — admin shouldn't see it,
			// claiming now happens on the public /claim page. Route/code kept as-is
			// for future use, just not linked from the sidebar.
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];
