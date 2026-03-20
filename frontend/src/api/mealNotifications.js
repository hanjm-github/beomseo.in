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
