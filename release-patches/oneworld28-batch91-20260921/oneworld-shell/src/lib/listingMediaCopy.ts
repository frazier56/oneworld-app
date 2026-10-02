/**
 * LISTING MEDIA COPY — the other four languages for the shared media stack (20 Sep 2026).
 * ============================================================================================
 * `PublicVideoDeck`, `MediaChoices`, `FeedMedia`, `FeedVideoPlayer` and `PublicVideoViewer` write
 * their strings with `W(lang, en, es)`. English and Spanish are inline; German, Russian, Chinese
 * and Portuguese come from the runtime dictionary, and until today NOTHING registered them —
 * OneHome's copy files never covered these components, so a German host saw "Cover photo" and
 * "Add videos" in English on an otherwise German form. A half-translated screen is a defect.
 *
 * The stack is shell now and serves rent, sale and events, so the words live here, once, and
 * register the moment the shell is imported. Product copy files may still override a key.
 *
 * Template strings (`${file.name} exceeds 300 MB.`) cannot be dictionary keys, so the five
 * uploader errors stay English/Spanish; they are error text, read once, and the number is the
 * message.
 */
import { registerCopy } from "./i18n";

const de: Record<string, string> = {
  "Add videos": "Videos hinzufügen",
  "Back": "Zurück",
  "Change": "Ändern",
  "Close": "Schließen",
  "Contact host": "Gastgeber kontaktieren",
  "Cover photo": "Titelfoto",
  "Cover": "Titelbild",
  "Done": "Fertig",
  "Leads the listing and your profile cards.": "Steht am Anfang des Inserats und Ihrer Profilkarten.",
  "Leads the event page and your cards.": "Steht am Anfang der Eventseite und Ihrer Karten.",
  "Listing video": "Video des Inserats",
  "Next": "Weiter",
  "Open photo": "Foto öffnen",
  "One photo or video leads your card in Discover. Videos play silently.": "Ein Foto oder Video steht am Anfang Ihrer Karte in Entdecken. Videos laufen ohne Ton.",
  "Play video": "Video abspielen",
  "Please sign in again before uploading.": "Bitte melden Sie sich vor dem Hochladen erneut an.",
  "Previous": "Zurück",
  "Remove video": "Video entfernen",
  "Same as cover": "Wie das Titelbild",
  "Share": "Teilen",
  "Swipe for more · tap to watch with sound": "Wischen für mehr · Tippen für Ton",
  "Uploading": "Wird hochgeladen",
  "Videos": "Videos",
  "View listing": "Inserat ansehen",
  "View event": "Event ansehen",
  "What the feed shows first": "Was der Feed zuerst zeigt",
};

const pt: Record<string, string> = {
  "Add videos": "Adicionar vídeos",
  "Back": "Voltar",
  "Change": "Alterar",
  "Close": "Fechar",
  "Contact host": "Falar com o anfitrião",
  "Cover photo": "Foto de capa",
  "Cover": "Capa",
  "Done": "Concluído",
  "Leads the listing and your profile cards.": "Abre o anúncio e os cartões do seu perfil.",
  "Leads the event page and your cards.": "Abre a página do evento e os seus cartões.",
  "Listing video": "Vídeo do anúncio",
  "Next": "Próximo",
  "Open photo": "Abrir foto",
  "One photo or video leads your card in Discover. Videos play silently.": "Uma foto ou vídeo abre o seu cartão em Descobrir. Os vídeos tocam sem som.",
  "Play video": "Reproduzir vídeo",
  "Please sign in again before uploading.": "Entre novamente antes de enviar.",
  "Previous": "Anterior",
  "Remove video": "Remover vídeo",
  "Same as cover": "Igual à capa",
  "Share": "Compartilhar",
  "Swipe for more · tap to watch with sound": "Deslize para ver mais · toque para ouvir",
  "Uploading": "Enviando",
  "Videos": "Vídeos",
  "View listing": "Ver anúncio",
  "View event": "Ver evento",
  "What the feed shows first": "O que o feed mostra primeiro",
};

const ru: Record<string, string> = {
  "Add videos": "Добавить видео",
  "Back": "Назад",
  "Change": "Изменить",
  "Close": "Закрыть",
  "Contact host": "Написать хозяину",
  "Cover photo": "Фото обложки",
  "Cover": "Обложка",
  "Done": "Готово",
  "Leads the listing and your profile cards.": "Открывает объявление и карточки вашего профиля.",
  "Leads the event page and your cards.": "Открывает страницу события и ваши карточки.",
  "Listing video": "Видео объявления",
  "Next": "Далее",
  "Open photo": "Открыть фото",
  "One photo or video leads your card in Discover. Videos play silently.": "Одно фото или видео открывает вашу карточку в разделе «Обзор». Видео играет без звука.",
  "Play video": "Смотреть видео",
  "Please sign in again before uploading.": "Войдите снова, прежде чем загружать.",
  "Previous": "Назад",
  "Remove video": "Удалить видео",
  "Same as cover": "Как обложка",
  "Share": "Поделиться",
  "Swipe for more · tap to watch with sound": "Листайте дальше · нажмите, чтобы смотреть со звуком",
  "Uploading": "Загрузка",
  "Videos": "Видео",
  "View listing": "Открыть объявление",
  "View event": "Открыть событие",
  "What the feed shows first": "Что лента показывает первым",
};

const zh: Record<string, string> = {
  "Add videos": "添加视频",
  "Back": "返回",
  "Change": "更换",
  "Close": "关闭",
  "Contact host": "联系房东",
  "Cover photo": "封面照片",
  "Cover": "封面",
  "Done": "完成",
  "Leads the listing and your profile cards.": "显示在房源和您的个人资料卡片最前面。",
  "Leads the event page and your cards.": "显示在活动页面和您的卡片最前面。",
  "Listing video": "房源视频",
  "Next": "下一个",
  "Open photo": "打开照片",
  "One photo or video leads your card in Discover. Videos play silently.": "一张照片或一段视频显示在“发现”中您的卡片最前面。视频静音播放。",
  "Play video": "播放视频",
  "Please sign in again before uploading.": "上传前请重新登录。",
  "Previous": "上一个",
  "Remove video": "移除视频",
  "Same as cover": "与封面相同",
  "Share": "分享",
  "Swipe for more · tap to watch with sound": "滑动查看更多 · 点击有声观看",
  "Uploading": "上传中",
  "Videos": "视频",
  "View listing": "查看房源",
  "View event": "查看活动",
  "What the feed shows first": "信息流最先显示的内容",
};

registerCopy({ de, pt, ru, zh });
