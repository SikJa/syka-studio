/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/** Explain only the failure reported by yt-dlp; an HTTP failure is not proof of a login requirement. */
export function videoDownloadError(raw: string, limit = 600): string {
  if (/429|402|too many requests|rate.limit/i.test(raw)) {
    return 'La plataforma limitó las solicitudes de descarga. Esperá un rato y volvé a intentar, o adjuntá el archivo local. Este error no confirma que necesites iniciar sesión.';
  }
  if (/confirm.*bot|unusual traffic|captcha|automated requests|not a bot/i.test(raw)) {
    return 'La plataforma bloqueó el acceso público con una verificación antibot. No significa que el video sea privado ni que su duración exija iniciar sesión. Syka todavía no permite conectar tu sesión de esta plataforma; adjuntá el archivo local.';
  }
  if (/private video|video is private|members.only|age.restricted|confirm your age|sign in to confirm your age/i.test(raw)) {
    return 'Este video requiere una cuenta autorizada en la plataforma de origen. Syka todavía no permite conectar esa sesión. Adjuntá el archivo local; no se leyeron cookies de tu navegador.';
  }
  if (/login|log in|sign in|cookies/i.test(raw)) {
    return 'La plataforma pide una sesión para esta descarga. Syka todavía no permite conectar tu sesión de esta plataforma. Adjuntá el archivo local; no se leyeron cookies de tu navegador.';
  }
  if (/403|forbidden/i.test(raw)) {
    return 'La plataforma rechazó la descarga (403). No confirma que necesites iniciar sesión. Actualizá yt-dlp, probá de nuevo o adjuntá el archivo local.';
  }
  if (/No video formats found|requested format.*not available/i.test(raw)) {
    return 'La publicación no ofrece un formato de video descargable compatible con yt-dlp. Puede contener imágenes o elementos no disponibles. Probá un enlace individual o adjuntá el archivo local.';
  }
  return raw.replace(/https?:\/\/\S+/g, '[enlace]').slice(-limit);
}
