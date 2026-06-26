// Shared defaults for background worker + options page.
// The OpenRouter key is intentionally EMPTY here so the published (universal)
// build ships no secret — each user enters their own key in Settings. A local,
// gitignored config.local.js can preset orKey for your personal install.
var TCA_DEFAULTS = {
  orKey: '',
  model: 'google/gemini-2.5-flash-lite',
  language: 'auto',
  myHandle: '',
  pollEnabled: true,
  pollMinutes: 15,
  voice: `You are a thoughtful, friendly person commenting on Threads in your own authentic voice. You write like a real human - concise and specific, sharing genuine value, experience or a sincere question. First person, a little personality, never robotic or salesy.`,
  guidelines: `LANGUAGE: reply in the SAME language as the post.

GOAL: be genuinely helpful so people remember you. Add real value first - a concrete tip, your own experience, an insight, or a sincere question. The comment must be useful on its own.

TONE: match the post. Casual / joke / everyday posts -> short, with a little wit. Questions or serious/professional topics -> calm and concrete, like a helpful peer or mentor.

SELF-PROMO / PRODUCTS: only if you have configured your own products (in Settings) AND the topic genuinely fits. Then mention at most ONE, softly, like a peer's tip - never an ad. You may add its official link once. If nothing fits, just be helpful, no promo.

STYLE: first person, 1-3 short sentences, up to 480 characters. Use short hyphens "-" only, never long dashes. No hashtags, no @mentions, no "buy/subscribe/click". Respect the author.`
};

// Topics you care about — used to highlight relevant threads and rank suggestions.
// Stems are matched as substrings against a lowercased post (Cyrillic-safe, no \b).
var TCA_TOPICS = [
  { label: 'SEO', weight: 1.2, stems: ['seo','сео','пошукова оптиміз','поисковая оптимиз','просун','просуван','продвиж','продвин','розкрут','раскрут','позиці','позици','трафік','трафик','backlink','зворотн посилан','ссылк','serp','ранжув','keyword','ключов слов','ключев слов'] },
  { label: 'IT/Dev', weight: 1, stems: ['розробк','разработ','програм','программир','developer','backend','frontend','fullstack','devops','open source','github',' git ',' код',' code','no-code','nocode','low-code','saas','api ',' api','деплой','deploy','рефактор'] },
  { label: 'Стартапи', weight: 1, stems: ['стартап','startup','засновник','co-founder',' founder','mvp','венчур','інвест','инвест',' pitch','seed','indie','лонч','launch','запуск продукт','side project','pet-проєкт','pet project','пет-проєкт','свій продукт','свой продукт','над чим працю','над чем работа','what are you building','покажіть проєкт','покажите проект','поділіться проєкт','поделитесь проект'] },
  { label: 'WordPress', weight: 1.1, stems: ['wordpress','вордпрес','woocommerce','elementor','гутенберг','gutenberg','плагін','плагин',' wp ','wp-','шаблон сайт'] },
  { label: 'Додатки', weight: 1, stems: ['додаток','застосун','приложени','мобільн','мобильн',' app ','android',' ios ','flutter','react native','play market','app store','поділіться застосун','поділіться додатк','покажіть свій застос','поделитесь приложен','покажите приложен','show your app','drop your app','що ви створили','что вы создали','what did you build','what have you built','розробка додатк','розробку додатк','розробка застосун','розробити додаток','розробити застосунок','разработать приложение','разработка приложен','app development','mobile dev','шукаю розробник','потрібен розробник','ищу разработчика','нужен разработчик'] },
  { label: 'AI', weight: 1, stems: ['штучн інтелект','штучного інтелект','нейромереж','нейросет','машинне навч','машинное обуч',' ai ',' ai-','gpt','llm','chatgpt','gemini','автоматиз','промпт',' prompt'] },
  { label: 'Батьки/Діти', weight: 1, stems: ['батьк','вихован','дитин','діт','дитяч','родител','ребён','ребен','дети ','діти','школяр','підлітк','подростк','семья','parent','kids',' child','children','toddler','chores','домашні обов','домашние обяз','винагород','мотивувати дит','режим дитини','розпорядок дня'] },
  { label: 'Україна', weight: 0.5, stems: ['україн','українськ','київ','львів','харків','одеса','дніпро'] }
];

// "Lead" intent — someone asking for help / a tool / a recommendation / where to
// start. Commenting here is most likely to win clients + followers. Boosts score
// and flags the post when it ALSO matches one of your topics.
var TCA_INTENT = ['порад','підкаж','подскаж','посовет','шукаю','ищу','потрібен','потрібна','нужен','нужна','як просун','как продвин','how to rank','how do i','where do i','how to grow','немає трафік','нет трафика','low traffic','no traffic','які інструмент','какие инструмен','recommend','порекоменд','допоможіть','помогите','як знайти кліент','как найти клиент','де знайти кліент','more clients','більше клієнт','з чого почати','с чего начать','хто знає','кто знает','будь ласка','any tips','tips?','порадьте','підкажіть'];

// Returns { score, topics:[labels], top, lead }. score >= 1 means "relevant to me".
function tcaRelevance(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  let score = 0; const topics = [];
  for (const topic of TCA_TOPICS) {
    if (topic.stems.some(s => t.includes(s))) { topics.push(topic.label); score += (topic.weight || 1); }
  }
  const lead = topics.length > 0 && (t.indexOf('?') >= 0 || TCA_INTENT.some(s => t.includes(s)));
  if (lead) score += 1.2; // float client/follower opportunities to the top
  return { score, topics, top: topics[0] || '', lead };
}

// Classify an item: 'social' = a follow/like/repost notification (NOT commentable),
// 'reply' = someone replied/commented to you, 'post' = a normal post. Used to skip
// follows/likes on the Activity page (you only answer where someone replied to you).
function tcaNotifKind(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  if (/відповів|відповіла|відповіли|відповід\w*.{0,12}вам|прокоментува|replied|commented|ответил|ответила|ответили|прокомментир/.test(t)) return 'reply';
  if (/(під|под)пис\w*.{0,15}(на вас|вас|вами)|стеж\w*.{0,12}(вами|вас)|started following you|follow(ed|s)? you|вподоба\w*|сподоба\w*|оцінив\w*|оценил\w*|понрав\w*|liked your|like your|вам сподоба|вашу публика|вашу публікаці|репост|reposted|поділ\w*.{0,12}(ваш|вас)|поделил\w*.{0,12}(ваш|вас)|згада\w*.{0,10}вас|упомян\w*.{0,10}вас|mentioned you/.test(t)) return 'social';
  return 'post';
}

// "Showcase" post — a founder-networking thread inviting people to share what
// they build. Here we present a short portfolio of your products (not just one).
var TCA_SHOWCASE = ['що розробля','що ви розробля','що будуєте','що ти будуєш','чим займаєт','розкажіть про себе','розкажіть, що','поділіться проєкт','поділіться застосун','покажіть проєкт','покажіть, що','представте свій','пишіть, що','пишите, что','share what you','what are you building','what are you working on','what are you making','drop your','tell us what you','нетворкінг','networking','хто що буду','хто що створ','що створюєте'];
function tcaShowcase(text) {
  const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  return TCA_SHOWCASE.some(s => t.includes(s));
}

// Products — used by the "🎯 Под продукт" tab (find posts to write about a specific
// product) and to focus the generated comment on that product. `match` = keywords
// that mean "this post is a fit for the product"; `desc` = how to describe it.
// Empty by default (universal build). Configure your own products in config.local.js
// (each: {key, name, label, url, desc, match:[keywords]}). Drives the "Продукт" tab.
var TCA_PRODUCTS = [];
function tcaProductMatch(text, product) {
  if (!product || !product.match) return false;
  const t = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  return product.match.some(s => t.includes(s));
}

// Seed topics for writing posts to your OWN feed ("Мне в ленту" section).
var TCA_POST_TOPICS = [
  'A lesson I learned the hard way',
  'A tool that saved me hours',
  'An unpopular opinion in my field',
  'Behind the scenes of what I am building',
  'A mistake I see people make a lot',
  'Something I changed my mind about',
  'A small win worth sharing',
  'What I wish I knew when I started'
];

if (typeof self !== 'undefined') {
  self.TCA_DEFAULTS = TCA_DEFAULTS;
  self.TCA_TOPICS = TCA_TOPICS;
  self.TCA_INTENT = TCA_INTENT;
  self.TCA_PRODUCTS = TCA_PRODUCTS;
  self.TCA_POST_TOPICS = TCA_POST_TOPICS;
  self.tcaRelevance = tcaRelevance;
  self.tcaNotifKind = tcaNotifKind;
  self.tcaShowcase = tcaShowcase;
  self.tcaProductMatch = tcaProductMatch;
}
