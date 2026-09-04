/**
 * Inline JSON-LD for the marketing site.
 *
 * The previous implementation passed this through Next.js `metadata.other`,
 * which surfaces as a `<meta>` tag rather than a `<script type="application/ld+json">`.
 * Google Rich Results does not parse `<meta>` for JSON-LD, so the structured
 * data was effectively invisible. Rendering it as a real script element lets
 * search engines and other consumers read it directly.
 */
export function JsonLd() {
	const data = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "Prince Invoice Generator",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web",
		description:
			"Professional invoicing, estimates, change orders, and retainage tracking for construction contractors.",
		url: "https://princeinvoicegenerator.up.railway.app",
		provider: {
			"@type": "Organization",
			name: "Prince Invoice Generator",
		},
	};
	return (
		<script
			type="application/ld+json"
			// The payload is static and built at render time. JSON.stringify is
			// safe here because none of the fields are user input.
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}
