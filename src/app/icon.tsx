import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
// Render at request time. next/og loads font assets via Satori which fails
// when the route is statically prerendered in the current build environment.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Icon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "#0f172a",
					color: "#f8fafc",
					fontSize: 20,
					fontWeight: 700,
					borderRadius: 6,
				}}
			>
				P
			</div>
		),
		{ ...size }
	);
}
