import { asLocale } from "@/content/i18n";
import { Finder } from "@/tools/ai-opportunity-finder/Finder";
import { manifest } from "@/tools/ai-opportunity-finder/manifest";

export default function Page({ locale }: { locale: 'en' | 'de' }) {
  return <Finder locale={locale} />;
}
