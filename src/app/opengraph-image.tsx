import { ImageResponse } from "next/og";

export const alt = "Prince — Construction Invoice Generator";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function OpengraphImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					padding: 72,
					background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
					color: "#f8fafc",
					fontFamily: "system-ui, sans-serif",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, fontWeight: 600, opacity: 0.85 }}>
					<div
						style={{
							width: 56,
							height: 56,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							background: "#f8fafc",
							color: "#0f172a",
							borderRadius: 12,
							fontSize: 32,
							fontWeight: 800,
						}}
					>
						P
					</div>
					Prince Invoice Generator
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
					<div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
						Invoicing built for contractors.
					</div>
					<div style={{ fontSize: 30, opacity: 0.75, maxWidth: 900 }}>
						Progress billing, change orders, retainage, and customer management — all in one place.
					</div>
				</div>
				<div style={{ fontSize: 22, opacity: 0.6 }}>princeinvoicegenerator.up.railway.app</div>
			</div>
		),
		{ ...size }
	);
}
