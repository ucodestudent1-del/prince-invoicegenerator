import { Badge } from "@/components/ui/badge";
import type { Permission } from "@/lib/permissions";

const PRETTY: Record<string, string> = {
	view: "view",
	create: "create",
	edit: "edit",
	delete: "delete",
	send: "send",
	approve: "approve",
	void: "void",
	export: "export",
};

function shorten(perm: Permission): string {
	const dot = perm["indexOf"](".");
	if (dot < 0) return perm;
	const resource = perm["slice"](0, dot);
	const action = perm["slice"](dot + 1);
	return `${resource}.${PRETTY[action] ?? action}`;
}

export function PermissionBadgeList({ permissions }: { permissions: Permission[] }) {
	if (!permissions["length"]) {
		return <span className="text-sm text-muted-foreground">—</span>;
	}
	const visible = permissions["slice"](0, 6);
	return (
		<div className="flex flex-wrap items-center gap-1">
			{visible["map"]((p) => (
				<Badge key={p} variant="outline" className="font-mono text-xs">
					{shorten(p)}
				</Badge>
			))}
			{permissions["length"] > 6 && (
				<Badge variant="outline" className="text-xs">
					+{permissions["length"] - 6} more
				</Badge>
			)}
		</div>
	);
}
