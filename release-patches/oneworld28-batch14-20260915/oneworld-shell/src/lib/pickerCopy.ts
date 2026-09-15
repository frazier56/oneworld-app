import type { Lang } from './i18n';

const en = {
  choose: 'Choose an option', search: 'Search…', searchOptions: 'Search options',
  empty: 'No matching options', date: 'Pick a date', time: 'Pick a time',
  hour: 'Hour', minute: 'Minute', previousMonth: 'Previous month', nextMonth: 'Next month',
};
type Copy = typeof en;
const es: Copy = {
  choose: 'Elija una opción', search: 'Buscar…', searchOptions: 'Buscar opciones',
  empty: 'No hay opciones coincidentes', date: 'Elige una fecha', time: 'Elige una hora',
  hour: 'Hora', minute: 'Minuto', previousMonth: 'Mes anterior', nextMonth: 'Mes siguiente',
};
const copy: Record<Lang, Copy> = {
  en, co: es, es,
  de: { choose: 'Option auswählen', search: 'Suchen…', searchOptions: 'Optionen suchen', empty: 'Keine passenden Optionen', date: 'Datum auswählen', time: 'Uhrzeit auswählen', hour: 'Stunde', minute: 'Minute', previousMonth: 'Vorheriger Monat', nextMonth: 'Nächster Monat' },
  ru: { choose: 'Выберите вариант', search: 'Поиск…', searchOptions: 'Поиск вариантов', empty: 'Подходящих вариантов нет', date: 'Выберите дату', time: 'Выберите время', hour: 'Час', minute: 'Минута', previousMonth: 'Предыдущий месяц', nextMonth: 'Следующий месяц' },
  zh: { choose: '选择选项', search: '搜索…', searchOptions: '搜索选项', empty: '没有匹配的选项', date: '选择日期', time: '选择时间', hour: '小时', minute: '分钟', previousMonth: '上个月', nextMonth: '下个月' },
  pt: { choose: 'Escolha uma opção', search: 'Buscar…', searchOptions: 'Buscar opções', empty: 'Nenhuma opção encontrada', date: 'Escolha uma data', time: 'Escolha um horário', hour: 'Hora', minute: 'Minuto', previousMonth: 'Mês anterior', nextMonth: 'Próximo mês' },
};
export const pickerCopy = (lang: Lang): Copy => copy[lang] ?? en;
export const pickerLocale = (lang: Lang): string => lang === 'co' ? 'es-CO' : lang;
