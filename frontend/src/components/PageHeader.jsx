import { Top, Text } from '@toss/tds-mobile';
import { adaptive } from '@toss/tds-colors';

export function PageHeader({ title, subtitle }) {
  return <Top
    style={{ padding: '20px 0 0' }}
    title={<Top.TitleParagraph size={22} color={adaptive.grey900} style={{ fontSize: 22, lineHeight: 1.4 }}>{title}</Top.TitleParagraph>}
    subtitleBottom={subtitle ? <Text color={adaptive.grey600} typography="t6" style={{ fontSize: 14, lineHeight: 1.5 }}>{subtitle}</Text> : undefined}
  />;
}
