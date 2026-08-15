/**
 * School registry for the RAG chatbot.
 *
 * `code` matches the `school` field written into Chroma metadata by
 * scripts/rag/chunk.ts, so these codes are what metadata filters key on.
 * `aliases` are matched against the user's question to decide which school a
 * question is about — they must be lowercase and unaccented, because
 * detectSchools() strips diacritics before comparing (students routinely type
 * "bach khoa ha noi" without tone marks).
 *
 * Keep aliases specific enough not to collide: "bach khoa" alone matches HUST,
 * HCMUT and DUT, so each of those needs a city qualifier.
 */

export interface School {
  code: string
  name: string
  aliases: string[]
}

export const SCHOOLS: School[] = [
  {
    code: 'HUST',
    name: 'Đại học Bách khoa Hà Nội',
    aliases: ['hust', 'bach khoa ha noi', 'bk ha noi', 'dhbk ha noi', 'bkhn'],
  },
  {
    code: 'HCMUT',
    name: 'Trường Đại học Bách khoa TP.HCM',
    aliases: ['hcmut', 'bach khoa tphcm', 'bach khoa tp hcm', 'bach khoa ho chi minh', 'bk tphcm'],
  },
  {
    code: 'DUT',
    name: 'Trường Đại học Bách khoa Đà Nẵng',
    aliases: ['dut', 'bach khoa da nang', 'bk da nang'],
  },
  {
    code: 'USTH',
    name: 'Trường Đại học Khoa học và Công nghệ Hà Nội',
    aliases: ['usth', 'khoa hoc va cong nghe ha noi', 'dai hoc viet phap'],
  },
  {
    code: 'VINUNI',
    name: 'Trường Đại học VinUni',
    aliases: ['vinuni', 'vin uni', 'vinuniversity'],
  },
  {
    code: 'VJU',
    name: 'Trường Đại học Việt Nhật',
    aliases: ['vju', 'viet nhat', 'vietnam japan'],
  },
  {
    code: 'UET',
    name: 'Trường Đại học Công nghệ, ĐHQG Hà Nội',
    aliases: ['uet', 'cong nghe dhqg', 'dai hoc cong nghe ha noi'],
  },
  {
    code: 'HUS',
    name: 'Trường Đại học Khoa học Tự nhiên, ĐHQG Hà Nội',
    aliases: ['hus', 'khoa hoc tu nhien', 'tu nhien dhqg'],
  },
  {
    code: 'HNUE',
    name: 'Trường Đại học Sư phạm Hà Nội',
    aliases: ['hnue', 'su pham ha noi', 'sp ha noi'],
  },
  {
    code: 'HAUI',
    name: 'Trường Đại học Công nghiệp Hà Nội',
    aliases: ['haui', 'cong nghiep ha noi'],
  },
  {
    code: 'HUCE',
    name: 'Trường Đại học Xây dựng Hà Nội',
    aliases: ['huce', 'xay dung ha noi', 'dai hoc xay dung'],
  },
  {
    code: 'HUMG',
    name: 'Trường Đại học Mỏ - Địa chất',
    aliases: ['humg', 'mo dia chat', 'mo - dia chat'],
  },
  {
    code: 'TDTU',
    name: 'Trường Đại học Tôn Đức Thắng',
    aliases: ['tdtu', 'ton duc thang'],
  },
  {
    code: 'PHENIKAA',
    name: 'Đại học Phenikaa',
    aliases: ['phenikaa', 'pheinika'],
  },
  {
    code: 'UEH',
    name: 'Đại học Kinh tế TP.HCM',
    aliases: ['ueh', 'kinh te tphcm', 'kinh te tp hcm', 'kinh te ho chi minh'],
  },
  {
    code: 'QNU',
    name: 'Trường Đại học Quy Nhơn',
    aliases: ['qnu', 'quy nhon'],
  },
  {
    code: 'FULBRIGHT',
    name: 'Đại học Fulbright Việt Nam',
    aliases: ['fulbright', 'fullbright'],
  },
  {
    code: 'BUV',
    name: 'Đại học Anh Quốc Việt Nam (BUV)',
    aliases: ['buv', 'anh quoc viet nam', 'british university'],
  },
  {
    code: 'PTIT',
    name: 'Học viện Công nghệ Bưu chính Viễn thông',
    aliases: ['ptit', 'buu chinh vien thong', 'hoc vien cong nghe buu chinh'],
  },
  {
    code: 'IUH',
    name: 'Trường Đại học Công nghiệp TP.HCM',
    aliases: ['iuh', 'cong nghiep tphcm', 'cong nghiep tp hcm'],
  },
  {
    code: 'HCMOU',
    name: 'Trường Đại học Mở TP.HCM',
    aliases: ['hcmou', 'dai hoc mo tphcm', 'dai hoc mo tp hcm', 'truong dai hoc mo'],
  },
  {
    code: 'HCMIU',
    name: 'Trường Đại học Quốc tế, ĐHQG TP.HCM',
    aliases: ['hcmiu', 'dai hoc quoc te', 'quoc te dhqg'],
  },
  {
    code: 'VNUIS',
    name: 'Khoa Quốc tế, ĐHQG Hà Nội (VNU-IS)',
    aliases: ['vnuis', 'vnu-is', 'khoa quoc te dhqg'],
  },
  {
    code: 'UIT',
    name: 'Trường Đại học Công nghệ Thông tin, ĐHQG TP.HCM',
    aliases: ['uit', 'cong nghe thong tin dhqg', 'cntt tphcm'],
  },
  {
    code: 'NTU',
    name: 'Trường Đại học Nha Trang',
    aliases: ['ntu', 'nha trang'],
  },
]

const BY_CODE = new Map(SCHOOLS.map((s) => [s.code, s]))

export function getSchool(code: string): School | undefined {
  return BY_CODE.get(code.toUpperCase())
}

/** Lowercase and strip Vietnamese diacritics for tolerant matching. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Which schools does this question mention?
 *
 * Returns every match, since a question can compare two schools. An empty
 * result means "no school named" — search the whole corpus rather than
 * guessing one.
 */
export function detectSchools(question: string): string[] {
  const normalized = normalize(question)
  const found = new Set<string>()
  for (const school of SCHOOLS) {
    for (const alias of school.aliases) {
      // Word-boundary match so short codes like "iu" or "ou" don't fire inside
      // unrelated words.
      const pattern = new RegExp(`(^|[^a-z0-9])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
      if (pattern.test(normalized)) {
        found.add(school.code)
        break
      }
    }
  }
  return [...found]
}
