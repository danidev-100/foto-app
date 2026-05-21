import { config } from '../config.js';

export function getBankDetails(req, res) {
  return res.json({
    success: true,
    data: {
      bankName: config.bankName,
      cbu: config.bankCbu,
      alias: config.bankAlias,
      holder: config.bankHolder,
      cuit: config.bankCuit,
    },
  });
}
