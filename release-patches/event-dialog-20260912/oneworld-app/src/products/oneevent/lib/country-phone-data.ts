/**
 * International country phone data: dial codes, emoji flags, and format masks.
 * '#' represents a digit placeholder in the mask.
 */

export interface CountryPhone {
  name: string;
  iso: string;
  code: string;    // e.g. "+1"
  flag: string;    // emoji flag
  mask: string;    // e.g. "(###) ###-####"
  maxDigits: number;
}

export const countryPhoneData: CountryPhone[] = [
  // North America
  { name: "United States", iso: "US", code: "+1", flag: "🇺🇸", mask: "(###) ###-####", maxDigits: 10 },
  { name: "Canada", iso: "CA", code: "+1", flag: "🇨🇦", mask: "(###) ###-####", maxDigits: 10 },
  { name: "Mexico", iso: "MX", code: "+52", flag: "🇲🇽", mask: "## #### ####", maxDigits: 10 },

  // Central America & Caribbean
  { name: "Costa Rica", iso: "CR", code: "+506", flag: "🇨🇷", mask: "#### ####", maxDigits: 8 },
  { name: "Panama", iso: "PA", code: "+507", flag: "🇵🇦", mask: "#### ####", maxDigits: 8 },
  { name: "Dominican Republic", iso: "DO", code: "+1", flag: "🇩🇴", mask: "(###) ###-####", maxDigits: 10 },
  { name: "Puerto Rico", iso: "PR", code: "+1", flag: "🇵🇷", mask: "(###) ###-####", maxDigits: 10 },
  { name: "Jamaica", iso: "JM", code: "+1", flag: "🇯🇲", mask: "(###) ###-####", maxDigits: 10 },
  { name: "Guatemala", iso: "GT", code: "+502", flag: "🇬🇹", mask: "#### ####", maxDigits: 8 },
  { name: "Honduras", iso: "HN", code: "+504", flag: "🇭🇳", mask: "#### ####", maxDigits: 8 },
  { name: "El Salvador", iso: "SV", code: "+503", flag: "🇸🇻", mask: "#### ####", maxDigits: 8 },
  { name: "Cuba", iso: "CU", code: "+53", flag: "🇨🇺", mask: "# ### ####", maxDigits: 8 },
  { name: "Trinidad and Tobago", iso: "TT", code: "+1", flag: "🇹🇹", mask: "(###) ###-####", maxDigits: 10 },

  // South America
  { name: "Colombia", iso: "CO", code: "+57", flag: "🇨🇴", mask: "### ### ####", maxDigits: 10 },
  { name: "Brazil", iso: "BR", code: "+55", flag: "🇧🇷", mask: "(##) #####-####", maxDigits: 11 },
  { name: "Argentina", iso: "AR", code: "+54", flag: "🇦🇷", mask: "## ####-####", maxDigits: 10 },
  { name: "Chile", iso: "CL", code: "+56", flag: "🇨🇱", mask: "# #### ####", maxDigits: 9 },
  { name: "Peru", iso: "PE", code: "+51", flag: "🇵🇪", mask: "### ### ###", maxDigits: 9 },
  { name: "Venezuela", iso: "VE", code: "+58", flag: "🇻🇪", mask: "###-#######", maxDigits: 10 },
  { name: "Ecuador", iso: "EC", code: "+593", flag: "🇪🇨", mask: "## ### ####", maxDigits: 9 },
  { name: "Uruguay", iso: "UY", code: "+598", flag: "🇺🇾", mask: "## ### ###", maxDigits: 8 },
  { name: "Paraguay", iso: "PY", code: "+595", flag: "🇵🇾", mask: "### ### ###", maxDigits: 9 },
  { name: "Bolivia", iso: "BO", code: "+591", flag: "🇧🇴", mask: "#### ####", maxDigits: 8 },

  // Europe
  { name: "United Kingdom", iso: "GB", code: "+44", flag: "🇬🇧", mask: "#### ######", maxDigits: 10 },
  { name: "Germany", iso: "DE", code: "+49", flag: "🇩🇪", mask: "#### #######", maxDigits: 11 },
  { name: "France", iso: "FR", code: "+33", flag: "🇫🇷", mask: "# ## ## ## ##", maxDigits: 9 },
  { name: "Spain", iso: "ES", code: "+34", flag: "🇪🇸", mask: "### ## ## ##", maxDigits: 9 },
  { name: "Italy", iso: "IT", code: "+39", flag: "🇮🇹", mask: "### ### ####", maxDigits: 10 },
  { name: "Portugal", iso: "PT", code: "+351", flag: "🇵🇹", mask: "### ### ###", maxDigits: 9 },
  { name: "Netherlands", iso: "NL", code: "+31", flag: "🇳🇱", mask: "## ########", maxDigits: 10 },
  { name: "Belgium", iso: "BE", code: "+32", flag: "🇧🇪", mask: "### ## ## ##", maxDigits: 9 },
  { name: "Switzerland", iso: "CH", code: "+41", flag: "🇨🇭", mask: "## ### ## ##", maxDigits: 9 },
  { name: "Austria", iso: "AT", code: "+43", flag: "🇦🇹", mask: "### #######", maxDigits: 10 },
  { name: "Sweden", iso: "SE", code: "+46", flag: "🇸🇪", mask: "##-### ## ##", maxDigits: 9 },
  { name: "Norway", iso: "NO", code: "+47", flag: "🇳🇴", mask: "### ## ###", maxDigits: 8 },
  { name: "Denmark", iso: "DK", code: "+45", flag: "🇩🇰", mask: "## ## ## ##", maxDigits: 8 },
  { name: "Finland", iso: "FI", code: "+358", flag: "🇫🇮", mask: "## ### ####", maxDigits: 9 },
  { name: "Ireland", iso: "IE", code: "+353", flag: "🇮🇪", mask: "## ### ####", maxDigits: 9 },
  { name: "Poland", iso: "PL", code: "+48", flag: "🇵🇱", mask: "### ### ###", maxDigits: 9 },
  { name: "Czech Republic", iso: "CZ", code: "+420", flag: "🇨🇿", mask: "### ### ###", maxDigits: 9 },
  { name: "Romania", iso: "RO", code: "+40", flag: "🇷🇴", mask: "### ### ###", maxDigits: 9 },
  { name: "Hungary", iso: "HU", code: "+36", flag: "🇭🇺", mask: "## ### ####", maxDigits: 9 },
  { name: "Greece", iso: "GR", code: "+30", flag: "🇬🇷", mask: "### ### ####", maxDigits: 10 },
  { name: "Turkey", iso: "TR", code: "+90", flag: "🇹🇷", mask: "### ### ####", maxDigits: 10 },
  { name: "Ukraine", iso: "UA", code: "+380", flag: "🇺🇦", mask: "## ### ####", maxDigits: 9 },
  { name: "Croatia", iso: "HR", code: "+385", flag: "🇭🇷", mask: "## ### ####", maxDigits: 9 },

  // Russia & CIS
  { name: "Russia", iso: "RU", code: "+7", flag: "🇷🇺", mask: "### ###-##-##", maxDigits: 10 },
  { name: "Kazakhstan", iso: "KZ", code: "+7", flag: "🇰🇿", mask: "### ###-##-##", maxDigits: 10 },

  // Middle East
  { name: "United Arab Emirates", iso: "AE", code: "+971", flag: "🇦🇪", mask: "## ### ####", maxDigits: 9 },
  { name: "Saudi Arabia", iso: "SA", code: "+966", flag: "🇸🇦", mask: "## ### ####", maxDigits: 9 },
  { name: "Israel", iso: "IL", code: "+972", flag: "🇮🇱", mask: "##-###-####", maxDigits: 9 },
  { name: "Qatar", iso: "QA", code: "+974", flag: "🇶🇦", mask: "#### ####", maxDigits: 8 },
  { name: "Kuwait", iso: "KW", code: "+965", flag: "🇰🇼", mask: "#### ####", maxDigits: 8 },
  { name: "Egypt", iso: "EG", code: "+20", flag: "🇪🇬", mask: "### ### ####", maxDigits: 10 },

  // Africa
  { name: "South Africa", iso: "ZA", code: "+27", flag: "🇿🇦", mask: "## ### ####", maxDigits: 9 },
  { name: "Nigeria", iso: "NG", code: "+234", flag: "🇳🇬", mask: "### ### ####", maxDigits: 10 },
  { name: "Kenya", iso: "KE", code: "+254", flag: "🇰🇪", mask: "### ######", maxDigits: 9 },
  { name: "Ghana", iso: "GH", code: "+233", flag: "🇬🇭", mask: "## ### ####", maxDigits: 9 },
  { name: "Morocco", iso: "MA", code: "+212", flag: "🇲🇦", mask: "## #### ###", maxDigits: 9 },
  { name: "Ethiopia", iso: "ET", code: "+251", flag: "🇪🇹", mask: "## ### ####", maxDigits: 9 },
  { name: "Tanzania", iso: "TZ", code: "+255", flag: "🇹🇿", mask: "### ### ###", maxDigits: 9 },

  // Asia
  { name: "China", iso: "CN", code: "+86", flag: "🇨🇳", mask: "### #### ####", maxDigits: 11 },
  { name: "Japan", iso: "JP", code: "+81", flag: "🇯🇵", mask: "##-####-####", maxDigits: 10 },
  { name: "South Korea", iso: "KR", code: "+82", flag: "🇰🇷", mask: "##-####-####", maxDigits: 10 },
  { name: "India", iso: "IN", code: "+91", flag: "🇮🇳", mask: "##### #####", maxDigits: 10 },
  { name: "Pakistan", iso: "PK", code: "+92", flag: "🇵🇰", mask: "### #######", maxDigits: 10 },
  { name: "Bangladesh", iso: "BD", code: "+880", flag: "🇧🇩", mask: "#### ######", maxDigits: 10 },
  { name: "Indonesia", iso: "ID", code: "+62", flag: "🇮🇩", mask: "###-####-####", maxDigits: 11 },
  { name: "Philippines", iso: "PH", code: "+63", flag: "🇵🇭", mask: "### ### ####", maxDigits: 10 },
  { name: "Vietnam", iso: "VN", code: "+84", flag: "🇻🇳", mask: "## ### ## ##", maxDigits: 9 },
  { name: "Thailand", iso: "TH", code: "+66", flag: "🇹🇭", mask: "##-###-####", maxDigits: 9 },
  { name: "Malaysia", iso: "MY", code: "+60", flag: "🇲🇾", mask: "##-### ####", maxDigits: 9 },
  { name: "Singapore", iso: "SG", code: "+65", flag: "🇸🇬", mask: "#### ####", maxDigits: 8 },
  { name: "Taiwan", iso: "TW", code: "+886", flag: "🇹🇼", mask: "### ### ###", maxDigits: 9 },
  { name: "Hong Kong", iso: "HK", code: "+852", flag: "🇭🇰", mask: "#### ####", maxDigits: 8 },

  // Oceania
  { name: "Australia", iso: "AU", code: "+61", flag: "🇦🇺", mask: "### ### ###", maxDigits: 9 },
  { name: "New Zealand", iso: "NZ", code: "+64", flag: "🇳🇿", mask: "##-### ####", maxDigits: 9 },
];

/** Format a phone number string using a country's mask pattern */
export function formatPhoneByMask(value: string, mask: string, maxDigits: number): string {
  const digits = value.replace(/\D/g, "").slice(0, maxDigits);
  if (digits.length === 0) return "";
  
  let result = "";
  let digitIndex = 0;
  
  for (let i = 0; i < mask.length && digitIndex < digits.length; i++) {
    if (mask[i] === "#") {
      result += digits[digitIndex];
      digitIndex++;
    } else {
      result += mask[i];
      // If next char in input would go to a separator, add it
    }
  }
  
  return result;
}

/** Find a country by ISO code */
export function findCountryByIso(iso: string): CountryPhone | undefined {
  return countryPhoneData.find((c) => c.iso === iso);
}

/** Get placeholder from mask (replace # with digit positions) */
export function getPlaceholder(mask: string): string {
  let digitCount = 0;
  return mask.replace(/#/g, () => {
    digitCount++;
    return String(digitCount % 10);
  });
}
