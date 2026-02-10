/**
 * Notifications API: request permission, send notification, test button, click opens app.
 */

/**
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
export function requestPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

/**
 * Send a browser notification. On click, focus app.
 * @param {string} title
 * @param {string} [body]
 */
export function sendNotification(title, body = '') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const n = new Notification(title, {
    body,
    icon: 'icons/icon.svg',
    tag: 'currency-notifier',
  });
  n.onclick = () => {
    n.close();
    window.focus();
    if (window.location.href) window.location.reload();
  };
}

/**
 * Send a test notification (e.g. for Settings button).
 */
export function sendTestNotification() {
  sendNotification('Rate Notifier', 'This is a test notification. You’re all set!');
}
