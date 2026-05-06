<?php
/**
 * send-reservation.php
 *
 * Verarbeitet das Reservierungsformular von index.html und sendet die Anfrage
 * inkl. Pilgerpass-Foto als E-Mail-Anhang an die Pilgerherberge.
 *
 * Erwartet POST (multipart/form-data) mit folgenden Feldern:
 *   name, email, checkin, checkout, room, guests, message, pilgerpass (file)
 *
 * Antwortet mit JSON: { ok: bool, message: string }
 *
 * Voraussetzungen am Server:
 *   - PHP 7.4+
 *   - PHP-mail() muss konfiguriert sein (sendmail / SMTP-Wrapper)
 *   - finfo-Extension (in PHP-Standard enthalten)
 */

// ────────────── Konfiguration ──────────────
$RECIPIENT       = 'pilgerherberge@psptirol.org';
$FROM_NAME       = 'Pilgerhaus St. Martin – Reservierung';
// From-Adresse SOLLTE eine Adresse der eigenen Domain sein, damit SPF/DKIM passen.
// Anpassen, falls anders gewünscht (z. B. noreply@psptirol.org).
$FROM_ADDRESS    = $RECIPIENT;
$MAX_FILE_BYTES  = 8 * 1024 * 1024; // 8 MB
$ALLOWED_MIMES   = [
    'image/jpeg', 'image/jpg', 'image/png',
    'image/heic', 'image/heif', 'image/webp',
];

header('Content-Type: application/json; charset=UTF-8');

function respond(bool $ok, string $message, int $code = 200): void {
    http_response_code($code);
    echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

function clean_input($value): string {
    return trim((string) ($value ?? ''));
}

function has_header_injection(string $value): bool {
    return preg_match('/[\r\n]/', $value) === 1;
}

// ────────────── Method-Check ──────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'Nur POST-Anfragen erlaubt.', 405);
}

// ────────────── Honeypot (Spam-Schutz) ──────────────
// Versteckte Felder, die ein menschlicher Nutzer leer lässt.
if (!empty($_POST['website']) || !empty($_POST['phone_extra'])) {
    // Bots verraten sich -> wir tun so, als wäre alles ok, senden aber nichts.
    respond(true, 'Vielen Dank! Ihre Anfrage wurde übermittelt.');
}

// ────────────── Eingaben einlesen ──────────────
$name     = clean_input($_POST['name']     ?? '');
$email    = clean_input($_POST['email']    ?? '');
$checkin  = clean_input($_POST['checkin']  ?? '');
$checkout = clean_input($_POST['checkout'] ?? '');
$room     = clean_input($_POST['room']     ?? '');
$guests   = clean_input($_POST['guests']   ?? '');
$message  = clean_input($_POST['message']  ?? '');

// ────────────── Validierung ──────────────
if ($name === '') {
    respond(false, 'Bitte geben Sie Ihren Namen an.', 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(false, 'Bitte geben Sie eine gültige E-Mail-Adresse an.', 400);
}
if ($checkin === '' || $checkout === '') {
    respond(false, 'Bitte geben Sie Anreise- und Abreisedatum an.', 400);
}
if ($checkout <= $checkin) {
    respond(false, 'Das Abreisedatum muss nach dem Anreisedatum liegen.', 400);
}
foreach ([$name, $email, $checkin, $checkout, $room, $guests] as $field) {
    if (has_header_injection($field)) {
        respond(false, 'Ungültige Zeichen in den Eingaben erkannt.', 400);
    }
}

// ────────────── Datei prüfen ──────────────
if (empty($_FILES['pilgerpass']) || !is_array($_FILES['pilgerpass'])) {
    respond(false, 'Bitte laden Sie ein Foto Ihres Pilgerpasses hoch.', 400);
}

$file = $_FILES['pilgerpass'];

if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
    $errors = [
        UPLOAD_ERR_INI_SIZE   => 'Die Datei ist größer als das Server-Limit.',
        UPLOAD_ERR_FORM_SIZE  => 'Die Datei ist größer als das Form-Limit.',
        UPLOAD_ERR_PARTIAL    => 'Die Datei wurde nur teilweise hochgeladen.',
        UPLOAD_ERR_NO_FILE    => 'Bitte laden Sie ein Foto Ihres Pilgerpasses hoch.',
        UPLOAD_ERR_NO_TMP_DIR => 'Server-Konfigurationsfehler (kein Temp-Verzeichnis).',
        UPLOAD_ERR_CANT_WRITE => 'Server konnte Datei nicht speichern.',
        UPLOAD_ERR_EXTENSION  => 'Eine PHP-Erweiterung hat den Upload abgebrochen.',
    ];
    $code = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    respond(false, $errors[$code] ?? 'Fehler beim Datei-Upload.', 400);
}

if (!is_uploaded_file($file['tmp_name'])) {
    respond(false, 'Ungültige Datei-Übertragung.', 400);
}

if ($file['size'] <= 0 || $file['size'] > $MAX_FILE_BYTES) {
    $maxMb = (int) ($MAX_FILE_BYTES / 1024 / 1024);
    respond(false, "Das Foto ist zu groß (max. {$maxMb} MB).", 400);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime  = $finfo ? finfo_file($finfo, $file['tmp_name']) : null;
if ($finfo) finfo_close($finfo);

if (!$mime || !in_array(strtolower($mime), $ALLOWED_MIMES, true)) {
    respond(false, 'Die Datei muss ein Bild sein (JPEG, PNG, HEIC, WEBP).', 400);
}

$attachment = @file_get_contents($file['tmp_name']);
if ($attachment === false) {
    respond(false, 'Foto konnte nicht gelesen werden. Bitte erneut versuchen.', 500);
}

// Sicherer Dateiname für den Anhang
$origName = (string) ($file['name'] ?? 'pilgerpass');
$safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($origName));
if ($safeName === '' || $safeName === '.' || $safeName === '..') {
    $safeName = 'pilgerpass.jpg';
}

// ────────────── E-Mail zusammenbauen ──────────────
$subjectRaw = "Reservierungsanfrage – " .
    ($room !== '' ? ucfirst($room) : 'Zimmer') .
    " ($checkin bis $checkout)";
// MIME-Encoded-Word für UTF-8 im Betreff
$subject = '=?UTF-8?B?' . base64_encode($subjectRaw) . '?=';

$boundary  = '----=_PSP_BOUNDARY_' . bin2hex(random_bytes(12));
$eol       = "\r\n";

$bodyText  = "Neue Reservierungsanfrage über die Homepage" . $eol . $eol;
$bodyText .= "Name:      $name" . $eol;
$bodyText .= "E-Mail:    $email" . $eol;
$bodyText .= "Anreise:   $checkin" . $eol;
$bodyText .= "Abreise:   $checkout" . $eol;
$bodyText .= "Zimmer:    " . ($room !== '' ? $room : 'Nicht angegeben') . $eol;
$bodyText .= "Gäste:     " . ($guests !== '' ? $guests : '-') . $eol;
$bodyText .= $eol;
$bodyText .= "Nachricht:" . $eol;
$bodyText .= ($message !== '' ? $message : '(keine Nachricht)') . $eol . $eol;
$bodyText .= "── Foto des Pilgerpasses ist als Anhang beigefügt ──" . $eol;

$body  = "--$boundary" . $eol;
$body .= "Content-Type: text/plain; charset=UTF-8" . $eol;
$body .= "Content-Transfer-Encoding: 8bit" . $eol . $eol;
$body .= $bodyText . $eol;

$body .= "--$boundary" . $eol;
$body .= "Content-Type: $mime; name=\"$safeName\"" . $eol;
$body .= "Content-Transfer-Encoding: base64" . $eol;
$body .= "Content-Disposition: attachment; filename=\"$safeName\"" . $eol . $eol;
$body .= chunk_split(base64_encode($attachment)) . $eol;

$body .= "--$boundary--" . $eol;

$headers = [
    'From: ' . sprintf('%s <%s>', $FROM_NAME, $FROM_ADDRESS),
    'Reply-To: ' . sprintf('%s <%s>', $name, $email),
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
    'X-Mailer: PSP-Reservation-Form',
];

// ────────────── Versand ──────────────
$success = @mail($RECIPIENT, $subject, $body, implode($eol, $headers));

if ($success) {
    respond(true, 'Vielen Dank! Ihre Anfrage wurde gesendet. Wir melden uns in Kürze bei Ihnen.');
}

respond(
    false,
    'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es später noch einmal ' .
    'oder schreiben Sie uns direkt an ' . $RECIPIENT . '.',
    500
);
