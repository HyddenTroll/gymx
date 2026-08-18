import webpush from "web-push";

/**
 * Configure web-push avec les clés VAPID depuis les variables d'environnement.
 * Les clés ne sont jamais codées en dur dans le dépôt.
 */
export function configureWebPush(): void {
  const subject = process.env.VAPID_SUBJECT || "mailto:moi@gymx.local";
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  }
}
