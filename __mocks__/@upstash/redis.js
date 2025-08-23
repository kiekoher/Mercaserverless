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
}

module.exports = { Redis };
