/**
 * Where to find Erez and the community.
 *
 * Kept as data in one place so the footer, the settings screen and the MCP
 * server all render the same links, and a change lands everywhere at once.
 */

export const CONTACT = {
  name: 'ארז טל-שיר',
  nameEn: 'Erez Tal-Shir',
  links: [
    {
      id: 'community',
      label: 'קהילת מ-0 ל-AI',
      labelEn: 'The Zero-to-AI community',
      desc: 'קהילת הוואטסאפ הפתוחה - שאלות, תשובות ופרומפטים שעובדים.',
      descEn: 'The open WhatsApp community: questions, answers and prompts that work.',
      url: 'https://chat.whatsapp.com/Ja5mg2IDxAxG2O0FKl3c7S',
      icon: 'whatsapp',
      primary: true,
    },
    {
      id: 'group',
      label: 'קבוצת הוואטסאפ',
      labelEn: 'The WhatsApp group',
      desc: 'הקבוצה הייעודית סביב הפורטל.',
      descEn: 'The dedicated group around the portal.',
      url: 'https://chat.whatsapp.com/CTG7ptNi8zFBoAtyOSyYFm',
      icon: 'users',
    },
    {
      id: 'linkedin',
      label: 'לינקדאין',
      labelEn: 'LinkedIn',
      desc: 'כתיבה שוטפת על AI, בידול ואסטרטגיה.',
      descEn: 'Regular writing on AI, positioning and strategy.',
      url: 'https://www.linkedin.com/in/erez-tal-shir/',
      icon: 'linkedin',
    },
    {
      id: 'whatsapp-direct',
      label: 'הודעה ישירה',
      labelEn: 'Message directly',
      desc: 'ווטסאפ אישי, לשאלות שלא מתאימות לקהילה.',
      descEn: 'Direct WhatsApp, for anything that does not belong in the group.',
      // wa.me wants the international form without a plus or leading zero.
      url: 'https://wa.me/972524545963',
      icon: 'phone',
    },
  ],
};

export function contactLink(id) {
  return CONTACT.links.find((link) => link.id === id) ?? null;
}
