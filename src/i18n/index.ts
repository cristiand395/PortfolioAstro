import english from "@i18n/en.json"
import spanish from "@i18n/es.json"

export const geti18n = ({ currentLocale = "en" }: { currentLocale: string | undefined }) => {
  return currentLocale === 'es' ? spanish : english;
}
