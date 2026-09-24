/**
 * Класний простір — завантаження фото у Google Диск.
 *
 * Як увімкнути:
 * 1. Відкрийте https://script.google.com і створіть новий проєкт.
 * 2. Вставте цей файл замість Code.gs.
 * 3. Змініть TOKEN на свій секрет (той самий впишіть у Налаштуваннях сайту).
 * 4. Розгорніть: Deploy → New deployment → Web app.
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Дозвольте доступ до Диска, скопіюйте URL, що закінчується на /exec,
 *    і вставте його в Налаштуваннях сайту разом із TOKEN.
 *
 * Папка: https://drive.google.com/drive/folders/1yPSsX35FgoVxrzNngoPByCCAQEpdjWdX
 */
var FOLDER_ID = "1yPSsX35FgoVxrzNngoPByCCAQEpdjWdX";
var TOKEN = "cW4arF1fbEqnS9o";
var MAX_BYTES = 6 * 1024 * 1024;

function doGet() {
  return json({ ok: true, service: "klasnyi-drive" });
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "";
    var body = JSON.parse(raw || "{}");
    if (TOKEN && body.token !== TOKEN) return json({ ok: false, error: "Forbidden" });
    var mime = String(body.mimeType || "");
    if (mime.indexOf("image/") !== 0) return json({ ok: false, error: "Only images" });
    var data = String(body.data || "").replace(/^data:[^;]+;base64,/, "");
    if (!data) return json({ ok: false, error: "Empty" });
    var bytes = Utilities.base64Decode(data);
    if (bytes.length > MAX_BYTES) return json({ ok: false, error: "Too large" });
    var folder = DriveApp.getFolderById(FOLDER_ID);
    var name = sanitize(body.name || "photo") + "-" + Date.now() + ext(mime);
    var file = folder.createFile(Utilities.newBlob(bytes, mime, name));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var id = file.getId();
    return json({
      ok: true,
      id: id,
      url: "https://lh3.googleusercontent.com/d/" + id,
      view: "https://drive.google.com/file/d/" + id + "/view",
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sanitize(name) {
  return String(name).replace(/[^\w.\-]+/g, "_").slice(0, 60);
}

function ext(mime) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".jpg";
}
