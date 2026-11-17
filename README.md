# ENG HUB — Cairo University Engineering

منصة ENG HUB مبنية باستخدام React + TypeScript + Vite، بواجهة عربية RTL. تم ضبط هذه النسخة لتعمل بالتركيب الذي اخترته:

- **Firebase Spark (الخطة المجانية):** Authentication وCloud Firestore للنصوص وبيانات الحسابات والروابط والبيانات الوصفية فقط.
- **Cloudinary:** تخزين ورفع كل الملفات والصور والفيديوهات.
- **GitHub Pages:** استضافة الواجهة من المستودع `abdalrahmansadoon/ENG-HUB`.
- لا يستخدم المشروع Firebase Storage أو Cloud Functions أو Firebase Hosting، ولا يحتاج إلى ترقية Blaze لهذا التصميم.

> هذه نسخة تأسيسية MVP؛ ما زالت بعض الشاشات تعرض بيانات تجريبية، وبعض الوحدات المتقدمة المذكورة في المتطلبات تحتاج إلى استكمال قبل استخدامها كمنصة إنتاجية.

## التشغيل المحلي

يتطلب Node.js 20 أو أحدث.

```bash
npm install
cp .env.example .env.local
npm run dev
```

املأ متغيرات Firebase في `.env.local` بالقيم الخاصة بتطبيق الويب. ملف `.env.local` مستثنى من Git.

## إعداد Firebase المجاني

1. افتح مشروع Firebase `eng-hub-5c30a`.
2. من Authentication فعّل Email/Password وGoogle.
3. أنشئ Cloud Firestore في المنطقة التي اخترتها `me-central1`.
4. لا تنشئ Firebase Storage لهذا المشروع؛ كل الملفات الثنائية ستذهب إلى Cloudinary.
5. انشر قواعد Firestore والفهارس فقط:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

تأكد من اختيار المشروع `eng-hub-5c30a` عند ربط CLI. لن تحتاج إلى نشر Hosting أو Functions أو Storage.

### إضافة أول مدير وإضافة مدراء آخرين

تُقرأ صلاحيات المدير من مجموعة Firestore اسمها **`admins`**. كل بريد مدير له مستند مستقل، ومعرّف المستند هو البريد الإلكتروني نفسه كما يظهر في Firebase Authentication حرفياً.

أولاً، أنشئ الحساب من الموقع أو من Firebase Console > Authentication، ثم افتح Firestore Console وأنشئ مجموعة `admins`، وبعدها أضف مستنداً:

**مثال أول مدير (المدير الأعلى):**

- Collection: `admins`
- Document ID: `admin@example.com` — استبدله بالبريد الفعلي، وبنفس حالة الأحرف المعروضة في Authentication.
- Fields:

```json
{
  "email": "admin@example.com",
  "role": "super-admin",
  "active": true
}
```

أنشئ الحقول من واجهة Firebase باختيار الأنواع: `email` نص String، و`role` نص String، و`active` قيمة Boolean.

**لإضافة مدير عادي آخر:** أضف مستنداً جديداً في المجموعة نفسها، بمعرّف بريده الإلكتروني، واجعل `role` يساوي `admin` و`active` يساوي `true`:

```json
{
  "email": "another-admin@example.com",
  "role": "admin",
  "active": true
}
```

كرر ذلك لأي عدد من حسابات المديرين؛ لا تضع عدة إيميلات في مستند واحد. كل حساب يجب أن يكون موجوداً أولاً في Firebase Authentication، وأن يطابق البريد المكتوب في مستند `admins` تماماً.

- `super-admin`: مدير أعلى، يستطيع تعديل إعدادات النظام.
- `admin`: مدير عادي، يستطيع إدارة المنصة وتعديل إعدادات Cloudinary.
- `active: false`: تعطيل صلاحية ذلك المدير. ويمكن حذف مستنده لإلغاء الصلاحية تماماً.

الموقع لا يمنح صلاحية المدير بمجرد وجود `role: admin` في ملف المستخدم؛ يجب أن يوجد مستند مطابق في `admins`. كما أن قواعد Firestore تمنع الموقع من إنشاء أو تعديل مستندات `admins` بنفسه. أضف هذه المستندات من Firebase Console فقط. بعد تعديل صلاحية مستخدم، سجّله خروجاً ثم دخوله مجدداً حتى تُحدّث الواجهة الدور المعروض.

لشرح مصوّر بالخطوات النصية والحقول المطلوبة، راجع [`docs/ADMIN_SETUP.md`](docs/ADMIN_SETUP.md).

### أين تحفظ بيانات المدير؟

- مستند ملف المستخدم: `users/{firebase-auth-uid}`، ويُنشأ عند التسجيل، ويحتوي بيانات الطالب العادية.
- صلاحيات المدراء: `admins/{email}`، ومعرّف المستند هو البريد كما سبق.
- إعدادات Cloudinary: `systemSettings/cloudinary`، ويُنشئها الموقع عند حفظ الإعدادات من لوحة الإدارة.

## إعداد Cloudinary

تم إدخال إعدادات Cloudinary التي زوّدنا بها صاحب المشروع كقيم افتراضية في الواجهة:

- **Cloud Name:** `bkryyc0o`
- **Unsigned Upload Preset:** `eng_hub_unsigned`
- **Signing mode:** يجب أن يكون `Unsigned`
- **مجلد الأصول المقترح:** `eng-hub`

بعد نشر الموقع، سجّل الدخول بحساب `super-admin` أو `admin`، ثم افتح لوحة الإدارة > إعدادات Cloudinary. ستجد Cloud Name واسم الـ Preset مُعبّأين مسبقاً. راجع حدود الملفات، وتأكد من تفعيل الرفع، ثم اضغط **حفظ إعدادات Cloudinary** لحفظ الإعدادات في مستند `systemSettings/cloudinary` في Firestore. إذا لم يكن المستند موجوداً بعد، يستخدم التطبيق القيم الافتراضية الموجودة في الشيفرة.

تأكد في Cloudinary من أن الـ preset مضبوط على **Unsigned**، وأن Allowed formats يقتصر على الصيغ التي تحتاجها المنصة (PDF وDOC/DOCX وPPT/PPTX وXLS/XLSX وCSV وTXT وZIP وJPG/JPEG/PNG/WEBP/GIF وMP4/MOV/WEBM)، مع حدود حجم مناسبة ومجلد مخصص `eng-hub`. يرسل التطبيق طلب الرفع إلى هذا المجلد.

Cloud Name وUnsigned Preset قيمتان عامتان يستخدمهما المتصفح لرفع الملفات. **لا نحتاج Cloudinary API Key أو API Secret في الواجهة، ولا ترسل API Secret مطلقاً.**

تنبيه خصوصية: الرفع غير الموقّع وروابط الملفات الناتجة يمكن أن تكون عامة لمن يملك الرابط. لا ترفع ملفات شخصية أو سرية أو إجابات امتحانات خاصة بهذه الطريقة. حدود الحجم في الواجهة مساعدة فقط؛ يجب فرض الحدود والامتدادات نفسها داخل Upload Preset في Cloudinary لأنها الضابط الفعلي في جهة الخدمة.

## إعداد GitHub Pages

المستودع المقصود:

`https://github.com/abdalrahmansadoon/ENG-HUB`

أُضيف GitHub Actions workflow في `.github/workflows/deploy.yml`. بعد رفع ملفات المشروع إلى فرع `main` (أو `master`):

1. افتح GitHub Repository > Settings > Pages.
2. اجعل Build and deployment source هو **GitHub Actions**.
3. من Firebase Console > Authentication > Settings > Authorized domains أضف `abdalrahmansadoon.github.io` حتى يعمل تسجيل الدخول وGoogle Popup عبر GitHub Pages.
4. إعدادات Firebase العامة ومفتاح VAPID موجودة كقيم افتراضية في ملف النشر. يمكنك، عند الحاجة، إضافة متغيرات المستودع التالية في Settings > Secrets and variables > Actions > Variables لتجاوز القيم الافتراضية:

| Variable | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | `AIzaSyDWrjLwgj8r5JPWfzbOIAx76MF7ydCLOB8` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `eng-hub-5c30a.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `eng-hub-5c30a` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `366947709379` |
| `VITE_FIREBASE_APP_ID` | `1:366947709379:web:747b0aba2d08056b734d76` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-M2MPGMLD14` |
| `VITE_FIREBASE_VAPID_KEY` | `BOQHNvhjRYDfvLmPZ_bQrJ94F4z0gYiYlAuguOzvO13t32hsX2Gt_zBF4kNSl6RpUQy3vVdnz-zRGJg7_fNqDDg` |

هذه بيانات إعداد تطبيق الويب العامة، وليست مفتاح Service Account. لا تضف أي Service Account JSON أو Cloudinary API Secret إلى متغيرات `VITE_`.

5. كل Push إلى `main` أو `master` سيشغّل البناء والنشر تلقائياً. ويمكن تشغيله يدوياً من تبويب Actions.

الرابط المتوقع للموقع:

`https://abdalrahmansadoon.github.io/ENG-HUB/`

إعداد Vite وملفات PWA مضبوط على مسار المستودع `/ENG-HUB/`.

## إشعارات الويب (Firebase Cloud Messaging)

من صفحة الملف الشخصي اضغط **تفعيل إشعارات المتصفح** واسمح للموقع بإرسال الإشعارات. سيُسجّل المتصفح رمز FCM في `devices` داخل Firestore. استُخدم Service Worker مستقل تحت المسار `fcm/` حتى لا يتعارض مع Service Worker الخاص بتخزين واجهة PWA.
ملف Service Worker موجود في `public/fcm/firebase-messaging-sw.js` ويحتوي إعداد Firebase Web App العام لأن GitHub Pages يقدّم هذا الملف كما هو. عند الانتقال إلى مشروع Firebase آخر، حدّث إعداد التطبيق العام في هذا الملف أيضاً. مفتاح VAPID عام، لذلك يُضاف إلى متغيرات GitHub Actions باسم `VITE_FIREBASE_VAPID_KEY`، ولا تضع أي مفتاح خاص أو Service Account في الواجهة.

لإرسال إشعار تجريبي، استخدم Firebase Console > Messaging وأرسل رسالة اختبار إلى رمز الجهاز المسجل في `devices`. لا يرسل الموقع رسائل FCM مباشرة من المتصفح؛ إذ يتطلب الإرسال البرمجي خادماً موثوقاً، ولم نضف Cloud Functions أو خادماً خارجياً في هذا الإعداد المجاني.

## الخدمات غير المستخدمة في هذا الإعداد

- Firebase Storage: غير مستخدم؛ لا تحفظ فيه أي ملفات.
- Cloud Functions: غير مستخدمة؛ لا يتطلب المشروع نشرها على خطة Spark.
- Firebase Cloud Messaging: يدعم الموقع طلب إذن الإشعارات وتسجيل رمز المتصفح في Firestore واستقبال إشعارات الخلفية. يمكن إرسال رسائل الاختبار من Firebase Console؛ لا توجد وظيفة خادم للإرسال من داخل لوحة الإدارة في هذه النسخة.
- Firebase Hosting: غير مستخدم؛ النشر عبر GitHub Pages.

## أوامر المشروع

```bash
npm run dev       # تشغيل التطوير
npm run typecheck # فحص TypeScript
npm run build     # بناء نسخة الإنتاج
npm run preview   # معاينة نسخة الإنتاج
```
