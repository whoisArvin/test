export const airports = [
  { city: 'تهران', code: 'THR', name: 'فرودگاه مهرآباد' },
  { city: 'تهران', code: 'IKA', name: 'فرودگاه امام خمینی' },
  { city: 'کیش', code: 'KIH', name: 'فرودگاه کیش' },
  { city: 'مشهد', code: 'MHD', name: 'فرودگاه هاشمی‌نژاد' },
  { city: 'شیراز', code: 'SYZ', name: 'فرودگاه شهید دستغیب' },
  { city: 'استانبول', code: 'IST', name: 'فرودگاه استانبول' },
  { city: 'دبی', code: 'DXB', name: 'فرودگاه بین‌المللی دبی' },
] as const;
export function resolveLocation(value?: string): { city?: string; code?: string } {
  if (!value?.trim()) return {};
  const text = value.trim();
  const airport = airports.find((a) => a.code === text.toUpperCase() || a.name === text);
  return airport ? { city: airport.city, code: airport.code } : { city: text };
}
