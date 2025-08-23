class Redis {
  constructor() {
    this.store = new Map();
  }
  async incr(key) {
    const val = (this.store.get(key) || 0) + 1;
    this.store.set(key, val);
    return val;
  }
  async pexpire() {
    return 'OK';
  }
  async get(key) {
    return this.store.get(key) ?? null;
  }
  async set(key, value) {
    this.store.set(key, value);
    return 'OK';
  }
  async del(key) {
    return this.store.delete(key);
  }
}

module.exports = { Redis };
