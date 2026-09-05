# Dot-notation audit
Scanned 265 files in src/
Total suspect hits: 166

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\unbilled-revenue-table.tsx
Hits: 26
- L55  `item.id`  — setCreatingId(item.id);
- L59  `invoice.id`  — router.push(`/dashboard/invoices/${invoice.id}`);
- L100  `item.id`  — const isCreating = creatingId === item.id;
- L102  `item.id`  — <TableRow key={item.id}>
- L104  `item.projectName`  — <div className="font-medium">{item.projectName}</div>
- L105  `item.customerName`  — {item.customerName && (
- L106  `item.customerName`  — <div className="text-xs text-muted-foreground">{item.customerName}</div>
- L110  `item.type`  — <Badge variant="outline" className={TYPE_COLOR[item.type]}>
- L111  `item.type`  — {TYPE_LABEL[item.type]}
- L115  `item.reason`  — <div className="line-clamp-2 text-sm">{item.reason}</div>
- L118  `item.amount`  — {formatCurrency(item.amount, item.currency)}
- L118  `item.currency`  — {formatCurrency(item.amount, item.currency)}
- L121  `item.recommendedAction`  — {item.recommendedAction}
- L184  `item.type`  — <Badge variant="outline" className={TYPE_COLOR[item.type]}>
- L185  `item.type`  — {TYPE_LABEL[item.type]}
- L194  `item.projectName`  — <p className="font-medium">{item.projectName}</p>
- L195  `item.customerName`  — {item.customerName && (
- L196  `item.customerName`  — <p className="text-sm text-muted-foreground">{item.customerName}</p>
- L202  `item.reason`  — <p className="text-sm">{item.reason}</p>
- L208  `item.amount`  — {formatCurrency(item.amount, item.currency)}
- L208  `item.currency`  — {formatCurrency(item.amount, item.currency)}
- L214  `item.recommendedAction`  — <p className="text-sm">{item.recommendedAction}</p>
- L217  `item.detail`  — {item.detail && (
- L220  `item.detail`  — <p className="text-sm">{item.detail}</p>
- L226  `item.projectId`  — {item.projectId && (
- L228  `item.projectId`  — <a href={`/dashboard/projects/${item.projectId}`}>

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\actions\unbilled-revenue.ts
Hits: 23
- L181  `item.projectId`  — where: { id: item.projectId, orgId },
- L196  `item.projectId`  — projectId: item.projectId,
- L200  `item.currency`  — currency: item.currency,
- L208  `item.amount`  — unitPrice: item.amount,
- L209  `item.sourceId`  — sku: item.sourceId,
- L228  `item.type`  — switch (item.type) {
- L230  `item.detail`  — return item.detail ? `Milestone: ${item.detail}` : "Completed milestone";
- L230  `item.detail`  — return item.detail ? `Milestone: ${item.detail}` : "Completed milestone";
- L232  `item.sourceNumber`  — return item.sourceNumber
- L233  `item.sourceNumber`  — ? `Change Order ${item.sourceNumber}${item.detail ? `: ${item.detail}` : ""}`
- L233  `item.detail`  — ? `Change Order ${item.sourceNumber}${item.detail ? `: ${item.detail}` : ""}`
- L233  `item.detail`  — ? `Change Order ${item.sourceNumber}${item.detail ? `: ${item.detail}` : ""}`
- L236  `item.detail`  — return item.detail ? `Reimbursable expense: ${item.detail}` : "Billable expense";
- L236  `item.detail`  — return item.detail ? `Reimbursable expense: ${item.detail}` : "Billable expense";
- L238  `item.detail`  — return item.detail ? `Time: ${item.detail}` : "Unbilled time";
- L238  `item.detail`  — return item.detail ? `Time: ${item.detail}` : "Unbilled time";
- L249  `item.type`  — if (item.type !== "approved_change_order") return;
- L252  `item.sourceId`  — where: { id: item.sourceId, orgId },
- L253  `invoice.id`  — data: { invoiceId: invoice.id },
- L267  `item.type`  — if (item.type !== "completed_milestone") return;
- L270  `item.sourceId`  — where: { id: item.sourceId, orgId },
- L271  `invoice.id`  — data: { status: "INVOICED", invoiceId: invoice.id },
- L278  `item.projectId`  — await revalidateWithLocale(`/dashboard/projects/${item.projectId}`);

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\dashboard.ts
Hits: 21
- L131  `d.getFullYear`  — const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
- L131  `d.getMonth`  — const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
- L268  `d.getFullYear`  — const start = new Date(d.getFullYear(), d.getMonth(), 1);
- L268  `d.getMonth`  — const start = new Date(d.getFullYear(), d.getMonth(), 1);
- L269  `d.getFullYear`  — const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
- L269  `d.getMonth`  — const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
- L288  `d.getMonth`  — label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`.slice(0, 8),
- L288  `d.getFullYear`  — label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`.slice(0, 8),
- L331  `p.id`  — id: `pay:${p.id}`,
- L333  `p.invoiceNumber`  — title: `Payment received${p.invoiceNumber ? ` for ${p.invoiceNumber}` : ""}`,
- L333  `p.invoiceNumber`  — title: `Payment received${p.invoiceNumber ? ` for ${p.invoiceNumber}` : ""}`,
- L334  `p.customerName`  — subtitle: p.customerName ?? undefined,
- L335  `p.amount`  — amount: roundMoney(p.amount),
- L336  `p.date`  — date: new Date(p.date),
- L342  `e.id`  — id: `exp:${e.id}`,
- L344  `e.vendor`  — title: `${e.vendor ?? e.category} expense`,
- L344  `e.category`  — title: `${e.vendor ?? e.category} expense`,
- L345  `e.amount`  — amount: roundMoney(e.amount),
- L346  `e.date`  — date: new Date(e.date),
- L365  `b.date`  — .sort((a, b) => b.date.getTime() - a.date.getTime())
- L365  `a.date`  — .sort((a, b) => b.date.getTime() - a.date.getTime())

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\project-edit-form.tsx
Hits: 15
- L69  `e.preventDefault`  — e.preventDefault();
- L110  `e.target`  — onChange={(e) => setName(e.target.value)}
- L119  `e.target`  — onChange={(e) => setNumber(e.target.value)}
- L129  `e.target`  — onChange={(e) => setCustomerId(e.target.value || "")}
- L146  `e.target`  — onChange={(e) => setAddress(e.target.value)}
- L158  `e.target`  — onChange={(e) => setStartDate(e.target.value)}
- L167  `e.target`  — onChange={(e) => setEndDate(e.target.value)}
- L176  `e.target`  — onChange={(e) => setEstCompletionDate(e.target.value)}
- L189  `e.target`  — onChange={(e) => setContractValue(e.target.value)}
- L199  `e.target`  — onChange={(e) => setTaxRate(e.target.value)}
- L209  `e.target`  — onChange={(e) => setRetainageRate(e.target.value)}
- L222  `e.target`  — onChange={(e) => setDepositRequired(e.target.value)}
- L230  `e.target`  — onChange={(e) => setPaymentTerms(e.target.value)}
- L238  `e.target`  — onChange={(e) => setProjectManager(e.target.value)}
- L248  `e.target`  — onChange={(e) => setStatus(e.target.value)}

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\project-form.tsx
Hits: 14
- L62  `e.preventDefault`  — e.preventDefault();
- L130  `e.target`  — onChange={(e) => setName(e.target.value)}
- L141  `e.target`  — onChange={(e) => setNumber(e.target.value)}
- L165  `c.id`  — <SelectItem key={c.id} value={c.id}>
- L165  `c.id`  — <SelectItem key={c.id} value={c.id}>
- L179  `e.target`  — onChange={(e) => setAddress(e.target.value)}
- L192  `e.target`  — onChange={(e) => setStartDate(e.target.value)}
- L201  `e.target`  — onChange={(e) => setEndDate(e.target.value)}
- L211  `e.target`  — onChange={(e) => setProjectManager(e.target.value)}
- L228  `e.target`  — onChange={(e) => setContractValue(e.target.value)}
- L241  `e.target`  — onChange={(e) => setEstCompletionDate(e.target.value)}
- L271  `e.target`  — onChange={(e) => setTaxRate(e.target.value)}
- L284  `e.target`  — onChange={(e) => setRetainageRate(e.target.value)}
- L298  `e.target`  — onChange={(e) => setDepositRequired(e.target.value)}

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\actions\team.ts
Hits: 9
- L23  `user.organizationId`  — if (!user.organizationId) {
- L26  `user.organizationId`  — const orgId = user.organizationId;
- L28  `user.email`  — if (!(await checkRateLimit(`team-invite:${user.email}`, 10, 60 * 60 * 1000))) {
- L32  `input.email`  — const normalizedEmail = input.email.toLowerCase().trim();
- L61  `input.role`  — role: input.role,
- L128  `user.id`  — actorId: user.id,
- L129  `user.email`  — actorEmail: user.email,
- L130  `user.role`  — actorRole: user.role,
- L133  `input.role`  — metadata: { invitedEmail: normalizedEmail, role: input.role },

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\dashboard\customers\page.tsx
Hits: 6
- L96  `c.outstandingBalance`  — const totalOutstanding = customers.reduce((sum: number, c: any) => sum + (c.outstandingBalance || 0), 0);
- L97  `c.totalInvoiced`  — const totalInvoiced = customers.reduce((sum: number, c: any) => sum + (c.totalInvoiced || 0), 0);
- L171  `c.id`  — <TableRow key={c.id}>
- L173  `c.id`  — <Link href={`/dashboard/customers/${c.id}`} className="hover:underline">
- L176  `c.company`  — {c.company && (
- L177  `c.company`  — <p className="text-xs text-muted-foreground">{c.company}</p>

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\schemas.ts
Hits: 6
- L102  `z.infer`  — export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
- L103  `z.infer`  — export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
- L104  `z.infer`  — export type CreateEstimateInput = z.infer<typeof CreateEstimateSchema>;
- L105  `z.infer`  — export type CreateChangeOrderInput = z.infer<typeof CreateChangeOrderSchema>;
- L106  `z.infer`  — export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;
- L109  `z.ZodError`  — export function formatZodError(err: z.ZodError): string {

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\dashboard\team\page.tsx
Hits: 5
- L83  `m.id`  — <TableRow key={m.id}>
- L92  `m.email`  — <TableCell>{m.email ?? "—"}</TableCell>
- L94  `m.id`  — <Badge variant={m.id === user.id ? "default" : "secondary"}>
- L94  `user.id`  — <Badge variant={m.id === user.id ? "default" : "secondary"}>
- L95  `m.role`  — {m.role}

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\numbering.ts
Hits: 4
- L9  `prisma.invoice`  — const last = await prisma.invoice.findFirst({
- L21  `prisma.estimate`  — const last = await prisma.estimate.findFirst({
- L33  `prisma.changeOrder`  — const last = await prisma.changeOrder.findFirst({
- L45  `prisma.project`  — const last = await prisma.project.findFirst({

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\invoices\upload-logo\route.ts
Hits: 3
- L16  `user.organizationId`  — if (!user.organizationId) {
- L24  `form.get`  — const rawFile = form.get("file");
- L46  `user.organizationId`  — const key = `org/${user.organizationId}/logos/${Date.now()}-${Math.random()

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\stripe\webhook\route.ts
Hits: 3
- L63  `customer.subscription`  — case "customer.subscription.created":
- L64  `customer.subscription`  — case "customer.subscription.updated": {
- L69  `customer.subscription`  — case "customer.subscription.deleted": {

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\support\page.tsx
Hits: 3
- L27  `invoice.com`  — description: "Reach our support team at privacy@prince-invoice.com.",
- L28  `invoice.com`  — href: "mailto:privacy@prince-invoice.com",
- L35  `invoice.com`  — href: "mailto:privacy@prince-invoice.com?subject=Feedback",

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\catalog-management-view.tsx
Hits: 3
- L343  `e.g`  — placeholder="e.g. Website Design, Logo Creation"
- L409  `e.g`  — placeholder="e.g. Services, Materials"
- L421  `e.g`  — placeholder="e.g. WEB-001"

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\team\invite-team-member-form.tsx
Hits: 3
- L31  `result.error`  — setError(result.error);
- L63  `e.target`  — onChange={(e) => setName(e.target.value)}
- L73  `e.target`  — onChange={(e) => setEmail(e.target.value)}

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\dashboard\projects\page.tsx
Hits: 2
- L264  `e.target`  — url.set("status", e.target.value);
- L282  `e.target`  — url.set("customer", e.target.value);

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\privacy\page.tsx
Hits: 2
- L308  `invoice.com`  — Email: <a href="mailto:privacy@prince-invoice.com" className="text-foreground underline">privacy@prince-invoice.com</a>
- L308  `invoice.com`  — Email: <a href="mailto:privacy@prince-invoice.com" className="text-foreground underline">privacy@prince-invoice.com</a>

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\timer-bar.tsx
Hits: 2
- L186  `e.g`  — <Input id="duration" type="number" name="duration" step="0.1" min="0" placeholder="e.g. 2.5" required />
- L194  `e.g`  — <Input id="hourlyRate" type="number" name="hourlyRate" step="0.01" min="0" placeholder="e.g. 100" />

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\addresses\route.ts
Hits: 1
- L46  `session.user`  — if (!(await checkRateLimit(`api:addresses:${session.user.email}`, 30, 60 * 1000))) {

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\auth\[...nextauth]\route.ts
Hits: 1
- L73  `e.g`  — "Set it to the fully qualified public origin (e.g. https://your-app.up.railway.app).",

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\catalog\items\route.ts
Hits: 1
- L51  `session.user`  — if (!(await checkRateLimit(`api:catalog:${session.user.email}`, 30, 60 * 1000))) {

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\estimates\check-expiration\route.ts
Hits: 1
- L31  `session.user`  — if (!(await checkRateLimit(`check-expiration:${session.user.email}`, 10, 60 * 1000))) {

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\api\estimates\[id]\send\route.ts
Hits: 1
- L20  `session.user`  — if (!(await checkRateLimit(`api:estimates:send:${session.user.email}`, 20, 60 * 1000))) {

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\dashboard\layout.tsx
Hits: 1
- L131  `item.icon`  — <item.icon className="h-4 w-4" />

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\dashboard\page.tsx
Hits: 1
- L79  `data.locale`  — const formatLocale = resolveFormatterLocale(data.locale);

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\dashboard\settings\page.tsx
Hits: 1
- L176  `s.icon`  — <s.icon className="h-4 w-4" />

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\estimate\[number]\page.tsx
Hits: 1
- L264  `estimate.css`  — {/* Document shell — clean data-table layout, see estimate.css. */}

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\layout.tsx
Hits: 1
- L10  `estimate.css`  — import "@/styles/estimate.css";

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\page.tsx
Hits: 1
- L94  `f.icon`  — <f.icon className="h-5 w-5" />

## C:\Users\New User\Desktop\prince-invoice-generator\src\app\[locale]\terms\page.tsx
Hits: 1
- L89  `invoice.com`  — or email privacy@prince-invoice.com.

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\address-book.tsx
Hits: 1
- L96  `e.g`  — placeholder="e.g. Home, Office"

## C:\Users\New User\Desktop\prince-invoice-generator\src\components\invoice-form.tsx
Hits: 1
- L289  `e.g`  — placeholder="e.g. INV-001 or custom name"

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\db-drift.ts
Hits: 1
- L35  `e.g`  — msg["includes"]("42704") || // undefined_object (e.g. missing enum type)

## C:\Users\New User\Desktop\prince-invoice-generator\src\lib\r2.ts
Hits: 1
- L8  `e.g`  — export const R2_PUBLIC_URL = process["env"]["R2_PUBLIC_URL"]; // e.g. https://<id>.r2.cloudflarestorage.com
