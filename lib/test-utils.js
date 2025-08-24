import { jest } from '@jest/globals';

/**
 * Creates a mock Next.js API request object.
 * @param {string} method - The HTTP method (e.g., 'GET', 'POST').
 * @param {object} body - The request body.
 * @param {object} query - The request query parameters.
 * @returns {object} A mock request object.
 */
export function createMockReq(method = 'GET', body = {}, query = {}) {
  return {
    method,
    body,
    query,
    headers: {
      'content-type': 'application/json',
    },
  };
}

/**
 * Creates a mock Next.js API response object with helpers for testing.
 * @returns {object} A mock response object.
 */
export function createMockRes() {
  const res = {
    statusCode: 0,
    _headers: {},
    _data: null,
    _ended: false,
    setHeader: (k, v) => {
      res._headers[k.toLowerCase()] = v;
    },
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (payload) => {
      res.setHeader('content-type', 'application/json');
      res._data = JSON.stringify(payload);
      return res;
    },
    end: (payload) => {
      if (payload) res._data = payload;
      res._ended = true;
      return res;
    },
    // Test helpers
    _getStatusCode() {
      return res.statusCode;
    },
    _getHeaders() {
      return res._headers;
    },
    _getData() {
      return res._data;
    },
    _getJSONData() {
      return JSON.parse(res._data);
    },
  };
  return res;
}
