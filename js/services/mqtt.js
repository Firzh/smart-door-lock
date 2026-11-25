class MqttService {
  constructor() {
    this.client = null;
    this.status = 'disconnected';
    this.brokerUrl = '';
    this.topics = {
      COMMAND: '',
      STATUS: '',
      EVENT: '',
    };
    this.messageListeners = new Set();
    this.statusListeners = new Set();
    this.errorListeners = new Set();
  }

  setStatus(nextStatus) {
    this.status = nextStatus;
    this.statusListeners.forEach((cb) => cb(nextStatus));
  }

  emitError(error) {
    this.errorListeners.forEach((cb) => cb(error));
  }

  getStatus() {
    return this.status;
  }

  getBrokerUrl() {
    return this.brokerUrl;
  }

  getTopics() {
    return { ...this.topics };
  }

  connect(mqttConfig) {
    if (this.client) return;

    if (!window.mqtt || typeof window.mqtt.connect !== 'function') {
      console.error('MQTT.js SDK gagal dimuat dari CDN.');
      this.setStatus('error');
      this.emitError(new Error('MQTT.js SDK gagal dimuat dari CDN.'));
      return;
    }

    if (!mqttConfig || !mqttConfig.BROKER_URL) {
      this.setStatus('unconfigured');
      return;
    }

    const { BROKER_URL, OPTIONS = {}, TOPICS = {} } = mqttConfig;
    const isValidWsUrl = /^wss?:\/\/.+/.test(String(BROKER_URL || ''));

    if (!isValidWsUrl || !OPTIONS.clientId) {
      this.setStatus('unconfigured');
      return;
    }

    this.brokerUrl = BROKER_URL;
    this.topics = {
      COMMAND: TOPICS.COMMAND || '',
      STATUS: TOPICS.STATUS || '',
      EVENT: TOPICS.EVENT || '',
    };

    this.setStatus('connecting');

    const connectOptions = { ...OPTIONS };
    if (!connectOptions.username) delete connectOptions.username;
    if (!connectOptions.password) delete connectOptions.password;

    this.client = window.mqtt.connect(BROKER_URL, connectOptions);

    this.client.on('connect', () => {
      this.setStatus('connected');
      if (this.topics.STATUS) this.subscribe(this.topics.STATUS);
      if (this.topics.EVENT) this.subscribe(this.topics.EVENT);
    });

    this.client.on('reconnect', () => {
      this.setStatus('connecting');
    });

    this.client.on('offline', () => {
      this.setStatus('offline');
    });

    this.client.on('close', () => {
      this.setStatus('disconnected');
    });

    this.client.on('error', (err) => {
      console.error('MQTT connection error:', err?.message || err);
      this.setStatus('error');
      this.emitError(err);
    });

    this.client.on('message', (topic, payload) => {
      const message = payload.toString();
      this.messageListeners.forEach((cb) => cb(topic, message));
    });
  }

  disconnect() {
    if (!this.client) return;
    this.client.end(true);
    this.client = null;
    this.setStatus('disconnected');
  }

  subscribe(topic) {
    if (!this.client || !topic) return;
    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Gagal subscribe ke topik ${topic}:`, err?.message || err);
        this.emitError(new Error(`Gagal subscribe ke topik ${topic}`));
      }
    });
  }

  publish(topic, payload) {
    return new Promise((resolve) => {
      if (!topic) {
        resolve({ ok: false, error: new Error('Topik command MQTT belum tersedia.') });
        return;
      }

      if (!this.client || this.status !== 'connected') {
        resolve({ ok: false, error: new Error('MQTT belum terhubung.') });
        return;
      }

      const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
      this.client.publish(topic, message, { qos: 0 }, (err) => {
        if (err) {
          console.error(`Gagal publish ke topik ${topic}:`, err?.message || err);
          resolve({ ok: false, error: err });
          return;
        }
        resolve({ ok: true, error: null });
      });
    });
  }

  onMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  onError(callback) {
    this.errorListeners.add(callback);
    return () => this.errorListeners.delete(callback);
  }
}

export const mqttService = new MqttService();
