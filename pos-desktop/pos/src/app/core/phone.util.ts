export interface Country {
  code: string;
  name: string;
  ar: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: '+962', name: 'Jordan', ar: 'الأردن', flag: '🇯🇴' },
  { code: '+966', name: 'Saudi Arabia', ar: 'السعودية', flag: '🇸🇦' },
  { code: '+971', name: 'UAE', ar: 'الإمارات', flag: '🇦🇪' },
  { code: '+965', name: 'Kuwait', ar: 'الكويت', flag: '🇰🇼' },
  { code: '+974', name: 'Qatar', ar: 'قطر', flag: '🇶🇦' },
  { code: '+973', name: 'Bahrain', ar: 'البحرين', flag: '🇧🇭' },
  { code: '+968', name: 'Oman', ar: 'عمان', flag: '🇴🇲' },
  { code: '+970', name: 'Palestine', ar: 'فلسطين', flag: '🇵🇸' },
  { code: '+20', name: 'Egypt', ar: 'مصر', flag: '🇪🇬' },
  { code: '+1', name: 'USA', ar: 'أمريكا', flag: '🇺🇸' },
];

/** Build canonical phone: +<code><digits without leading zeros> */
export function normalizePhone(code: string, num: string): string {
  const digits = String(num || '')
    .replace(/\D/g, '')
    .replace(/^0+/, '');
  return code + digits;
}

export function validPhone(code: string, num: string): boolean {
  return normalizePhone(code, num).replace(/\D/g, '').length >= 10;
}
