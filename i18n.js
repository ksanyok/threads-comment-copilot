// UI localization. The Russian string is the key; ru returns it as-is, en/uk from
// the table below. Language is taken from the browser (chrome.i18n.getUILanguage).
// Loaded in the content script, popup, options and (importScripts) the worker.
var TCA_LANG = (function () {
  try {
    var l = ((chrome && chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || 'en').toLowerCase();
    if (l.indexOf('uk') === 0 || l.indexOf('ua') === 0) return 'uk';
    if (l.indexOf('ru') === 0 || l.indexOf('be') === 0) return 'ru';
    return 'en';
  } catch (e) { return 'en'; }
})();

var TCA_MSG = {
  // --- actions / buttons ---
  'Авто': { en: 'Auto', uk: 'Авто' },
  'С юмором': { en: 'Witty', uk: 'З гумором' },
  'Менторски': { en: 'Mentor', uk: 'Менторськи' },
  'Вставить в ответ': { en: 'Insert into reply', uk: 'Вставити у відповідь' },
  'Открыть пост': { en: 'Open post', uk: 'Відкрити пост' },
  'Открыть': { en: 'Open', uk: 'Відкрити' },
  'Написать': { en: 'Write', uk: 'Написати' },
  'Написано': { en: 'Written', uk: 'Написано' },
  'Черновик': { en: 'Draft', uk: 'Чернетка' },
  'Копировать': { en: 'Copy', uk: 'Копіювати' },
  'Скопировать': { en: 'Copy', uk: 'Скопіювати' },
  'Ещё': { en: 'More', uk: 'Ще' },
  'Очистить': { en: 'Clear', uk: 'Очистити' },
  'Про ': { en: 'About ', uk: 'Про ' },
  '✓ Вставлено': { en: '✓ Inserted', uk: '✓ Вставлено' },
  '📋 Cmd+V': { en: '📋 Cmd+V', uk: '📋 Cmd+V' },
  // --- card ---
  'Комментарий для @': { en: 'Comment for @', uk: 'Коментар для @' },
  '⏳ Пишу комментарий…': { en: '⏳ Writing a comment…', uk: '⏳ Пишу коментар…' },
  '⚠️ Нет ключа OpenRouter — откройте ⚙ настройки.': { en: '⚠️ No OpenRouter key — open ⚙ settings.', uk: '⚠️ Немає ключа OpenRouter — відкрийте ⚙ налаштування.' },
  'нет ответа': { en: 'no response', uk: 'немає відповіді' },
  'Текст ляжет в окно ответа Threads. «Опублікувати» — вы сами.': { en: 'The text goes into the Threads reply box. You press “Post”.', uk: 'Текст ляже у вікно відповіді Threads. «Опублікувати» — ви самі.' },
  'Это пост из фонового поиска. Откройте его и вставьте черновик.': { en: 'This post is from the background search. Open it and paste the draft.', uk: 'Це пост із фонового пошуку. Відкрийте його та вставте чернетку.' },
  'Готово. Проверьте и нажмите «Опублікувати» в Threads.': { en: 'Done. Review and press “Post” in Threads.', uk: 'Готово. Перевірте та натисніть «Опублікувати» у Threads.' },
  'Скопировано в буфер. Откройте ответ и вставьте (Cmd/Ctrl+V).': { en: 'Copied to clipboard. Open the reply and paste (Cmd/Ctrl+V).', uk: 'Скопійовано в буфер. Відкрийте відповідь і вставте (Cmd/Ctrl+V).' },
  'Черновик скопирован. Откройте пост и вставьте (Cmd/Ctrl+V).': { en: 'Draft copied. Open the post and paste (Cmd/Ctrl+V).', uk: 'Чернетку скопійовано. Відкрийте пост і вставте (Cmd/Ctrl+V).' },
  'Сформировать комментарий и вставить в ответ': { en: 'Draft a comment and insert it into the reply', uk: 'Сформувати коментар і вставити у відповідь' },
  // --- launcher / sidebar ---
  'Подходящие ветки для комментария': { en: 'Threads worth replying to', uk: 'Гілки, де варто відповісти' },
  ' новых тематических веток — открыть': { en: ' new matching threads — open', uk: ' нових тематичних гілок — відкрити' },
  '🧵 Ветки для комментария': { en: '🧵 Threads to reply to', uk: '🧵 Гілки для коментаря' },
  'На странице': { en: 'On page', uk: 'На сторінці' },
  'Все': { en: 'All', uk: 'Усі' },
  'Найдено': { en: 'Found', uk: 'Знайдено' },
  'Найдено ': { en: 'Found ', uk: 'Знайдено ' },
  'Продукт': { en: 'Product', uk: 'Продукт' },
  'История': { en: 'History', uk: 'Історія' },
  'Пост': { en: 'Post', uk: 'Пост' },
  'Искать по теме (даже то, чего нет в ленте):': { en: 'Search by topic (even what is not in your feed):', uk: 'Шукати за темою (навіть те, чого немає у стрічці):' },
  'Подходящих веток на странице нет. Откройте поиск по теме выше или прокрутите ленту.': { en: 'No matching threads on this page. Open a topic search above or scroll the feed.', uk: 'Підхожих гілок на сторінці немає. Відкрийте пошук за темою вище або прокрутіть стрічку.' },
  'Постов на странице не найдено. Прокрутите ленту.': { en: 'No posts found on this page. Scroll the feed.', uk: 'Постів на сторінці не знайдено. Прокрутіть стрічку.' },
  'Загрузка…': { en: 'Loading…', uk: 'Завантаження…' },
  'Фоновый поиск пока ничего не нашёл. Он идёт раз в N минут (⚙), либо нажмите «🔔 Поискать новые сейчас» в окне расширения.': { en: 'The background search has not found anything yet. It runs every N minutes (⚙), or press “🔔 Search now” in the popup.', uk: 'Фоновий пошук поки нічого не знайшов. Він іде раз на N хвилин (⚙), або натисніть «🔔 Пошукати зараз» у вікні розширення.' },
  ' найдено': { en: ' found', uk: ' знайдено' },
  'тема': { en: 'topic', uk: 'тема' },
  'пост': { en: 'post', uk: 'пост' },
  '✓ написано': { en: '✓ written', uk: '✓ написано' },
  'написано': { en: 'written', uk: 'написано' },
  'только что': { en: 'just now', uk: 'щойно' },
  ' мин': { en: ' min', uk: ' хв' },
  ' ч': { en: ' h', uk: ' год' },
  ' дн': { en: ' d', uk: ' дн' },
  ' записей': { en: ' entries', uk: ' записів' },
  'Пока пусто. Здесь будут комментарии, которые вы уже написали.': { en: 'Empty for now. Comments you have written will appear here.', uk: 'Поки порожньо. Тут будуть коментарі, які ви вже написали.' },
  // --- product / post tabs ---
  'Выберите продукт — покажу посты на странице, где о нём уместно написать, и сформирую комментарий с акцентом на него.': { en: 'Pick a product — I’ll show on-page posts where it fits and draft a comment focused on it.', uk: 'Оберіть продукт — покажу пости на сторінці, де про нього доречно написати, і сформую коментар з акцентом на ньому.' },
  'На странице нет постов под «': { en: 'No on-page posts for “', uk: 'На сторінці немає постів під «' },
  '». Откройте поиск по теме (выше) и прокрутите ленту.': { en: '”. Open a topic search (above) and scroll the feed.', uk: '». Відкрийте пошук за темою (вище) і прокрутіть стрічку.' },
  'Пост себе в ленту. Нажмите «Запропонувати теми», выберите тему — сформирую пост в вашем стиле. Публикуете сами.': { en: 'A post for your own feed. Press “Suggest topics”, pick one — I’ll draft a post in your style. You publish it.', uk: 'Пост у власну стрічку. Натисніть «Запропонувати теми», оберіть тему — сформую пост у вашому стилі. Публікуєте самі.' },
  'Запропонувати теми': { en: 'Suggest topics', uk: 'Запропонувати теми' },
  '…или своя тема для поста': { en: '…or your own post topic', uk: '…або своя тема для поста' },
  'Сгенерировать пост': { en: 'Generate post', uk: 'Згенерувати пост' },
  '⏳ Подбираю темы…': { en: '⏳ Suggesting topics…', uk: '⏳ Підбираю теми…' },
  'Не удалось подобрать. Впишите тему вручную ниже.': { en: 'Could not suggest. Type a topic manually below.', uk: 'Не вдалося підібрати. Впишіть тему вручну нижче.' },
  'Пост: ': { en: 'Post: ', uk: 'Пост: ' },
  '⏳ Пишу пост…': { en: '⏳ Writing a post…', uk: '⏳ Пишу пост…' },
  'Скопируйте и вставьте в окно нового поста Threads. Публикуете вы сами.': { en: 'Copy and paste it into the new-post box in Threads. You publish it.', uk: 'Скопіюйте та вставте у вікно нового поста Threads. Публікуєте ви самі.' },
  // chip labels that were Russian
  'Стартапы': { en: 'Startups', uk: 'Стартапи' },
  'Дети': { en: 'Kids', uk: 'Діти' },
  'Приложения': { en: 'Apps', uk: 'Додатки' },
  // --- popup ---
  '🧵 Комментарии Threads': { en: '🧵 Threads Comments', uk: '🧵 Коментарі Threads' },
  'Настройки': { en: 'Settings', uk: 'Налаштування' },
  'Открой ленту или поиск Threads по своей теме — расширение подберёт подходящие ветки. Или выбери тему ниже:': { en: 'Open your Threads feed or a topic search — the extension finds matching threads. Or pick a topic below:', uk: 'Відкрий стрічку або пошук Threads за темою — розширення підбере підхожі гілки. Або обери тему нижче:' },
  '🔄 Показать подходящие на странице': { en: '🔄 Show matches on this page', uk: '🔄 Показати підхожі на сторінці' },
  '🔔 Поискать новые в фоне сейчас': { en: '🔔 Search for new ones now', uk: '🔔 Пошукати нові у фоні зараз' },
  'или впишите текст вручную': { en: 'or paste text manually', uk: 'або впишіть текст вручну' },
  'Вставьте сюда пост, на который пишем комментарий…': { en: 'Paste the post you want to comment on…', uk: 'Вставте сюди пост, на який пишемо коментар…' },
  'Сформировать комментарий': { en: 'Draft a comment', uk: 'Сформувати коментар' },
  'пост мне в ленту': { en: 'a post for my feed', uk: 'пост у мою стрічку' },
  'Нажмите «Запропонувати теми» — подберу темы в вашем стиле и языке. Или впишите свою. Публикуете сами.': { en: 'Press “Suggest topics” — I’ll suggest topics in your style and language. Or type your own. You publish it.', uk: 'Натисніть «Запропонувати теми» — підберу теми у вашому стилі та мові. Або впишіть свою. Публікуєте самі.' },
  '💡 Запропонувати теми': { en: '💡 Suggest topics', uk: '💡 Запропонувати теми' },
  'Не задан ключ OpenRouter. ': { en: 'No OpenRouter key set. ', uk: 'Не задано ключ OpenRouter. ' },
  'Открыть настройки': { en: 'Open settings', uk: 'Відкрити налаштування' },
  'Открыл поиск Threads. Подождите пару секунд, прокрутите ленту и нажмите «Показать подходящие».': { en: 'Opened Threads search. Wait a couple of seconds, scroll the feed and press “Show matches”.', uk: 'Відкрив пошук Threads. Зачекайте пару секунд, прокрутіть стрічку та натисніть «Показати підхожі».' },
  '⏳ Читаю страницу…': { en: '⏳ Reading the page…', uk: '⏳ Читаю сторінку…' },
  'Откройте Threads, чтобы подобрать ветки. ': { en: 'Open Threads to find threads. ', uk: 'Відкрийте Threads, щоб підібрати гілки. ' },
  'Открыть Threads': { en: 'Open Threads', uk: 'Відкрити Threads' },
  'Не удалось прочитать страницу. Обновите вкладку Threads (она должна быть открыта и прокручена).': { en: 'Could not read the page. Refresh the Threads tab (it must be open and scrolled).', uk: 'Не вдалося прочитати сторінку. Оновіть вкладку Threads (вона має бути відкрита та прокручена).' },
  'Подходящих веток на этой странице не нашлось. Прокрутите ленту/поиск по теме и повторите.': { en: 'No matching threads on this page. Scroll the feed / topic search and try again.', uk: 'Підхожих гілок на цій сторінці не знайшлося. Прокрутіть стрічку/пошук за темою та повторіть.' },
  ' подходящих веток на странице:': { en: ' matching threads on this page:', uk: ' підхожих гілок на сторінці:' },
  '↗ Открыть': { en: '↗ Open', uk: '↗ Відкрити' },
  '✨ Комментарий': { en: '✨ Comment', uk: '✨ Коментар' },
  '✨ Черновик': { en: '✨ Draft', uk: '✨ Чернетка' },
  '📨 Вставить в ответ': { en: '📨 Insert into reply', uk: '📨 Вставити у відповідь' },
  '✓ В Threads': { en: '✓ In Threads', uk: '✓ У Threads' },
  '📋 Готово — Cmd+V': { en: '📋 Done — Cmd+V', uk: '📋 Готово — Cmd+V' },
  '↗ Открыть и вставить': { en: '↗ Open & paste', uk: '↗ Відкрити і вставити' },
  'Вставьте текст поста в поле ниже.': { en: 'Paste the post text in the field below.', uk: 'Вставте текст поста в поле нижче.' },
  '📋 Скопировать': { en: '📋 Copy', uk: '📋 Скопіювати' },
  '✓ Скопировано': { en: '✓ Copied', uk: '✓ Скопійовано' },
  '↻ Ещё': { en: '↻ More', uk: '↻ Ще' },
  '⏳ Ищу новые посты по вашим темам в фоне…': { en: '⏳ Searching for new posts on your topics…', uk: '⏳ Шукаю нові пости за вашими темами…' },
  'Не удалось запустить поиск. Перезагрузите расширение.': { en: 'Could not start the search. Reload the extension.', uk: 'Не вдалося запустити пошук. Перезавантажте розширення.' },
  'Поиск уже идёт, подождите.': { en: 'A search is already running, please wait.', uk: 'Пошук уже триває, зачекайте.' },
  'Поиск выключен в настройках (⚙).': { en: 'Search is turned off in settings (⚙).', uk: 'Пошук вимкнено в налаштуваннях (⚙).' },
  '🔔 Нашёл ': { en: '🔔 Found ', uk: '🔔 Знайшов ' },
  ' новых по теме «': { en: ' new on “', uk: ' нових за темою «' },
  '». Список ниже:': { en: '”. List below:', uk: '». Список нижче:' },
  'Новых по теме «': { en: 'No new ones on “', uk: 'Нових за темою «' },
  '» сейчас нет. Темы чередуются. Раньше найденное — ниже:': { en: '” right now. Topics rotate. Earlier finds below:', uk: '» зараз немає. Теми чергуються. Раніше знайдене — нижче:' },
  'Ошибка: ': { en: 'Error: ', uk: 'Помилка: ' },
  ' найдено в фоне': { en: ' found in background', uk: ' знайдено у фоні' },
  'Список найденного очищен.': { en: 'Found list cleared.', uk: 'Список знайденого очищено.' },
  // --- options ---
  'Не удалось загрузить модели (': { en: 'Could not load models (', uk: 'Не вдалося завантажити моделі (' },
  '). Можно вписать id вручную в поиск и выбрать.': { en: '). You can type a model id in the search and pick it.', uk: '). Можна вписати id вручну в пошук і обрати.' },
  'Ничего не найдено.': { en: 'Nothing found.', uk: 'Нічого не знайдено.' },
  'Сохранено ✓': { en: 'Saved ✓', uk: 'Збережено ✓' },
  'вход': { en: 'in', uk: 'вхід' },
  'выход': { en: 'out', uk: 'вихід' },
  // --- background / errors ---
  'Пустой ответ модели.': { en: 'Empty model response.', uk: 'Порожня відповідь моделі.' },
  'Не задан ключ OpenRouter. Откройте настройки расширения (⚙).': { en: 'No OpenRouter key. Open the extension settings (⚙).', uk: 'Не задано ключ OpenRouter. Відкрийте налаштування розширення (⚙).' },
  // --- HTML-embedded fragments (translated whole) ---
  '<span>написано</span>': { en: '<span>written</span>', uk: '<span>написано</span>' },
  '<span>Очистить</span>': { en: '<span>Clear</span>', uk: '<span>Очистити</span>' },
  '🗑 Очистить': { en: '🗑 Clear', uk: '🗑 Очистити' },
  '<div class="tca-status">⏳ Пишу комментарий…</div>': { en: '<div class="tca-status">⏳ Writing a comment…</div>', uk: '<div class="tca-status">⏳ Пишу коментар…</div>' },
  '<div class="tca-status">⏳ Пишу пост…</div>': { en: '<div class="tca-status">⏳ Writing a post…</div>', uk: '<div class="tca-status">⏳ Пишу пост…</div>' },
  '<div class="tca-sb-empty">Загрузка…</div>': { en: '<div class="tca-sb-empty">Loading…</div>', uk: '<div class="tca-sb-empty">Завантаження…</div>' },
  '<div class="tca-sb-lbl">⏳ Подбираю темы…</div>': { en: '<div class="tca-sb-lbl">⏳ Suggesting topics…</div>', uk: '<div class="tca-sb-lbl">⏳ Підбираю теми…</div>' },
  '<div class="tca-sb-lbl">Не удалось подобрать. Впишите тему вручную ниже.</div>': { en: '<div class="tca-sb-lbl">Could not suggest. Type a topic manually below.</div>', uk: '<div class="tca-sb-lbl">Не вдалося підібрати. Впишіть тему вручну нижче.</div>' },
  '<div class="status">⏳ Пишу комментарий…</div>': { en: '<div class="status">⏳ Writing a comment…</div>', uk: '<div class="status">⏳ Пишу коментар…</div>' },
  '<div class="status" style="margin-top:9px">⏳ Пишу комментарий…</div>': { en: '<div class="status" style="margin-top:9px">⏳ Writing a comment…</div>', uk: '<div class="status" style="margin-top:9px">⏳ Пишу коментар…</div>' },
  '<div class="status" style="margin-top:9px">⏳ Пишу пост…</div>': { en: '<div class="status" style="margin-top:9px">⏳ Writing a post…</div>', uk: '<div class="status" style="margin-top:9px">⏳ Пишу пост…</div>' },
  '<div class="status err">Нет ключа OpenRouter — откройте ⚙</div>': { en: '<div class="status err">No OpenRouter key — open ⚙</div>', uk: '<div class="status err">Немає ключа OpenRouter — відкрийте ⚙</div>' },
  '<div class="status err" style="margin-top:9px">Нет ключа OpenRouter — откройте ⚙</div>': { en: '<div class="status err" style="margin-top:9px">No OpenRouter key — open ⚙</div>', uk: '<div class="status err" style="margin-top:9px">Немає ключа OpenRouter — відкрийте ⚙</div>' },
  '<div class="pr">вход <b>': { en: '<div class="pr">in <b>', uk: '<div class="pr">вхід <b>' },
  '</b> · выход <b>': { en: '</b> · out <b>', uk: '</b> · вихід <b>' },
  '🧵 $1 новых постов по теме: $2': { en: '🧵 $1 new posts on: $2', uk: '🧵 $1 нових постів за темою: $2' },
  // --- options page ---
  'Пишет комментарии и посты в вашем голосе. Вы проверяете и публикуете сами.': { en: 'Writes comments and posts in your voice. You review and publish yourself.', uk: 'Пише коментарі та пости вашим голосом. Ви перевіряєте та публікуєте самі.' },
  'Модель ИИ': { en: 'AI model', uk: 'Модель ШІ' },
  'Рекомендуемые': { en: 'Recommended', uk: 'Рекомендовані' },
  'Загрузка моделей…': { en: 'Loading models…', uk: 'Завантаження моделей…' },
  'Цены за 1M токенов: ввод / вывод. Актуальный список из OpenRouter.': { en: 'Prices per 1M tokens: input / output. Live list from OpenRouter.', uk: 'Ціни за 1M токенів: вхід / вихід. Актуальний список з OpenRouter.' },
  'Ваш ник в Threads (чтобы не предлагать свои же посты)': { en: 'Your Threads handle (so your own posts are not suggested)', uk: 'Ваш нік у Threads (щоб не пропонувати власні пости)' },
  'ваш ник без @': { en: 'your handle without @', uk: 'ваш нік без @' },
  'Голос / манера': { en: 'Voice / style', uk: 'Голос / манера' },
  'Правила и продукты': { en: 'Rules and products', uk: 'Правила та продукти' },
  'Язык комментариев': { en: 'Comment language', uk: 'Мова коментарів' },
  'auto — как в посте': { en: 'auto — match the post', uk: 'auto — як у пості' },
  'Поиск: gemini, gpt, claude, llama, deepseek…': { en: 'Search: gemini, gpt, claude, llama, deepseek…', uk: 'Пошук: gemini, gpt, claude, llama, deepseek…' },
  'Авто-поиск: искать новые тематические посты в фоне и слать уведомления': { en: 'Auto-search: find new matching posts in the background and notify', uk: 'Авто-пошук: шукати нові тематичні пости у фоні та надсилати сповіщення' },
  'Раз в N минут открывает скрытую вкладку поиска Threads по вашим темам, ищет новые ветки и уведомляет. Ничего не публикует.': { en: 'Every N minutes it opens a hidden Threads search tab for your topics, finds new threads and notifies you. It never publishes anything.', uk: 'Раз на N хвилин відкриває приховану вкладку пошуку Threads за вашими темами, шукає нові гілки та сповіщає. Нічого не публікує.' },
  'Интервал авто-поиска, минут': { en: 'Auto-search interval, minutes', uk: 'Інтервал авто-пошуку, хвилин' },
  'Сохранить': { en: 'Save', uk: 'Зберегти' },
  'Тон по умолчанию': { en: 'Default tone', uk: 'Тон за замовчуванням' },
  'Авто (умный — на шутки шутка, на вопрос польза)': { en: 'Auto (smart — joke for jokes, value for questions)', uk: 'Авто (розумний — на жарт жарт, на питання користь)' },
  'Юмор в приоритете': { en: 'Humor first', uk: 'Гумор у пріоритеті' },
  'Нейтрально': { en: 'Neutral', uk: 'Нейтрально' },
  'В карточке комментария тон можно переопределить под каждый ответ.': { en: 'You can override the tone per comment in the composer card.', uk: 'У картці коментаря тон можна перевизначити для кожної відповіді.' }
};

function L(s) {
  var e = TCA_MSG[s];
  var out = (!e || TCA_LANG === 'ru') ? s : (e[TCA_LANG] != null ? e[TCA_LANG] : (e.en != null ? e.en : s));
  for (var i = 1; i < arguments.length; i++) out = String(out).split('$' + i).join(arguments[i]);
  return out;
}

// Localize static HTML: <tag data-i18n>Russian source</tag>, placeholders via
// data-i18n-ph, titles via data-i18n-title. The current text/attr is the key.
function tcaLocalizeDom(root) {
  root = root || document;
  root.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = L((el.textContent || '').trim()); });
  root.querySelectorAll('[data-i18n-ph]').forEach(function (el) { el.setAttribute('placeholder', L(el.getAttribute('placeholder') || '')); });
  root.querySelectorAll('[data-i18n-title]').forEach(function (el) { el.setAttribute('title', L(el.getAttribute('title') || '')); });
}

if (typeof self !== 'undefined') { self.TCA_MSG = TCA_MSG; self.TCA_LANG = TCA_LANG; self.L = L; self.tcaLocalizeDom = tcaLocalizeDom; }
