
// =====================================
// SUPABASE STATIC CONFIGURATION
// =====================================

export const CONFIG = {
  SUPABASE_URL: 'https://sakhzygdgrgpaqpdbcgy.supabase.co',

  SUPABASE_ANON_KEY:
    'sb_publishable_9SrTF-Jqr5XAX_ljmUaSrg_nyK8jXz7',

  // Supabase tables
  TABLES: {
    CARDS: 'authorized_cards',
    LOGS: 'access_logs',
    APP_CONFIG: 'app_config',
  },

  APP: {
    REQUIRE_AUTH: true,
    UID_MIN_LENGTH: 8,
    UID_MAX_LENGTH: 20,
  },
};


// =====================================
// LOAD CONFIGURATION FROM SUPABASE
// =====================================

export async function loadAppConfig(supabase) {

  const { data, error } = await supabase
    .from(CONFIG.TABLES.APP_CONFIG)
    .select('key, value');

  if (error) {
    throw new Error(
      `Failed to load app_config: ${error.message}`
    );
  }

  // Convert database rows into key-value object
  const settings = {};

  for (const item of data) {
    settings[item.key] = item.value;
  }

  // Required configuration
  const requiredKeys = [
    'device_id',
    'mqtt_ws_url',
    'mqtt_username',
    'mqtt_password',
    'mqtt_topic_command',
    'mqtt_topic_status',
    'mqtt_topic_event',
  ];

  for (const key of requiredKeys) {
    if (
      !settings[key] ||
      settings[key].trim() === '-'
    ) {
      throw new Error(
        `Missing configuration in app_config: ${key}`
      );
    }
  }

  // Return runtime configuration
  return {
    DEVICE_ID: settings.device_id,

    MQTT: {
      BROKER_URL: settings.mqtt_ws_url,

      OPTIONS: {
        clientId:
          `smartdoor_web_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,

        username: settings.mqtt_username,
        password: settings.mqtt_password,

        clean: true,
        reconnectPeriod: 4000,
        connectTimeout: 10000,
      },

      TOPICS: {
        COMMAND: settings.mqtt_topic_command,
        STATUS: settings.mqtt_topic_status,
        EVENT: settings.mqtt_topic_event,
      },
    },
  };
}
