# Класний простір

Шкільна платформа: вхід, школи, розклад, завдання, оцінки, оголошення, чат.

Дані й акаунти зберігаються у **Firebase** (проєкт `schooleballs`): Authentication + Cloud Firestore. Власний сервер і Postgres не потрібні.

## Локально

```bash
npm install
npm run dev
```

## Хостинг

Залийте сайт на Firebase Hosting, GitHub Pages або Vercel (команда збірки `npm run build`).

У Firebase Console → Authentication → Settings → Authorized domains додайте адресу сайту. Без цього вхід з нової адреси не спрацює.

Після входу учень може натиснути «Відкрити демо як Максим». Учитель створює школу — клас 8-А уже заповнений.
