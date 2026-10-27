import { z } from 'zod';
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'تاریخ معتبر نیست'
  );
export const passengerSchema = z.object({
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  birthDate: isoDate.refine((v) => new Date(v) < new Date(), 'تاریخ تولد باید در گذشته باشد'),
  documentNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,20}$/),
});
export const credentialsSchema = z.object({
  email: z
    .email()
    .max(200)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(80).optional(),
});
export const searchSchema = z.object({
  product: z.enum(['FLIGHT', 'HOTEL', 'TOUR']).default('FLIGHT'),
  flightType: z.enum(['domestic', 'international']).optional(),
  origin: z.string().max(80).optional(),
  destination: z.string().max(80).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  quantity: z.coerce.number().int().min(1).max(9).default(1),
});
export const bookingSchema = z.object({
  items: z
    .array(
      z.object({
        offerId: z.string().min(1).max(100),
        startDate: isoDate,
        endDate: isoDate,
        quantity: z.number().int().min(1).max(9),
      })
    )
    .min(1)
    .max(6),
  passengers: z.array(passengerSchema).min(1).max(9),
  expectedTotalIrr: z.number().int().positive().max(2_000_000_000),
});
export type BookingInput = z.infer<typeof bookingSchema>;
export const tourSchema = z.object({
  title: z.string().min(3).max(120),
  subtitle: z.string().max(200),
  destination: z.string().min(2).max(80),
  priceIrr: z.number().int().min(10000).max(1_000_000_000),
  date: isoDate,
  total: z.number().int().min(1).max(500),
  published: z.boolean(),
  details: z.object({
    duration: z.string().max(80),
    transport: z.string().max(80),
    services: z.array(z.string().max(150)).max(20),
    itinerary: z.array(z.string().max(500)).max(30),
    rules: z.string().max(3000),
    documents: z.string().max(2000),
    manualConfirmation: z.boolean().default(false),
  }),
});
