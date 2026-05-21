import { healthResponse } from '../lib/response.js';

export function healthCheck(_req, res) {
  return healthResponse(res);
}
