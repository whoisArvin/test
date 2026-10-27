# Assets and dependencies

Vazirmatn is self-hosted from `@fontsource/vazirmatn` (SIL Open Font License). Icons use `lucide-react` (ISC). The local shadcn-style Button uses Radix Slot, class-variance-authority and Tailwind utilities; components.json records the project configuration.

Local illustrative travel photography was fetched over verified HTTPS from:

- https://github.com/codewithsadee/tourly/tree/master/assets/images
- `travel-hero.jpg`: hero-banner.jpg, Portofino, Italy.
- `istanbul.jpg`: popular-1.jpg, Venice (illustrative, **not a photograph of Istanbul**).
- `dubai.jpg`: popular-2.jpg, Dubai.
- `shiraz.jpg`: popular-3.jpg, Kyoto (illustrative, **not a photograph of Shiraz**).
- `kish.jpg`: packege-1.jpg, tropical island (illustrative, **not a photograph of Kish or a contracted hotel**).
- `hotel.jpg`: packege-2.jpg, illustrative accommodation.

Original repository licensing and the photographer's rights must be reviewed before commercial use. Replace the illustrative cards with licensed destination/hotel-specific assets before launch. UI and alt text identify photos as inspirational; no supplier-hotel image accuracy is claimed. Earlier unused camping images from adrianhajdin/travel_ui_ux were removed.

No external font or image network access is required to run the prepared application. npm package integrity remains enabled. `deepmerge-ts` is overridden to 8.0.2 to address GHSA-ggr8-5vv4-36mx in Prisma's configuration dependency; generate, migrations, tests and build must pass when this override is changed.
