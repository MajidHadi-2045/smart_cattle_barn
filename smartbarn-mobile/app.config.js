module.exports = {
  "name": "smartbarn-mobile",
  "slug": "smartbarn-mobile-v2",
  "version": "1.0.0",
  "orientation": "portrait",
  "icon": "./assets/icon.png",
  "userInterfaceStyle": "light",
  "newArchEnabled": true,
  "splash": {
    "image": "./assets/splash-icon.png",
    "resizeMode": "contain",
    "backgroundColor": "#ffffff"
  },
  "ios": {
    "supportsTablet": true
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive-icon.png",
      "backgroundColor": "#ffffff"
    },
    "edgeToEdgeEnabled": true,
    "predictiveBackGestureEnabled": false,
    "package": "com.goodakun42.smartbarnmobile",
    "googleServicesFile": process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
    "permissions": [
      "NOTIFICATIONS",
      "POST_NOTIFICATIONS",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "INTERNET"
    ]
  },
  "plugins": [
    [
      "expo-notifications",
      {
        "icon": "./assets/icon.png",
        "color": "#059669",
        "sounds": []
      }
    ]
  ],
  "web": {
    "favicon": "./assets/favicon.png"
  },
  "extra": {
    "eas": {
      "projectId": "726d14a4-be20-4b36-9639-de47f4cb96c8"
    }
  }
};
