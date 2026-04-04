/**
 * @file src/api/mealNotifications.js
 * @description Device-scoped meal reminder subscription client.
 * The backend stores subscriptions by installationId instead of user session,
 * so the frontend always talks in terms of the current PWA/browser instance.
 */
import { fastapiApi } from './fastapiClient';


function getMealNotificationErrorMessage(error, fallbackMessage) {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage.trim()) {
    return serverMessage.trim();
  }

  const directMessage = error?.message;
  if (typeof directMessage === 'string' && directMessage.trim()) {
    return directMessage.trim();
  }

  return fallbackMessage;
}


export const mealNotificationsApi = {
  async getSubscription(installationId) {
    try {
      // The server returns { item } so callers can distinguish "no record yet"
      // from transport or validation failures without another sentinel value.
      const response = await fastapiApi.get('/api/school-info/meals/notifications/subscription', {
        params: { installationId },
      });
      return response.data?.item;
    } catch (error) {
      throw new Error(
        getMealNotificationErrorMessage(
          error,
          '급식 알림 설정을 불러오지 못했어요.'
        )
      );
    }
  },

  async saveSubscription(payload) {
    try {
      // Upsert semantics let the frontend treat first-time enable and later
      // edits as the same operation.
      const response = await fastapiApi.put(
        '/api/school-info/meals/notifications/subscription',
        payload
      );
      return response.data?.item;
    } catch (error) {
      throw new Error(
        getMealNotificationErrorMessage(
          error,
          '급식 알림 설정을 저장하지 못했어요.'
        )
      );
    }
  },

  async deleteSubscription(installationId) {
    try {
      // Delete fully unregisters the current device instead of toggling a flag.
      await fastapiApi.delete('/api/school-info/meals/notifications/subscription', {
        params: { installationId },
      });
    } catch (error) {
      throw new Error(
        getMealNotificationErrorMessage(
          error,
          '급식 알림 설정을 삭제하지 못했어요.'
        )
      );
    }
  },
};
