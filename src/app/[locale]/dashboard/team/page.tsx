import { requireUser, requireFeature } from "@/lib/org";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { logServerError } from "@/lib/errors";
import { getTranslations } from "next-intl/server";

export default async function TeamPage({ params }: { params: { locale: string } }) {
  await requireFeature("multipleUsers");
  const user = await requireUser();
  if (!user || !user["organizationId"]) return null;
  const orgId = user["organizationId"];
  const t = await getTranslations("team");

  let members;
  try {
    members = await db["user"]["findMany"]({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    logServerError("TeamPage", err);
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("role")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members["map"]((m) => (
                <TableRow key={m["id"]}>
                  <TableCell className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {(m["name"] ?? "U")["slice"](0, 2)["toUpperCase"]()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{m["name"] ?? "—"}</span>
                  </TableCell>
                  <TableCell>{m["email"] ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m["id"] === user["id"] ? "default" : "secondary"}>
                      {m["role"]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        {t("invitePlaceholder")}
      </p>
    </div>
  );
}
