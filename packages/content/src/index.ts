export const company = {
  name: '沖縄介護センター',
  legalName: '有限会社 沖縄介護センター',
  address: '沖縄県那覇市松川531-1',
  postalCode: '902-0062',
  telephone: '098-882-1156',
  phoneHref: 'tel:0988821156',
  website: 'https://www.okinawakaigo.jp/',
  instagram: 'https://www.instagram.com/okinawakaigo/',
} as const;

export const jobs = [
  {
    id: 'helper', name: '訪問介護員', shortName: 'ヘルパー', category: '暮らしを支える',
    description: '住み慣れた家で、その人らしく。日々の生活に寄り添い、一人ひとりに必要なケアを届けます。',
    duties: ['ご自宅での身体介護・生活援助', '障がいのある方の暮らしのサポート', '通院などの外出支援'],
    qualification: 'お持ちの介護資格・運転免許について、相談時にお聞かせください。',
    note: '訪問先や担当する支援の内容を、説明会で具体的にお伝えします。',
  },
  {
    id: 'care-manager', name: 'ケアマネジャー', shortName: 'ケアマネジャー', category: '暮らしをつなぐ',
    description: 'ご本人とご家族の想いを聞き、必要な支援へつなぐ。地域の事業所と連携し、暮らしの選択肢を広げます。',
    duties: ['ご本人・ご家族の相談対応', 'ケアプランの作成', '関係機関との連絡・調整'],
    qualification: '介護支援専門員の資格・これまでのご経験についてお聞かせください。',
    note: '担当業務や勤務方法について、ご希望とあわせてご相談ください。',
  },
  {
    id: 'counselor', name: '相談支援専門員', shortName: '相談員', category: 'これからを考える',
    description: '「こんなふうに暮らしたい」を一緒に考える。障がいのある方の希望に向き合い、福祉サービスの利用を支えます。',
    duties: ['暮らしや福祉サービスについての相談対応', 'サービス等利用計画の作成', '関係機関との連携・モニタリング'],
    qualification: '相談支援に関する研修の修了状況・ご経験をお聞かせください。',
    note: '現在の募集状況を含め、担当者からご案内します。',
  },
] as const;

export type JobId = typeof jobs[number]['id'];
export const nextSteps = [
  { id: 'orientation', label: '説明会に参加したい' },
  { id: 'visit', label: '職場を見学したい' },
  { id: 'interview', label: '面接について相談したい' },
] as const;

export const benefits = [
  { icon: 'people', title: 'ひとりで抱えない、チームの支え。', description: '新人指導担当者による段階的な指導と、職員同士で相談できる体制を整えています。訪問先でも、チームとのつながりを大切に。' },
  { icon: 'book', title: '学びたい気持ちを、次の力に。', description: '資格取得に向けた研修費用の補助や、オンライン研修を用意。日々の経験と学びを、専門職としての成長につなげます。' },
  { icon: 'leaf', title: 'ケアに向き合う時間を、もっと。', description: '介護ソフトと連動した端末で、記録や情報共有の負担を軽減。働く人を支える仕組みから、よりよいケアを考えています。' },
] as const;

export const faqs = [
  { question: '応募するか決めていなくても、相談できますか？', answer: 'はい。仕事内容や働き方を知るところから、お話ししましょう。説明会・見学・面接のうち、ご希望のステップをお伝えください。日程や実施方法は担当者がご案内します。' },
  { question: 'ブランクがある場合や、経験が浅い場合は？', answer: 'これまでのご経験とお持ちの資格をお聞かせください。担当する業務に必要な資格や、入職後の指導について、個別にご案内します。' },
  { question: '給与や勤務時間を、応募前に確認できますか？', answer: 'はい。職種・資格・勤務形態によって条件が異なります。給与、手当、勤務時間、休日など、最新の募集条件は担当者にご確認いただけます。希望する働き方もあわせてお伝えください。' },
  { question: '旅行の付き添いの仕事もありますか？', answer: '沖縄介護センターでは、旅行時の介護・看護の付き添いも行っています。担当に必要な資格や経験、現在の募集状況はお問い合わせください。' },
] as const;
